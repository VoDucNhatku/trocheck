import test from 'node:test';
import assert from 'node:assert/strict';
import { progressText, stageSummary, type MyPostsSummary } from './my-posts-model';

test('private progress gives positions and omits estimates without history', () => {
  assert.equal(progressText({ stage: 'queued', queue_position: 3 }), 'Đang chờ · vị trí 3');
  assert.equal(progressText({ stage: 'queued', queue_position: 3, estimated_wait_seconds: 61 }), 'Đang chờ · vị trí 3 (khoảng 2 phút)');
  assert.equal(progressText({ stage: 'asking_ai' }), 'Đang hỏi AI');
  assert.match(progressText({ stage: 'not_published', reason: 'Bài đã hết phòng' }), /Bài đã hết phòng/);
  assert.match(progressText({ stage: 'failed', reason: 'TimeoutError' }), /Hết thời gian chờ đọc bài/);
});

test('summary counts every owner stage and gives the furthest wait estimate', () => {
  const summary: MyPostsSummary = { counts: { all: 55, published: 0, waiting: 55, other: 0 },
    quota: { used: 55, limit: 200, remaining: 145 },
    stage_counts: { queued: 12, reading: 3, asking_ai: 0, needs_review: 40 }, estimated_wait_seconds: 60 };
  assert.equal(stageSummary(summary), '12 bài đang chờ (khoảng 1 phút) · 3 bài đang đọc giá, diện tích, vị trí · 40 bài chờ duyệt');
});
