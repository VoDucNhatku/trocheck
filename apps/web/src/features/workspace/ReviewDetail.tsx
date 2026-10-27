'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Evidence, Listing } from '@/lib/api/types';
import type { ReviewDetail as Detail, ReviewDecision, ReviewSaved } from '@/lib/workspace/types';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import { EvidenceHighlighter } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import { evidenceKey } from '@/lib/evidence';
import { FEE_LABEL, PROPERTY_LABEL, feeValue, formatDate, formatVnd, rentHeadline } from '@/lib/format';
import { REASON_NAME } from './Team';
import { Button, ErrorNotice, Intro, Loading, Modal, s } from './ui';

const GROUPS = ['rent', 'area', 'room', 'location', 'fees'] as const;
type Group = typeof GROUPS[number];
const GROUP_NAME: Record<Group, string> = { rent: 'Giá thuê', area: 'Diện tích', room: 'Loại / số phòng', location: 'Vị trí', fees: 'Phí và đặt cọc' };
const LABEL: Record<Group, Evidence['label']> = { rent: 'PRICE', area: 'AREA', room: 'ROOM', location: 'LOC', fees: 'FEE' };
const ACTION_NAME: Record<ReviewDecision['action'], string> = { approve: 'Chấp nhận tin', reject: 'Loại tin', split: 'Tách khỏi cụm trùng', merge: 'Gộp vào cụm trùng' };
const STATUS_NAME: Record<Detail['review_status'], string> = { needs_review: 'Cần duyệt', auto_accepted: 'Được nhận tự động', approved: 'Đã chấp nhận', rejected: 'Đã loại', duplicate: 'Trùng tin' };
const LLM_STATUS: Record<string, string> = { not_run: 'Chưa chạy', skipped_no_key: 'Chưa chạy', succeeded: 'Đã hoàn thành', ok: 'Đã hoàn thành', error: 'Gặp lỗi', failed: 'Gặp lỗi', running: 'Đang xử lý' };
const FIELD_EXPLANATION: Record<string, string> = { both_agree: 'Regex và LLM khớp về giá trị.', regex_only: 'Giá trị dựa trên bằng chứng Regex.', llm_only: 'Giá trị dựa trên đoạn trích LLM; cần đối chiếu bài gốc.', conflict: 'Hai cách đọc chưa khớp, cần đối chiếu bài gốc.', human: 'Giá trị do người duyệt chọn.' };
type Control = { key: string; label: string; options?: Record<string, string>; kind?: 'number' | 'boolean' | 'nullableBoolean'; step?: string; min?: number };
const FORM = { exact: 'Một số cụ thể', range: 'Một khoảng', none: 'Không có số' };
const YES_NO = { unknown: 'Chưa ghi rõ', true: 'Có', false: 'Không' };
const FEE_UNIT = { per_kwh: 'Đồng / số điện', per_m3: 'Đồng / khối nước', per_person_month: 'Đồng / người / tháng', per_unit_month: 'Đồng / phòng / tháng', months_of_rent: 'Tháng tiền thuê', one_time: 'Một lần', unknown: 'Chưa rõ đơn vị' };
const CONTROLS: Record<Exclude<Group, 'fees'>, Control[]> = {
  rent: [
    { key: 'visibility', label: 'Công khai giá', options: { disclosed: 'Có ghi số', hidden_explicit: 'Ghi rõ liên hệ để biết giá', not_stated: 'Không nhắc tới giá', ambiguous: 'Nội dung mơ hồ' } },
    { key: 'amount_form', label: 'Dạng giá', options: { ...FORM, starting_from: 'Giá từ…' } },
    { key: 'amount_vnd', label: 'Giá cụ thể (đồng)', kind: 'number' }, { key: 'min_vnd', label: 'Giá từ (đồng)', kind: 'number' }, { key: 'max_vnd', label: 'Giá đến (đồng)', kind: 'number' },
    { key: 'basis', label: 'Cơ sở tính giá', options: { unknown: 'Chưa rõ', per_unit: 'Cả phòng / căn', per_person: 'Mỗi người' } },
    { key: 'period', label: 'Chu kỳ', options: { unknown: 'Chưa rõ', month: 'Tháng', day: 'Ngày' } },
  ],
  area: [
    { key: 'amount_form', label: 'Dạng diện tích', options: FORM },
    { key: 'value_m2', label: 'Diện tích cụ thể (m²)', kind: 'number', step: 'any', min: 0.01 },
    { key: 'min_m2', label: 'Diện tích từ (m²)', kind: 'number', step: 'any', min: 0.01 }, { key: 'max_m2', label: 'Diện tích đến (m²)', kind: 'number', step: 'any', min: 0.01 },
    { key: 'from_dimensions', label: 'Tính từ kích thước trong bài', kind: 'boolean' },
  ],
  room: [
    { key: 'property_type', label: 'Loại phòng', options: PROPERTY_LABEL }, { key: 'bedrooms', label: 'Số phòng ngủ', kind: 'number' }, { key: 'bathrooms', label: 'Số WC', kind: 'number' },
    { key: 'mezzanine', label: 'Gác lửng', kind: 'nullableBoolean' }, { key: 'private_bathroom', label: 'WC riêng', kind: 'nullableBoolean' },
    { key: 'furnishing', label: 'Nội thất', options: { unknown: 'Chưa rõ', full: 'Đầy đủ', basic: 'Cơ bản', none: 'Không nội thất' } },
  ],
  location: [
    { key: 'landmark', label: 'Mốc vị trí' }, { key: 'street', label: 'Đường' }, { key: 'ward_code', label: 'Mã phường chuẩn' }, { key: 'ward_name', label: 'Tên phường chuẩn' },
    { key: 'old_ward_name', label: 'Tên phường cũ trong bài' }, { key: 'old_district_name', label: 'Tên quận cũ trong bài' },
    { key: 'resolution', label: 'Căn cứ xác định phường', options: { unresolved: 'Chưa xác định', exact: 'Ghi rõ trong bài', from_street: 'Từ tên đường trong từ điển', from_landmark: 'Từ mốc trong từ điển' } },
  ],
};
const FEE_CONTROLS: Control[] = [
  { key: 'type', label: 'Loại khoản tiền', options: { ...FEE_LABEL, deposit: 'Đặt cọc' } }, { key: 'unit', label: 'Đơn vị', options: FEE_UNIT },
  { key: 'amount_vnd', label: 'Số tiền (đồng)', kind: 'number' }, { key: 'months', label: 'Số tháng tiền thuê', kind: 'number', step: 'any', min: 0.01 },
  { key: 'free', label: 'Bài ghi miễn phí', kind: 'boolean' }, { key: 'state_rate', label: 'Bài ghi giá nhà nước', kind: 'boolean' },
];
const record = (value: object) => value as unknown as Record<string, unknown>;
function summary(listing: Listing, group: Group) {
  if (group === 'rent') { const price = rentHeadline(listing.rent); return price.main + ' ' + price.suffix; }
  if (group === 'area') return listing.area.amount_form === 'exact' && listing.area.value_m2 != null ? listing.area.value_m2.toLocaleString('vi-VN') + ' m²' : listing.area.amount_form === 'range' ? `${listing.area.min_m2 ?? '—'}–${listing.area.max_m2 ?? '—'} m²` : 'Chưa ghi rõ';
  if (group === 'room') return PROPERTY_LABEL[listing.room.property_type];
  if (group === 'location') return [listing.location.street, listing.location.ward_name, listing.location.landmark].filter(Boolean).join(' · ') || 'Chưa xác định';
  return listing.fees.map(fee => FEE_LABEL[fee.type] + ' ' + feeValue(fee)).join(' · ') || 'Chưa có khoản đọc được';
}
function ControlInput({ control, value, prefix, change }: { control: Control; value: unknown; prefix: string; change: (value: unknown) => void }) {
  const id = prefix + '-' + control.key;
  const options = control.options ?? (control.kind === 'nullableBoolean' ? YES_NO : null);
  if (control.kind === 'boolean') return <label className={s.check} htmlFor={id}><input id={id} type="checkbox" checked={value === true} onChange={event => change(event.target.checked)} />{control.label}</label>;
  return <div className={s.field}><label htmlFor={id} className={s.label}>{control.label}</label>{options ?
    <select id={id} className={s.select} value={value == null ? 'unknown' : String(value)} onChange={event => change(control.kind === 'nullableBoolean' ? event.target.value === 'unknown' ? null : event.target.value === 'true' : event.target.value)}>{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select> :
    <input id={id} className={s.input} type={control.kind === 'number' ? 'number' : 'text'} step={control.step ?? '1'} min={control.kind === 'number' ? control.min ?? 0 : undefined} value={value == null ? '' : String(value)} onChange={event => change(event.target.value === '' ? null : control.kind === 'number' ? Number(event.target.value) : event.target.value)} />}</div>;
}
function differences(before: Listing, after: Listing) {
  return GROUPS.flatMap(group => {
    if (group === 'fees') return JSON.stringify(before.fees) === JSON.stringify(after.fees) ? [] : [{ label: GROUP_NAME.fees, before: summary(before, group), after: summary(after, group) }];
    const rows = CONTROLS[group].filter(control => JSON.stringify(record(before[group])[control.key]) !== JSON.stringify(record(after[group])[control.key])).map(control => {
      const display = (value: unknown) => value == null ? 'Chưa ghi rõ' : control.options?.[String(value)] ?? (typeof value === 'boolean' ? value ? 'Có' : 'Không' : String(value));
      return { label: GROUP_NAME[group] + ' · ' + control.label, before: display(record(before[group])[control.key]), after: display(record(after[group])[control.key]) };
    });
    if (group === 'rent' && JSON.stringify(before.rent.includes) !== JSON.stringify(after.rent.includes)) rows.push({ label: 'Giá thuê · Khoản đã bao trong giá', before: before.rent.includes.map(type => FEE_LABEL[type]).join(', ') || 'Chưa có khoản', after: after.rent.includes.map(type => FEE_LABEL[type]).join(', ') || 'Chưa có khoản' });
    return rows;
  });
}

export function ReviewDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const [reason, setReason] = useState('');
  const [cluster, setCluster] = useState('');
  const [confirm, setConfirm] = useState<ReviewDecision['action'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(false);
  const [latest, setLatest] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<Evidence[]>([]);
  const [leave, setLeave] = useState<string | null>(null);
  const lock = useRef(false);
  const historyGuard = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const modalWasOpen = useRef(false);
  const dirty = !!data && !!draft && (GROUPS.some(group => JSON.stringify(draft[group]) !== JSON.stringify(data.listing[group])) || !!reason || !!cluster);
  const guard = useRef(false); guard.current = (dirty || busy) && !saved;
  useEffect(() => {
    if (confirm || leave) modalWasOpen.current = true;
    else if (modalWasOpen.current) { modalWasOpen.current = false; returnFocus.current?.focus(); }
  }, [confirm, leave]);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    api<Detail>('team/reviews/' + encodeURIComponent(id), { signal: controller.signal }).then(value => { setData(value); setDraft(structuredClone(value.listing)); }).catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [id, reload]);
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) { if (guard.current) { event.preventDefault(); event.returnValue = ''; } }
    function navigate(event: MouseEvent) {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!guard.current || !anchor || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (anchor.href === window.location.href || anchor.getAttribute('href')?.startsWith('#')) return;
      event.preventDefault(); event.stopPropagation(); if (!lock.current) { returnFocus.current = anchor; setLeave(anchor.href); }
    }
    // The same-URL entry installed when dirty lets Back stay until the choice is made.
    function back() { if (guard.current) { window.history.pushState(window.history.state, '', window.location.href); if (!lock.current) { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setLeave('/team/duyet'); } } }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true); window.addEventListener('popstate', back);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); window.removeEventListener('popstate', back); };
  }, []);
  useEffect(() => {
    if (dirty && !saved && !historyGuard.current) { window.history.pushState(window.history.state, '', window.location.href); historyGuard.current = true; }
    else if (!dirty && historyGuard.current && !saved) { historyGuard.current = false; window.history.back(); }
  }, [dirty, saved]);
  async function refreshConflict() {
    setActionError('');
    try { setLatest(await api<Detail>('team/reviews/' + encodeURIComponent(id))); }
    catch (caught) { setActionError('Chưa tải được bản mới: ' + messageOf(caught)); }
  }
  async function decide() {
    if (!data || !draft || !confirm || lock.current || stale) return;
    if (confirm === 'reject' && !reason.trim()) { setFieldErrors({ reason: 'Hãy nhập lý do loại tin.' }); return; }
    if (confirm === 'merge' && !cluster.trim()) { setFieldErrors({ merge_into_cluster: 'Hãy chọn hoặc nhập cụm đích.' }); return; }
    lock.current = true; setBusy(true); setActionError(''); setFieldErrors({});
    const fields = Object.fromEntries(GROUPS.filter(group => JSON.stringify(draft[group]) !== JSON.stringify(data.listing[group])).map(group => [group, group === 'fees' ? draft.fees.map(fee => ({ ...fee, evidence: (fee.evidence ?? []).map(span => Object.fromEntries(Object.entries(span).filter(([, value]) => value != null))) })) : Object.fromEntries([...CONTROLS[group].map(control => control.key), ...(group === 'rent' ? ['includes'] : [])].filter(key => record(draft[group])[key] !== undefined).map(key => [key, record(draft[group])[key]]))]));
    const body: ReviewDecision = { action: confirm, expected_version: data.version, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(confirm === 'merge' ? { merge_into_cluster: cluster.trim() } : {}), ...(confirm === 'approve' && Object.keys(fields).length ? { fields } : {}) };
    try {
      await api<ReviewSaved>('team/reviews/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify(body) });
      guard.current = false; setSaved(true); setConfirm(null); window.location.assign('/team/duyet?decision=' + confirm);
    } catch (caught) {
      if (caught instanceof WorkspaceError && caught.status === 409) { setStale(true); setConfirm(null); await refreshConflict(); }
      else { setActionError(messageOf(caught)); if (caught instanceof WorkspaceError) setFieldErrors(caught.fields); }
    } finally { lock.current = false; setBusy(false); }
  }
  function patch(group: Exclude<Group, 'fees'>, key: string, value: unknown) {
    setDraft(current => current ? { ...current, [group]: { ...current[group], [key]: value } } : current);
  }
  const text = data?.post.text ?? '';
  const evidence = data ? [...data.run.regex_spans, ...data.run.llm_spans, ...GROUPS.flatMap(group => group === 'fees' ? data.listing.fees.flatMap(fee => fee.evidence ?? []) : data.listing[group].evidence)].filter((span, index, rows) => Array.from(text).slice(span.start, span.end).join('') === span.quote && rows.findIndex(other => evidenceKey(other) === evidenceKey(span)) === index) : [];
  const active = new Set(selected.map(evidenceKey));
  return <><Intro eyebrow="Không gian nhóm / Hàng duyệt" title="Đọc kỹ trước khi quyết định" description="Đối chiếu đoạn trích, giữ phần chưa rõ và lưu quyết định trên đúng phiên bản."><Link prefetch={false} className={[s.button, s.secondary].join(' ')} href="/team/duyet">Về hàng duyệt</Link></Intro>
    {error ? <ErrorNotice message={error} retry={() => setReload(value => value + 1)} /> : !data || !draft ? <Loading label="Đang mở tin cần duyệt…" /> : <>
      <section className={[s.notice, s.warning].join(' ')} aria-labelledby="review-reasons"><h2 id="review-reasons" className={s.panelTitle}>Lý do cần duyệt</h2>{data.reasons.length ? <ul className={s.questions}>{data.reasons.map(item => <li key={item}>{REASON_NAME[item] ?? REASON_NAME.field_needs_review}</li>)}</ul> : <p>Không có lý do đang chờ. Trạng thái hiện tại: {STATUS_NAME[data.review_status]}.</p>}</section>
      <div className={[s.between, s.section].join(' ')}><span className={s.mono}>Tin {id}</span><span className={s.muted}>Phiên bản {data.version} · {STATUS_NAME[data.review_status]}</span></div>
      {stale && <section className={[s.panel, s.section].join(' ')} aria-labelledby="version-conflict" role="alert"><h2 id="version-conflict" className={s.panelTitle}>Tin đã được sửa. Chưa lưu quyết định của bạn.</h2><p>Bản đang đọc là phiên bản {data.version}{latest ? ', bản mới là phiên bản ' + latest.version : ''}. Các sửa đổi của bạn vẫn được giữ bên dưới. Hãy đối chiếu rồi dùng bản mới trước khi duyệt lại.</p>
        {latest ? <><p className={s.description}>Trạng thái: {STATUS_NAME[data.review_status]} → {STATUS_NAME[latest.review_status]} · Cụm: <span className={s.mono}>{data.cluster_id ?? 'Chưa có'} → {latest.cluster_id ?? 'Chưa có'}</span></p>
          {differences(data.listing, latest.listing).length ? <ul className={s.questions}>{differences(data.listing, latest.listing).map(row => <li key={row.label}><strong>{row.label}</strong>: {row.before} → {row.after}</li>)}</ul> : <p className={s.description}>Giá trị trích xuất không đổi; phiên bản, trạng thái hoặc lịch sử duyệt đã thay đổi.</p>}
          {differences(data.listing, draft).length > 0 && <details className={s.disclosure} open><summary>Các sửa đổi chưa lưu của bạn</summary><ul className={s.questions}>{differences(data.listing, draft).map(row => <li key={row.label}>{row.label}: {row.before} → {row.after}</li>)}</ul></details>}
          <div className={s.actions}><Button variant="secondary" onClick={() => { setData(latest); setDraft(structuredClone(latest.listing)); setReason(''); setCluster(''); setStale(false); setLatest(null); setSelected([]); setFieldErrors({}); }}>Dùng bản mới và bỏ sửa đổi cũ</Button></div></> : <div className={s.actions}><Button variant="secondary" onClick={refreshConflict}>Tải lại bản mới</Button></div>}
        {actionError && <ErrorNotice message={actionError} />}</section>}
      <div className={[s.reviewLayout, s.section].join(' ')}>
        <section className={[s.panel, s.sourcePane, s.evidencePane].join(' ')}><div className={s.panelHead}><h2 className={s.panelTitle}>Bài gốc & bằng chứng</h2><span className={s.muted}>Đã che liên hệ</span></div><EvidenceHighlighter text={text} evidence={evidence} active={active} onSelect={span => setSelected([span])} />
          {selected.length > 0 && <div className={s.section}><p className={s.notice}>Đoạn chọn: {selected.map(span => '“' + span.quote + '”').join(' · ')}</p><Button variant="ghost" onClick={() => setSelected([])}>Bỏ chọn bằng chứng</Button></div>}
          <p className={[s.hint, s.section].join(' ')}>GIÁ: giá thuê · DT: diện tích · VT: vị trí · PN: loại / số phòng · PHÍ: phí và cọc. Bấm đoạn trích để đối chiếu.</p>
        </section>
        <div className={s.stack}><section className={s.panel}><h2 className={s.panelTitle}>Đối chiếu & giá trị chọn</h2><p className={s.muted}>Regex / LLM hiển thị đoạn chữ tìm được. Giá trị chọn là kết quả đã chuẩn hóa. Ô trống giữ giá trị thiếu; chỉ sửa theo căn cứ trong bài.</p><p className={s.hint}>Trạng thái LLM: {LLM_STATUS[data.run.llm_status] ?? 'Chưa có thông tin'}.</p>
          <fieldset disabled={busy || stale || saved} className={s.reviewFields}>{GROUPS.map(group => <section className={s.reviewGroup} key={group} aria-labelledby={'group-' + group}><h3 id={'group-' + group} className={s.label}>{GROUP_NAME[group]}</h3>
            <div className={s.reviewSources}>{(['regex', 'llm'] as const).map(method => { const spans = data.run[method === 'regex' ? 'regex_spans' : 'llm_spans'].filter(span => span.label === LABEL[group] && Array.from(text).slice(span.start, span.end).join('') === span.quote); return <div key={method}><p className={s.hint}>{method === 'regex' ? 'Regex' : 'LLM'}</p>{spans.length ? spans.map((span, index) => <button key={index} type="button" className={s.quoteButton} onClick={() => setSelected([span])}>“{span.quote}”</button>) : <p className={s.muted}>Không có đoạn trích</p>}</div>; })}</div>
            <p className={s.reviewChosen}><span className={s.hint}>Giá trị chọn</span><strong>{summary(draft, group)}</strong></p>
            {group !== 'fees' && <p className={s.hint}>{draft[group].abstain_reason ? 'Giá trị còn thiếu: ' + ({ not_in_text: 'Bài không ghi', ambiguous_source: 'Nguồn mơ hồ', conflict: 'Hai cách đọc chưa khớp', llm_error: 'LLM gặp lỗi', unsupported_format: 'Dạng chưa hỗ trợ' }[draft[group].abstain_reason]) : FIELD_EXPLANATION[draft[group].agreement ?? ''] ?? 'Đối chiếu bằng chứng trước khi quyết định.'}</p>}
            <details className={s.disclosure}><summary>Sửa {GROUP_NAME[group].toLocaleLowerCase('vi-VN')}</summary><div className={s.reviewInputs}>{group !== 'fees' ? CONTROLS[group].map(control => <ControlInput key={control.key} control={control} value={record(draft[group])[control.key]} prefix={'review-' + group} change={value => patch(group, control.key, value)} />) : <>
              {draft.fees.map((fee, index) => <div className={s.reviewFee} key={index}><h4 className={s.label}>Khoản {index + 1}</h4>{FEE_CONTROLS.map(control => <ControlInput key={control.key} control={control} value={record(fee)[control.key]} prefix={'review-fee-' + index} change={value => setDraft(current => current ? { ...current, fees: current.fees.map((row, rowIndex) => rowIndex === index ? { ...row, [control.key]: value } : row) } : current)} />)}<Button type="button" variant="ghost" onClick={() => setDraft(current => current ? { ...current, fees: current.fees.filter((_, rowIndex) => rowIndex !== index) } : current)}>Bỏ khoản {index + 1} khỏi bản sửa</Button></div>)}
              <Button type="button" variant="secondary" onClick={() => setDraft(current => current ? { ...current, fees: [...current.fees, { type: 'other', unit: 'unknown', amount_vnd: null, months: null, free: false, state_rate: false, evidence: [] }] } : current)}>Thêm khoản có trong bài</Button></>}
            </div>{group === 'rent' && <div className={s.section}><p className={s.label}>Khoản bài ghi đã bao trong giá</p><div className={s.row}>{Object.entries(FEE_LABEL).map(([type, label]) => <label key={type} className={s.check}><input type="checkbox" checked={draft.rent.includes.includes(type as Listing['fees'][number]['type'])} onChange={event => patch('rent', 'includes', event.target.checked ? [...draft.rent.includes, type] : draft.rent.includes.filter(item => item !== type))} />{label}</label>)}</div></div>}
              <p className={[s.hint, s.section].join(' ')}>Không cộng thuê, phí và cọc. Để trống số khi bài không ghi; giữ “chưa rõ” nếu thiếu căn cứ về đơn vị.</p></details>
          </section>)}</fieldset>
        </section>
        <section className={s.panel}><h2 className={s.panelTitle}>Cụm tin & lịch sử</h2><p className={s.muted}>Cụm hiện tại: <span className={s.mono}>{data.cluster_id ?? 'Chưa có cụm'}</span></p>
          {data.suspected_duplicates.length ? <ul className={s.questions}>{data.suspected_duplicates.map(item => <li key={item.listing_id}><Link prefetch={false} className={s.textLink} href={'/team/duyet/' + item.listing_id}>Tin {item.listing_id}</Link> · {item.rent_vnd == null ? 'Chưa rõ giá' : formatVnd(item.rent_vnd)}{item.area_m2 == null ? '' : ' · ' + item.area_m2.toLocaleString('vi-VN') + ' m²'}<p className={s.hint}>Độ giống văn bản {item.cosine.toLocaleString('vi-VN')} · không phải xác suất trùng.</p>{item.cluster_id && <Button variant="ghost" disabled={busy || stale} onClick={() => setCluster(item.cluster_id!)}>Chọn cụm này</Button>}</li>)}</ul> : <p className={s.description}>Chưa có tin nghi trùng được đề xuất.</p>}
          <details className={s.disclosure}><summary>Lịch sử quyết định ({data.history.length})</summary>{data.history.length ? <ul className={s.questions}>{data.history.map((event, index) => <li key={index}>{ACTION_NAME[event.action as ReviewDecision['action']] ?? event.action} · {formatDate(event.created_at)}{event.reason ? ' · ' + event.reason : ''}</li>)}</ul> : <p className={s.muted}>Chưa có quyết định của người duyệt.</p>}</details>
        </section>
        <section className={s.panel}><h2 className={s.panelTitle}>Quyết định của bạn</h2><label className={s.field} htmlFor="review-reason"><span className={s.label}>Lý do (bắt buộc khi loại tin)</span><textarea id="review-reason" className={[s.textarea, s.reviewReason].join(' ')} value={reason} maxLength={500} disabled={busy || stale || saved} aria-invalid={!!fieldErrors.reason} aria-describedby="review-reason-help" onChange={event => { setReason(event.target.value); setFieldErrors({}); }} /></label><p id="review-reason-help" className={s.hint}>{fieldErrors.reason ?? `${reason.length}/500 ký tự. Lý do được lưu cùng quyết định.`}</p>
          <div className={[s.field, s.section].join(' ')}><label htmlFor="merge-cluster" className={s.label}>Cụm đích khi gộp trùng</label><input id="merge-cluster" className={[s.input, s.mono].join(' ')} value={cluster} disabled={busy || stale || saved} aria-invalid={!!fieldErrors.merge_into_cluster} aria-describedby="merge-help" onChange={event => { setCluster(event.target.value); setFieldErrors({}); }} /><p id="merge-help" className={s.hint}>{fieldErrors.merge_into_cluster ?? 'Chọn từ gợi ý hoặc nhập mã cụm đã xác minh.'}</p></div>
          <p className={[s.hint, s.section].join(' ')}>“Tách khỏi cụm trùng” chuyển tin này sang một cụm riêng, không chia bài thành nhiều tin. Sửa các trường chỉ được lưu khi chấp nhận tin.</p>
          {actionError && !confirm && !stale && <ErrorNotice message={actionError} />}
          <div className={s.reviewActions}>{(['approve', 'reject', 'split', 'merge'] as const).map(action => <Button key={action} className={s.reviewAction} variant={action === 'reject' ? 'danger' : action === 'approve' ? undefined : 'secondary'} disabled={busy || stale || saved} onClick={event => { returnFocus.current = event.currentTarget; setActionError(''); setFieldErrors({}); setConfirm(action); }}>{ACTION_NAME[action]}</Button>)}</div><p role="status" className={s.hint}>{saved ? 'Đã lưu quyết định. Đang về hàng duyệt…' : dirty ? 'Có sửa đổi chưa lưu.' : 'Chưa có sửa đổi chưa lưu.'}</p>
        </section></div>
      </div>
    </>}
    {confirm && <Modal title={ACTION_NAME[confirm] + '?'} busy={busy} onClose={() => { setConfirm(null); setActionError(''); }}><p>{confirm === 'approve' ? 'Lưu các giá trị đã chọn và chấp nhận tin trên phiên bản đang đọc.' : confirm === 'reject' ? 'Tin sẽ bị loại khỏi tập được chấp nhận. Bạn cần ghi lý do để người khác đối chiếu.' : confirm === 'split' ? 'Chuyển riêng tin này sang một cụm mới. Không tạo thêm tin từ bài gốc.' : 'Đánh dấu tin trùng và chuyển vào cụm đích đã chọn.'}</p>{confirm !== 'approve' && dirty && <p className={[s.notice, s.section].join(' ')}>Các thay đổi trường dữ liệu sẽ không được lưu với quyết định này.</p>}
      {confirm === 'reject' && <div className={[s.field, s.section].join(' ')}><label className={s.label} htmlFor="confirm-reason">Lý do loại tin</label><textarea id="confirm-reason" className={[s.textarea, s.reviewReason].join(' ')} value={reason} disabled={busy} maxLength={500} aria-invalid={!!fieldErrors.reason} aria-describedby="confirm-reason-error" onChange={event => { setReason(event.target.value); setFieldErrors({}); }} /><p id="confirm-reason-error" role={fieldErrors.reason ? 'alert' : undefined} className={s.hint}>{fieldErrors.reason ?? 'Bắt buộc, tối đa 500 ký tự.'}</p></div>}
      {confirm === 'merge' && <div className={[s.field, s.section].join(' ')}><label className={s.label} htmlFor="confirm-cluster">Mã cụm đích</label><input id="confirm-cluster" className={s.input} value={cluster} disabled={busy} aria-invalid={!!fieldErrors.merge_into_cluster} aria-describedby="confirm-cluster-error" onChange={event => { setCluster(event.target.value); setFieldErrors({}); }} /><p id="confirm-cluster-error" role={fieldErrors.merge_into_cluster ? 'alert' : undefined} className={s.hint}>{fieldErrors.merge_into_cluster ?? 'Chỉ gộp vào cụm đã kiểm tra.'}</p></div>}
      {actionError && <ErrorNotice message={actionError} />}{Object.entries(fieldErrors).filter(([key]) => !['reason', 'merge_into_cluster'].includes(key)).map(([key, value]) => <p className={s.error} role="alert" key={key}>{key}: {value}</p>)}
      <div className={s.reviewActions}><button type="button" className={[s.button, s.secondary].join(' ')} ref={button => { if (button) button.autofocus = true; }} disabled={busy} onClick={() => setConfirm(null)}>Hủy, tiếp tục đọc</button><Button className={s.reviewAction} variant={confirm === 'reject' ? 'danger' : undefined} busy={busy} onClick={decide}>{busy ? 'Đang lưu quyết định…' : 'Xác nhận ' + ACTION_NAME[confirm].toLocaleLowerCase('vi-VN')}</Button></div>
    </Modal>}
    {leave && <Modal title="Rời tin khi chưa lưu?" onClose={() => setLeave(null)}><p>Các sửa đổi đang có sẽ bị bỏ. Chọn ở lại để tiếp tục đối chiếu và lưu quyết định.</p><div className={s.actions}><button type="button" className={[s.button, s.secondary].join(' ')} ref={button => { if (button) button.autofocus = true; }} onClick={() => setLeave(null)}>Ở lại đọc tiếp</button><Button variant="danger" onClick={() => { guard.current = false; window.location.assign(leave); }}>Bỏ sửa đổi và rời trang</Button></div></Modal>}
  </>;
}
