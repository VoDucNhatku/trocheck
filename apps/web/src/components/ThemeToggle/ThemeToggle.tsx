'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import styles from '../shared.module.css';

export function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => { observer.disconnect(); media.removeEventListener('change', update); };
  }, []);

  function select(value: 'light' | 'dark') {
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try { localStorage.setItem('trocheck-theme', value); } catch { /* The selection still works when storage is unavailable. */ }
  }

  return <div className={styles.themeToggle} role="group" aria-label="Chế độ màu">
    <button type="button" className={styles.themeButton} aria-label="Chế độ sáng" aria-pressed={theme === 'light'} onClick={() => select('light')}><Sun size={17} aria-hidden="true" /></button>
    <button type="button" className={styles.themeButton} aria-label="Chế độ tối" aria-pressed={theme === 'dark'} onClick={() => select('dark')}><Moon size={17} aria-hidden="true" /></button>
  </div>;
}
