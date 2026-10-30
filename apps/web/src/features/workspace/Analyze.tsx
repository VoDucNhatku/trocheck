'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { api, messageOf } from '@/lib/workspace/client';
import type { AnalysisCreated, IngestPost } from '@/lib/workspace/types';
import { Button, ErrorNotice, Intro, s } from './ui';
import { ANALYSIS_SAMPLES, MAX_TEXT, analysisSample, imageError, maskAnalysisText } from './analysis-input';
import a from './analyze.module.css';
import { preservePhrases } from './AnalysisEvidence';

export const SAMPLE_TEXT = ANALYSIS_SAMPLES['post-001'].text;
export function Analyze({ initialMode = 'paste', sampleCase = '' }: { initialMode?: 'paste' | 'image'; sampleCase?: string }) {
  const router = useRouter();
  const imageSample = analysisSample(sampleCase);
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState('');
  const [complete, setComplete] = useState(false);
  const [sample, setSample] = useState(false);
  const [image, setImage] = useState<'example' | 'chosen' | null>(initialMode === 'image' && sampleCase ? 'example' : null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const lock = useRef(false);
  const masked = maskAnalysisText(text.trim());
  const length = Array.from(text).length;
  const valid = Boolean(masked) && length <= MAX_TEXT;
  function choose(file?: File) {
    if (!file || lock.current) return;
    const problem = imageError(file);
    if (problem) { setError(problem); return; }
    // Only metadata is used. Private image bytes are never read, displayed or uploaded.
    setImage('chosen'); setText(''); setSample(false); setPreview(false); setComplete(false); setError('');
  }
  function useSample(id: string) {
    const value = analysisSample(id);
    setText(value.text); setComplete(value.complete); setSample(true); setPreview(false); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!valid) { setError(length > MAX_TEXT ? 'Bài dài hơn giới hạn 20.000 ký tự. Hãy rút nội dung trước khi gửi.' : 'Dán nội dung bài đăng trước khi tiếp tục.'); input.current?.focus(); return; }
    if (!preview) { setPreview(true); setError(''); return; }
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
  return <><Intro title="Phân tích bài đăng" description="Dán bài hoặc tải ảnh chụp. Kiểm tra chữ đã che liên hệ, rồi đọc giá cùng bằng chứng." />
    <ol className={a.progress} aria-label="Các bước xử lý"><li>Che thông tin</li><li>Gán nhãn</li><li>So sánh</li></ol>
    <div className={a.layout}><form method="post" onSubmit={submit} className={a.document} aria-busy={busy}>
      <div className={a.tabs} aria-label="Cách nhập">{(['paste', 'image'] as const).map(value => <Button key={value} type="button" variant="secondary" aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setPreview(false); setError(''); }}>{value === 'paste' ? 'Dán chữ' : 'Tải ảnh chụp'}</Button>)}</div>
      {mode === 'image' && <>
        <div className={a.drop} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
          <ImageIcon size={28} aria-hidden="true" /><p>Kéo ảnh chụp bài đăng vào đây<br />hoặc chọn file</p><small>{preservePhrases('JPG, PNG, WebP · tối đa 5 MB')}</small>
          <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Chọn ảnh chụp bài đăng" onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          <div className={a.actions}><Button type="button" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>Chọn ảnh</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setImage('example'); setText(''); setComplete(false); setPreview(false); setSample(false); setError(''); }}>Dùng ảnh chụp ví dụ</Button></div>
        </div>
        {image && <section className={a.shot} aria-label="Khối giữ chỗ ảnh chụp"><b>{image === 'example' ? 'Người đăng đã ẩn' : 'Đã chọn ảnh trên máy'}</b><p className={a.caption}>{image === 'example' ? 'Ảnh chụp (ví dụ tự tạo)' : 'Ảnh không được hiển thị hoặc gửi lên máy chủ.'}</p>{image === 'example' && <p className={a.source}>{preservePhrases(imageSample.text)}</p>}<div className={a.placeholder}>Ảnh phòng (ví dụ)</div></section>}
        {image === 'example' && <div className={a.actions}><Button type="button" disabled={busy} onClick={() => useSample(sampleCase)}>Đọc chữ từ ảnh ví dụ</Button></div>}
        <p className={a.hint}>OCR thật chưa kết nối. Ảnh ví dụ dùng chữ mẫu; với ảnh riêng, hãy nhập lại chữ bên dưới. Chỉ chữ đã kiểm tra được gửi đi.</p>
      </>}
      <label className={a.field} htmlFor="post-text">{mode === 'image' ? 'Chữ trong ảnh — bạn có thể nhập và sửa' : 'Nội dung bài đăng'}</label>
      <textarea ref={input} id="post-text" className={a.textarea} value={text} disabled={busy} aria-invalid={length > MAX_TEXT} placeholder="Mình còn phòng… Giá… Điện… Nước…" aria-describedby="text-count privacy-hint" onChange={event => { setText(event.target.value); setPreview(false); setSample(false); setError(''); }} />
      <p id="text-count" className={a.hint}>{length.toLocaleString('vi-VN')} / {preservePhrases('20.000 ký tự')}</p>
      <label className={a.check}><input type="checkbox" checked={complete} disabled={busy} onChange={event => { setComplete(event.target.checked); setPreview(false); }} /><span>Tôi đã dán đủ nội dung, gồm phần “Xem thêm”.</span></label>
      <p id="privacy-hint" className={a.hint}>Không gửi tên người đăng. Hãy xóa tên và thông tin riêng tư trước khi tiếp tục. Số điện thoại và email sẽ được che.</p>
      {!complete && <p className={a.hint}>Nếu chưa đầy đủ, kết quả sẽ giữ cảnh báo thiếu nội dung.</p>}
      {sample && <p className={a.hint}>Bài mẫu tự tạo được đánh dấu demo, tách khỏi thống kê kho thật.</p>}
      {error && <ErrorNotice message={error} />}
      <div className={a.actions}><Button type="submit" busy={busy}>{busy ? 'Đang gửi bài…' : preview ? 'Phân tích ngay' : 'Xem nội dung sẽ gửi'}<ArrowRight size={15} aria-hidden="true" /></Button><Button type="button" variant="secondary" disabled={busy} onClick={() => { setText(''); setPreview(false); setSample(false); setComplete(false); setError(''); input.current?.focus(); }}>Xóa</Button></div>
      {busy && <p className={a.hint} role="status">Đang tạo bản đọc tin. Máy chủ sẽ đọc bài sau khi tiếp nhận.</p>}
      <section className={a.examples}><p>Ba bài mẫu · ví dụ tự tạo</p><div className={a.actions}>{[['post-001', 'Giá và phí rõ ràng'], ['post-034', 'Bài giấu giá'], ['seeking', 'Bài tìm phòng']].map(([id, label]) => <Button key={id} type="button" variant="secondary" disabled={busy} onClick={() => { setMode('paste'); useSample(id); }}>{label}</Button>)}</div></section>
    </form><aside className={a.side}>
      <section className={a.preview} aria-label="Xem trước bản đọc"><div>{preview ? <><div className={a.previewHead}><h2>Nội dung sẽ gửi</h2><span className={a.badge}><ShieldCheck size={15} aria-hidden="true" />Đã che liên hệ</span></div><p className={a.source}>{preservePhrases(masked)}</p></> : <><p className={a.caption}>TỪ BÀI ĐĂNG ĐẾN BẢN ĐỌC</p><h2 className={a.previewTitle}>Tiền nhà có căn cứ.<br />Phí có chỗ riêng.</h2><ol className={s.readingSteps}><li><b>01</b><span>{preservePhrases('Giá thuê giữ đúng cách tính')}</span></li><li><b>02</b><span>Phí và đặt cọc tách riêng</span></li><li><b>03</b><span>Chỉ so khi đủ mười phòng tương tự</span></li></ol></>}</div>
        {preview ? <p className={a.hint}>Kiểm tra lại nội dung trên trước khi bấm “Phân tích ngay”. Bài của bạn chỉ mình bạn thấy, trừ khi bạn chọn đóng góp.</p> : <blockquote className={a.quote}>“Giá <span className={a.phrase}>4,7 tr/tháng.</span> Điện <span className={a.phrase}>3,5k/số.</span>”<small>Ví dụ tự tạo · bấm bài mẫu để đọc thử</small></blockquote>}
      </section><p className={a.note}>{preservePhrases('Bài tìm phòng không tạo giá thuê. “Ib giá” nghĩa là bài không công khai giá.')}</p>
      <ul className={a.legend} aria-label="Nhãn bằng chứng">{[['PRICE', 'Giá thuê'], ['AREA', 'Diện tích'], ['LOC', 'Vị trí'], ['ROOM', 'Phòng'], ['FEE', 'Phí']].map(([label, name]) => <li key={label} data-entity={label}>{preservePhrases(name)}</li>)}</ul>
    </aside></div></>;
}
