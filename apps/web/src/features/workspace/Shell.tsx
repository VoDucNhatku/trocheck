'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Search, BarChart3, Database, ListChecks, FlaskConical, Gauge, Menu, X, UserRound, LogOut, ChevronDown, Bell, Users, Radio } from 'lucide-react';
import type { Role, SessionUser } from '@/lib/workspace/types';
import { hasRole, ROLE_NAME } from '@/lib/workspace/types';
import { api, messageOf } from '@/lib/workspace/client';
import { Logo } from '@/components/Logo/Logo';
import { s } from './ui';

// Add each future destination as one row once its route and API are available.
const NAVIGATION = [
  { group: 'Đọc tin', href: '/phan-tich', title: 'Phân tích bài đăng', icon: BookOpen },
  { group: 'Đọc tin', href: '/tim-tro', title: 'Tìm trọ', icon: Search },
  { group: 'Đọc tin', href: '/thi-truong', title: 'Thị trường', icon: BarChart3 },
  { group: 'Khu nhóm', href: '/team/kho', title: 'Kho dữ liệu', icon: Database, roles: ['collector', 'reviewer'] },
  { group: 'Khu nhóm', href: '/team/duyet', title: 'Hàng duyệt', icon: ListChecks, roles: ['reviewer'] },
  { group: 'Khu nhóm', href: '/team/kiem-tra', title: 'Kiểm tra trích xuất', icon: FlaskConical, roles: ['researcher'] },
  { group: 'Khu nhóm', href: '/team/danh-gia', title: 'Đánh giá', icon: Gauge, roles: ['researcher'] },
  { group: 'Khu nhóm', href: '/team/nguoi-dung', title: 'Người dùng', icon: Users, roles: ['researcher'] },
  { group: 'Khu nhóm', href: '/team/nguon-cao', title: 'Nguồn cào', icon: Radio, roles: ['researcher'] },
  { group: 'Cá nhân', href: '/tai-khoan', title: 'Tài khoản', icon: UserRound },
  { group: 'Cá nhân', href: '/thong-bao', title: 'Thông báo', icon: Bell },
] satisfies { group: string; href: string; title: string; icon: typeof BookOpen; roles?: Role[] }[];

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const drawerTrigger = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function closeDrawer() { drawer.current?.close(); }
  function showDrawer() { setOpen(false); drawer.current?.showModal(); setDrawerOpen(true); }
  useEffect(() => { setOpen(false); drawer.current?.close(); }, [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const breakpoint = window.matchMedia('(min-width: 768px)');
    const resize = () => { if (breakpoint.matches) drawer.current?.close(); };
    breakpoint.addEventListener('change', resize);
    return () => { document.body.style.overflow = previous; breakpoint.removeEventListener('change', resize); };
  }, [drawerOpen]);
  useEffect(() => {
    if (!open) return;
    account.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const outside = (event: PointerEvent) => { if (!account.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); accountTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  async function logout() {
    if (busy) return; setBusy(true); setError('');
    try { await api('auth/logout', { method: 'POST', body: '{}' }); window.location.replace('/dang-nhap'); }
    catch (caught) { setError(messageOf(caught)); setBusy(false); }
  }
  useEffect(() => {
    const reload = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', reload);
    return () => window.removeEventListener('pageshow', reload);
  }, []);
  const items = NAVIGATION.filter(item => !item.roles || hasRole(user, ...item.roles));
  const link = (item: typeof NAVIGATION[number]) => <Link prefetch={false} onClick={closeDrawer} key={item.href} href={item.href} className={s.navLink} aria-label={item.title}
    aria-current={pathname === item.href || pathname.startsWith(item.href + '/') ? 'page' : undefined}><item.icon aria-hidden="true" size={18} strokeWidth={1.6} /><span className={s.navText}>{item.title}</span><span className={s.navTooltip} role="tooltip">{item.title}</span></Link>;
  const navigation = <><Link href="/" onClick={closeDrawer} className={s.brand} aria-label="TrọCheck — trang chủ"><Logo inverse /></Link><nav aria-label="Bàn làm việc" className={s.nav}>
    {['Đọc tin', 'Khu nhóm', 'Cá nhân'].map(group => {
      const entries = items.filter(item => item.group === group);
      return entries.length > 0 && <div key={group} className={s.navGroup}><p className={s.navLabel}>{group}</p>{entries.map(link)}</div>;
    })}</nav><div className={s.sidebarFoot}><Link href="/" onClick={closeDrawer} className={s.navLink} aria-label="Về trang chủ"><ArrowLeft size={18} aria-hidden="true" /><span className={s.navText}>Về trang chủ</span><span className={s.navTooltip} role="tooltip">Về trang chủ</span></Link></div></>;
  const active = items.find(item => pathname === item.href || pathname.startsWith(item.href + '/'));
  return <div data-workspace className={[s.workspace, s.shell].join(' ')}><aside data-workspace-chrome className={s.sidebar} aria-label="Điều hướng khu trong">{navigation}</aside>
    <div><header data-workspace-chrome className={s.topbar}><button ref={drawerTrigger} type="button" className={[s.shellIconButton, s.mobileMenuButton].join(' ')} aria-label="Mở điều hướng" aria-expanded={drawerOpen} aria-controls="workspace-drawer" onClick={showDrawer}><Menu size={20} aria-hidden="true" /></button>
      <nav aria-label="Đường dẫn" className={s.breadcrumb}><span className={s.breadcrumbRoot}>{active?.group ?? 'Đọc tin'}<span aria-hidden="true">/</span></span><span className={s.breadcrumbItem} aria-current={pathname.startsWith('/phan-tich/') ? undefined : 'page'}>{active?.title ?? 'Phân tích bài đăng'}</span>{pathname.startsWith('/phan-tich/') && <><span className={s.breadcrumbSeparator} aria-hidden="true">/</span><span className={s.breadcrumbItem} aria-current="page">Bản đọc tin</span></>}</nav><div ref={account} className={s.accountMenu} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
        {/* Future notification bell: add one connected control before the account trigger. */}
        <button ref={accountTrigger} type="button" className={s.identity} aria-label="Menu tài khoản" aria-expanded={open} aria-controls="account-popover" onClick={() => setOpen(!open)}><b className={s.avatar} aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</b><span>{user.username}</span><ChevronDown size={14} aria-hidden="true" /></button>
        {open && <div id="account-popover" className={s.accountPopover}><strong>{user.username}</strong><p>{user.roles.map(role => ROLE_NAME[role]).join(' · ')}</p><Link href="/tai-khoan" prefetch={false}>Tài khoản<UserRound size={16} aria-hidden="true" /></Link><Link href="/" prefetch={false}>Về trang chủ<ArrowLeft size={16} aria-hidden="true" /></Link><hr /><button type="button" className={s.shellLogout} disabled={busy} aria-busy={busy || undefined} onClick={logout}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}<LogOut size={16} aria-hidden="true" /></button>{error && <p role="alert" className={s.error}>{error}</p>}</div>}
      </div></header>
      <main className={s.main} id="main" tabIndex={-1}>{children}</main></div>
    <dialog data-workspace data-workspace-chrome id="workspace-drawer" className={s.mobileDialog} ref={drawer} aria-label="Điều hướng" onClose={() => { setDrawerOpen(false); if (window.matchMedia('(max-width: 767px)').matches) drawerTrigger.current?.focus(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer(); } }}>
      <div className={s.drawerHeading}><span>Bàn làm việc</span><button type="button" autoFocus className={s.shellIconButton} aria-label="Đóng điều hướng" onClick={closeDrawer}><X size={20} aria-hidden="true" /></button></div>{navigation}</dialog>
  </div>;
}
