'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/workspace/client';
import { requestExtension } from '@/lib/workspace/extension-bridge';
import type { TokenInfo } from '@/lib/workspace/types';
import type { MyPostsSummary } from './my-posts-model';
import { onboardingSteps, processedCount } from './onboarding-model';
import styles from './onboarding.module.css';

/** Fired by the connection panel so the checklist re-reads real state after a connect or revoke. */
export const TOKENS_CHANGED = 'trocheck:tokens-changed';

/** Shows only for an account with no posts. `summary` comes from the page when it already has it. */
export function OnboardingChecklist({ summary }: { summary?: MyPostsSummary | null }) {
  const [own, setOwn] = useState<MyPostsSummary | null>(null);
  const [tokens, setTokens] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(value => value + 1);
    window.addEventListener(TOKENS_CHANGED, refresh);
    return () => window.removeEventListener(TOKENS_CHANGED, refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Every request is a convenience: a failure leaves the step as not done, never an error banner.
    api<{ items: TokenInfo[] }>('team/extension-tokens', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      const now = Date.now();
      setTokens((Array.isArray(value?.items) ? value.items : []).filter(item => !item.revoked_at && (!item.expires_at || Date.parse(item.expires_at) > now)).length);
    }).catch(() => { if (!controller.signal.aborted) setTokens(0); });
    if (!summary) api<MyPostsSummary>('me/posts/summary', { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setOwn(value); }).catch(() => undefined);
    requestExtension('PING').then(answer => { if (!controller.signal.aborted) setSeen(answer.ok); }).catch(() => undefined);
    return () => controller.abort();
  }, [summary, tick]);
  const counts = (summary ?? own)?.counts;
  if (!counts || counts.all > 0) return null;
  const steps = onboardingSteps({ extensionSeen: seen, activeTokens: tokens ?? 0, sent: counts.all, processed: processedCount(counts) });
  const next = steps.findIndex(step => !step.done);
  return <section className={styles.box} aria-labelledby="onboarding-title">
    <h2 id="onboarding-title">Bắt đầu trong 4 bước</h2>
    <p className={styles.lead}>Trạng thái dưới đây lấy từ tài khoản của bạn, không phải danh sách tĩnh.</p>
    <ol className={styles.steps}>{steps.map((step, index) => <li key={step.key} data-done={step.done} data-next={index === next || undefined}>
      <span className={styles.mark} aria-hidden="true">{step.done ? '✓' : index + 1}</span>
      <div><strong>{step.title}<span className={styles.state}>{step.done ? 'Đã xong' : 'Chưa xong'}</span></strong>
        <p>{step.hint}</p>
        {!step.done && step.href && <Link className={styles.link} href={step.href}>{step.link}</Link>}</div>
    </li>)}</ol>
  </section>;
}
