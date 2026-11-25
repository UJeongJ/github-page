import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { levels, scenario, sheetNames, sum, unitAt, valueAt } from '../src/io/model.ts';

const expectedProduction = [1964.069239470151, 1532.841770422341, 1424.108258471317, 1362.023579818450];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
levels.forEach(({ id, count }, index) => test(`${id}: sheet schemas, official units and published coefficient totals`, () => {
  const book = JSON.parse(gunzipSync(readFileSync(new URL(`../public/data/${id}.json.gz`, import.meta.url))));
  assert.equal(book.level, id);
  assert.equal(book.sectors.length, count);
  assert.deepEqual(book.sheets.map(s => s.name), sheetNames);
  for (const sheet of book.sheets) {
    assert.equal(sheet.rows.length, sheet.cells.length);
    assert.ok(sheet.cells.every(r => r.length === sheet.cols.length));
  }
  const [a, b] = book.sectors;
  assert.equal(unitAt(book.sheets[0], book.sectors[0]), '백만원');
  assert.equal(unitAt(book.sheets[6], book.sectors[0]), '무차원');
  assert.equal(unitAt(book.sheets[9], { code: '9812' }), '%');
  assert.equal(unitAt(book.sheets[9], { code: '9811' }), '무차원');
  const single = scenario(book, { [a.code]: 1000 });
  close(sum(single.map(r => r.production)), expectedProduction[index]);
  const results = scenario(book, { [a.code]: 1000, [b.code]: -100 });
  for (const [i, metric] of ['production', 'imports', 'valueAdded'].entries()) {
    const sheet = book.sheets[i + 6];
    close(sum(results.map(r => r[metric])), valueAt(sheet, '9590', a.code) * 1000 - valueAt(sheet, '9590', b.code) * 100);
  }
  const am = book.sheets[4];
  close(single[0].imports, sum(single.map((r, i) => am.cells[0][i] * r.production)));
  const va = valueAt(book.sheets[3], '9690', a.code);
  close(single[0].valueAdded, va * single[0].production);
}));
