import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'TrọCheck — đọc đúng giá thuê trọ', template: '%s · TrọCheck' },
  icons: { icon: '/brand/trocheck-icon.png' },
  description:
    'Đọc đúng giá thuê trọ từ bài đăng Facebook, tách giá khỏi phí, rồi so với giá trung bình các tin tương tự.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=document.documentElement.dataset.theme||localStorage.getItem('trocheck-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}" }} /></head>
      <body>
        <a href="#main" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        {children}
      </body>
    </html>
  );
}
