'use client';

import { useEffect, useRef, useState } from 'react';
import { messageOf, workspaceFetch } from '@/lib/workspace/client';
import { Button, ErrorNotice, Modal, s } from '@/features/workspace/ui';

export function ExportData() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!open) trigger.current?.focus(); }, [open]);
  function close() { if (!lock.current) setOpen(false); }
  async function download() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const response = await workspaceFetch(`team/export?format=${format}&include_demo=${includeDemo}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'trocheck-listings.' + format;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('Đã tải dữ liệu chuẩn hóa' + (includeDemo ? ', gồm cả demo.' : ', không gồm demo.'));
      setOpen(false);
    } catch (caught) { setError(messageOf(caught)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div>
    <Button variant="secondary" onClick={event => { trigger.current = event.currentTarget; setError(''); setOpen(true); }}>Xuất dữ liệu</Button>
    {feedback && <p className={s.hint} role="status">{feedback}</p>}
    {open && <Modal title="Xuất dữ liệu chuẩn hóa" busy={busy} onClose={close}>
      <p>Xuất toàn bộ tin hiện hành được API cho phép. Bộ lọc Kho không áp dụng cho tệp xuất; không kèm chữ bài gốc.</p>
      <label className={[s.field, s.section].join(' ')}><span className={s.label}>Định dạng</span><select className={s.select} value={format} disabled={busy} onChange={event => setFormat(event.target.value as 'csv' | 'json')}><option value="csv">CSV</option><option value="json">JSON</option></select></label>
      <label className={[s.check, s.section].join(' ')}><input type="checkbox" checked={includeDemo} disabled={busy} onChange={event => setIncludeDemo(event.target.checked)} />Gồm dữ liệu demo</label>
      <p className={s.hint}>Dữ liệu demo vẫn mang cờ is_demo trong tệp, không gộp thành dữ liệu thật.</p>
      {error && <ErrorNotice message={error} />}
      <div className={s.actions}><Button variant="secondary" disabled={busy} onClick={close}>Hủy</Button><Button busy={busy} onClick={download}>{busy ? 'Đang tải tệp…' : 'Tải xuống'}</Button></div>
    </Modal>}
  </div>;
}
