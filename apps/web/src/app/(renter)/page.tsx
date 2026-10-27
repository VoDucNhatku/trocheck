import Link from 'next/link';
import { Suspense } from 'react';
import { ApiState, LoadingState } from '@/components/ApiState/ApiState';
import { errorMessage } from '@/lib/api/http';
import { parseDemo, type SearchParams } from '@/features/listings/filters';
import { HERO_EXAMPLE, FEW_EXAMPLE } from '@/features/landing/illustrations';
import { ArrowRight, Ban, Divide, Eye, Layers, Sigma, Ruler } from 'lucide-react';
import { EvidenceHighlighter } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import { Reveal } from '@/components/Reveal/Reveal';
import { ExtensionDemo } from '@/features/landing/ExtensionDemo';
import { HousingScene } from '@/features/landing/HousingScene';
import { ReadingHero } from '@/features/landing/ReadingHero';
import { getStatsOverview } from '@/lib/api/client';
import { ev } from '@/features/landing/illustrations';
import { formatDate } from '@/lib/format';
import styles from './landing.module.css';

const CASES = (() => {
  const c = (text: string, spans: [string, Parameters<typeof ev>[2]][], result: string, rule: string, Icon: typeof Ban) => ({
    text,
    evidence: spans.map(([q, l]) => ev(text, q, l)),
    result,
    rule,
    Icon,
  });
  return [
    c('Phòng khép kín 25m2, có gác. Giá ib nhé.', [['25m2', 'AREA'], ['Phòng khép kín', 'ROOM']], 'Bài không công khai giá', '“ib giá” không phải là giá. Giá để trống, có lý do.', Eye),
    c('Phòng 30m2 ở 2 người, giá 1tr5/người/tháng.', [['30m2', 'AREA'], ['1tr5/người/tháng', 'PRICE']], '1,5 tr /tháng/người', 'Không nhân lên thành 3 triệu. Chỉ so với tin cũng tính theo người.', Divide),
    c('Phòng trọ 20m2, từ 3tr/tháng tuỳ tầng.', [['20m2', 'AREA'], ['từ 3tr/tháng', 'PRICE'], ['Phòng trọ', 'ROOM']], 'Từ 3 tr — chưa so sánh', 'Giá “từ…” không phải một con số, nên không đưa vào trung vị.', Ruler),
    c('Còn 2 phòng: P201 25m2 3tr8, P302 35m2 4tr9.', [['P201', 'ROOM'], ['25m2', 'AREA'], ['3tr8', 'PRICE'], ['P302', 'ROOM'], ['35m2', 'AREA'], ['4tr9', 'PRICE']], '2 tin riêng', 'Một bài, hai phòng, hai giá: tách thành hai thẻ, không trộn.', Layers),
    c('Giá 3tr5, điện 3k5/số, nước 100k/người.', [['3tr5', 'PRICE'], ['điện 3k5/số', 'FEE'], ['nước 100k/người', 'FEE']], 'Giá 3,5 tr · phí riêng', 'Không cộng giá với phí thành “tổng”, vì chưa biết dùng bao nhiêu điện.', Sigma),
    c('Cần tìm phòng gần ĐH FPT dưới 3tr.', [['gần ĐH FPT', 'LOC']], 'Không phải bài cho thuê', 'Bài tìm phòng bị phân loại riêng, không trích giá.', Ban),
  ];
})();

const PRINCIPLES = [
  { n: '01', title: 'Thiếu là thiếu', body: 'Giá không có thì ghi “Chưa có giá”, không hiện 0. Phí bài không nói thì ghi “Không đề cập”.' },
  { n: '02', title: 'Có nguồn mới có số', body: 'Mỗi giá trị trỏ về đúng đoạn chữ trong bài. LLM trích sai nguyên văn thì bị bỏ.' },
  { n: '03', title: 'Dưới 10 tin, không kết luận', body: 'Nhóm so sánh nhỏ thì nói chưa đủ dữ liệu, kèm số tin hiện có.' },
  { n: '04', title: 'Từ ngữ trung tính', body: '“Cao hơn trung vị của nhóm tin so sánh”, không phải “bị hét giá” hay “rẻ, nên thuê”.' },
];

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = parseDemo(await searchParams);
  const { detail, comparison } = HERO_EXAMPLE;
  const { detail: few, comparison: fewComparison } = FEW_EXAMPLE;

  return (
    <div className={styles.landing}>
      <HousingScene demo={demo} />
      <ReadingHero detail={detail} comparison={comparison} demo={demo} />

      <Suspense fallback={<LoadingState message="Đang tải số liệu kho…" />}><WarehouseStats demo={demo} /></Suspense>

      <Reveal as="section" className={`container ${styles.section}`} aria-labelledby="cases-title" id="cach-hoat-dong">
        <header className={styles.head} data-reveal>
          <p className={styles.kicker}>02 / ĐỌC GIỮA NHỮNG DÒNG TIN</p>
          <h2 id="cases-title" className={styles.h2}>
            Tin có thể mơ hồ. Cách đọc thì không.
          </h2>
          <p className={styles.sub}>
            Sáu kiểu bài hay gặp và cách ReNER-VN xử lý. Mọi bài dưới đây là ví dụ tự tạo.
          </p>
        </header>
        <ul className={styles.cases}>
          {CASES.map(({ text, evidence, result, rule, Icon }) => (
            <li key={text} className={styles.case} data-reveal>
              <EvidenceHighlighter text={text} evidence={evidence} className={styles.caseText} />
              <div className={styles.caseResult}>
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>{result}</span>
              </div>
              <p className={styles.caseRule}>{rule}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" className={styles.extSection} aria-labelledby="ext-title" id="extension">
        <div className={`container ${styles.extGrid}`}>
          <header className={styles.extCopy} data-reveal>
            <p className={styles.kicker}>03 / MỘT NGƯỜI BẠN KHI TÌM TRỌ</p>
            <h2 id="ext-title" className={styles.h2}>
              Nhận định ngay trên Facebook.
            </h2>
            <ol className={styles.steps}>
              <li>
                <span>1</span>
                <p>
                  Bấm nút <b>ReNER</b> cạnh bài, hoặc bôi đen nội dung.
                </p>
              </li>
              <li>
                <span>2</span>
                <p>Xem trước chữ sẽ gửi. Số điện thoại đã che ngay trên máy bạn.</p>
              </li>
              <li>
                <span>3</span>
                <p>Đọc giá, phí và vị trí của tin so với nhóm tin tương tự.</p>
              </li>
            </ol>
            <p className={styles.extNote}>Extension đang được phát triển. Trong lúc chờ, bạn xem trước các trạng thái panel ở bên cạnh.</p>
          </header>
          <div data-reveal>
            <ExtensionDemo ok={{ detail, comparison }} few={{ detail: few, comparison: fewComparison }} demo={demo} />
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className={`container ${styles.section}`} aria-labelledby="rules-title" id="nguyen-tac">
        <header className={styles.head} data-reveal>
          <p className={styles.kicker}>04 / RÕ RÀNG TỪ NGUYÊN TẮC</p>
          <h2 id="rules-title" className={styles.h2}>
            Thà nói “chưa biết” còn hơn đoán.
          </h2>
        </header>
        <ol className={styles.principles}>
          {PRINCIPLES.map((p) => (
            <li key={p.n} data-reveal>
              <span className={styles.pNum}>{p.n}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <section className={`container ${styles.cta}`} aria-labelledby="cta-title">
        <h2 id="cta-title" className={styles.ctaTitle}>
          Tìm phòng theo <em>ngân sách</em> của bạn.
        </h2>
        <div className={styles.ctaRow}>
          <Link href={`/tim-tro${demo === undefined ? '' : `?demo=${demo}`}`} className={styles.ctaPrimary}>
            Mở Tìm trọ <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/#nguyen-tac" className={styles.ctaSecondary}>
            Nguyên tắc dữ liệu
          </Link>
        </div>
      </section>
    </div>
  );
}

async function WarehouseStats({ demo }: { demo?: boolean }) {
  try {
    const stats = await getStatsOverview(demo);
    return <section className={styles.stats} aria-label="Số liệu kho"><div className={`container ${styles.statsInner}`}>
      {stats.total_listings > 0 ? <>
        <p><strong className="num">{stats.total_listings}</strong> tin trong kho</p>
        <p><strong className="num">{stats.eligible_listings}</strong> tin đủ điều kiện thống kê</p>
        <p>{stats.updated_at ? `Cập nhật ${formatDate(stats.updated_at)}` : 'Chưa rõ ngày cập nhật'}</p>
      </> : <p>Kho chưa có tin. Bạn vẫn có thể xem các ví dụ tự tạo trên trang.</p>}
      {stats.is_demo && <span className={styles.demoTag}>dữ liệu demo</span>}
      <Link href={`/tim-tro?demo=${stats.is_demo}`}>Xem kho này →</Link>
    </div></section>;
  } catch (error) {
    return <div className="container"><ApiState title="Chưa tải được số liệu kho" message={errorMessage(error)} /></div>;
  }
}
