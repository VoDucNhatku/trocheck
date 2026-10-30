'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { components } from '@/lib/api/generated';
import type { Evidence, Label, Listing } from '@/lib/api/types';
import { evidenceKey, segment } from '@/lib/evidence';
import { LABEL_NAME, LABEL_TEXT, PROPERTY_LABEL } from '@/lib/format';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import type { LabResult } from '@/lib/workspace/types';
import { Button, Empty, ErrorNotice, Intro, Loading, s } from '@/features/workspace/ui';
import { Phrases, feeLabel, reviewFeeValue, reviewRent } from '../../duyet/_components/display';
import { ExportData } from '../../_components/ExportData';
import r from './lab.module.css';

type Gold = components['schemas']['GoldResult'];
type ExtractedListing = Pick<Listing, 'rent' | 'area' | 'room' | 'location' | 'fees'>;
type GoldState = { state: 'loading' | 'missing' | 'locked' | 'error'; message: string }
  | { state: 'ready'; value: Gold; evidence: Evidence[] };
type Selection = { label: Label; method?: string; span?: Evidence };
const FIELDS: { field: keyof ExtractedListing; title: string; label: Label }[] = [
  { field: 'rent', title: 'Giá thuê', label: 'PRICE' },
  { field: 'area', title: 'Diện tích', label: 'AREA' },
  { field: 'location', title: 'Vị trí', label: 'LOC' },
  { field: 'room', title: 'Loại / số phòng', label: 'ROOM' },
  { field: 'fees', title: 'Phí (tách riêng)', label: 'FEE' },
];
const LABELS = FIELDS.map(field => field.label);
const POST_TYPE: Record<string, string> = { rental_offer: 'Cho thuê', seeking: 'Cần thuê', roommate: 'Tìm người ở ghép', sale: 'Mua bán', spam: 'Spam', other: 'Khác' };

function goldEvidence(value: Gold, text: string): Evidence[] {
  const cps = Array.from(text);
  return value.spans.flatMap(span => {
    const { start, end, label } = span;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isInteger(start) || !Number.isInteger(end)
      || start < 0 || end <= start || end > cps.length || !LABELS.includes(label as Label)) return [];
    const quote = cps.slice(start, end).join('');
    if (span.quote != null && span.quote !== quote) return [];
    return [{ start, end, label: label as Label, quote, method: 'human' as const }];
  });
}

// The extraction schema is shared with Listing; Lab objects have no persisted listing_id.
function extracted(value: unknown): ExtractedListing[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object') as ExtractedListing[];
}
function fieldValue(listing: ExtractedListing, field: keyof ExtractedListing): string {
  if (field === 'rent') {
    return listing.rent ? reviewRent(listing.rent) : 'Không đề cập';
  }
  if (field === 'area') {
    const area = listing.area;
    if (area?.amount_form === 'exact' && area.value_m2 != null) return area.value_m2.toLocaleString('vi-VN') + ' m²';
    if (area?.amount_form === 'range') return (area.min_m2?.toLocaleString('vi-VN') ?? 'Chưa rõ') + '–' + (area.max_m2?.toLocaleString('vi-VN') ?? 'chưa rõ') + ' m²';
    return 'Không đề cập';
  }
  if (field === 'room') {
    const room = listing.room;
    return [room?.property_type && room.property_type !== 'unknown' ? PROPERTY_LABEL[room.property_type] : '', room?.bedrooms != null ? room.bedrooms.toLocaleString('vi-VN') + ' phòng ngủ' : ''].filter(Boolean).join(' · ') || 'Không đề cập';
  }
  if (field === 'location') {
    const location = listing.location;
    return [location?.street, location?.ward_name, location?.landmark].filter(Boolean).join(' · ') || 'Không đề cập';
  }
  return listing.fees?.map(fee => feeLabel(fee) + ': ' + reviewFeeValue(fee)).join('; ') || 'Không đề cập';
}
function Values({ listings, field }: { listings: ExtractedListing[]; field: keyof ExtractedListing }) {
  return listings.length ? <>{listings.map((listing, index) => <p key={index}>{listings.length > 1 && <b>Tin {index + 1}: </b>}<Phrases text={fieldValue(listing, field)} /></p>)}</>
    : <span className={r.hint}>Không có listing trong kết quả.</span>;
}

export function Lab() {
  const [mode, setMode] = useState<'text' | 'post'>('text');
  const [text, setText] = useState('');
  const [postId, setPostId] = useState('');
  const [result, setResult] = useState<LabResult | null>(null);
  const [gold, setGold] = useState<GoldState | null>(null);
  const [goldReload, setGoldReload] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const running = useRef<AbortController | null>(null);
  const count = Array.from(text).length;
  useEffect(() => () => { running.current?.abort(); }, []);

  useEffect(() => {
    setGold(null);
    if (!result) return;
    if (result.split === 'test') { setGold({ state: 'locked', message: 'Nhãn tập test bị khóa. Không dùng nhãn test để chỉnh rule hoặc prompt.' }); return; }
    if (!result.post_id) { setGold({ state: 'missing', message: 'Văn bản dán chưa gắn với post_id. Không có nhãn chuẩn để đối chiếu.' }); return; }
    const controller = new AbortController();
    setGold({ state: 'loading', message: 'Đang kiểm tra quyền đọc nhãn chuẩn…' });
    api<Gold>('lab/gold/' + encodeURIComponent(result.post_id), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    }).then(value => {
      if (controller.signal.aborted) return;
      if (value.split === 'test') setGold({ state: 'locked', message: 'Nhãn tập test bị khóa.' });
      else setGold({ state: 'ready', value, evidence: goldEvidence(value, result.text) });
    }).catch(caught => {
      if (controller.signal.aborted) return;
      if (caught instanceof WorkspaceError && caught.status === 404) setGold({ state: 'missing', message: 'API xác nhận bài này chưa có nhãn chuẩn.' });
      else if (caught instanceof WorkspaceError && caught.status === 403) setGold({ state: 'locked', message: 'API không cho phép đọc nhãn chuẩn của bài này.' });
      else setGold({ state: 'error', message: messageOf(caught) });
    });
    return () => controller.abort();
  }, [result, goldReload]);

  async function run(event?: FormEvent) {
    event?.preventDefault();
    if (running.current) return;
    setError(''); setInvalid(false);
    if (mode === 'text' ? !text.trim() || count > 20000 : !postId.trim()) {
      setInvalid(true);
      setError(mode === 'text' ? 'Nhập văn bản từ 1 đến 20.000 ký tự Unicode.' : 'Nhập post_id của bài có sẵn.');
      return;
    }
    const controller = new AbortController(); running.current = controller;
    setBusy(true); setResult(null); setGold(null); setSelection(null);
    try {
      const value = await api<LabResult>('lab/run', {
        method: 'POST', body: JSON.stringify(mode === 'text' ? { text } : { post_id: postId.trim() }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!controller.signal.aborted) setResult(value);
    } catch (caught) {
      if (!controller.signal.aborted) {
        if (caught instanceof WorkspaceError && caught.status === 403) window.location.replace('/team/403');
        else setError(messageOf(caught));
      }
    } finally {
      if (running.current === controller) running.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const regex = result?.rows.find(row => row.method === 'regex');
  const regexAvailable = !!regex && regex.available !== false;
  const llm = result?.rows.find(row => row.method === 'llm');
  const llmAvailable = llm?.available === true;
  const goldReady = result?.split !== 'test' && gold?.state === 'ready';
  const goldMessage = gold && gold.state !== 'ready' ? gold.message : 'Đang kiểm tra nhãn chuẩn…';
  const methods = result ? [
    { key: 'regex', title: 'Regex', available: regexAvailable, evidence: regex?.evidence ?? [], message: 'Chưa có kết quả Regex trong phản hồi API.' },
    { key: 'llm', title: 'LLM', available: llmAvailable, evidence: llm?.evidence ?? [], message: 'Chưa có kết quả LLM lưu sẵn. Đây không phải kết quả trích xuất rỗng.' },
    { key: 'gold', title: 'Nhãn chuẩn', available: goldReady, evidence: goldReady ? gold.evidence : [], message: goldMessage },
  ] : [];
  function active(evidence: Evidence[]) {
    return new Set(evidence.filter(span => selection && span.label === selection.label
      && (!selection.span || evidenceKey(span) === evidenceKey(selection.span))).map(evidenceKey));
  }

  return <><Intro eyebrow="Không gian nghiên cứu" title="Kiểm tra trích xuất" description="Đặt bằng chứng Regex, LLM và nhãn chuẩn cạnh nhau. Chọn một trường để lần về đúng đoạn chữ làm căn cứ."><ExportData /></Intro>
    <div className={r.stack}>
      <section className={r.inputSheet} aria-labelledby="lab-input-title">
        <div className={r.heading}><h2 id="lab-input-title"><span className={r.step}>01</span>Chọn nội dung đối chiếu</h2><span className={r.hint}>Không gọi LLM mới</span></div>
        <form onSubmit={run} className={r.inputGrid}>
          <div><fieldset className={r.modes} disabled={busy}><legend>Nguồn đầu vào</legend>
            <label><input type="radio" name="lab-mode" value="text" checked={mode === 'text'} onChange={() => { setMode('text'); setInvalid(false); setError(''); }} />Dán văn bản</label>
            <label><input type="radio" name="lab-mode" value="post" checked={mode === 'post'} onChange={() => { setMode('post'); setInvalid(false); setError(''); }} />Bài có sẵn (post_id)</label>
          </fieldset>
            {mode === 'text' ? <div className={s.field}><label className={s.label} htmlFor="lab-text">Văn bản bài đăng</label>
              <textarea id="lab-text" className={[s.textarea, r.textInput].join(' ')} value={text} disabled={busy} aria-invalid={invalid || count > 20000} aria-describedby="lab-input-hint"
                onChange={event => setText(event.target.value)} />
              <p id="lab-input-hint" className={r.hint}>{count.toLocaleString('vi-VN')} / 20.000 ký tự Unicode. Hãy xóa tên, email và thông tin riêng tư trước khi gửi; API che số điện thoại.</p>
            </div> : <div className={s.field}><label className={s.label} htmlFor="lab-post">Mã bài (post_id)</label>
              <input id="lab-post" className={[s.input, r.input].join(' ')} value={postId} disabled={busy} aria-invalid={invalid} aria-describedby="lab-input-hint" autoComplete="off" onChange={event => setPostId(event.target.value)} />
              <p id="lab-input-hint" className={r.hint}>Dùng mã bài có sẵn trong API. Nội dung và nhãn được đọc theo bài đó; không tìm bài bằng mã ví dụ.</p>
            </div>}
            <div className={r.actions}><Button type="submit" busy={busy}>{busy ? 'Đang đối chiếu…' : 'Chạy đối chiếu'}</Button><span className={r.hint}>Regex chạy trên nội dung đã che số điện thoại.</span></div>
          </div>
          <aside className={r.guide}><h3>Đọc kết quả có căn cứ</h3><p>LLM chỉ hiển thị kết quả đã lưu hoặc có trong cache. Chưa có kết quả được ghi rõ, không coi là đã chạy.</p><p>Nhãn chuẩn do API kiểm quyền. Tập test luôn được giữ khóa; Kiểm tra trích xuất không sửa nhãn, rule hay prompt.</p></aside>
        </form>
      </section>
      {error && <ErrorNotice message={error} retry={invalid ? undefined : () => void run()} />}
      {busy && <Loading label="Đang chạy Regex và đọc kết quả đối chiếu…" />}
      {!busy && !result && !error && <Empty title="Chưa chạy đối chiếu"><p className={r.hint}>Dán một bài hoặc nhập post_id rồi chạy. Chỉ hiện kết quả sau khi API trả về.</p></Empty>}
      {result && <>
        <section className={r.section} aria-labelledby="lab-evidence-title">
          <div className={r.heading}><h2 id="lab-evidence-title"><span className={r.step}>02</span>Bằng chứng trên cùng nguyên văn</h2><span className={s.badge}>Đã nhận kết quả API</span></div>
          <div className={s.row}><span className={r.hint}>Loại bài: {POST_TYPE[result.post_type] ?? result.post_type}</span>
            {result.post_id && <span className={r.mono}>post_id: {result.post_id}</span>}{result.split && <span className={s.badge}>Tập {result.split}</span>}</div>
          <ul className={r.legend} aria-label="Chú giải nhãn bằng chứng">{FIELDS.map(field => <li key={field.label}><span className={[r.swatch, r[field.label]].join(' ')}>{LABEL_TEXT[field.label]}</span>{LABEL_NAME[field.label]}</li>)}</ul>
          <div className={r.methods}>{methods.map(method => <section key={method.key} className={r.method} aria-label={'Bằng chứng ' + method.title}>
            <div className={r.methodHead}><h3>{method.title}</h3><p>{method.available ? method.evidence.length + ' đoạn bằng chứng' : method.key === 'gold' && result.split === 'test' ? 'Tập test · bị khóa' : method.key === 'gold' && gold?.state === 'loading' ? 'Đang đọc nhãn' : 'Chưa có kết quả được phép đọc'}</p></div>
            {method.available ? <>
              {method.evidence.length === 0 && <p className={r.hint}>{method.key === 'gold' ? 'Nhãn chuẩn có sẵn, không có span hợp lệ.' : 'Đã chạy, không tìm thấy span.'}</p>}
              <div className={r.source}><EvidenceText text={result.text} evidence={method.evidence} active={active(method.evidence)} onSelect={span => setSelection({ label: span.label, method: method.title, span })} /></div>
            </> : <p className={r.hint} role={method.key === 'gold' && gold?.state === 'loading' ? 'status' : method.key === 'gold' && gold?.state === 'error' ? 'alert' : undefined}>{method.message}</p>}
            {method.key === 'gold' && gold?.state === 'error' && <Button variant="ghost" onClick={() => setGoldReload(value => value + 1)}>Thử đọc nhãn lại</Button>}
            {method.key === 'gold' && goldReady && <p className={r.hint}>{gold.value.adjudicated ? 'Đã hòa giải nhãn' : 'Chưa hòa giải nhãn'}</p>}
          </section>)}</div>
          <div className={r.selection} role="status" aria-live="polite">
            {selection ? <><p><strong>{LABEL_NAME[selection.label]}</strong>{selection.method && ' · ' + selection.method}{selection.span ? ' · “' + selection.span.quote + '”' : ' · Đã chọn các bằng chứng thuộc trường này.'}</p>
              {selection.span && <p className={r.mono}>Offset Unicode [{selection.span.start}, {selection.span.end}){selection.span.rule_id && ' · Rule: ' + selection.span.rule_id}</p>}
              {!methods.some(method => method.available && method.evidence.some(span => span.label === selection.label)) && <p>Không có bằng chứng thuộc trường này trong các kết quả đang có.</p>}
              <Button variant="ghost" onClick={() => setSelection(null)}>Bỏ chọn bằng chứng</Button></> : 'Chọn một đoạn được tô nhãn hoặc một trường bên dưới để đối chiếu bằng chứng.'}
          </div>
        </section>
        <section className={r.section} aria-labelledby="lab-values-title">
          <div className={r.heading}><h2 id="lab-values-title"><span className={r.step}>03</span>Giá trị chuẩn hóa</h2></div>
          <div className={r.scroll} role="region" aria-label="Bảng giá trị chuẩn hóa" tabIndex={0}><table className={[r.table, r.values].join(' ')}>
            <caption>Giữ đơn vị từ API; giá thuê và phí tách riêng. Cuộn ngang để đọc đủ ba phương pháp trên màn hình nhỏ.</caption>
            <thead><tr><th scope="col">Trường</th><th scope="col">Regex</th><th scope="col">LLM</th><th scope="col">Nhãn chuẩn</th></tr></thead>
            <tbody>{FIELDS.map(field => <tr key={field.field}><th scope="row"><button type="button" className={r.fieldButton} aria-pressed={selection?.label === field.label} onClick={() => setSelection({ label: field.label })}>{field.title}</button></th>
              <td>{regexAvailable ? <Values listings={extracted(result.listings.regex)} field={field.field} /> : 'Chưa có kết quả'}</td>
              <td>{llmAvailable ? <Values listings={extracted(result.listings.llm)} field={field.field} /> : <span className={r.hint}>LLM chưa có kết quả lưu sẵn.</span>}</td>
              <td>{goldReady ? gold.value.expected == null ? 'Nhãn chuẩn chưa có giá trị chuẩn hóa.' : <Values listings={extracted(gold.value.expected.listings)} field={field.field} /> : <span className={r.hint}>{goldMessage}</span>}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <section className={r.section} aria-label="Chi tiết kỹ thuật trích xuất">
          <details className={r.disclosure} data-token-details><summary>Bảng token BIO · {result.tokens.length.toLocaleString('vi-VN')} token</summary>
            {result.tokens.length ? <div className={[r.scroll, r.tokenScroll].join(' ')} role="region" tabIndex={0} aria-label="Bảng token BIO"><table className={r.table}><caption>B-: đầu thực thể; I-: tiếp nối; O: ngoài thực thể. “Khác nhãn” chỉ so Regex với LLM có sẵn, không kết luận bên nào đúng.</caption>
              <thead><tr><th scope="col">Token</th><th scope="col">Regex</th><th scope="col">LLM</th><th scope="col">Nhãn chuẩn</th></tr></thead>
              <tbody>{result.tokens.map((token, index) => <tr key={index} className={regexAvailable && llmAvailable && token.regex !== token.llm ? r.different : undefined}><th scope="row" className={r.mono} data-quote>{token.token}{regexAvailable && llmAvailable && token.regex !== token.llm && <span className={r.diffLabel}>Khác nhãn</span>}</th><td className={r.mono}>{regexAvailable ? token.regex : 'Chưa có'}</td><td className={r.mono}>{llmAvailable ? token.llm : 'Chưa có'}</td><td className={r.mono}>{goldReady ? token.gold ?? 'Chưa có BIO' : result.split === 'test' ? 'Bị khóa' : 'Chưa có'}</td></tr>)}</tbody>
            </table></div> : <p className={r.hint}>API đã trả về danh sách token rỗng.</p>}
          </details>
          <details className={r.disclosure} data-after-tokens><summary>Chuỗi chuẩn hóa do API trả về</summary><pre className={r.pre}>{JSON.stringify(result.normalized.map(row => ({ field: row.field, regex: regexAvailable ? row.regex : null, llm: llmAvailable ? row.llm : null, gold: goldReady ? row.gold : null })), null, 2)}</pre></details>
        </section>
      </>}
    </div>
  </>;
}

// Route-local version until the shared highlighter supports 12px labels and phrase wrapping.
function EvidenceText({ text, evidence, active, onSelect }: { text: string; evidence: Evidence[]; active: Set<string>; onSelect: (span: Evidence) => void }) {
  const points = Array.from(text);
  const grounded = evidence.filter(span => Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= points.length && points.slice(span.start, span.end).join('') === span.quote);
  return <p className={r.evidence} data-evidence>{segment(text, grounded).map((part, index) => part.span ? <button key={index} type="button" className={[r.mark, r[part.span.label]].join(' ')} aria-pressed={active.has(evidenceKey(part.span))} onClick={() => onSelect(part.span!)}><span className={r.tag}>{LABEL_TEXT[part.span.label]}</span><Phrases text={part.text} /></button> : <span key={index}><Phrases text={part.text} /></span>)}</p>;
}
