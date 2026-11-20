/**
 * Motor de comparación normativa (LCS por líneas y resaltado intralínea por palabras).
 * Isomórfico: sin dependencias de Node, ejecutable directamente en navegador y servidor.
 */

const TOKEN_PATTERN = /\s+|\p{L}[\p{L}\p{N}_'-]*|\p{N}+(?:[.,]\p{N}+)*|[^\s]/gu;
const WORD_CHECK_PATTERN = /[\p{L}\p{N}]/u;

function normalizeLines(text = '') {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function tokenizeLine(line = '') {
  const matches = String(line ?? '').match(TOKEN_PATTERN);
  return matches || [];
}

function buildLcsMatrix(seqA, seqB) {
  const m = seqA.length;
  const n = seqB.length;
  const cols = n + 1;
  const dp = new Int32Array((m + 1) * cols);

  for (let i = m - 1; i >= 0; i--) {
    const rowOffset = i * cols;
    const nextRowOffset = (i + 1) * cols;
    for (let j = n - 1; j >= 0; j--) {
      if (seqA[i] === seqB[j]) {
        dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
      } else {
        const down = dp[nextRowOffset + j];
        const right = dp[rowOffset + j + 1];
        dp[rowOffset + j] = down >= right ? down : right;
      }
    }
  }

  return { dp, cols };
}

function backtrackLcs(seqA, seqB) {
  const m = seqA.length;
  const n = seqB.length;

  // Respaldo lineal si un texto excepcionalmente extenso superase el umbral de matriz
  if (m * n > 400_000) {
    const fallback = [];
    for (const item of seqA) fallback.push({ type: 'removed', text: item });
    for (const item of seqB) fallback.push({ type: 'added', text: item });
    return fallback;
  }

  const { dp, cols } = buildLcsMatrix(seqA, seqB);
  const ops = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (seqA[i] === seqB[j]) {
      ops.push({ type: 'unchanged', text: seqA[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + (j + 1)]) {
      ops.push({ type: 'removed', text: seqA[i] });
      i++;
    } else {
      ops.push({ type: 'added', text: seqB[j] });
      j++;
    }
  }

  while (i < m) {
    ops.push({ type: 'removed', text: seqA[i] });
    i++;
  }
  while (j < n) {
    ops.push({ type: 'added', text: seqB[j] });
    j++;
  }

  return ops;
}

function mergeAdjacentTokens(tokens) {
  const merged = [];
  for (const token of tokens) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === token.type) {
      prev.text += token.text;
    } else {
      merged.push({ type: token.type, text: token.text });
    }
  }
  return merged;
}

/**
 * Calcula las diferencias a nivel de palabra/token entre dos líneas sustituidas.
 */
export function computeWordDiff(oldLine = '', newLine = '') {
  const tokensA = tokenizeLine(oldLine);
  const tokensB = tokenizeLine(newLine);
  const ops = backtrackLcs(tokensA, tokensB);

  const unified = ops.map((op) => ({ type: op.type, text: op.text }));
  const oldTokens = [];
  const newTokens = [];

  for (const op of ops) {
    if (op.type === 'unchanged') {
      oldTokens.push({ type: 'unchanged', text: op.text });
      newTokens.push({ type: 'unchanged', text: op.text });
    } else if (op.type === 'removed') {
      oldTokens.push({ type: 'removed', text: op.text });
    } else if (op.type === 'added') {
      newTokens.push({ type: 'added', text: op.text });
    }
  }

  return {
    tokens: mergeAdjacentTokens(unified),
    oldTokens: mergeAdjacentTokens(oldTokens),
    newTokens: mergeAdjacentTokens(newTokens)
  };
}

/**
 * Calcula el diff ordenado por líneas mediante LCS y empareja bloques contiguos
 * de eliminación/adición con resaltado intralínea por palabras.
 */
export function computeClauseDiff(originalText = '', proposedText = '') {
  const origLines = normalizeLines(originalText);
  const propLines = normalizeLines(proposedText);
  const entries = backtrackLcs(origLines, propLines);

  let idx = 0;
  while (idx < entries.length) {
    if (entries[idx].type !== 'removed') {
      idx++;
      continue;
    }

    const removedStart = idx;
    while (idx < entries.length && entries[idx].type === 'removed') {
      idx++;
    }
    const removedEnd = idx;

    const addedStart = idx;
    while (idx < entries.length && entries[idx].type === 'added') {
      idx++;
    }
    const addedEnd = idx;

    const pairCount = Math.min(removedEnd - removedStart, addedEnd - addedStart);
    for (let k = 0; k < pairCount; k++) {
      const removedEntry = entries[removedStart + k];
      const addedEntry = entries[addedStart + k];
      const wordDiff = computeWordDiff(removedEntry.text, addedEntry.text);
      removedEntry.tokens = wordDiff.oldTokens;
      addedEntry.tokens = wordDiff.newTokens;
    }
  }

  return entries;
}

function countWordTokens(text = '') {
  return tokenizeLine(text).filter((token) => WORD_CHECK_PATTERN.test(token)).length;
}

/**
 * Resume métricas cuantitativas (líneas y palabras añadidas o suprimidas) a partir de un diff.
 */
export function summarizeDiffStats(diff = []) {
  let addedLines = 0;
  let removedLines = 0;
  let addedWords = 0;
  let removedWords = 0;

  for (const entry of diff) {
    if (entry.type === 'added') {
      addedLines++;
      if (Array.isArray(entry.tokens)) {
        for (const token of entry.tokens) {
          if (token.type === 'added') {
            addedWords += countWordTokens(token.text);
          }
        }
      } else {
        addedWords += countWordTokens(entry.text);
      }
    } else if (entry.type === 'removed') {
      removedLines++;
      if (Array.isArray(entry.tokens)) {
        for (const token of entry.tokens) {
          if (token.type === 'removed') {
            removedWords += countWordTokens(token.text);
          }
        }
      } else {
        removedWords += countWordTokens(entry.text);
      }
    }
  }

  return {
    addedLines,
    removedLines,
    addedWords,
    removedWords,
    hasChanges: addedLines > 0 || removedLines > 0
  };
}
