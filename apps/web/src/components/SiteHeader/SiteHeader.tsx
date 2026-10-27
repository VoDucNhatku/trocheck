'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, Puzzle, X } from 'lucide-react';
import { Logo } from '../Logo/Logo';
import { useDatasetHref } from '@/lib/useDatasetHref';
import styles from './SiteHeader.module.css';

const NAV = [
  { href: '/tim-tro', label: 'Tìm trọ' },
  { href: '/#nguyen-tac', label: 'Nguyên tắc' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const scoped = useDatasetHref();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
        <Link href={scoped('/')} className={styles.brand} aria-label="ReNER-VN — trang chủ">
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
          <Link href={scoped("/#cach-hoat-dong")} className={styles.ghost}>
            Cách hoạt động
          </Link>
          <Link href={scoped('/#extension')} className={styles.cta}>
            <Puzzle size={14} strokeWidth={1.75} aria-hidden="true" />
            Xem extension
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className={styles.burger}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <nav aria-label="Điều hướng trên điện thoại" id="mobile-nav" className={[styles.sheet, open ? styles.sheetOpen : ''].join(' ')} hidden={!open}>
        {NAV.map((n) => (
          <Link key={n.href} href={scoped(n.href)} onClick={() => setOpen(false)} className={styles.sheetLink}>
            {n.label}
          </Link>
        ))}
        <Link href={scoped("/#cach-hoat-dong")} className={styles.sheetLink}>
          Cách hoạt động
        </Link>
        <Link href={scoped('/#extension')} className={styles.cta}>
          <Puzzle size={14} aria-hidden="true" /> Xem extension
        </Link>
      </nav>
    </header>
  );
}
