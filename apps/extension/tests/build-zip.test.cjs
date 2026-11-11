const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { buildZip, TARGET } = require('../scripts/build-zip.cjs');

test('the zip offered on the web matches the current extension code', () => {
  assert.ok(buildZip().equals(fs.readFileSync(TARGET)), 'Run npm run build:zip after changing extension/.');
});
