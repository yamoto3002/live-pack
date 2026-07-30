import { authenticatedUser, json, preflight, publicError, serviceClient, text } from '../_shared/http.ts';
import { sha256, verifyPasscode } from '../_shared/crypto.ts';

const PRESET_FIELDS: Record<string, string[]> = {
  performer: ['title', 'number', 'version', 'duration', 'key', 'bpm', 'click', 'sync', 'start', 'end', 'public_notes', 'role_notes', 'cues', 'links'],
  staff: ['title', 'number', 'duration', 'cues', 'staff_notes', 'total', 'timeline'],
  venue: ['title', 'number', 'duration', 'cues', 'total', 'venue', 'date', 'time_limit'],
  print: ['title', 'number', 'duration', 'total'],
  full: ['title', 'number', 'version', 'duration', 'key', 'bpm', 'click', 'sync', 'start', 'end', 'public_notes', 'role_notes', 'staff_notes', 'cues', 'links', 'total', 'venue', 'date', 'time_limit'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return publicError(req, 405);
  try {
    const client = serviceClient();
    const body = await req.json();
    const token = text(body.token, 200);
    const passcode = text(body.passcode, 120);
    if (!token) return publicError(req);

    const { data: link } = await client.from('share_links').select('*').eq('token', token).maybeSingle();
    if (!link) return publicError(req);

    const ipSource = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = await sha256(`${link.id}:${ipSource}`);
    const recentSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await client.from('share_access_logs').select('id', { count: 'exact', head: true })
      .eq('share_link_id', link.id).eq('ip_hash', ipHash).gte('created_at', recentSince);
    if ((count || 0) > 30) return publicError(req, 429);

    const user = await authenticatedUser(req);
    let deniedReason = '';
    if (!link.enabled) deniedReason = 'denied';
    else if (link.paused_at) deniedReason = 'paused';
    else if (link.expires_at && new Date(link.expires_at) <= new Date()) deniedReason = 'expired';
    else if (link.login_required && !user) deniedReason = 'denied';
    else if (link.passcode_hash && !passcode) deniedReason = 'passcode_required';
    else if (!await verifyPasscode(passcode, link.passcode_hash)) deniedReason = 'denied';

    if (deniedReason) {
      await client.from('share_access_logs').insert({
        share_link_id: link.id, viewer_id: user?.id || null, result: deniedReason,
        ip_hash: ipHash, user_agent: text(req.headers.get('user-agent'), 500),
      });
      if (deniedReason === 'passcode_required') return json(req, { status: deniedReason });
      if (deniedReason === 'expired' || deniedReason === 'paused') {
        return json(req, { status: deniedReason });
      }
      if (link.login_required && !user) return json(req, { status: 'login_required' });
      if (link.passcode_hash && passcode) return json(req, { status: 'invalid_passcode' });
      return publicError(req);
    }

    const fields = link.preset === 'custom'
      ? Object.entries(link.view_fields || {}).filter(([, enabled]) => enabled).map(([name]) => name)
      : PRESET_FIELDS[link.preset] || PRESET_FIELDS.performer;

    const [{ data: live }, { data: entries }, { data: cues }, { data: notes }] = await Promise.all([
      client.from('lives').select('id, title, live_date, venue, time_limit_sec, status').eq('id', link.live_id).single(),
      client.from('setlist_entries').select('id, song_id, song_version_id, sort_order, title_snapshot, version_name_snapshot, duration_sec, musical_key, bpm, has_click, has_sync, start_type, end_type, memo').eq('live_id', link.live_id).order('sort_order'),
      client.from('setlist_cues').select('id, after_entry_id, sort_order, cue_type, title, duration_sec, transition_type, trigger_person, operator_name, playback, memo').eq('live_id', link.live_id).order('sort_order'),
      client.from('notes').select('setlist_entry_id, visibility, target_role_name, body').eq('live_id', link.live_id).neq('visibility', 'private'),
    ]);

    const visibleNotes = (notes || []).filter((note) => {
      if (note.visibility === 'host') return false;
      if (note.visibility === 'staff') return fields.includes('staff_notes');
      if (note.visibility === 'role') return fields.includes('role_notes');
      if (note.visibility === 'public') return fields.includes('public_notes');
      return false;
    });

    const safeLive = {
      id: live?.id,
      title: live?.title,
      status: live?.status,
      ...(fields.includes('date') ? { live_date: live?.live_date } : {}),
      ...(fields.includes('venue') ? { venue: live?.venue } : {}),
      ...(fields.includes('time_limit') ? { time_limit_sec: live?.time_limit_sec } : {}),
    };
    const safeEntries = (entries || []).map((entry) => ({
      id: entry.id,
      sort_order: entry.sort_order,
      ...(fields.includes('title') ? { title_snapshot: entry.title_snapshot } : {}),
      ...(fields.includes('version') ? { version_name_snapshot: entry.version_name_snapshot } : {}),
      ...(fields.includes('duration') ? { duration_sec: entry.duration_sec } : {}),
      ...(fields.includes('key') ? { musical_key: entry.musical_key } : {}),
      ...(fields.includes('bpm') ? { bpm: entry.bpm } : {}),
      ...(fields.includes('click') ? { has_click: entry.has_click } : {}),
      ...(fields.includes('sync') ? { has_sync: entry.has_sync } : {}),
      ...(fields.includes('start') ? { start_type: entry.start_type } : {}),
      ...(fields.includes('end') ? { end_type: entry.end_type } : {}),
      notes: visibleNotes.filter((note) => note.setlist_entry_id === entry.id),
    }));
    const safeCues = fields.includes('cues') ? (cues || []).map((cue) => ({
      id: cue.id,
      after_entry_id: cue.after_entry_id,
      sort_order: cue.sort_order,
      cue_type: cue.cue_type,
      title: cue.title,
      duration_sec: cue.duration_sec,
      transition_type: cue.transition_type,
      trigger_person: cue.trigger_person,
      operator_name: cue.operator_name,
      playback: cue.playback,
    })) : [];

    const payload = {
      link: {
        id: link.id, label: link.label,
        preset: link.preset, fields, allow_edit_requests: link.allow_edit_requests,
        allow_information_requests: link.allow_information_requests,
        allow_chat: link.allow_chat, allow_print: link.allow_print,
        allow_pdf: link.allow_pdf, allow_jpeg: link.allow_jpeg,
        expires_at: link.expires_at,
      },
      live: safeLive,
      entries: safeEntries,
      cues: safeCues,
      viewer: { signed_in: Boolean(user) },
    };

    await Promise.all([
      client.from('share_access_logs').insert({
        share_link_id: link.id, viewer_id: user?.id || null, result: 'success',
        ip_hash: ipHash, user_agent: text(req.headers.get('user-agent'), 500),
      }),
      client.from('share_links').update({
        last_accessed_at: new Date().toISOString(),
        access_count: Number(link.access_count || 0) + 1,
      }).eq('id', link.id),
    ]);
    return json(req, payload);
  } catch (error) {
    console.error('[resolve-share-link]', error);
    return publicError(req);
  }
});
