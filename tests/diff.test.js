import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClauseDiff,
  computeWordDiff,
  summarizeDiffStats
} from '../public/shared/textDiff.js';

test('computeClauseDiff: preserva el orden exacto de inserciones intermedias mediante LCS', () => {
  const original = [
    'Artículo 1. Objeto de la ley.',
    'Artículo 2. Ámbito de aplicación.',
    'Artículo 4. Disposición final.'
  ].join('\n');

  const proposed = [
    'Artículo 1. Objeto de la ley.',
    'Artículo 2. Ámbito de aplicación.',
    'Artículo 3. Garantía en micropymes rurales.',
    'Artículo 4. Disposición final.'
  ].join('\n');

  const diff = computeClauseDiff(original, proposed);
  assert.deepEqual(
    diff.map((d) => [d.type, d.text]),
    [
      ['unchanged', 'Artículo 1. Objeto de la ley.'],
      ['unchanged', 'Artículo 2. Ámbito de aplicación.'],
      ['added', 'Artículo 3. Garantía en micropymes rurales.'],
      ['unchanged', 'Artículo 4. Disposición final.']
    ]
  );
});

test('computeClauseDiff: conserva líneas repetidas sin colapsarlas como un Set', () => {
  const original = 'Cláusula común.\nApartado intermedio.\nCláusula común.';
  const proposed = 'Cláusula común.\nApartado sustituido.\nCláusula común.';

  const diff = computeClauseDiff(original, proposed);
  const unchanged = diff.filter((d) => d.type === 'unchanged');
  assert.equal(unchanged.length, 2);
  assert.equal(diff[1].type, 'removed');
  assert.equal(diff[2].type, 'added');
});

test('computeClauseDiff + computeWordDiff: adjunta tokens intralínea en párrafos modificados', () => {
  const original = 'La ayuda mensual será de 350 euros durante seis meses.';
  const proposed = 'La ayuda mensual será de 750 euros durante ocho meses.';

  const diff = computeClauseDiff(original, proposed);
  assert.equal(diff.length, 2);
  assert.equal(diff[0].type, 'removed');
  assert.equal(diff[1].type, 'added');

  assert.ok(Array.isArray(diff[0].tokens));
  assert.ok(Array.isArray(diff[1].tokens));

  const removedWords = diff[0].tokens.filter((t) => t.type === 'removed').map((t) => t.text.trim());
  const addedWords = diff[1].tokens.filter((t) => t.type === 'added').map((t) => t.text.trim());

  assert.deepEqual(removedWords, ['350', 'seis']);
  assert.deepEqual(addedWords, ['750', 'ocho']);

  const direct = computeWordDiff(original, proposed);
  assert.ok(direct.tokens.some((t) => t.type === 'added' && t.text.includes('750')));
  assert.ok(direct.tokens.some((t) => t.type === 'removed' && t.text.includes('350')));

  const stats = summarizeDiffStats(diff);
  assert.equal(stats.addedLines, 1);
  assert.equal(stats.removedLines, 1);
  assert.equal(stats.addedWords, 2);
  assert.equal(stats.removedWords, 2);
  assert.equal(stats.hasChanges, true);
});

test('computeClauseDiff: gestiona entradas vacías y saltos CRLF con acentos españoles', () => {
  const diffEmpty = computeClauseDiff('', '');
  assert.deepEqual(diffEmpty, []);
  assert.equal(summarizeDiffStats(diffEmpty).hasChanges, false);

  const crlf = 'Línea primera con áéíóú.\r\nLínea segunda.';
  const lf = 'Línea primera con áéíóú.\nLínea segunda.';
  const identical = computeClauseDiff(crlf, lf);
  assert.equal(identical.length, 2);
  assert.ok(identical.every((d) => d.type === 'unchanged'));
});
