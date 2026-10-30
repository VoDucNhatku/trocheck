'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ArrowUpRight, Loader2, ScanText, ShieldCheck, X } from 'lucide-react';
import { PriceDistributionBar } from '@/components/PriceDistributionBar/PriceDistributionBar';
import type { Comparison, ListingDetail } from '@/lib/api/types';
import { PROPERTY_LABEL, dataRangeSentence, feeLine, formatShort, rentHeadline, verdictSentence } from '@/lib/format';
import styles from './ExtensionDemo.module.css';

type Panel = 'preview' | 'running' | 'result' | 'insufficient';

const TABS: { id: Panel; label: string }[] = [
  { id: 'preview', label: 'Xem trước' },
  { id: 'running', label: 'Đang đọc' },
  { id: 'result', label: 'Kết quả' },
  { id: 'insufficient', label: 'Chưa đủ dữ liệu' },
];

interface Props {
  demo?: boolean;
  ok: { detail: ListingDetail; comparison: Comparison };
  few: { detail: ListingDetail; comparison: Comparison };
}

export function ExtensionDemo({ ok, few, demo }: Props) {
  const [panel, setPanel] = useState<Panel>('result');
  const current = panel === 'insufficient' ? few : ok;
  const { listing, post } = current.detail;
  const c = current.comparison;
  const head = rentHeadline(listing.rent);

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.wrap}>
        <div className={styles.tabs} role="tablist" aria-label="Trạng thái panel extension">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={panel === t.id}
              aria-controls="ext-panel"
              className={styles.tab}
              onClick={() => setPanel(t.id)}
            >
              {panel === t.id && <motion.span layoutId="ext-tab" className={styles.tabBg} transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }} />}
              <span className={styles.tabText}>{t.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.window}>
          <div className={styles.chrome} aria-hidden="true">
            <span />
            <span />
            <span />
            <div className={styles.url}>facebook.com/groups/…</div>
            <div className={styles.extIcon}>
              <ScanText size={14} />
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.feed} aria-hidden="true">
              <div className={styles.feedPost}>
                <div className={styles.feedHead}>
                  <span className={styles.feedAvatar} />
                  <div>
                    <p className={styles.feedGroup}>{post.source_group_name}</p>
                    <p className={styles.feedMeta}>Người đăng đã ẩn</p>
                  </div>
                  <span className={styles.renerBtn}>
                    <ScanText size={12} /> ReNER
                  </span>
                </div>
                <p className={styles.feedText}>{post.text}</p>
              </div>
              <div className={styles.feedGhost} />
              <div className={styles.feedGhost} />
            </div>

            <div id="ext-panel" role="tabpanel" className={styles.panel} aria-live="polite">
              <div className={styles.panelHead}>
                <span className={styles.panelBrand}>ReNER-VN · Nhận định</span>
                <X size={14} aria-hidden="true" />
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={panel}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                  className={styles.panelBody}
                >
                  {panel === 'preview' && (
                    <>
                      <p className={styles.small}>Chữ sẽ được gửi đi (đã che số điện thoại):</p>
                      <blockquote className={styles.quote}>{post.text}</blockquote>
                      <p className={styles.note}>
                        <ShieldCheck size={13} aria-hidden="true" /> Không gửi tên người đăng.
                      </p>
                      <div className={styles.row}>
                        <span className={styles.btnPrimary}>Phân tích</span>
                        <span className={styles.btnGhost}>Hủy</span>
                      </div>
                    </>
                  )}
                  {panel === 'running' && (
                    <div className={styles.running}>
                      <Loader2 size={18} className={styles.spin} aria-hidden="true" />
                      <div>
                        <p className={styles.runTitle}>Đang đọc bài…</p>
                        <p className={styles.small}>Không hiện phần trăm, vì hệ thống không biết trước tổng việc.</p>
                      </div>
                    </div>
                  )}
                  {(panel === 'result' || panel === 'insufficient') && (
                    <>
                      <p className={styles.price}>
                        {head.main}
                        {head.suffix && <small>{head.suffix}</small>}
                      </p>
                      <p className={styles.meta}>
                        {PROPERTY_LABEL[listing.room.property_type]} · {listing.area.value_m2 ? `${listing.area.value_m2} m²` : 'DT chưa rõ'} ·{' '}
                        {listing.location.landmark ?? listing.location.ward_name ?? 'Vị trí chưa rõ'}
                      </p>
                      <p className={styles.fees}>Phí: {feeLine(listing.fees)}</p>
                      <p className={styles.verdict} data-v={c.verdict ?? 'none'}>
                        {verdictSentence(c, listing.rent.amount_form, listing.rent.visibility)}
                      </p>
                      <PriceDistributionBar comparison={c} targetRent={listing.rent.amount_vnd ?? null} compact />
                      {c.similar.length > 0 && (
                        <p className={styles.small}>
                          {c.similar.length} tin tương tự: {c.similar.map((s) => formatShort(s.rent_vnd)).join(' · ')}
                        </p>
                      )}
                      <p className={styles.fine}>{dataRangeSentence(c.data_from, c.data_to)}</p>
                      <Link href={`/tim-tro${demo === undefined ? '' : `?demo=${demo}`}`} className={styles.webLink}>
                        Tìm tin trong kho <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
