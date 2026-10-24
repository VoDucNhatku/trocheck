'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LayoutDashboard, Menu, UserPlus, X } from 'lucide-react';
import { Logo } from '../Logo/Logo';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { useDatasetHref } from '@/lib/useDatasetHref';
import styles from './SiteHeader.module.css';

const NAV = [
  { href: '/tim-tro', label: 'Tìm trọ' },
  { href: '/thi-truong', label: 'Thị trường' },
  { href: '/#nguyen-tac', label: 'Nguyên tắc' },
  { href: '/#cach-hoat-dong', label: 'Cách hoạt động' },
  { href: '/#extension', label: 'Extension' },
];

/** `account` is the signed-in username, or null for visitors. */
export function SiteHeader({ account = null }: { account?: string | null }) {
  const pathname = usePathname();
  const scoped = useDatasetHref();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={[styles.header, pathname === '/' ? styles.home : '', scrolled ? styles.scrolled : ''].join(' ')}>
      <div className={`container ${styles.inner}`}>
        <Link href={scoped('/')} className={styles.brand} aria-label="TrọCheck — trang chủ">
          <Logo />
        </Link>

        <nav className={styles.nav} aria-label="Điều hướng chính">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={scoped(n.href)} onClick={() => setOpen(false)} className={[styles.link, active ? styles.active : ''].join(' ')} aria-current={active ? 'page' : undefined}>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          {account ? (
            <Link href="/phan-tich" className={styles.cta} title={'Đang đăng nhập: ' + account}>
              <LayoutDashboard size={14} strokeWidth={1.75} aria-hidden="true" />
              Vào bàn làm việc
            </Link>
          ) : (
            <>
              <Link href="/dang-nhap" className={styles.ghost}>
                Đăng nhập
              </Link>
              <Link href="/dang-ky" className={styles.cta}>
                <UserPlus size={14} strokeWidth={1.75} aria-hidden="true" />
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>

        <div className={styles.tools}>
          <ThemeToggle />
          <button
          ref={toggleRef}
          type="button"
          className={styles.burger}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <nav aria-label="Điều hướng trên điện thoại" id={menuId} className={styles.sheet} hidden={!open}>
        {NAV.map((n) => (
          <Link key={n.href} href={scoped(n.href)} onClick={() => setOpen(false)} className={styles.sheetLink}>
            {n.label}
          </Link>
        ))}
        {account ? (
          <Link href="/phan-tich" className={styles.cta}>
            <LayoutDashboard size={14} aria-hidden="true" /> Vào bàn làm việc ({account})
          </Link>
        ) : (
          <>
            <Link href="/dang-nhap" className={styles.sheetLink}>
              Đăng nhập
            </Link>
            <Link href="/dang-ky" className={styles.cta}>
              <UserPlus size={14} aria-hidden="true" /> Tạo tài khoản
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
