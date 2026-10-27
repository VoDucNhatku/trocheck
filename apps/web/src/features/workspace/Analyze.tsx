'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { maskPhones } from '@/lib/privacy';
import { api, messageOf } from '@/lib/workspace/client';
import type { AnalysisCreated, IngestPost } from '@/lib/workspace/types';
import { Button, ErrorNotice, Intro, s } from './ui';

export const SAMPLE_TEXT = '🏠 Cho thuê phòng trọ khép kín tại phường Cầu Giấy, 28m2. Giá 4tr8/tháng/phòng. Điện 3k5/số, nước 100k/người/tháng. Cọc 1 tháng tiền thuê. Internet đã gồm trong phí dịch vụ 150k/phòng/tháng.';
const MAX_TEXT = 20000; // IngestPost.text max_length from the API schema.
export function Analyze() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [complete, setComplete] = useState(false);
  const [sample, setSample] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ signature: string; key: string } | null>(null);
  const lock = useRef(false);
  const masked = maskPhones(text.trim());
  const length = Array.from(text).length;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || !preview || !masked || length > MAX_TEXT) return;
    lock.current = true; setBusy(true); setError('');
    const signature = JSON.stringify({ masked, complete, sample });
    if (request.current?.signature !== signature) request.current = { signature, key: 'web:' + crypto.randomUUID() };
    const payload: IngestPost = {
      idempotency_key: request.current.key, source_type: sample ? 'fixture' : 'manual_paste',
      text: masked, text_complete: complete, phone_masked: true,
    };
    try {
      const result = await api<AnalysisCreated>('analyses', { method: 'POST', body: JSON.stringify(payload) });
      router.push('/phan-tich/' + encodeURIComponent(result.analysis_id));
    } catch (caught) { setError(messageOf(caught)); lock.current = false; setBusy(false); }
  }
  return <><Intro title="Đọc kỹ một bài đăng" description="Dán nội dung, xem lại phần đã che liên hệ rồi để ReNER tách giá, phí và bằng chứng. Bài của bạn chưa được đưa vào kho chung." />
    <div className={s.split}><form method="post" onSubmit={submit} className={s.panel}>
      <div className={s.panelHead}><h2 className={s.panelTitle}>Nội dung bài đăng</h2><span className={s.muted}>{length.toLocaleString('vi-VN')} / 20.000</span></div>
      <label className={s.field}><span className="visually-hidden">Dán văn bản bài đăng</span><textarea className={s.textarea} value={text} disabled={busy} aria-invalid={length > MAX_TEXT}
        placeholder="Cho thuê phòng… Giá… Điện… Nước…" onChange={event => { setText(event.target.value); setPreview(false); setSample(false); }} aria-describedby="privacy-hint" /></label>
      <p id="privacy-hint" className={s.hint} style={{ marginTop: 10 }}>Chỉ xử lý chữ. Không suy diện tích, tình trạng phòng hay tiện ích từ ảnh.</p>
      <div className={s.actions}><Button type="button" variant="secondary" disabled={busy} onClick={() => { setText(SAMPLE_TEXT); setComplete(true); setSample(true); setPreview(false); setError(''); }}>Dùng bài mẫu tự tạo</Button>
        {text && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setText(''); setPreview(false); setSample(false); setError(''); }}>Xóa nội dung</Button>}</div>
      <hr className={s.divider} /><label className={s.check}><input type="checkbox" checked={complete} disabled={busy} onChange={event => { setComplete(event.target.checked); setPreview(false); }} /><span>Tôi đã dán đầy đủ nội dung bài, bao gồm phần “Xem thêm”.</span></label>
      {!complete && <p className={s.hint} style={{ marginTop: 8 }}>Nếu chưa đầy đủ, ReNER sẽ giữ dấu hiệu thiếu nội dung.</p>}
      {sample && <p className={[s.notice, s.section].join(' ')}>Đây là bài minh họa tự tạo. Kết quả được đánh dấu demo và tách khỏi thống kê kho thật.</p>}
      {error && <div className={s.section}><ErrorNotice message={error} /></div>}
      <div className={s.actions}>{!preview ? <Button type="button" disabled={!masked || length > MAX_TEXT} onClick={() => setPreview(true)}>Xem nội dung sẽ gửi<ArrowRight size={15} /></Button>
        : <Button type="submit" busy={busy}>{busy ? 'Đang gửi bài…' : 'Phân tích bài này'}<ArrowRight size={15} /></Button>}</div>
      {length > MAX_TEXT && <p className={s.error}>Bài dài hơn giới hạn 20.000 ký tự của máy chủ. Hãy rút nội dung trước khi gửi.</p>}
    </form><div className={s.stack}>
      <section className={s.panel}><div className={s.panelHead}><h2 className={s.panelTitle}>{preview ? 'Nội dung sẽ gửi' : 'Một bản đọc tin có gì?'}</h2>{preview && <ShieldCheck size={18} />}</div>
        {preview ? <><p className={s.hint}>Số điện thoại đã được che trên trình duyệt. Hãy xóa thêm tên, email hoặc thông tin riêng tư khác trước khi gửi.</p><hr className={s.divider} /><p className={s.source}>{masked}</p></> :
          <><p className={s.description}>Bài gốc đi cùng các giá trị đã đọc được, để bạn luôn biết con số đến từ đâu.</p><ol className={s.loginSteps} style={{ marginTop: 24 }}><li><b>01</b>Giá thuê và cơ sở tính</li><li><b>02</b>Từng khoản phí, giữ đúng đơn vị</li><li><b>03</b>Điều còn thiếu cần hỏi người đăng</li><li><b>04</b>Nhóm so sánh nếu đủ dữ liệu</li></ol></>}
      </section><p className={s.muted}>ReNER đọc giá chào thuê từ bài đăng. Kết quả không xác nhận phòng còn trống hoặc thông tin do người đăng mô tả.</p>
    </div></div></>;
}
