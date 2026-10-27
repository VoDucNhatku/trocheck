'use client';

import Link from 'next/link';
import { ArrowRight, Puzzle, MoreHorizontal, ThumbsUp, MessageCircle } from 'lucide-react';
import { EvidenceHighlighter } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import type { Comparison, ListingDetail } from '@/lib/api/types';
import { FEE_LABEL, PROPERTY_LABEL, dataRangeSentence, feeValue, formatShort, formatVnd, verdictSentence } from '@/lib/format';
import styles from './ReadingHero.module.css';

interface Props {
  detail: ListingDetail;
  comparison: Comparison;
  demo?: boolean;
}

/** Static teaching illustration; warehouse data is read separately from the API. */
export function ReadingHero({ detail, comparison, demo }: Props) {
  const { listing, post } = detail;

  const evidence = [
    ...(listing.room.evidence ?? []),
    ...(listing.area.evidence ?? []),
    ...(listing.location.evidence ?? []),
    ...(listing.rent.evidence ?? []),
    ...listing.fees.flatMap((f) => f.evidence ?? []),
  ];

  const rent = listing.rent;
  const target = rent.amount_vnd ?? null;
  const c = comparison;
  const scale =
    c.p25 != null && c.p75 != null && target != null
      ? (() => {
          const pts = [c.p25, c.p75, target, ...(c.median != null ? [c.median] : [])];
          const lo = Math.min(...pts) * 0.85;
          const hi = Math.max(...pts) * 1.1;
          return (v: number) => ((v - lo) / (hi - lo)) * 100;
        })()
      : null;

  return (
    <section className={styles.hero} aria-labelledby="reading-title" id="doc-bai-dang">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>01 / TỪ BÀI ĐĂNG ĐẾN THÔNG TIN</p>
          <h2 id="reading-title" className={styles.title}>Một bài đăng.<br /><em>Từng con số rõ ràng.</em></h2>
          <p className={styles.lead}>“5tr5” là tiền thuê. Điện, nước, cọc là những khoản riêng. ReNER giúp bạn nhìn rõ từng phần, trước khi nhắn hỏi chủ nhà.</p>
          <ol className={styles.steps}>
            <li><span>01</span><div><h3>Đọc đúng chữ trong bài</h3><p>Mỗi thông tin đều có đoạn gốc để đối chiếu.</p></div></li>
            <li><span>02</span><div><h3>Giá thuê một bên, phí một bên</h3><p>Thiếu thông tin thì ghi rõ, không tự đoán.</p></div></li>
            <li><span>03</span><div><h3>So với những tin tương tự</h3><p>Cùng khu vực, loại phòng và khoảng diện tích. Ít hơn 10 tin thì chưa kết luận.</p></div></li>
          </ol>
          <Link href="#extension" className={styles.secondary}><Puzzle size={15} aria-hidden="true" /> Xem minh họa extension <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>

        <div className={styles.stage}>
          <div data-tilt className={styles.tilt}>
            <article data-hero-post className={styles.post} aria-label="Bài đăng ví dụ">
              <header className={styles.postHead}>
                <span className={styles.avatar} aria-hidden="true" />
                <div>
                  <p className={styles.postGroup}>{post.source_group_name}</p>
                  <p className={styles.postMeta}>Người đăng đã ẩn · 2 giờ</p>
                </div>
                <MoreHorizontal size={18} className={styles.postMore} aria-hidden="true" />
              </header>
              <EvidenceHighlighter text={post.text} evidence={evidence} size="lg" className={styles.postText} />
              <footer className={styles.postFoot} aria-hidden="true">
                <span>
                  <ThumbsUp size={14} /> Thích
                </span>
                <span>
                  <MessageCircle size={14} /> Bình luận
                </span>
                <span className={styles.stamp}>ví dụ tự tạo</span>
              </footer>
            </article>

            <aside data-sheet className={styles.sheet} aria-label="Kết quả chuẩn hóa">
              <p className={styles.sheetTitle}>Minh họa chuẩn hóa</p>
              <dl className={styles.sheetList}>
                <div data-sheet-row className={styles.sheetPrice}>
                  <dt>Giá thuê</dt>
                  <dd>
                    {target != null ? formatVnd(target) : 'Chưa có giá'}
                    <small>/tháng/phòng</small>
                  </dd>
                </div>
                <div data-sheet-row>
                  <dt>Diện tích</dt>
                  <dd>{listing.area.value_m2} m²</dd>
                </div>
                <div data-sheet-row>
                  <dt>Loại</dt>
                  <dd>
                    {PROPERTY_LABEL[listing.room.property_type]}
                    {listing.room.bedrooms ? ` · ${listing.room.bedrooms} PN` : ''}
                  </dd>
                </div>
                <div data-sheet-row>
                  <dt>Vị trí</dt>
                  <dd>{listing.location.landmark}</dd>
                </div>
                {listing.fees.map((f) => (
                  <div data-sheet-row key={f.type} className={styles.sheetFee}>
                    <dt>{FEE_LABEL[f.type]}</dt>
                    <dd>{feeValue(f)}</dd>
                  </div>
                ))}
              </dl>
            </aside>

            <aside data-verdict className={styles.verdict} aria-label="Nhận định giá">
              <p className={styles.verdictKicker}>Nhận định</p>
              <p className={styles.verdictText} data-v={c.verdict ?? 'none'}>
                {verdictSentence(c, rent.amount_form, rent.visibility)}
              </p>
              {scale && c.p25 != null && c.p75 != null && c.median != null && target != null && (
                <div className={styles.bar} aria-hidden="true">
                  <span className={styles.barAxis} />
                  <span
                    data-bar-iqr
                    className={styles.barIqr}
                    style={{ left: `${scale(c.p25)}%`, width: `${scale(c.p75) - scale(c.p25)}%` }}
                  />
                  <span className={styles.barMedian} style={{ left: `${scale(c.median)}%` }} />
                  <span data-bar-target data-pos={`${scale(target)}%`} className={styles.barTarget} style={{ left: `${scale(target)}%` }}>
                    <span>Tin này</span>
                  </span>
                </div>
              )}
              <p className={styles.verdictMeta}>
                {c.p25 != null && c.p75 != null && c.median != null
                  ? `Trung vị ${formatShort(c.median)} · P25–P75 ${formatShort(c.p25)}–${formatShort(c.p75)} · N = ${c.n}`
                  : `N = ${c.n}`}
              </p>
              <p className={styles.verdictFine}>{dataRangeSentence(c.data_from, c.data_to)}</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
