import assert from 'node:assert/strict';
import test from 'node:test';
import { marketFilters, marketQuery } from '../src/features/workspace/Market.model';

test('market leaves the dataset to the API unless a valid override is explicit', () => {
  assert.equal(new URLSearchParams(marketQuery(marketFilters({}))).has('demo'), false);
  assert.equal(new URLSearchParams(marketQuery(marketFilters({ demo: 'invalid' }))).has('demo'), false);
  assert.equal(new URLSearchParams(marketQuery(marketFilters({ demo: 'false' }))).get('demo'), 'false');
});
