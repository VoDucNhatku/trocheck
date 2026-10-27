import assert from 'node:assert/strict';
import test from 'node:test';
import { storeQuery } from './store-model';

test('collection date boundaries include the entire Vietnam day and preserve filters', () => {
  const query = new URLSearchParams(storeQuery('date_from=2024-02-29&date_to=2024-02-29&status=processed&group=C%E1%BA%A7u+Gi%E1%BA%A5y&page=2'));
  assert.equal(query.get('date_from'), '2024-02-28T17:00:00.000Z');
  assert.equal(query.get('date_to'), '2024-02-29T16:59:59.999Z');
  assert.equal(query.get('status'), 'processed');
  assert.equal(query.get('group'), 'Cầu Giấy');
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('page_size'), '20');
});

test('invalid URL dates do not crash the view; API remains the validator', () => {
  const query = new URLSearchParams(storeQuery('date_from=2026-99-99&date_to=bad'));
  assert.equal(query.get('date_from'), '2026-99-99');
  assert.equal(query.get('date_to'), 'bad');
  assert.equal(new URLSearchParams(storeQuery('date_from=2026-02-30')).get('date_from'), '2026-02-30');
});
