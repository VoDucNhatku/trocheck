import { RecoveryForm } from '../quen-mat-khau/RecoveryForm';

export const metadata = { title: 'Đặt mật khẩu mới', icons: { icon: '/brand/trocheck-icon.png' }, robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page() { return <RecoveryForm reset />; }
