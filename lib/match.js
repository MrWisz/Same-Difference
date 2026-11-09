// Fuzzy guess matching: forgiving of case, accents, punctuation and small typos.

const STOP = new Set([
  'the', 'mr', 'mrs', 'ms', 'dr', 'doctor', 'captain', 'king', 'queen', 'prince', 'princess',
  'lord', 'lady', 'sir', 'professor', 'agent', 'count', 'darth', 'master', 'super', 'little',
  'big', 'baby', 'miss', 'uncle', 'aunt', 'general', 'detective', 'inspector', 'saint', 'jack',
]);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function tolerance(len) {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

// All accepted answers for a character: its name, aliases, and its first name
// when the name has two+ words (e.g. "Homer" for "Homer Simpson").
function answersFor(character) {
  const out = new Set();
  for (const raw of [character.name, ...(character.aliases || [])]) {
    const n = norm(raw);
    if (!n) continue;
    out.add(n);
    out.add(n.replace(/ /g, ''));
    const parts = n.split(' ');
    if (parts.length >= 2 && parts[0].length >= 4 && !STOP.has(parts[0])) out.add(parts[0]);
  }
  return [...out];
}

function isCorrectGuess(guess, character) {
  const g = norm(guess);
  if (!g) return false;
  const gCompact = g.replace(/ /g, '');
  return answersFor(character).some((a) => {
    if (a === g || a === gCompact) return true;
    return lev(a, g) <= tolerance(a.length) || lev(a, gCompact) <= tolerance(a.length);
  });
}

module.exports = { isCorrectGuess, norm };
