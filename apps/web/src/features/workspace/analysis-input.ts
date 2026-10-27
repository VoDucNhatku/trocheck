import { maskPhones } from '@/lib/privacy';

export const MAX_TEXT = 20000;
export function analysisSample(id: string) {
  return Object.prototype.hasOwnProperty.call(ANALYSIS_SAMPLES, id) ? ANALYSIS_SAMPLES[id] : ANALYSIS_SAMPLES['post-001'];
}
export function maskAnalysisText(text: string) {
  return maskPhones(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[Email đã ẩn]');
}
export function imageError(file: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Chọn ảnh JPG, PNG hoặc WebP.';
  if (!file.size) return 'Ảnh trống. Hãy chọn ảnh khác.';
  if (file.size > 5 * 1024 * 1024) return 'Ảnh lớn hơn 5 MB. Chọn ảnh nhỏ hơn.';
  return null;
}
// Self-authored examples from the approved prototype; never used as extraction results.
export const ANALYSIS_SAMPLES: Record<string, { text: string; complete: boolean }> = {
  "post-001": {
    "text": "Mình còn chung cư mini ở Cầu Giấy, gần điểm xe buýt.\nDiện tích 30 m², có gác, WC riêng, nội thất cơ bản.\nGiá 4,7 tr/tháng. Điện 3,5k/số, nước 100k/người/tháng, internet miễn phí.\nCọc 1 tháng tiền thuê. Ngõ đi lại thoải mái, liên hệ [SĐT].",
    "complete": true
  },
  "post-034": {
    "text": "Mình còn căn hộ dịch vụ ở Yên Hòa, gần điểm xe buýt.\nDiện tích 38 m², có gác, WC riêng, nội thất cơ bản.\nGiá ib giá. Điện 3,5k/số, nước 100k/người/tháng, internet miễn phí.\nCọc 1 tháng tiền thuê. Ngõ đi lại thoải mái, liên hệ [SĐT].",
    "complete": true
  },
  "seeking": {
    "text": "Mình cần tìm phòng ở Cầu Giấy, khoảng 3 triệu/tháng. Ai có phòng nhắn mình [SĐT].",
    "complete": true
  },
  "image": {
    "text": "Mình còn chung cư mini ở Cầu Giấy, gần điểm xe buýt.\nDiện tích 30 m², có gác, WC riêng, nội thất cơ bản.\nGiá 4,7 tr/tháng. Điện 3,5k/số, nước 100k/người/tháng, internet miễn phí.\nCọc 1 tháng tiền thuê. Ngõ đi lại thoải mái, liên hệ [SĐT].",
    "complete": true
  },
  "hashtag-gia": {
    "text": "Phòng studio Cầu Giấy, ngõ rộng, vào ở ngay 🏠\nCó gác, WC riêng, máy giặt chung, chỗ để xe.\nĐiện 3,5k/số · nước 100k/người · mạng 50k/tháng.\nCọc 1 tháng, hợp đồng rõ ràng.\nGiá xem hashtag #4tr7, inbox để nhận lịch xem [SĐT] #caugiay #phongdep",
    "complete": true
  },
  "nhieu-phong-20": {
    "text": "Khai trương dãy phòng mới tại Dịch Vọng, còn 20 phòng.\nPhòng khép kín, có gác, điều hòa, khóa vân tay.\nGiá từ 3tr/tháng, điện 3,8k/số · nước 100k/người.\nPhí dịch vụ 80k, gửi xe 100k, mạng miễn phí.\nCọc 1 tháng, xem phòng buổi tối [SĐT] #20phong #dichvong",
    "complete": true
  },
  "xem-them-cat": {
    "text": "Còn phòng gần Mỹ Đình, full đồ, có gác và cửa sổ.\nGiá 3tr nhưng chưa rõ tính theo phòng hay người, điện nước...\nInbox mình gửi video và lịch xem nhé ... Xem thêm",
    "complete": false
  },
  "gac-khong-phai-dien-tich": {
    "text": "Phòng khép kín ở Yên Hòa, diện tích 25 m², gác cao 1m6.\nCó điều hòa, nóng lạnh, bếp và chỗ để xe.\nGiá 4,2tr/tháng · điện 3,5k/số · nước 100k/người.\nMạng 70k, cọc 1 tháng, vào ở ngay [SĐT]",
    "complete": true
  },
  "coc-1-5-thang": {
    "text": "Căn hộ mini Nam Từ Liêm, 28 m², có gác và ban công.\nGiá 3,8tr/tháng · điện 3,8k/số · nước 100k/người.\nDịch vụ 60k, xe 100k, mạng miễn phí.\nĐặt cọc 1,5 tháng tiền thuê, hợp đồng 12 tháng [SĐT]",
    "complete": true
  },
  "phi-mo-ho": {
    "text": "Phòng mới tại Cầu Giấy, đủ đồ, thang máy, bảo vệ.\nGiá 4,5tr/tháng · điện 3,5k/số · nước 100k/người.\nMạng 70k, xe 120k, vệ sinh 50k, điện hành lang 50k.\nCọc 1 tháng, khoản hành lang chưa rõ kỳ, hỏi lại khi xem [SĐT]",
    "complete": true
  },
  "nuoc-hai-kieu": {
    "text": "Studio gần Đại học Quốc gia, có gác, WC riêng.\nGiá 3,6tr/tháng · điện 3,8k/số.\nNước 100k/người hoặc 30k/khối, chọn một cách tính.\nDịch vụ 70k, xe 100k, cọc 1 tháng, liên hệ [SĐT]",
    "complete": true
  }
};
