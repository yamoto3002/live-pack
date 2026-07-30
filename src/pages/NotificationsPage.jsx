import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { EmptyState, PageHead } from '../components/PageElements';
import {
  decideAccessRequest, listAccessRequests, listNotifications,
  markAllNotificationsRead, markNotificationRead,
} from '../services/notificationService';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    listNotifications()
      .then(async (values) => {
        setItems(values);
        const ids = values
          .filter((item) => item.related_entity_type === 'share_access_request')
          .map((item) => item.related_entity_id);
        const accessRequests = await listAccessRequests(ids);
        setRequests(Object.fromEntries(accessRequests.map((request) => [request.id, request])));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const decide = async (requestId, decision, permission = null) => {
    setBusy(`${requestId}:${decision}:${permission || ''}`);
    setError('');
    try {
      await decideAccessRequest({
        requestId,
        decision,
        permission,
        // The authenticated Edge Function assigns the three-hour default.
        expiresAt: null,
      });
      setRequests((current) => ({
        ...current,
        [requestId]: { ...current[requestId], status: decision },
      }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy('');
    }
  };

  const read = async (item) => {
    if (item.read_at) return;
    await markNotificationRead(item.id);
    setItems((current) => current.map((value) => value.id === item.id
      ? { ...value, read_at: new Date().toISOString() }
      : value));
  };

  return (
    <div className="page notifications-page">
      <PageHead eyebrow="通知" title="申請と共有の動きを確認" text="編集申請、チャット、期限、バンド招待を時系列で表示します。">
        <button className="secondary" disabled={!items.some((item) => !item.read_at)} onClick={async () => { await markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, read_at: new Date().toISOString() }))); }}><CheckCheck />すべて既読</button>
      </PageHead>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {loading ? <div className="loading-line"><RefreshCw className="spin" />通知を読み込んでいます…</div>
        : !items.length ? <EmptyState icon={Bell} title="新しい通知はありません" text="編集申請や共有メッセージが届くと、ここに表示されます。" />
          : <section className="notification-list">{items.map((item) => {
            const request = requests[item.related_entity_id];
            return (
              <article className={item.read_at ? 'read' : ''} key={item.id}>
                <button className="notification-main" onClick={() => read(item)}>
                  <i />
                  <div><span>{item.type}</span><h2>{item.title}</h2><p>{item.body}</p></div>
                  <time>{new Date(item.created_at).toLocaleString('ja-JP')}</time>
                </button>
                {request?.status === 'pending' && (
                  <div className="request-decision">
                    <p>{request.message || (request.request_type === 'edit' ? '編集権限の申請です。' : '情報開示の申請です。')}</p>
                    <button disabled={Boolean(busy)} onClick={() => decide(request.id, 'rejected')}><X />拒否</button>
                    {request.request_type === 'edit' && <button disabled={Boolean(busy)} onClick={() => decide(request.id, 'approved', 'temporary_editor')}><Clock3 />3時間だけ許可</button>}
                    <button disabled={Boolean(busy)} onClick={() => decide(request.id, 'approved', request.request_type === 'edit' ? 'permanent_editor' : null)}><ShieldCheck />{request.request_type === 'edit' ? '常に許可' : '開示を許可'}</button>
                  </div>
                )}
                {request && request.status !== 'pending' && <small className="request-result">{request.status === 'approved' ? '許可済み' : '拒否済み'}</small>}
              </article>
            );
          })}</section>}
    </div>
  );
}
