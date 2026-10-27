'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LABEL_NAME } from '@/lib/format';
import type { Label } from '@/lib/api/types';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import type { EvalResult, EvalRuns } from '@/lib/workspace/types';
import { Button, Empty, ErrorNotice, Forbidden, Intro, Loading, s } from './ui';
import r from './research.module.css';

type JsonObject = Record<string, unknown>;
const METHOD_NAME: Record<string, string> = { regex: 'Regex', llm: 'LLM', hybrid: 'Kết hợp' };
const FIELD_NAME: Record<string, string> = { rent: 'Giá thuê', area: 'Diện tích', location: 'Vị trí', room: 'Loại / số phòng', fees: 'Phí' };
const RATE_GROUPS: Record<string, string> = { normalized_correct: 'Chuẩn hóa đúng', correct_abstention: 'Để trống đúng' };
const SYSTEM_RATES: Record<string, string> = { false_price_rate: 'Sinh giá sai khi chuẩn không có giá', listing_pairing: 'Ghép giá–diện tích đúng', post_type_accuracy: 'Phân loại bài đúng' };
function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function text(value: unknown, fallback = 'Chưa có') {
  return typeof value === 'string' && value ? value : fallback;
}
function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN') : 'Chưa có';
}
function percent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 2 }) : 'Chưa có';
}
function date(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Chưa rõ thời điểm';
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
function labelName(value: string) {
  return value === 'micro' ? 'Gộp toàn bộ (micro)' : LABEL_NAME[value as Label] ?? value;
}
function ScoreCells({ score }: { score: JsonObject }) {
  return <><td>{percent(score.precision)}</td><td>{percent(score.recall)}</td><td>{percent(score.f1)}</td><td>{number(score.support)}</td></>;
}
function Metrics({ value }: { value: NonNullable<EvalResult['metrics']> }) {
  const methods = Object.entries(value).map(([method, data]) => ({ method, data: object(data) }));
  const rateRows = methods.flatMap(({ method, data }) => [
    ...Object.entries(RATE_GROUPS).flatMap(([key, title]) => Object.entries(object(data[key])).map(([field, rate]) => ({ method, title: title + ' · ' + (FIELD_NAME[field] ?? field), rate: object(rate) }))),
    ...Object.entries(SYSTEM_RATES).filter(([key]) => key in data).map(([key, title]) => ({ method, title, rate: object(data[key]) })),
  ]);
  const confusion = methods.filter(({ data }) => Object.keys(object(data.price_fee_confusion)).length > 0);
  const hasScores = methods.some(({ data }) => Object.keys(object(object(data.entities).strict)).length > 0);

  return <>
    <section className={s.panel} aria-labelledby="eval-scores-title"><div className={r.heading}><h2 id="eval-scores-title"><span className={r.step}>02</span>Precision / Recall / F1</h2><span className={r.hint}>Đơn vị: % · mẫu số theo API</span></div>
      {hasScores ? <div className={r.scroll} role="region" tabIndex={0} aria-label="Chỉ số tổng hợp"><table className={r.table}>
        <caption>Khớp biên và nhãn chính xác (strict), gộp toàn bộ thực thể (micro). Giá trị thiếu giữ là “Chưa có”.</caption>
        <thead><tr><th scope="col">Phương pháp</th><th scope="col">Precision (%)</th><th scope="col">Recall (%)</th><th scope="col">F1 (%)</th><th scope="col">Support (thực thể)</th></tr></thead>
        <tbody>{methods.map(({ method, data }) => <tr key={method} className={r.micro}><th scope="row">{METHOD_NAME[method] ?? method}</th><ScoreCells score={object(object(object(data.entities).strict).micro)} /></tr>)}</tbody>
      </table></div> : <p className={r.hint}>Response chưa có chỉ số thực thể strict. Không suy P/R/F1 từ các tỉ lệ khác.</p>}
      {methods.map(({ method, data }) => {
        const entities = object(data.entities);
        return <div key={method} className={r.metricGroup}>
          {['strict', 'partial'].filter(mode => Object.keys(object(entities[mode])).length > 0).map(mode => <details key={mode} className={r.disclosure}>
            <summary>{METHOD_NAME[method] ?? method} · {mode === 'strict' ? 'Khớp chính xác' : 'Khớp chồng lấn'} · từng nhãn</summary>
            <div className={r.scroll} role="region" tabIndex={0} aria-label={method + ' ' + mode}><table className={r.table}>
              <caption>{mode === 'strict' ? 'strict: cùng biên và nhãn.' : 'partial: có chồng lấn theo bộ đánh giá.'} TP / FP / FN và support là số thực thể, giữ nguyên response.</caption>
              <thead><tr><th scope="col">Nhãn</th><th scope="col">P (%)</th><th scope="col">R (%)</th><th scope="col">F1 (%)</th><th scope="col">Support</th><th scope="col">TP</th><th scope="col">FP</th><th scope="col">FN</th></tr></thead>
              <tbody>{Object.entries(object(entities[mode])).map(([label, raw]) => { const score = object(raw); return <tr key={label} className={label === 'micro' ? r.micro : undefined}><th scope="row">{labelName(label)}</th><ScoreCells score={score} /><td>{number(score.tp)}</td><td>{number(score.fp)}</td><td>{number(score.fn)}</td></tr>; })}</tbody>
            </table></div>
          </details>)}
        </div>;
      })}
    </section>
    {rateRows.length > 0 && <section className={s.panel} aria-labelledby="eval-rates-title"><div className={r.heading}><h2 id="eval-rates-title">Chuẩn hóa và để trống</h2></div>
      <div className={r.scroll} role="region" tabIndex={0} aria-label="Tỉ lệ chuẩn hóa và để trống"><table className={r.table}><caption>Tỉ lệ và mẫu số n được lấy trực tiếp từ metrics; n = 0 không được đổi thành tỉ lệ 0%.</caption>
        <thead><tr><th scope="col">Phương pháp</th><th scope="col">Chỉ số</th><th scope="col">Tỉ lệ (%)</th><th scope="col">n (mẫu)</th></tr></thead>
        <tbody>{rateRows.map(row => <tr key={row.method + ':' + row.title}><th scope="row">{METHOD_NAME[row.method] ?? row.method}</th><td>{row.title}</td><td>{percent(row.rate.value)}</td><td>{number(row.rate.n)}</td></tr>)}</tbody>
      </table></div>
    </section>}
    {confusion.length > 0 && <section className={s.panel} aria-labelledby="eval-confusion-title"><div className={r.heading}><h2 id="eval-confusion-title">Nhầm giá thuê và phí</h2></div>
      <div className={r.scroll} role="region" tabIndex={0} aria-label="Số lần nhầm giá và phí"><table className={r.table}><caption>Số trường hợp do bộ đánh giá đếm; không cộng vào tiền thuê hay suy ra tỉ lệ.</caption>
        <thead><tr><th scope="col">Phương pháp</th><th scope="col">Giá bị gán thành phí (ca)</th><th scope="col">Phí bị gán thành giá (ca)</th></tr></thead>
        <tbody>{confusion.map(({ method, data }) => { const counts = object(data.price_fee_confusion); return <tr key={method}><th scope="row">{METHOD_NAME[method] ?? method}</th><td>{number(counts.gold_PRICE_system_FEE)}</td><td>{number(counts.gold_FEE_system_PRICE)}</td></tr>; })}</tbody>
      </table></div>
    </section>}
  </>;
}

export function Evaluation() {
  const [runs, setRuns] = useState<EvalRuns | null>(null);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<{ id: string; value: EvalResult } | null>(null);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reload, setReload] = useState(0);
  const [detailReload, setDetailReload] = useState(0);
  const [forbidden, setForbidden] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setRuns(null); setListError(''); setDetail(null);
    api<EvalRuns>('eval/runs', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(value => {
      if (controller.signal.aborted) return;
      setRuns(value);
      setSelected(current => value.items.some(run => run.run_id === current) ? current : '');
    }).catch(caught => {
      if (controller.signal.aborted) return;
      if (caught instanceof WorkspaceError && caught.status === 403) setForbidden(true);
      else setListError(messageOf(caught));
    });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    setDetail(null); setDetailError('');
    if (!selected || !runs) return;
    const controller = new AbortController();
    api<EvalResult>('eval/runs/' + encodeURIComponent(selected), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(value => {
      if (!controller.signal.aborted) setDetail({ id: selected, value });
    }).catch(caught => {
      if (controller.signal.aborted) return;
      if (caught instanceof WorkspaceError && caught.status === 403) setForbidden(true);
      else setDetailError(messageOf(caught));
    });
    return () => controller.abort();
  }, [selected, runs, detailReload]);

  if (forbidden) return <Forbidden />;
  const choices = runs?.items.filter(run => typeof run.run_id === 'string' && run.run_id.length > 0) ?? [];
  const result = detail?.id === selected ? detail.value : null;
  const manifest = result?.manifest;
  return <><Intro eyebrow="Không gian nghiên cứu" title="Đánh giá" description="Đọc kết quả của từng lần chạy đã lưu. Chỉ số, tập dữ liệu và phiên bản luôn đi cùng nhau." />
    <div className={r.stack}>
      <section className={s.panel} aria-labelledby="eval-run-title"><div className={r.heading}><h2 id="eval-run-title"><span className={r.step}>01</span>Lần chạy đánh giá</h2><span className={r.hint}>Chỉ đọc kết quả đã có</span></div>
        <div className={r.runPicker}><div className={s.field}><label className={s.label} htmlFor="eval-run">Chọn run</label>
          <select id="eval-run" className={s.select} value={selected} disabled={!runs || choices.length === 0} onChange={event => setSelected(event.target.value)} aria-describedby="eval-run-hint">
            <option value="">{!runs ? 'Đang đọc danh sách…' : choices.length ? 'Chọn một lần chạy' : 'Chưa có run để chọn'}</option>
            {choices.map(run => <option key={run.run_id} value={run.run_id!}>{run.run_id}{run.split ? ' · ' + run.split : ''}{run.frozen === true ? ' · Đã đóng băng' : ''}</option>)}
          </select>
        </div><Button variant="secondary" disabled={!runs && !listError} onClick={() => setReload(value => value + 1)}>Tải lại danh sách</Button></div>
        <p id="eval-run-hint" className={r.hint}>Trang này không khởi chạy đánh giá hoặc gọi LLM. Chọn run từ danh sách API trả về.</p>
        {runs && choices.length < runs.items.length && <p className={s.notice}>Một số manifest chưa có run_id nên chưa thể mở chi tiết; cần kiểm tra dữ liệu lần chạy.</p>}
      </section>
      {listError && <ErrorNotice message={listError} retry={() => setReload(value => value + 1)} />}
      {!runs && !listError && <Loading label="Đang đọc các lần chạy đánh giá…" />}
      {runs && runs.items.length === 0 && <Empty title="Chưa có lần chạy đánh giá"><div className={r.emptyGuide}><p>API chưa có run nào. Chưa có cơ sở để hiển thị Precision, Recall hoặc F1.</p><p>Nhóm nghiên cứu có thể chạy bộ đánh giá trên tập dev rồi tải lại danh sách. Trong lúc đó, dùng <Link href="/team/lab">Lab đối chiếu</Link> để kiểm tra bằng chứng từng bài.</p><p>Tập test giữ khóa theo quy trình đóng băng; không dùng nhãn test để chỉnh rule hoặc prompt.</p></div></Empty>}
      {runs && choices.length > 0 && !selected && <Empty title="Chọn một lần chạy để đọc kết quả"><p className={r.hint}>Giữ cùng run_id khi đối chiếu phiên bản, chỉ số và bảng lỗi.</p></Empty>}
      {selected && runs && detailError && <ErrorNotice message={detailError} retry={() => setDetailReload(value => value + 1)} />}
      {selected && runs && !result && !detailError && <Loading label="Đang đọc chỉ số và bảng lỗi của run đã chọn…" />}
      {result && manifest && <>
        <section className={s.panel} aria-labelledby="eval-manifest-title"><div className={r.heading}><h2 id="eval-manifest-title">Thông tin lần chạy</h2><span className={manifest.frozen === true ? r.frozen : s.badge}>{manifest.frozen === true ? 'Đã đóng băng' : manifest.frozen === false ? 'Chưa đóng băng' : 'Chưa có thông tin đóng băng'}</span></div>
          <p className={r.mono}>run_id: {text(manifest.run_id, selected)}</p>
          <dl className={r.metadata}><div><dt>Tập dữ liệu</dt><dd>{text(manifest.split)}</dd></div><div><dt>Bắt đầu (giờ Việt Nam)</dt><dd>{date(manifest.started_at)}</dd></div><div><dt>Kết thúc (giờ Việt Nam)</dt><dd>{date(manifest.finished_at)}</dd></div>
            <div><dt>Phương pháp</dt><dd>{Array.isArray(manifest.methods) ? manifest.methods.filter(item => typeof item === 'string').map(method => METHOD_NAME[method] ?? method).join(' · ') || 'Chưa có' : 'Chưa có'}</dd></div><div><dt>Commit</dt><dd className={r.mono}>{text(manifest.git_commit)}</dd></div><div><dt>Số bài chuẩn</dt><dd>{number(object(manifest.gold).n_posts)}</dd></div></dl>
          {manifest.split === 'test' && <p className={[s.notice, s.section].join(' ')}>Đây là kết quả trên tập test. Không dùng nhãn test để chỉnh quy tắc hoặc prompt.</p>}
        </section>
        {result.metrics === null ? <Empty title="Run chưa có chỉ số"><p className={r.hint}>API trả metrics = null. Manifest và bảng lỗi hiện có vẫn đọc được; thử tải lại khi bộ đánh giá ghi xong.</p><Button variant="secondary" onClick={() => setDetailReload(value => value + 1)}>Tải lại run</Button></Empty>
          : Object.keys(result.metrics).length === 0 ? <Empty title="Metrics đang rỗng"><p className={r.hint}>API đã trả một đối tượng metrics rỗng, không có số liệu để hiển thị.</p></Empty> : <Metrics value={result.metrics} />}
        <section className={s.panel} aria-labelledby="eval-errors-title"><div className={r.heading}><h2 id="eval-errors-title"><span className={r.step}>03</span>Bảng lỗi tổng hợp</h2></div>
          {result.error_counts.length ? <div className={r.scroll} role="region" tabIndex={0} aria-label="Bảng lỗi tổng hợp"><table className={r.table}><caption>Số dòng lỗi theo phương pháp và loại do API tổng hợp.</caption><thead><tr><th scope="col">Phương pháp</th><th scope="col">Loại lỗi</th><th scope="col">Số dòng lỗi</th></tr></thead>
            <tbody>{result.error_counts.map((row, index) => <tr key={row.method + ':' + row.error_type + ':' + index}><th scope="row">{row.method ? METHOD_NAME[row.method] ?? row.method : 'Chưa rõ phương pháp'}</th><td className={r.mono}>{row.error_type ?? 'Chưa rõ loại lỗi'}</td><td>{number(row.count)}</td></tr>)}</tbody>
          </table></div> : <p className={r.hint}>API trả bảng lỗi rỗng. Điều này chưa khẳng định không có lỗi: API không cho biết tệp lỗi chưa có hay đã được ghi mà không có dòng lỗi.</p>}
          <p className={[r.hint, s.section].join(' ')}>Hiện API chỉ cung cấp số lỗi tổng hợp, chưa có endpoint xem từng bài lỗi hoặc tải báo cáo. Trang không tạo liên kết chi tiết khi chưa có dữ liệu.</p>
        </section>
        <section className={s.panel} aria-label="Thông tin kỹ thuật đánh giá"><details className={r.disclosure}><summary>Manifest và phiên bản đầy đủ</summary><pre className={r.pre}>{JSON.stringify(result.manifest, null, 2)}</pre></details>
          <details className={r.disclosure}><summary>Metrics gốc từ API (gồm chi phí nếu có)</summary><pre className={r.pre}>{JSON.stringify(result.metrics, null, 2)}</pre></details>
        </section>
      </>}
    </div>
  </>;
}
