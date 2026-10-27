import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marketAreaReady, marketFilters, marketMeanReady, marketMinimum, marketQuery, marketSearchUrl, marketWards, type MarketCell } from './Market.model';

const cell: MarketCell = { ward_code: 'CG', ward_name: 'Cầu Giấy', property_type: 'ccmn', basis: 'per_unit', n: 10, n_per_m2: 10, mean_vnd: 4400000, mean_per_m2: 150000, median: 3900000, p25: 1, p75: 2, median_per_m2: 1, data_from: null, data_to: null };

test('market suppresses means below ten and never falls back to research fields', () => {
  assert.equal(marketMeanReady({ ...cell, n: 9 }), false);
  assert.equal(marketMeanReady(cell), true);
  assert.equal(marketMeanReady({ ...cell, mean_vnd: null }), false);
  assert.equal(marketMeanReady({ ...cell, mean_vnd: Number.NaN }), false);
  assert.equal(marketMeanReady({ ...cell, mean_vnd: 0 }), false);
  assert.equal(marketMeanReady(cell, 12), false);
  assert.equal(marketMinimum(3), 10);
});

test('price per square metre needs its own sufficient area sample', () => {
  assert.equal(marketAreaReady(cell), true);
  assert.equal(marketAreaReady({ ...cell, n_per_m2: 9 }), false);
  assert.equal(marketAreaReady({ ...cell, mean_per_m2: null }), false);
  assert.equal(marketAreaReady({ ...cell, n: 9 }), false);
});

test('market filters normalize one supported basis/dataset and preserve Unicode wards', () => {
  const filters = marketFilters({ ward: ' Cầu Giấy ', type: 'ccmn', basis: ['per_person', 'per_unit'], demo: 'false' });
  const params = new URLSearchParams(marketQuery(filters));
  assert.equal(params.get('ward'), 'Cầu Giấy');
  assert.equal(params.get('basis'), 'per_person');
  assert.equal(params.get('demo'), 'false');
  assert.deepEqual(marketFilters({ type: 'studio', basis: 'unknown', demo: 'invalid' }), { ward: '', type: '', basis: 'per_unit', demo: 'true' });
});

test('ward groups stay separate and search links use the public route supported filters', () => {
  assert.equal(marketWards([cell, { ...cell, property_type: 'phong_tro' }, { ...cell, ward_code: 'ND', ward_name: 'Nghĩa Đô' }]).length, 2);
  const url = new URL(marketSearchUrl('Cầu Giấy', 'ccmn', false), 'http://local');
  assert.equal(url.pathname, '/tim-tro');
  assert.equal(url.searchParams.get('phuong'), 'Cầu Giấy');
  assert.equal(url.searchParams.get('loai'), 'ccmn');
  assert.equal(url.searchParams.get('demo'), 'false');
  assert.equal(url.searchParams.has('basis'), false);
});
