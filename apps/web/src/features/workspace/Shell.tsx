'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, Search, BarChart3, Database, ListChecks, FlaskConical, Gauge, Menu, X, UserRound } from 'lucide-react';
import type { SessionUser } from '@/lib/workspace/types';
import { hasRole } from '@/lib/workspace/types';
import { s, Button } from './ui';

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const reload = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', reload);
    return () => window.removeEventListener('pageshow', reload);
  }, []);
  const items = [
    { href: '/phan-tich', title: 'Phân tích bài đăng', icon: BookOpen },
    { href: '/tim-tro', title: 'Tìm trọ', icon: Search },
    { href: '/thi-truong', title: 'Thị trường', icon: BarChart3 },
  ];
  const team = [
    ...(hasRole(user, 'collector', 'reviewer') ? [{ href: '/team/kho', title: 'Kho dữ liệu', icon: Database }] : []),
    ...(hasRole(user, 'reviewer') ? [{ href: '/team/duyet', title: 'Hàng duyệt', icon: ListChecks }] : []),
    ...(hasRole(user, 'researcher') ? [{ href: '/team/lab', title: 'Lab đối chiếu', icon: FlaskConical }, { href: '/team/danh-gia', title: 'Đánh giá', icon: Gauge }] : []),
  ];
  const link = (item: typeof items[number]) => <Link prefetch={false} onClick={() => drawer.current?.close()} key={item.href} href={item.href} className={s.navLink}
    aria-current={pathname === item.href || pathname.startsWith(item.href + '/') ? 'page' : undefined}><item.icon size={16} strokeWidth={1.6} />{item.title}</Link>;
  const navigation = <><Link href="/" className={s.brand}>ReNER<small>VN</small></Link><nav aria-label="Bàn làm việc" className={s.nav}><p className={s.navLabel}>Đọc tin</p>{items.map(link)}
    {team.length > 0 && <><p className={s.navLabel}>Không gian nhóm</p>{team.map(link)}</>}
    <p className={s.navLabel}>Cá nhân</p>{link({ href: '/tai-khoan', title: 'Tài khoản', icon: UserRound })}</nav></>;
  const current = [...items, ...team].find(item => pathname.startsWith(item.href))?.title ?? 'Tài khoản';
  return <div data-workspace className={[s.workspace, s.shell].join(' ')}><aside className={s.sidebar}>{navigation}
    <div className={s.sidebarFoot}><p>Đọc có nguồn.<br />Hiểu trước khi hỏi thuê.</p><Link href="/" className={s.navLink}><ArrowLeft size={14} />Về sân nhà</Link></div></aside>
    <div><header className={s.topbar}><Button variant="ghost" className={[s.iconButton, s.mobileMenuButton].join(' ')} aria-label="Mở điều hướng" onClick={() => drawer.current?.showModal()}><Menu size={19} /></Button>
      <span className={s.breadcrumb}>Đọc tin <span aria-hidden="true">/</span> {current}</span><Link href="/tai-khoan" prefetch={false} className={s.identity}><b className={s.avatar}>{user.username.slice(0, 1).toUpperCase()}</b><span>{user.username}</span></Link></header>
      <main className={s.main} id="main" tabIndex={-1}>{children}</main></div>
    <dialog data-workspace className={s.mobileDialog} ref={drawer} aria-label="Điều hướng"><div className={s.between}><span className={s.muted}>Bàn làm việc</span><Button variant="ghost" className={s.iconButton} aria-label="Đóng điều hướng" onClick={() => drawer.current?.close()}><X size={19} /></Button></div>{navigation}</dialog>
  </div>;
}
