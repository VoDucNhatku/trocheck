'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import s from './account-notices.module.css';

export function PersonalNav({ current }: { current: 'account' | 'notifications' }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('theme');
    const value = requested === 'light' || requested === 'dark' ? requested : document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = value; setTheme(value);
  }, []);
  return <nav className={s.personalNav} aria-label="Trang cá nhân"><Link href={current === 'account' ? '/thong-bao' : '/tai-khoan'}>{current === 'account' ? 'Xem thông báo' : 'Tài khoản'}</Link><button type="button" onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = value; setTheme(value); }} aria-label={'Chuyển sang chế độ ' + (theme === 'dark' ? 'sáng' : 'tối')}>{theme === 'dark' ? 'Sáng' : 'Tối'}</button></nav>;
}
