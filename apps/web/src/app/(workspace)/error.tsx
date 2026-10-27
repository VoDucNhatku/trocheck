'use client';
import { ErrorNotice, Intro } from '@/features/workspace/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <><Intro title="Chưa mở được bàn làm việc" description="Dữ liệu chưa được tải đầy đủ. Bạn có thể thử lại sau ít phút." /><ErrorNotice message="Không kết nối được máy chủ ReNER." retry={reset} /></>;
}
