import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingSteps, processedCount } from './onboarding-model';

const flags = (state: Parameters<typeof onboardingSteps>[0]) => onboardingSteps(state).map(step => step.done);

test('new account: nothing is done', () => {
  assert.deepEqual(flags({ extensionSeen: false, activeTokens: 0, sent: 0, processed: 0 }), [false, false, false, false]);
});
test('extension detected but not connected', () => {
  assert.deepEqual(flags({ extensionSeen: true, activeTokens: 0, sent: 0, processed: 0 }), [true, false, false, false]);
});
test('a token counts as installed and connected', () => {
  assert.deepEqual(flags({ extensionSeen: false, activeTokens: 1, sent: 0, processed: 0 }), [true, true, false, false]);
});
test('posts received but still processing: result step stays open and says so', () => {
  const steps = onboardingSteps({ extensionSeen: true, activeTokens: 1, sent: 5, processed: 0 });
  assert.deepEqual(steps.map(step => step.done), [true, true, true, false]);
  assert.match(steps[3].hint, /đang được xử lý/);
});
test('everything done once posts are processed', () => {
  assert.deepEqual(flags({ extensionSeen: true, activeTokens: 1, sent: 5, processed: 3 }), [true, true, true, true]);
});
test('processed count ignores posts that are still waiting', () => {
  assert.equal(processedCount({ all: 7, published: 2, waiting: 4, other: 1 }), 3);
});
