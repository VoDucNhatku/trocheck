import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonText, safeOriginalLink, STATUS_LABEL, statusExplanation, type MyPost } from './my-posts-model';
import { workspaceRouteAllowed } from '../../lib/workspace/safe-path';

const post = { status: 'needs_review', reason_codes: [], listings: [] } as unknown as MyPost;
test('all server post states have Vietnamese labels and plain explanations', () => {
  assert.equal(Object.keys(STATUS_LABEL).length, 6);
  for (const status of Object.keys(STATUS_LABEL) as MyPost['status'][]) {
    assert.ok(STATUS_LABEL[status]);
    assert.ok(statusExplanation({ ...post, status }).length > 15);
  }
  assert.match(statusExplanation({ ...post, reason_codes: ['basis_unknown'] }), /phòng hay người/);
  assert.match(statusExplanation({ ...post, reason_codes: ['former_ward_split'] }), /nhiều phường mới/);
  assert.match(statusExplanation({ ...post, reason_codes: ['outside_hcm_province'] }), /ngoài phạm vi/);
  assert.equal(statusExplanation({ ...post, listings: [{ ward_code: null }] as MyPost['listings'] }), 'Chưa rõ phường.');
  assert.doesNotMatch(statusExplanation({ ...post, reason_codes: ['unknown_internal_code'] }), /unknown_internal_code/);
});

test('comparison preserves server formula and never invents a percentage for missing data', () => {
  const missing = comparisonText({ status: 'insufficient_data', n: 2 } as Parameters<typeof comparisonText>[0]);
  assert.match(missing, /Chưa đủ tin/); assert.doesNotMatch(missing, /%/);
  const message = 'Cao hơn mức trung bình (+12%) của 10 tin cùng phường.';
  assert.equal(comparisonText({ status: 'ok', message } as Parameters<typeof comparisonText>[0]), message);
});

test('private GET proxy paths are allowed and unsafe original links are rejected', () => {
  for (const path of ['me/posts', 'me/posts/summary']) {
    assert.equal(workspaceRouteAllowed(path, 'GET'), true);
    assert.equal(workspaceRouteAllowed(path, 'POST'), false);
  }
  assert.equal(workspaceRouteAllowed('me/posts/other-user', 'GET'), false);
  assert.equal(safeOriginalLink('javascript:alert(1)'), null);
  assert.equal(safeOriginalLink('https://www.facebook.com/groups/1/posts/2/'), 'https://www.facebook.com/groups/1/posts/2/');
});
