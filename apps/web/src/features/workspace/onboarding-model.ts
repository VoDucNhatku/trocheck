import type { MyPostsSummary } from './my-posts-model';

type Counts = MyPostsSummary['counts'];

export type OnboardingState = {
  extensionSeen: boolean; activeTokens: number; sent: number; processed: number;
};

/** Pure, so the done/not-done rules can be tested without a browser. */
export function onboardingSteps(state: OnboardingState) {
  const connected = state.activeTokens > 0;
  return [
    { key: 'install', done: state.extensionSeen || connected, title: 'Cài extension',
      hint: state.extensionSeen ? 'Đã phát hiện extension trong trình duyệt này.' : connected ? 'Đã có kết nối. Extension có thể nằm ở trình duyệt khác.' : 'Chưa phát hiện extension trong trình duyệt này. Tải file, giải nén rồi Load unpacked.',
      href: '/extension', link: 'Xem hướng dẫn cài extension' },
    { key: 'connect', done: connected, title: 'Kết nối tài khoản',
      hint: connected ? `Đang có ${state.activeTokens} kết nối còn hiệu lực.` : 'Vào trang Tài khoản, bấm “Kết nối extension trên trình duyệt này”.',
      href: '/tai-khoan', link: 'Mở trang Tài khoản để kết nối' },
    { key: 'scroll', done: state.sent > 0, title: 'Mở Facebook và cuộn nhóm',
      hint: state.sent > 0 ? `Đã nhận ${state.sent} bài từ extension.` : 'Mở Facebook, tìm “phòng trọ” kèm tên khu vực (ví dụ “phòng trọ Thủ Đức”) hoặc vào một nhóm cho thuê, rồi cuộn xuống vài chục bài. Nếu Facebook đã mở từ trước khi cài, tải lại trang một lần.' },
    { key: 'result', done: state.processed > 0, title: 'Quay lại đây xem kết quả',
      hint: state.processed > 0 ? 'Đã có bài được xử lý. Xem bên dưới.' : state.sent > 0 ? 'Bài đang được xử lý. Chờ một lát rồi tải lại trang.' : 'Sau khi cuộn, quay lại trang này. Bài sẽ hiện kèm giá, diện tích, khu vực đọc được.' },
  ];
}

export function processedCount(counts: Counts) {
  return (counts.published ?? 0) + (counts.other ?? 0);
}
