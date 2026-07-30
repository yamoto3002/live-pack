begin;

alter table public.share_links
  add column if not exists recipient_name text,
  add column if not exists preset text not null default 'performer',
  add column if not exists view_fields jsonb not null default '{}'::jsonb,
  add column if not exists allow_edit_requests boolean not null default false,
  add column if not exists allow_information_requests boolean not null default true,
  add column if not exists allow_chat boolean not null default false,
  add column if not exists allow_print boolean not null default true,
  add column if not exists allow_pdf boolean not null default true,
  add column if not exists allow_jpeg boolean not null default false,
  add column if not exists login_required boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists invite_message text,
  add column if not exists last_accessed_at timestamptz,
  add column if not exists access_count bigint not null default 0;

alter table public.share_links
  add constraint share_links_recipient_name_not_blank
    check (recipient_name is null or btrim(recipient_name) <> ''),
  add constraint share_links_preset_valid
    check (preset in ('performer', 'staff', 'venue', 'print', 'full', 'custom')),
  add constraint share_links_view_fields_object
    check (jsonb_typeof(view_fields) = 'object'),
  add constraint share_links_access_count_nonnegative
    check (access_count >= 0);

create table public.share_access_logs (
  id bigint generated always as identity primary key,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  result text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint share_access_logs_result_valid
    check (result in ('success', 'not_found', 'passcode_required', 'denied', 'expired', 'paused'))
);

create index share_access_logs_link_created_idx
  on public.share_access_logs (share_link_id, created_at desc);
create index share_access_logs_viewer_idx
  on public.share_access_logs (viewer_id)
  where viewer_id is not null;

create table public.share_access_requests (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null,
  message text,
  requested_sections text[] not null default '{}',
  status text not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_access_requests_type_valid check (request_type in ('edit', 'information')),
  constraint share_access_requests_status_valid
    check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  constraint share_access_requests_message_not_blank
    check (message is null or btrim(message) <> '')
);

create unique index share_access_requests_one_pending_idx
  on public.share_access_requests (share_link_id, requester_id, request_type)
  where status = 'pending';
create index share_access_requests_live_status_idx
  on public.share_access_requests (live_id, status, created_at desc);
create index share_access_requests_requester_idx
  on public.share_access_requests (requester_id, created_at desc);
create index share_access_requests_decided_by_idx
  on public.share_access_requests (decided_by)
  where decided_by is not null;

create table public.live_access_grants (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  source_request_id uuid references public.share_access_requests (id) on delete set null,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_access_grants_permission_valid
    check (permission in ('viewer', 'temporary_editor', 'permanent_editor')),
  constraint live_access_grants_expiry_valid
    check (permission <> 'temporary_editor' or expires_at is not null)
);

create unique index live_access_grants_active_user_live_idx
  on public.live_access_grants (live_id, user_id)
  where active;
create index live_access_grants_user_active_idx
  on public.live_access_grants (user_id, active, expires_at);
create index live_access_grants_granted_by_idx
  on public.live_access_grants (granted_by);
create index live_access_grants_source_request_idx
  on public.live_access_grants (source_request_id)
  where source_request_id is not null;

create table public.share_conversations (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint share_conversations_link_unique unique (share_link_id),
  constraint share_conversations_live_link_unique unique (id, live_id)
);

create index share_conversations_live_idx on public.share_conversations (live_id);

create table public.share_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.share_conversations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  message_type text not null default 'message',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_messages_body_not_blank check (btrim(body) <> ''),
  constraint share_messages_type_valid
    check (message_type in ('message', 'system', 'access_request', 'access_result'))
);

create index share_messages_conversation_created_idx
  on public.share_messages (conversation_id, created_at);
create index share_messages_author_idx
  on public.share_messages (author_id, created_at desc);

create table public.share_personal_notes (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_personal_notes_user_live_unique unique (live_id, user_id),
  constraint share_personal_notes_body_not_blank check (btrim(body) <> '')
);

create index share_personal_notes_user_idx
  on public.share_personal_notes (user_id, updated_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_not_blank check (btrim(type) <> ''),
  constraint notifications_title_not_blank check (btrim(title) <> '')
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create or replace function live_pack_private.can_access_live(target_live_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    live_pack_private.is_band_member(
      live_pack_private.band_id_for_live($1)
    )
    or exists (
      select 1
      from public.live_access_grants
      where live_id = $1
        and user_id = (select auth.uid())
        and active
        and (expires_at is null or expires_at > now())
    );
$$;

create or replace function live_pack_private.can_edit_live(target_live_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    live_pack_private.has_band_permission(
      live_pack_private.band_id_for_live($1),
      array['owner', 'admin', 'editor']
    )
    or exists (
      select 1
      from public.live_access_grants
      where live_id = $1
        and user_id = (select auth.uid())
        and permission in ('temporary_editor', 'permanent_editor')
        and active
        and (expires_at is null or expires_at > now())
    );
$$;

create trigger share_access_requests_set_updated_at
before update on public.share_access_requests
for each row execute function live_pack_private.set_updated_at();
create trigger live_access_grants_set_updated_at
before update on public.live_access_grants
for each row execute function live_pack_private.set_updated_at();
create trigger share_messages_set_updated_at
before update on public.share_messages
for each row execute function live_pack_private.set_updated_at();
create trigger share_personal_notes_set_updated_at
before update on public.share_personal_notes
for each row execute function live_pack_private.set_updated_at();

alter table public.share_access_logs enable row level security;
alter table public.share_access_requests enable row level security;
alter table public.live_access_grants enable row level security;
alter table public.share_conversations enable row level security;
alter table public.share_messages enable row level security;
alter table public.share_personal_notes enable row level security;
alter table public.notifications enable row level security;

revoke all on table
  public.share_access_logs,
  public.share_access_requests,
  public.live_access_grants,
  public.share_conversations,
  public.share_messages,
  public.share_personal_notes,
  public.notifications
from public, anon, authenticated;

grant select, insert, update on public.share_access_requests to authenticated;
grant select on public.live_access_grants to authenticated;
grant select on public.share_conversations to authenticated;
grant select, insert, update on public.share_messages to authenticated;
grant select, insert, update, delete on public.share_personal_notes to authenticated;
grant select, update on public.notifications to authenticated;

grant select (
  id, live_id, token, label, scope, target_member_id, target_role_name,
  enabled, expires_at, created_by, created_at, updated_at, recipient_name,
  preset, view_fields, allow_edit_requests, allow_information_requests,
  allow_chat, allow_print, allow_pdf, allow_jpeg, login_required, paused_at,
  invite_message, last_accessed_at, access_count
) on public.share_links to authenticated;

grant update (
  label, scope, target_member_id, target_role_name, enabled, expires_at,
  recipient_name, preset, view_fields, allow_edit_requests,
  allow_information_requests, allow_chat, allow_print, allow_pdf,
  allow_jpeg, login_required, paused_at, invite_message
) on public.share_links to authenticated;

create policy access_requests_select_own_or_host
on public.share_access_requests
for select to authenticated
using (
  requester_id = (select auth.uid())
  or live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin']
  )
);

create policy access_requests_insert_self
on public.share_access_requests
for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and status = 'pending'
);

create policy access_requests_update_host
on public.share_access_requests
for update to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin']
  )
  or (requester_id = (select auth.uid()) and status = 'pending')
)
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin']
  )
  or requester_id = (select auth.uid())
);

create policy live_grants_select_self_or_host
on public.live_access_grants
for select to authenticated
using (
  user_id = (select auth.uid())
  or live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin']
  )
);

create policy conversations_select_live_access
on public.share_conversations
for select to authenticated
using (live_pack_private.can_access_live(live_id));

create policy messages_select_live_access
on public.share_messages
for select to authenticated
using (
  exists (
    select 1 from public.share_conversations
    where share_conversations.id = conversation_id
      and live_pack_private.can_access_live(share_conversations.live_id)
  )
);

create policy messages_insert_author
on public.share_messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and message_type = 'message'
  and exists (
    select 1 from public.share_conversations
    join public.share_links on share_links.id = share_conversations.share_link_id
    where share_conversations.id = conversation_id
      and share_links.allow_chat
      and share_links.enabled
      and share_links.paused_at is null
      and live_pack_private.can_access_live(share_conversations.live_id)
  )
);

create policy messages_soft_delete_author_or_host
on public.share_messages
for update to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.share_conversations
    where share_conversations.id = conversation_id
      and live_pack_private.has_band_permission(
        live_pack_private.band_id_for_live(share_conversations.live_id),
        array['owner', 'admin']
      )
  )
)
with check (body <> '');

create policy personal_notes_self
on public.share_personal_notes
for select to authenticated
using (user_id = (select auth.uid()) and live_pack_private.can_access_live(live_id));

create policy personal_notes_insert_self
on public.share_personal_notes
for insert to authenticated
with check (user_id = (select auth.uid()) and live_pack_private.can_access_live(live_id));

create policy personal_notes_update_self
on public.share_personal_notes
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and live_pack_private.can_access_live(live_id));

create policy personal_notes_delete_self
on public.share_personal_notes
for delete to authenticated
using (user_id = (select auth.uid()));

create policy notifications_select_self
on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update_self
on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke execute on function live_pack_private.can_access_live(uuid)
from public, anon, authenticated;
revoke execute on function live_pack_private.can_edit_live(uuid)
from public, anon, authenticated;
grant execute on function live_pack_private.can_access_live(uuid) to authenticated;
grant execute on function live_pack_private.can_edit_live(uuid) to authenticated;

commit;
