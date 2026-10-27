'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Copy } from 'lucide-react';
import type { Comparison, Evidence, Listing } from '@/lib/api/types';
import type { AnalysisResult } from '@/lib/workspace/types';
import { api, messageOf } from '@/lib/workspace/client';
import { EvidenceHighlighter } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import { evidenceKey } from '@/lib/evidence';
import { FEE_LABEL, PROPERTY_LABEL, REASON_TEXT, dataRangeSentence, feeValue, formatPercent, formatVnd, rentHeadline } from '@/lib/format';
import { Button, DataBadge, Empty, ErrorNotice, Intro, Loading, Modal, s } from './ui';

const JOB_NAME: Record<string, string> = { queued: 'Đang chờ xử lý', running: 'Đang đọc bài', succeeded: 'Đã đọc xong', failed: 'Xử lý chưa thành công' };
const META_NAME: Record<string, string> = { both_agree: 'Regex và LLM khớp', regex_only: 'Bằng chứng Regex', llm_only: 'Bằng chứng LLM', conflict: 'Cần kiểm tra lại', human: 'Đã được người duyệt chọn' };
function allEvidence(listing: Listing) {
  return [...listing.rent.evidence, ...listing.area.evidence, ...listing.room.evidence, ...listing.location.evidence, ...listing.fees.flatMap(fee => fee.evidence ?? [])];
}
function questions(listing: Listing) {
  const rows: string[] = [];
  if (listing.rent.amount_form === 'none') rows.push('Giá thuê cụ thể là bao nhiêu? Bài chưa có giá để đối chiếu.');
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
  const [copied, setCopied] = useState('');
  const active = new Set(selected.map(evidenceKey));
  const rent = rentHeadline(listing.rent);
  const missing = questions(listing);
  const fees = listing.fees.filter(fee => fee.type !== 'deposit');
  const deposits = listing.fees.filter(fee => fee.type === 'deposit');
  const fields = [
    { title: 'Giá thuê', value: rent.main + ' ' + rent.suffix, meta: listing.rent },
    { title: 'Diện tích', value: listing.area.amount_form === 'exact' && listing.area.value_m2 != null ? listing.area.value_m2 + ' m²' :
      listing.area.amount_form === 'range' ? listing.area.min_m2 + '–' + listing.area.max_m2 + ' m²' : 'Chưa ghi rõ', meta: listing.area },
    { title: 'Vị trí', value: [listing.location.street, listing.location.ward_name, listing.location.landmark].filter(Boolean).join(' · ') || 'Chưa xác định', meta: listing.location },
    { title: 'Loại phòng', value: PROPERTY_LABEL[listing.room.property_type], meta: listing.room },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(['Bản đọc tin ReNER', ...fields.map(field => field.title + ': ' + field.value),
        'Phí (tách riêng): ' + (fees.map(fee => FEE_LABEL[fee.type] + ' ' + feeValue(fee) + (fee.unit === 'unknown' ? ' (chưa rõ đơn vị)' : '')).join('; ') || 'Chưa ghi rõ'),
        'Đặt cọc (tách riêng): ' + (deposits.map(feeValue).join('; ') || 'Chưa ghi rõ'),
        'Cần hỏi thêm: ' + (missing.join(' ') || 'Kiểm tra lại với người đăng.'),
        'Nguồn phân tích: ' + window.location.href, 'Đây là giá chào thuê; chưa xác minh thực tế.'].join('\n'));
      setCopied('Đã sao chép bản đọc tin.');
    } catch { setCopied('Chưa sao chép được. Trình duyệt chưa cho phép clipboard.'); }
  }
  return <div className={showSource ? s.reading : s.stack}>
    {showSource && <section className={[s.panel, s.sourcePane, s.evidencePane].join(' ')}><div className={s.panelHead}><h2 className={s.panelTitle}>Nguyên văn & bằng chứng</h2><span className={s.muted}>Đã che số điện thoại</span></div>
      <EvidenceHighlighter text={text} evidence={allEvidence(listing)} active={active} onSelect={evidence => setSelected([evidence])} />
      {selected.length > 0 && <div className={s.section}><p className={s.notice}>Đoạn chọn: {selected.map(evidence => '“' + evidence.quote + '”').join(' · ')}</p><Button variant="ghost" onClick={() => setSelected([])}>Bỏ chọn bằng chứng</Button></div>}
    </section>}
    <div className={s.stack}><section className={s.panel}><p className={s.eyebrow}>Bản đọc tin</p><h2 className={s.panelTitle}>Những điều bài đã nói</h2>
      {fields.map(field => <button className={s.fieldRow} key={field.title} type="button" aria-pressed={field.meta.evidence.some(evidence => active.has(evidenceKey(evidence)))} onClick={() => setSelected(field.meta.evidence)}>
        <span className={s.label}>{field.title}</span><span><strong>{field.value}</strong><small>{field.meta.evidence.length ? META_NAME[field.meta.agreement ?? ''] ?? 'Có đoạn trích trong bài' : 'Không có bằng chứng xác định'}</small></span><ChevronRight size={14} /></button>)}
      <div className={s.section}><h3 className={s.label}>Các khoản phí — tách khỏi giá thuê</h3>
        {fees.length ? <ul className={s.feeList}>{fees.map((fee, index) => <li key={fee.type + ':' + index}><button className={s.textLink} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit' }} onClick={() => setSelected(fee.evidence ?? [])}>{FEE_LABEL[fee.type]}{fee.type === 'other' && fee.evidence?.[0] ? ' · ' + fee.evidence[0].quote : ''}</button><span>{feeValue(fee)}{fee.unit === 'unknown' && <small className={s.muted}> · chưa rõ đơn vị</small>}</span></li>)}</ul> : <p className={s.muted}>Bài chưa có khoản phí đọc được. Không có thông tin không có nghĩa là miễn phí.</p>}
        <p className={s.hint} style={{ marginTop: 14 }}>Không cộng phí với tiền thuê hoặc tự nhân giá theo người.</p></div>
      <div className={s.section}><h3 className={s.label}>Đặt cọc</h3>{deposits.length ? <ul className={s.feeList}>{deposits.map((fee, index) => <li key={index}><button type="button" className={s.quoteButton} onClick={() => setSelected(fee.evidence ?? [])}>Xem bằng chứng cọc</button><span>{feeValue(fee)}{fee.unit === 'unknown' && <small className={s.muted}> · chưa rõ đơn vị</small>}</span></li>)}</ul> : <p className={s.muted}>Bài chưa ghi rõ khoản cọc.</p>}<p className={s.hint}>Giữ riêng khoản cọc, không cộng vào giá thuê hoặc tổng phí.</p></div>
    </section><section className={[s.panel, missing.length ? s.warning : ''].join(' ')}><h2 className={s.panelTitle}>Cần hỏi thêm</h2>
      {missing.length ? <ul className={s.questions}>{missing.map(item => <li key={item}>{item}</li>)}</ul> : <p className={s.muted}>Các trường chính đã có thông tin. Vẫn cần đối chiếu điều kiện thuê với người đăng.</p>}</section>
      <div><Button variant="secondary" onClick={copy}><Copy size={14} />Sao chép bản đọc tin</Button><p className={s.hint} role="status" style={{ marginTop: 8 }}>{copied}</p></div>
    </div></div>;
}
function ComparisonSection({ listingId, demo }: { listingId: string; demo: boolean }) {
  const [value, setValue] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setValue(null);
    api<Comparison>('listings/' + encodeURIComponent(listingId) + '/comparison?demo=' + demo, { signal: controller.signal }).then(setValue).catch(error => { if (!controller.signal.aborted) setError(messageOf(error)); });
    return () => controller.abort();
  }, [listingId, demo, reload]);
  return <section className={[s.panel, s.section].join(' ')}><h2 className={s.panelTitle}>Ngữ cảnh so sánh</h2>
    {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !value ? <p className={s.muted} role="status">Đang tìm nhóm tương tự…</p> : <>
      <p style={{ fontSize: 17, fontWeight: 500 }}>{value.status === 'insufficient_data' || value.n < 10 ? `Chưa đủ dữ liệu để kết luận: mới có ${value.n} tin tương tự (cần ít nhất 10).` : value.status === 'ok' && value.delta_percent != null && value.verdict ? value.verdict === 'near' ? `Giá chào thuê gần trung vị nhóm (chênh lệch ${value.delta_percent > 0 ? '+' : value.delta_percent < 0 ? '−' : ''}${formatPercent(value.delta_percent)}).` : `Giá chào thuê ${value.verdict === 'higher' ? 'cao hơn' : 'thấp hơn'} trung vị nhóm khoảng ${formatPercent(value.delta_percent)}.` : value.message}</p><p className={s.description}>{PROPERTY_LABEL[value.criteria.property_type ?? 'unknown']} · {value.criteria.ward_name ?? 'Chưa rõ phường'} · {value.criteria.basis === 'per_unit' ? 'Theo phòng' : value.criteria.basis === 'per_person' ? 'Theo người' : 'Chưa rõ cơ sở tính'} · N = {value.n}</p>
      {value.n >= 10 && value.status === 'ok' && value.median != null && <p className={s.description}>Trung vị {formatVnd(value.median)} · P25 {value.p25 == null ? '—' : formatVnd(value.p25)} · P75 {value.p75 == null ? '—' : formatVnd(value.p75)}</p>}
      {value.reason_codes.length > 0 && <ul className={s.questions}>{value.reason_codes.map(reason => <li key={reason}>{REASON_TEXT[reason]}</li>)}</ul>}
      <p className={s.hint} style={{ marginTop: 16 }}>{dataRangeSentence(value.data_from, value.data_to)}</p><DataBadge demo={value.is_demo} />
      {value.similar.length > 0 && <div className={s.similarList}>{value.similar.map(item => <Link key={item.listing_id} className={[s.textLink, s.similarLink].join(' ')} href={'/tin/' + item.listing_id + '?demo=' + value.is_demo}><span>{PROPERTY_LABEL[value.criteria.property_type ?? 'unknown']}{item.area_m2 == null ? '' : ' · ' + item.area_m2.toLocaleString('vi-VN') + ' m²'}<small>{formatVnd(item.rent_vnd)} / tháng{value.criteria.basis === 'per_person' ? ' / người' : value.criteria.basis === 'per_unit' ? ' / phòng' : ''}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>}
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
    setError('');
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
    try { await api('analyses/' + encodeURIComponent(id) + '/contribute', { method: 'POST', body: '{}' }); setResult(value => value ? { ...value, contributed: true } : value); setConfirm(false); }
    catch (caught) { setSaveError(messageOf(caught)); }
    finally { lock.current = false; setSaving(false); }
  }
  const listing = result?.listings[selected];
  return <><Intro eyebrow="Phân tích bài đăng" title="Bản đọc tin của bạn" description="Đọc từng con số cùng đoạn chữ làm căn cứ. Phần thiếu được giữ lại để bạn hỏi thêm." ><Link href="/phan-tich" className={[s.button, s.secondary].join(' ')}>Đọc bài khác</Link></Intro>
    {error && <ErrorNotice message={error} retry={() => setReload(reload + 1)} />}
    {!result ? !error && <Loading label="Đang mở bản đọc tin…" /> : <>
      <div className={[s.between, s.notice].join(' ')}><span className={s.status} role="status">{JOB_NAME[result.status] ?? result.status}</span><div className={s.row}><DataBadge demo={result.is_demo} /><span className={s.mono}>{id.slice(0, 16)}</span></div></div>
      {(result.status === 'queued' || result.status === 'running') && <p className={[s.notice, s.section].join(' ')}>Bài đã được lưu vào hàng xử lý. Bạn có thể rời trang và quay lại bằng đường dẫn này. Không cần giữ tab để máy chủ xử lý.</p>}
      {result.status === 'failed' && <div className={s.section}><ErrorNotice message={result.error?.message ?? 'Chưa xử lý được bài. Nhóm vận hành có thể xử lý lại trong kho.'} /></div>}
      {(result.partial || result.llm_status === 'skipped_no_key') && <p className={[s.notice, s.section].join(' ')}>{result.partial ? 'Kết quả một phần: bước LLM gặp lỗi; các bằng chứng đọc được vẫn hiển thị bên dưới.' : 'Kết quả hiện dựa trên Regex. Bước LLM chưa được chạy.'}</p>}
      {!result.text_complete && <p className={[s.notice, s.warning, s.section].join(' ')}>Nội dung chưa được xác nhận là toàn bộ bài. Thông tin thiếu có thể nằm trong phần chưa dán.</p>}
      {result.listings.length > 1 && <div className={[s.row, s.section].join(' ')} aria-label="Chọn tin trong bài">{result.listings.map((item, index) => <button key={item.listing_id} className={s.chip} aria-pressed={selected === index} onClick={() => setSelected(index)}>Tin {index + 1}</button>)}</div>}
      {listing ? <div className={s.section}><ReadingCard key={listing.listing_id} listing={listing} text={result.text ?? ''} /><ComparisonSection listingId={listing.listing_id} demo={result.is_demo} /></div> :
        result.status === 'succeeded' && <Empty title="Không có tin cho thuê được trích xuất"><p>Bài được phân loại {result.post_type === 'seeking' ? 'tìm phòng' : result.post_type === 'roommate' ? 'tìm người ở ghép' : 'chưa có tin phù hợp'}. Không tạo giá thuê khi không có căn cứ.</p></Empty>}
      {result.text && !listing && <section className={[s.panel, s.section].join(' ')}><h2 className={s.panelTitle}>Nội dung đã gửi</h2><p className={s.source}>{result.text}</p></section>}
      {result.status === 'succeeded' && !result.is_demo && <section className={[s.panel, s.section].join(' ')}><div className={s.between}><div><h2 className={s.panelTitle}>{result.contributed ? 'Bài đã được đóng góp' : 'Chia sẻ vào kho chung?'}</h2><p className={s.muted}>{result.contributed ? 'Bài vẫn chịu các điều kiện duyệt và thống kê của kho.' : 'Bạn tự chọn đóng góp. Hiện bài chưa tham gia kho so sánh.'}</p></div>{!result.contributed && <Button variant="secondary" onClick={() => { setConfirm(true); setSaveError(''); }}>Đóng góp bài này</Button>}</div></section>}
      {result.is_demo && <p className={[s.notice, s.section].join(' ')}>Bài tự tạo được tách khỏi kho thật và không dùng để kết luận thị trường thực tế.</p>}
    </>}
    {confirm && <Modal title="Đóng góp vào kho chung?" onClose={() => setConfirm(false)} busy={saving}><p>Bài và kết quả đã che số điện thoại sẽ được nhóm sử dụng. Hãy chắc rằng bạn đã xóa tên, email và nội dung riêng tư còn lại.</p>{saveError && <ErrorNotice message={saveError} />}<div className={s.actions}><Button variant="secondary" autoFocus disabled={saving} onClick={() => setConfirm(false)}>Để riêng</Button><Button busy={saving} onClick={contribute}>{saving ? 'Đang đóng góp…' : 'Đồng ý đóng góp'}</Button></div></Modal>}
  </>;
}
