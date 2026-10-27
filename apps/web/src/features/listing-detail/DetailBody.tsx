'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { EvidenceHighlighter, evidenceKey } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import type { Agreement, Evidence, FeeType, ListingDetail } from '@/lib/api/types';
import { FEE_LABEL, LABEL_TEXT, PROPERTY_LABEL, feeValue, formatVnd, rentHeadline } from '@/lib/format';
import styles from './DetailBody.module.css';

const AGREEMENT: Record<Agreement, string> = {
  both_agree: 'Regex + LLM khớp',
  regex_only: 'Chỉ Regex',
  llm_only: 'Chỉ LLM',
  conflict: 'Regex và LLM lệch',
  human: 'Người duyệt sửa',
};

const FEE_ORDER: FeeType[] = ['deposit', 'electricity', 'water', 'service', 'internet', 'parking', 'other'];

interface Row {
  id: string;
  label: string;
  value: string;
  evidence: Evidence[];
  agreement?: Agreement | null;
  missing?: boolean;
  tag: keyof typeof LABEL_TEXT;
}

export function DetailBody({ detail }: { detail: ListingDetail }) {
  const { listing, post } = detail;
  const [active, setActive] = useState<string | null>(null);

  const rent = rentHeadline(listing.rent);
  const room = listing.room;
  const loc = listing.location;

  const rows: Row[] = useMemo(
    () => [
      {
        id: 'area',
        label: 'Diện tích',
        value: listing.area.value_m2 != null ? `${listing.area.value_m2} m²` : 'Chưa rõ',
        evidence: listing.area.evidence ?? [],
        agreement: listing.area.agreement,
        missing: listing.area.value_m2 == null,
        tag: 'AREA',
      },
      {
        id: 'room',
        label: 'Loại phòng',
        value: [
          PROPERTY_LABEL[room.property_type],
          room.bedrooms != null ? (room.bedrooms === 0 ? 'studio' : `${room.bedrooms} phòng ngủ`) : null,
          room.private_bathroom ? 'khép kín' : null,
          room.mezzanine ? 'có gác' : null,
          room.furnishing === 'full' ? 'full nội thất' : room.furnishing === 'basic' ? 'nội thất cơ bản' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        evidence: room.evidence ?? [],
        agreement: room.agreement,
        tag: 'ROOM',
      },
      {
        id: 'loc',
        label: 'Vị trí',
        value: [loc.landmark, loc.street, loc.ward_name ?? 'Chưa xác định phường'].filter(Boolean).join(' · '),
        evidence: loc.evidence ?? [],
        agreement: loc.agreement,
        tag: 'LOC',
      },
    ],
    [listing, room, loc],
  );

  const activeKeys = useMemo(() => {
    if (!active) return new Set<string>();
    const ev =
      active === 'rent'
        ? (listing.rent.evidence ?? [])
        : active.startsWith('fee:')
          ? (listing.fees.find((f) => f.type === active.slice(4))?.evidence ?? [])
          : (rows.find((r) => r.id === active)?.evidence ?? []);
    return new Set(ev.map(evidenceKey));
  }, [active, listing, rows]);

  const allEvidence = [
    ...(listing.rent.evidence ?? []),
    ...rows.flatMap((r) => r.evidence),
    ...listing.fees.flatMap((f) => f.evidence ?? []),
  ];

  const pick = (id: string) => setActive((cur) => (cur === id ? null : id));
  const onSpan = (e: Evidence) => {
    const k = evidenceKey(e);
    if (listing.rent.evidence?.some((x) => evidenceKey(x) === k)) return pick('rent');
    const fee = listing.fees.find((f) => f.evidence?.some((x) => evidenceKey(x) === k));
    if (fee) return pick(`fee:${fee.type}`);
    const row = rows.find((r) => r.evidence.some((x) => evidenceKey(x) === k));
    if (row) pick(row.id);
  };

  return (
    <div className={styles.grid}>
      <section className={styles.fields} aria-labelledby="price-title">
        <h2 id="price-title" className={styles.h2}>
          Giá và phí
        </h2>

        <button
          type="button"
          className={[styles.rent, active === 'rent' ? styles.on : ''].join(' ')}
          onClick={() => pick('rent')}
          aria-pressed={active === 'rent'}
          disabled={!listing.rent.evidence?.length}
        >
          <span className={styles.rentLabel}>
            <span className={styles.tag} data-label="PRICE">
              GIÁ
            </span>
            Giá thuê
          </span>
          <span className={[styles.rentValue, rent.missing ? styles.rentMissing : ''].join(' ')}>
            {listing.rent.amount_form === 'exact' && listing.rent.amount_vnd != null ? formatVnd(listing.rent.amount_vnd) : rent.main}
            {!rent.missing && <small>{rent.suffix}</small>}
          </span>
          {listing.rent.includes.length > 0 && (
            <span className={styles.includes}>Đã bao: {listing.rent.includes.map((t) => FEE_LABEL[t].toLowerCase()).join(', ')}</span>
          )}
          {listing.rent.basis === 'per_person' && (
            <span className={styles.note}>
              <Info size={13} aria-hidden="true" /> Giá tính theo người. Không nhân lên theo số người ở.
            </span>
          )}
          {listing.rent.agreement && <span className={styles.src}>{AGREEMENT[listing.rent.agreement]}</span>}
        </button>

        <table className={styles.table}>
          <caption className="visually-hidden">Các khoản phí</caption>
          <tbody>
            {FEE_ORDER.map((t) => {
              const fee = listing.fees.find((f) => f.type === t);
              const included = listing.rent.includes.includes(t);
              const id = `fee:${t}`;
              const clickable = !!fee?.evidence?.length;
              return (
                <tr key={t} className={[active === id ? styles.on : '', clickable ? styles.clickable : ''].join(' ')}>
                  <th scope="row">
                    {clickable ? (
                      <button type="button" onClick={() => pick(id)} aria-pressed={active === id}>
                        <span className={styles.tag} data-label="FEE">
                          PHÍ
                        </span>
                        {FEE_LABEL[t]}
                      </button>
                    ) : (
                      <span className={styles.plain}>{FEE_LABEL[t]}</span>
                    )}
                  </th>
                  <td className={!fee && !included ? styles.muted : ''}>
                    {included ? 'Đã bao trong giá' : fee ? feeValue(fee) : 'Không đề cập'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={styles.fine}>Không cộng giá thuê với phí thành tổng, vì chưa biết mức dùng điện, nước và số người.</p>

        <h2 className={styles.h2}>Thông tin chính</h2>
        <dl className={styles.facts}>
          {rows.map((r) => (
            <div key={r.id} className={active === r.id ? styles.on : ''}>
              <dt>
                <button type="button" onClick={() => pick(r.id)} aria-pressed={active === r.id} disabled={!r.evidence.length}>
                  <span className={styles.tag} data-label={r.tag}>
                    {LABEL_TEXT[r.tag]}
                  </span>
                  {r.label}
                </button>
              </dt>
              <dd className={r.missing ? styles.muted : ''}>
                {r.value}
                {r.agreement && <span className={[styles.src, r.agreement === 'conflict' ? styles.conflict : ''].join(' ')}>{AGREEMENT[r.agreement]}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.evidence} aria-labelledby="evidence-title">
        <div className={styles.evidenceCard}>
          <div className={styles.evidenceHead}>
            <h2 id="evidence-title" className={styles.h2}>
              Bằng chứng
            </h2>
            <span className={styles.hint}>Bấm một trường hoặc một đoạn để đối chiếu</span>
          </div>
          <EvidenceHighlighter text={post.text} evidence={allEvidence} active={activeKeys} onSelect={onSpan} size="lg" />
          <p className={styles.source}>
            {[post.source_group_name, 'số điện thoại đã che', detail.is_demo ? 'bài ví dụ tự tạo' : null]
              .filter(Boolean)
              .join(' · ')}
            {!post.text_complete && ' · văn bản nguồn chưa đầy đủ'}
          </p>
          <ul className={styles.legend} aria-label="Chú thích nhãn">
            {(['PRICE', 'AREA', 'LOC', 'ROOM', 'FEE'] as const).map((l) => (
              <li key={l}>
                <span className={styles.tag} data-label={l}>
                  {LABEL_TEXT[l]}
                </span>
                {{ PRICE: 'giá', AREA: 'diện tích', LOC: 'vị trí', ROOM: 'phòng', FEE: 'phí' }[l]}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
