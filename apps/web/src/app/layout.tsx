import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ReNER-VN — đọc đúng giá thuê trọ', template: '%s · ReNER-VN' },
  description:
    'Đọc đúng giá thuê trọ từ bài đăng Facebook, tách giá khỏi phí, rồi so với trung vị các tin tương tự.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#12120f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <a href="#main" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        {children}
      </body>
    </html>
  );
}
