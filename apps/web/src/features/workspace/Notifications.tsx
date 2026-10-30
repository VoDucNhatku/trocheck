'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BookOpen, CheckCircle2, ListChecks, Gauge, Database } from 'lucide-react';
import { hasRole, type Role, type SessionUser } from '@/lib/workspace/types';
import { Button } from './ui';
import { PersonalNav } from './PersonalNav';
import s from './account-notices.module.css';

type NoticeType = 'analysis' | 'contribution' | 'review' | 'evaluation' | 'source';
type Notice = { id: string; type: NoticeType; title: string; body: string; role?: Role; read: boolean; date: string };
// Invented prototype content. Reading state is intentionally confined to this mounted page.
const EXAMPLES: Notice[] = [
  { id: 'notice-001', type: 'analysis', title: 'Bản đọc tin đã xong', body: 'Chung cư mini 30 m² · 4,7 tr/tháng', read: false, date: '2026-10-28T02:00:00Z' },
  { id: 'notice-002', type: 'contribution', title: 'Bài bạn đóng góp đã được duyệt', body: 'Đã giữ bài trong kho dữ liệu ví dụ.', read: false, date: '2026-10-28T02:00:00Z' },
  { id: 'notice-003', type: 'contribution', title: 'Bài đóng góp đã bị loại', body: 'Trùng với tin đã có trong kho.', read: false, date: '2026-10-28T02:00:00Z' },
  { id: 'notice-004', type: 'review', title: '3 tin mới cần duyệt', body: 'Có hai cách đọc khác nhau, cần người đối chiếu.', role: 'reviewer', read: true, date: '2026-10-27T02:00:00Z' },
  { id: 'notice-005', type: 'evaluation', title: 'Lượt đánh giá ví dụ đã xong', body: 'Tập dev · kết quả mô phỏng để xem bố cục.', role: 'researcher', read: true, date: '2026-10-27T02:00:00Z' },
  { id: 'notice-006', type: 'source', title: 'Nguồn cào gặp lỗi', body: 'Phòng trọ Cầu Giấy (ví dụ): Facebook yêu cầu xác minh.', role: 'admin', read: true, date: '2026-10-27T02:00:00Z' },
];
const ICONS = { analysis: BookOpen, contribution: CheckCircle2, review: ListChecks, evaluation: Gauge, source: Database };
const GROUPS: { key: 'all' | 'unread' | NoticeType; title: string; role?: Role }[] = [
  { key: 'all', title: 'Tất cả' }, { key: 'unread', title: 'Chưa đọc' }, { key: 'analysis', title: 'Phân tích' },
  { key: 'contribution', title: 'Đóng góp' }, { key: 'review', title: 'Hàng duyệt', role: 'reviewer' },
  { key: 'evaluation', title: 'Đánh giá', role: 'researcher' }, { key: 'source', title: 'Nguồn cào', role: 'admin' },
];
const day = (value: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
function phrase(text: string) {
  return text.split(/(Cầu Giấy|30 m²|4,7 tr\/tháng)/).map((part, index) => /^(Cầu Giấy|30 m²|4,7 tr\/tháng)$/.test(part) ? <span className={s.phrase} key={index}>{part}</span> : part);
}

export function Notifications({ user }: { user: SessionUser }) {
  const [notices, setNotices] = useState(() => EXAMPLES.filter(item => !item.role || hasRole(user, item.role)));
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Notice | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const filterGroup = useRef<HTMLDivElement | null>(null);
  const [feedback, setFeedback] = useState('');
  const unread = notices.filter(item => !item.read).length;
  const visible = notices.filter(item => filter === 'all' || (filter === 'unread' ? !item.read || selected?.id === item.id : item.type === filter));
  const groups = GROUPS.filter(item => !item.role || hasRole(user, item.role));

  useEffect(() => { if (selected) closeButton.current?.focus(); }, [selected]);
  function close() {
    setSelected(null);
    if (filter === 'unread') filterGroup.current?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus();
    else trigger.current?.focus();
  }
  function open(item: Notice, button: HTMLButtonElement) {
    trigger.current = button;
    setSelected(item);
    setNotices(values => values.map(value => value.id === item.id ? { ...value, read: true } : value));
    setFeedback('Đã đánh dấu thông báo ví dụ là đã đọc trong trang này.');
  }
  function markAll() {
    setNotices(values => values.map(value => ({ ...value, read: true })));
    setFeedback('Đã đánh dấu tất cả thông báo ví dụ là đã đọc trong trang này.');
  }
  return <div className={s.page}>
    <header className={s.heading}><div><p className={s.eyebrow}>Cá nhân</p><h1>Thông báo</h1><p>Những cập nhật liên quan đến bài và công việc của bạn.</p></div><PersonalNav current="notifications" /></header>
    <div className={s.exampleNote}><strong className={s.badge}>Ví dụ</strong><p>Thông báo tự tạo để xem bố cục. Đây không phải cập nhật từ tài khoản của bạn; thao tác đã đọc chỉ giữ đến khi bạn rời hoặc tải lại trang.</p></div>
    <div className={s.toolbar}><p><strong>{unread}</strong> thông báo ví dụ chưa đọc</p><Button variant="secondary" disabled={!unread} onClick={markAll}>Đánh dấu đã đọc hết</Button></div>
    <div ref={filterGroup} className={s.filters} role="group" aria-label="Lọc thông báo">{groups.map(item => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setSelected(null); setFeedback(''); }}>{item.title}</button>)}</div>
    <p className={s.feedback} role="status">{feedback}</p>
    {visible.length ? [...new Set(visible.map(item => item.date.slice(0, 10)))].map(date => <section key={date} className={s.day} aria-label={'Thông báo ngày ' + day(date)}><h2>{day(date)}</h2><ul className={s.notifications}>{visible.filter(item => item.date.startsWith(date)).map(item => {
      const Icon = ICONS[item.type];
      return <li key={item.id} className={s.notice} data-unread={!item.read}><span className={s.noticeIcon} aria-hidden="true"><Icon size={20} /></span><div className={s.noticeBody}><button type="button" className={s.noticeTitle} aria-expanded={selected?.id === item.id} aria-controls={'detail-' + item.id} onClick={event => selected?.id === item.id ? close() : open(item, event.currentTarget)}>{item.title}</button><p>{phrase(item.body)}</p><div className={s.noticeMeta}><span className={s.badge}>Ví dụ</span><span>{item.read ? 'Đã đọc' : 'Chưa đọc'}</span><time dateTime={item.date}>09:00</time></div>{selected?.id === item.id && <section id={'detail-' + item.id} className={s.detail} role="region" aria-label={'Chi tiết: ' + item.title} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}><p>Nội dung mô phỏng ngày {day(item.date)}. Thông báo này chưa liên kết với một bài hoặc công việc thật.</p><div className={s.actions}><button ref={closeButton} type="button" className={s.closeDetail} onClick={close}>Đóng chi tiết</button>{['analysis', 'contribution'].includes(item.type) && <Link href="/phan-tich" className={s.textLink}>Phân tích bài đăng</Link>}{item.type === 'review' && <Link href="/team/duyet" className={s.textLink}>Đến hàng duyệt</Link>}{item.type === 'evaluation' && <Link href="/team/danh-gia" className={s.textLink}>Đến đánh giá</Link>}</div></section>}</div></li>;
    })}</ul></section>) : <section className={s.empty}><Bell size={28} aria-hidden="true" /><h2>Chưa có thông báo nào</h2><p>{filter === 'unread' ? 'Bạn đã đọc hết các thông báo ví dụ.' : 'Không có thông báo ví dụ trong mục này.'}</p><button className={s.textLink} type="button" onClick={() => setFilter('all')}>Xem tất cả thông báo</button></section>}
  </div>;
}
