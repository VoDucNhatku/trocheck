'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Copy } from 'lucide-react';
import type { Comparison, Evidence, Listing } from '@/lib/api/types';
import type { AnalysisResult } from '@/lib/workspace/types';
import { api, messageOf } from '@/lib/workspace/client';
import { AnalysisEvidence, preservePhrases as keepPhrases } from './AnalysisEvidence';
import { evidenceKey } from '@/lib/evidence';
import { PROPERTY_LABEL, REASON_TEXT, dataRangeSentence, formatVnd } from '@/lib/format';
import { Button, DataBadge, Empty, ErrorNotice, Intro, Loading, Modal, s } from './ui';
import a from './analyze.module.css';

import { Receipt } from './Receipt';
import { feeLabel, groundedEvidence, listingEvidence, receiptFee, receiptFields, receiptRent } from './receipt-model';
import r from './reading.module.css';

const JOB_NAME: Record<string, string> = { queued: 'Đang chờ xử lý', running: 'Đang đọc bài', succeeded: 'Đã đọc xong', failed: 'Xử lý chưa thành công' };
function questions(listing: Listing, unverifiedRent: boolean) {
  const rows: string[] = [];
  if (unverifiedRent) rows.push('Giá thuê chính xác là bao nhiêu? Đoạn trích chưa đủ căn cứ xác định số tiền.');
  else if (listing.rent.amount_form === 'none') rows.push('Giá thuê cụ thể là bao nhiêu? Bài chưa có giá để đối chiếu.');
  if (listing.rent.basis === 'unknown') rows.push('Giá tính cho một phòng hay một người?');
  if (listing.rent.period === 'unknown') rows.push('Khoản giá thuê áp dụng theo tháng, ngày hay kỳ nào?');
  if (listing.area.amount_form === 'none') rows.push('Diện tích sử dụng là bao nhiêu m²? Bài chưa ghi rõ.');
  if (listing.location.resolution === 'unresolved') rows.push('Địa chỉ thuộc phường nào? Chưa xác định được từ bài.');
  if (!listing.fees.length) rows.push('Điện, nước, cọc và phí dịch vụ được tính thế nào? Bài chưa có khoản phí đọc được.');
  if (listing.fees.some(fee => fee.unit === 'unknown')) rows.push('Các khoản phí chưa rõ đơn vị được tính theo người, phòng hay một lần?');
  return rows;
}
export function ReadingCard({ listing, text, showSource = true }: { listing: Listing; text: string; showSource?: boolean }) {
  const [selected, setSelected] = useState<Evidence[]>([]);
  const source = useRef<HTMLElement>(null);
  function select(spans: Evidence[]) {
    setSelected(spans);
    if (spans.length && showSource && window.innerWidth <= 700) { source.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); source.current?.focus({ preventScroll: true }); }
  }
  const [copied, setCopied] = useState('');
  const active = new Set(selected.map(evidenceKey));
  const rent = receiptRent(listing, text);
  const missing = questions(listing, rent.unverified);
  const fees = listing.fees.filter(fee => fee.type !== 'deposit');
  const deposits = listing.fees.filter(fee => fee.type === 'deposit');
  const fields = [{ title: 'Giá thuê', value: rent.unverified ? rent.main + '. ' + rent.reason : groundedEvidence(text, listing.rent.evidence).length ? rent.main + ' ' + (rent.suffix || 'Chưa rõ kỳ tính giá') : 'Không đề cập' }, ...receiptFields(listing, text)];
  const copyFee = (fee: Listing['fees'][number]) => groundedEvidence(text, fee.evidence).length ? receiptFee(fee) : 'Không có bằng chứng xác định';
  async function copy() {
    try {
      await navigator.clipboard.writeText(['Bản đọc tin TrọCheck', ...fields.map(field => field.title + ': ' + field.value),
        'Phí (tách riêng): ' + (fees.map(fee => feeLabel(fee) + ' ' + copyFee(fee)).join('; ') || 'Không đề cập'),
        'Đặt cọc (tách riêng): ' + (deposits.map(copyFee).join('; ') || 'Không đề cập'),
        'Cần hỏi thêm: ' + (missing.join(' ') || 'Kiểm tra lại với người đăng.'),
        'Nguồn phân tích: ' + window.location.href, 'Đây là giá chào thuê; chưa xác minh thực tế.'].join('\n'));
      setCopied('Đã sao chép bản đọc tin.');
    } catch { setCopied('Chưa sao chép được. Trình duyệt chưa cho phép clipboard.'); }
  }
  return <div className={showSource ? r.layout : r.stack}>
    <div className={r.stack}><Receipt listing={listing} text={text} active={active} onSelect={select} />
      <div><Button variant="secondary" onClick={copy}><Copy size={14} />Sao chép bản đọc tin</Button><p className={s.hint} role="status" style={{ marginTop: 8 }}>{copied}</p></div>
    </div>
    <div className={r.stack}>{showSource && <section ref={source} tabIndex={-1} className={r.source}><h2>Bài đăng gốc</h2><p className={s.hint}>Đã che số điện thoại · Bấm dòng phiếu để xem bằng chứng</p>
      <AnalysisEvidence text={text} evidence={listingEvidence(listing, text)} active={active} onSelect={evidence => setSelected([evidence])} />
      {selected.length > 0 && <div className={r.selection}><p role="status">Đoạn chọn: {keepPhrases(selected.map(evidence => '“' + evidence.quote + '”').join(' · '))}</p><Button variant="ghost" onClick={() => setSelected([])}>Bỏ chọn bằng chứng</Button></div>}
    </section>}<section className={r.questions}><h2>Cần hỏi thêm</h2>
      {missing.length ? <ul>{missing.map(item => <li key={item}>{keepPhrases(item)}</li>)}</ul> : <p className={s.muted}>Các trường chính đã có thông tin. Vẫn cần đối chiếu điều kiện thuê với người đăng.</p>}
      <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(missing.length ? missing.join('\n') : 'Nhờ bạn xác nhận lại điều kiện thuê trong bài.'); setCopied('Đã sao chép câu hỏi.'); } catch { setCopied('Chưa sao chép được. Trình duyệt chưa cho phép clipboard.'); } }}><Copy size={14} />Sao chép câu hỏi</Button></section></div>
  </div>;
}

function ComparisonSection({ listingId, demo, rentReason }: { listingId: string; demo: boolean; rentReason: string }) {
  const [value, setValue] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setValue(null);
    if (rentReason) return () => controller.abort();
    api<Comparison>('listings/' + encodeURIComponent(listingId) + '/comparison?demo=' + demo, { signal: controller.signal }).then(setValue).catch(error => { if (!controller.signal.aborted) setError(messageOf(error)); });
    return () => controller.abort();
  }, [listingId, demo, reload, rentReason]);
  if (rentReason) return <section className={r.comparison}><h2>So với nhóm</h2><p>Chưa thể so sánh vì giá thuê chưa xác định.</p><p className={s.hint}>{rentReason}</p></section>;
  return <section className={r.comparison}><h2>So với nhóm</h2>
    {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !value ? <p className={s.muted} role="status">Đang tìm nhóm tương tự…</p> : <>
      <p style={{ fontSize: 17, fontWeight: 500 }}>{keepPhrases(value.status === 'not_comparable' ? value.message : value.status === 'insufficient_data' || value.n < 10 ? `Chưa đủ dữ liệu để kết luận: mới có ${value.n} tin tương tự (cần ít nhất 10).` : value.status === 'ok' && value.mean_vnd == null ? 'Chưa có giá trung bình từ máy chủ để so sánh.' : value.message)}</p><p className={s.description}>{keepPhrases(PROPERTY_LABEL[value.criteria.property_type ?? 'unknown'] + ' · ' + (value.criteria.ward_name ?? 'Chưa rõ phường'))} · {keepPhrases(value.criteria.basis === 'per_unit' ? 'Theo phòng' : value.criteria.basis === 'per_person' ? 'Theo người' : 'Chưa rõ cơ sở tính')} · <span className={a.phrase}>{value.n.toLocaleString('vi-VN')} tin tương tự</span></p>
      {value.n >= 10 && value.status === 'ok' && value.mean_vnd != null && <p className={s.description}>Giá trung bình <span className={a.phrase}>{formatVnd(value.mean_vnd)}</span> {keepPhrases('/tháng')}{value.mean_per_m2 != null && <> · <span className={a.phrase}>{formatVnd(value.mean_per_m2)}</span>{keepPhrases('/m²/tháng')}</>}</p>}
      {value.reason_codes.length > 0 && <ul className={s.questions}>{value.reason_codes.map(reason => <li key={reason}>{keepPhrases(REASON_TEXT[reason])}</li>)}</ul>}
      <p className={s.hint} style={{ marginTop: 16 }}>{dataRangeSentence(value.data_from, value.data_to)}</p><DataBadge demo={value.is_demo} />
      {value.similar.length > 0 && <div className={s.similarList}>{value.similar.map(item => <Link key={item.listing_id} className={[s.textLink, s.similarLink].join(' ')} href={'/tin/' + item.listing_id + '?demo=' + value.is_demo}><span>{keepPhrases(PROPERTY_LABEL[value.criteria.property_type ?? 'unknown'])}{item.area_m2 == null ? '' : <> · <span className={a.phrase}>{item.area_m2.toLocaleString('vi-VN')} m²</span></>}<small><span className={a.phrase}>{formatVnd(item.rent_vnd)}</span> {keepPhrases('/tháng' + (value.criteria.basis === 'per_person' ? ' /người' : ''))}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>}
    </>}
  </section>;
}
export function Analysis({ id }: { id: string }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let count = 0;
    setError(''); setResult(null); setSelected(0);
    async function poll() {
      try {
        const value = await api<AnalysisResult>('analyses/' + encodeURIComponent(id), { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResult(value);
        if (value.status === 'queued' || value.status === 'running') timer = setTimeout(poll, Math.min(1500 * 1.45 ** count++, 10000));
      } catch (caught) { if (!controller.signal.aborted) setError(messageOf(caught)); }
    }
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [id, reload]);
  async function contribute() {
    if (lock.current) return; lock.current = true; setSaving(true); setSaveError('');
    try { const saved = await api<{ contributed: boolean }>('analyses/' + encodeURIComponent(id) + '/contribute', { method: 'POST', body: '{}' }); if (!saved.contributed) throw new Error('Máy chủ chưa xác nhận đóng góp. Hãy thử lại.'); setResult(value => value ? { ...value, contributed: true } : value); setConfirm(false); }
    catch (caught) { setSaveError(messageOf(caught)); }
    finally { lock.current = false; setSaving(false); }
  }
  const listing = result?.listings[selected];
  return <><Intro eyebrow="Phân tích bài đăng" title="Bản đọc tin của bạn" description="Đọc từng con số cùng đoạn chữ làm căn cứ. Phần thiếu được giữ lại để bạn hỏi thêm." ><Link href="/phan-tich" className={[s.button, s.secondary].join(' ')}>Đọc bài khác</Link></Intro>
    {error && <ErrorNotice message={error} retry={() => setReload(reload + 1)} />}
    {!result ? !error && <Loading label="Đang mở bản đọc tin…" /> : <>
      <div className={[s.between, s.notice].join(' ')}><span className={s.status} role="status">{JOB_NAME[result.status] ?? result.status}</span><div className={s.row}><DataBadge demo={result.is_demo} /><span className={s.mono}>{id.slice(0, 16)}</span></div></div>
      {(result.status === 'queued' || result.status === 'running') && <div className={s.section}><Loading label="Đang đọc bài… Che thông tin · Gán nhãn · So sánh" /><p className={s.notice}>Bạn có thể rời trang và quay lại bằng đường dẫn này. Chưa biết trước tổng việc nên không hiển thị phần trăm.</p></div>}
      {result.status === 'failed' && <div className={s.section}><ErrorNotice message={result.error?.message ?? 'Chưa xử lý được bài. Nhóm vận hành có thể xử lý lại trong kho.'} /></div>}
      {(result.partial || result.llm_status === 'skipped_no_key') && <p className={[s.notice, s.section].join(' ')}>{result.partial ? 'Kết quả một phần: bước LLM gặp lỗi; các bằng chứng đọc được vẫn hiển thị bên dưới.' : 'Kết quả hiện dựa trên Regex. Bước LLM chưa được chạy.'}</p>}
      {!result.text_complete && <p className={[s.notice, s.warning, s.section].join(' ')}>Nội dung chưa được xác nhận là toàn bộ bài. Thông tin thiếu có thể nằm trong phần chưa dán.</p>}
      {result.listings.length > 1 && <div className={[s.row, s.section].join(' ')} aria-label="Chọn tin trong bài">{result.listings.map((item, index) => <button key={item.listing_id} className={s.chip} aria-pressed={selected === index} onClick={() => setSelected(index)}>Tin {index + 1}</button>)}</div>}
      {listing ? <div className={s.section}><ReadingCard key={listing.listing_id} listing={listing} text={result.text ?? ''} /><ComparisonSection listingId={listing.listing_id} demo={result.is_demo} rentReason={receiptRent(listing, result.text ?? '').reason} /></div> :
        result.status === 'succeeded' && <Empty title={result.post_type === 'seeking' ? 'Đây là bài tìm phòng, không trích giá' : 'Không có tin cho thuê được trích xuất'}><p>{result.post_type === 'seeking' ? 'Hệ thống không biến ngân sách tìm phòng thành giá chào thuê.' : 'Không tạo giá thuê khi không có căn cứ.'}</p></Empty>}
      {result.text && !listing && <section className={[s.panel, s.section].join(' ')}><h2 className={s.panelTitle}>Nội dung đã gửi</h2><p className={s.source} data-quote>{keepPhrases(result.text)}</p></section>}
      {result.status === 'succeeded' && <section className={r.contribution}><div className={s.between}><div><h2 className={s.panelTitle}>{result.contributed ? 'Bài đã được đóng góp' : 'Đóng góp bài vào kho'}</h2><p className={s.muted}>{result.contributed ? 'Bài vẫn chịu các điều kiện duyệt và thống kê của kho.' : 'Bạn tự chọn đóng góp. Hiện bài chưa tham gia kho so sánh.'}</p></div>{!result.contributed && <Button variant="secondary" onClick={() => { setConfirm(true); setSaveError(''); }}>Đóng góp bài vào kho</Button>}</div></section>}
      {result.is_demo && <p className={[s.notice, s.section].join(' ')}>Bài tự tạo được tách khỏi kho thật và không dùng để kết luận thị trường thực tế.</p>}
    </>}
    {confirm && <Modal title="Đóng góp vào kho chung?" onClose={() => setConfirm(false)} busy={saving}><p>Bài và kết quả đã che số điện thoại sẽ được nhóm sử dụng. Hãy chắc rằng bạn đã xóa tên, email và nội dung riêng tư còn lại.</p>{saveError && <ErrorNotice message={saveError} />}<div className={s.actions} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:enabled');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
    }}><button type="button" className={[s.button, s.secondary].join(' ')} autoFocus disabled={saving} onClick={() => setConfirm(false)}>Để riêng</button><button type="button" className={s.button} disabled={saving} aria-busy={saving || undefined} onClick={contribute}>{saving ? 'Đang đóng góp…' : 'Đồng ý đóng góp'}</button></div></Modal>}
  </>;
}
