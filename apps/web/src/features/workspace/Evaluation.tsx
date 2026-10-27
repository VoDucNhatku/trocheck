'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, WorkspaceError } from '@/lib/workspace/client';
import type { EvalResult, EvalRuns } from '@/lib/workspace/types';
import { TeamHeader, StateBox, displayDate } from './TeamAdmin';
import s from './team-admin.module.css';

type Json = Record<string, unknown>;
const METHODS = [['regex', 'Regex'], ['llm', 'LLM'], ['hybrid', 'Kết hợp']] as const;
const LABELS = [['PRICE', 'Giá thuê'], ['AREA', 'Diện tích'], ['LOC', 'Vị trí'], ['ROOM', 'Loại / số phòng'], ['FEE', 'Phí'], ['micro', 'Gộp toàn bộ (micro)']] as const;
const ERROR_NAMES: Record<string, string> = { missing: 'Thiếu nhãn', spurious: 'Thừa nhãn', boundary: 'Sai ranh giới', label: 'Sai nhãn', normalization: 'Sai chuẩn hóa' };
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const text = (value: unknown) => typeof value === 'string' && value ? value : 'Chưa có thông tin';
const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
const percent = (value: number | null) => value === null ? 'Chưa có' : value.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
function ErrorCounts({ rows }: { rows: EvalResult['error_counts'] }) {
  if (!rows.length) return <p>Chưa có dòng lỗi tổng hợp. API chưa phân biệt tệp lỗi chưa được ghi với tệp lỗi rỗng.</p>;
  const methods = [...new Set([...METHODS.map(([method]) => method), ...rows.map(row => row.method)])].filter(method => rows.some(row => row.method === method));
  return <table className={[s.table, s.compare, s.errors].join(' ')}><caption>Số dòng lỗi theo phương pháp từ lượt đang chọn; không phải số bài lỗi</caption><thead><tr><th scope="col">Loại lỗi</th>{methods.map(method => <th key={method ?? 'unknown'} scope="col">{METHODS.find(([key]) => key === method)?.[1] ?? text(method)}</th>)}</tr></thead><tbody>{[...new Set(rows.map(row => row.error_type))].map(type => <tr key={type ?? 'unknown'}><th scope="row">{ERROR_NAMES[type ?? ''] ?? text(type)}</th>{methods.map(method => {
    const count = rows.find(row => row.method === method && row.error_type === type)?.count;
    return <td key={method ?? 'unknown'} data-label={METHODS.find(([key]) => key === method)?.[1] ?? text(method)}>{typeof count === 'number' && Number.isFinite(count) ? count.toLocaleString('vi-VN') : 'Chưa có'}</td>;
  })}</tr>)}</tbody></table>;
}
function Scores({ metrics }: { metrics: Json }) {
  const strict = (method: string) => object(object(object(metrics[method]).entities).strict);
  const labels = LABELS.filter(([label]) => METHODS.some(([method]) => label in strict(method)));
  if (!labels.length) return <StateBox title="Chưa có chỉ số thực thể strict"><p>Không suy Precision, Recall hay F1 từ những tỉ lệ khác.</p></StateBox>;
  return <section className={s.panel}><h2>P / R / F1 theo nhãn</h2><p className={s.muted}>P: đúng trong số đã gán · R: tìm được trong số nhãn chuẩn · F1: kết hợp P và R. Giá trị cao nhất trong số có dữ liệu được in đậm và gạch chân.</p><table className={[s.table, s.compare].join(' ')}><caption>Khớp chính xác biên và nhãn (strict) · đơn vị % · ô thiếu giữ “Chưa có”</caption><thead><tr><th scope="col" rowSpan={2}>Nhãn</th>{METHODS.map(([method, title]) => <th key={method} colSpan={3} scope="colgroup">{title}</th>)}</tr><tr>{METHODS.flatMap(([method]) => ['P', 'R', 'F1'].map(key => <th key={method + key} scope="col">{key}</th>))}</tr></thead><tbody>{labels.map(([label, name]) => <tr key={label}><th scope="row">{name}</th>{METHODS.flatMap(([method, title]) => ['precision', 'recall', 'f1'].map((key, i) => {
    const value = score(object(strict(method)[label])[key]);
    const values = METHODS.map(([other]) => score(object(strict(other)[label])[key])).filter((item): item is number => item !== null);
    return <td key={method + key} data-label={title + ' · ' + ['P', 'R', 'F1'][i]} className={value !== null && value === Math.max(...values) ? s.best : undefined}>{percent(value)}</td>;
  }))}</tr>)}</tbody></table></section>;
}

export function Evaluation() {
  const [runs, setRuns] = useState<EvalRuns | null>(null), [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<{ id: string; value: EvalResult } | null>(null);
  const [listError, setListError] = useState(''), [detailError, setDetailError] = useState('');
  const [reload, setReload] = useState(0), [detailReload, setDetailReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setRuns(null); setListError(''); setDetail(null);
    api<EvalRuns>('eval/runs', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      setRuns(value);
      setSelected(current => value.items.some(run => run.run_id === current) ? current : value.items.find(run => run.run_id)?.run_id ?? '');
    }).catch(caught => { if (!controller.signal.aborted) setListError(caught instanceof WorkspaceError && caught.status === 403 ? 'Bạn chưa có quyền xem đánh giá.' : 'Không tải được danh sách lượt chạy.'); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    setDetail(null); setDetailError('');
    if (!selected || !runs) return;
    const controller = new AbortController();
    api<EvalResult>('eval/runs/' + encodeURIComponent(selected), { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setDetail({ id: selected, value });
    }).catch(caught => { if (!controller.signal.aborted) setDetailError(caught instanceof WorkspaceError && caught.status === 404 ? 'Lượt chạy này không còn trong danh sách đã lưu. Tải lại danh sách để chọn lượt khác.' : 'Không tải được chi tiết lượt chạy.'); });
    return () => controller.abort();
  }, [selected, runs, detailReload]);
  const choices = runs?.items.filter(run => run.run_id) ?? [];
  const result = detail?.id === selected ? detail.value : null;
  const manifest = result?.manifest;
  const versions = object(manifest?.versions);
  const example = manifest?.is_demo === true || object(result).is_demo === true;
  return <div className={s.page}>
    <TeamHeader current="evaluation" title="Đánh giá" description="So sánh Regex, LLM và Kết hợp trên cùng một lượt đã lưu." />
    <p className={s.note}>Chỉ đọc kết quả đã lưu. Mỗi lượt giữ tập dữ liệu, phiên bản và commit; trang không khởi chạy đánh giá hoặc gọi mô hình.</p>
    <div className={s.runPicker}><label className={s.field}>Lượt chạy<select value={selected} disabled={!runs || !choices.length} onChange={event => setSelected(event.target.value)}><option value="">{runs ? 'Chọn một lượt chạy' : 'Đang tải danh sách…'}</option>{choices.map(run => <option key={run.run_id} value={run.run_id!}>{run.run_id} · {run.split ?? 'Chưa rõ tập'}{run.frozen ? ' · Đã đóng băng' : ''}</option>)}</select></label><button type="button" disabled={!runs && !listError} onClick={() => setReload(value => value + 1)}>Tải lại danh sách</button></div>
    <Link className={s.link} href="/team/kiem-tra">Kiểm tra một bài</Link>
    {listError ? <StateBox error title={listError}><button type="button" onClick={() => setReload(value => value + 1)}>Thử lại danh sách</button></StateBox> : !runs ? <StateBox title="Đang tải các lượt đánh giá…" /> : !choices.length ? <StateBox title={runs.items.length ? 'Lượt chạy chưa có mã hợp lệ' : 'Chưa có lượt đánh giá nào'}><div className={s.emptyGuide}><p>Chưa có cơ sở để hiển thị Precision, Recall hoặc F1. Nhóm nghiên cứu có thể chạy bộ đánh giá trên tập dev rồi tải lại.</p><p>Lệnh trên máy nhóm: <code>make eval</code></p><p>Không dùng nhãn test để chỉnh quy tắc hoặc prompt.</p></div></StateBox> : null}
    {choices.length > 0 && !selected && <StateBox title="Chọn một lượt chạy để đọc kết quả" />}
    {selected && runs && (detailError ? <StateBox error title={detailError}><button type="button" onClick={() => setDetailReload(value => value + 1)}>Thử lại chi tiết</button></StateBox> : !result ? <StateBox title="Đang tải chỉ số của lượt đã chọn…" /> : null)}
    {result && manifest && <>
      {example && <p className={s.note}><strong>Ví dụ — số mô phỏng để xem bố cục.</strong> Đây không phải kết quả đánh giá của hệ thống.</p>}
      {manifest.split === 'test' && <p className={s.note}>Kết quả trên tập test đã khóa. Không dùng nhãn test để chỉnh quy tắc hoặc prompt.</p>}
      {result.metrics === null ? <StateBox title="Lượt chạy chưa có chỉ số"><p>Chỉ số chưa được ghi. Không thay giá trị thiếu bằng 0.</p><button type="button" onClick={() => setDetailReload(value => value + 1)}>Tải lại chỉ số</button></StateBox> : !Object.keys(result.metrics).length ? <StateBox title="Chỉ số đang rỗng" /> : <Scores metrics={result.metrics} />}
      <div className={s.two}><section className={s.panel}><h2>Loại lỗi</h2><ErrorCounts rows={result.error_counts} /><p className={s.muted}>Chưa có dữ liệu để mở từng bài lỗi hay tải báo cáo.</p></section>
      <section className={s.panel}><h2>Thông tin lượt chạy</h2><dl className={s.meta}>{[['Mã lượt', text(manifest.run_id)], ['Tập dữ liệu', text(manifest.split)], ['Đóng băng', manifest.frozen === true ? 'Đã đóng băng' : manifest.frozen === false ? 'Chưa đóng băng' : 'Chưa có thông tin'], ['Lexicon', text(versions.lexicon)], ['Prompt', text(versions.prompt)], ['Mô hình', text(versions.model)], ['Bắt đầu (giờ Việt Nam)', displayDate(typeof manifest.started_at === 'string' ? manifest.started_at : null)], ['Kết thúc (giờ Việt Nam)', displayDate(typeof manifest.finished_at === 'string' ? manifest.finished_at : null)], ['Commit', text(manifest.git_commit)]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className={s.muted}>Chỉ đối chiếu số liệu với đúng tập và phiên bản của lượt đó. Không nhập tay chỉ số trên trang.</p></section></div>
    </>}
  </div>;
}
