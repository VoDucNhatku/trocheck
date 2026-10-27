import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_SAMPLES, analysisSample, imageError, maskAnalysisText } from './analysis-input';

test('preview masks both phone and email before transmission', () => {
  assert.equal(maskAnalysisText('Liên hệ 0901 234 567 hoặc example@example.test'), 'Liên hệ [SĐT] hoặc [Email đã ẩn]');
});
test('image validation accepts only nonempty supported files up to 5 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(imageError({ type, size: 5 * 1024 * 1024 }), null);
  assert.match(imageError({ type: 'image/svg+xml', size: 10 })!, /JPG, PNG/);
  assert.match(imageError({ type: 'image/png', size: 0 })!, /trống/);
  assert.match(imageError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })!, /5 MB/);
});
test('unknown and inherited case names fall back to the default sample', () => {
  for (const id of ['', 'missing', '__proto__', 'constructor']) assert.equal(analysisSample(id), ANALYSIS_SAMPLES['post-001']);
  assert.equal(analysisSample('xem-them-cat').complete, false);
  assert.match(analysisSample('post-001').text, /Giá 4,7 tr\/tháng\./);
  for (const sample of Object.values(ANALYSIS_SAMPLES)) assert.doesNotMatch(sample.text, /\/phòng/);
});
