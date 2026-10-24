'use client';
import { ApiState } from '@/components/ApiState/ApiState';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="container"><ApiState title="Chưa tải được trang" message="Có lỗi khi tải dữ liệu. Vui lòng thử lại." reset={reset} /></div>;
}
