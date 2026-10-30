const PHRASES = /(\d[\d.,]*[ \t]*(?:m²|triệu|tr|đ|%|tháng|người|k)(?![\p{L}\p{N}])(?:\/(?:tháng|người|kWh)(?:\/người)?)?|Cầu Giấy|ĐH FPT|Tăng Nhơn Phú|Thủ Đức|Lê Văn Việt|Hà Nội|Đống Đa|Tôn Thất Tùng|Bình Thạnh|thang máy|giá thuê|diện tích|không đề cập|tiện nghi|loại phòng|đặt cọc|theo người|theo tháng|trung bình|ảnh phòng|phiếu giá|bài gốc|vị trí|nội thất|khép kín|gác lửng|dịch vụ|điện hành lang|Chạy tiếp|Tạm dừng|Xem trước|Đang đọc|Kết quả|wifi miễn phí)/giu;

/** Wrap short semantic units only; prose can still break between them at 320px. */
export function protectLandingPhrases(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.parentElement?.closest('.phrase, script, style')) nodes.push(text);
  }
  for (const text of nodes) {
    const parts = text.data.split(PHRASES);
    if (parts.length < 2) continue;
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (index % 2 === 0) fragment.append(document.createTextNode(part));
      else { const span = document.createElement('span'); span.className = 'phrase'; span.textContent = part; fragment.append(span); }
    });
    text.replaceWith(fragment);
  }
}
