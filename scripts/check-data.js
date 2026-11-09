// Prints how many characters each trait has (per category) and resolves images.
// Usage: npm run check-data   (add --refresh to re-fetch all images)
const { CHARACTERS, TRAITS, CATEGORIES } = require('../data/characters');
const images = require('../lib/images');

const cats = Object.keys(CATEGORIES);
console.log(`${CHARACTERS.length} characters:`, cats.map((c) => `${c}=${CHARACTERS.filter((x) => x.cat === c).length}`).join(' '));
console.log('\ntrait'.padEnd(14), 'total', cats.map((c) => c.slice(0, 5).padStart(6)).join(''));
const rows = Object.keys(TRAITS).map((t) => {
  const has = CHARACTERS.filter((c) => c.traits.includes(t));
  return [t, has.length, cats.map((c) => has.filter((x) => x.cat === c).length)];
}).sort((a, b) => a[1] - b[1]);
for (const [t, n, per] of rows) console.log(t.padEnd(13), String(n).padStart(5), per.map((x) => String(x).padStart(6)).join(''), n < 8 ? '  <-- thin' : '');

const dupes = CHARACTERS.filter((c, i) => CHARACTERS.findIndex((x) => x.id === c.id) !== i);
if (dupes.length) console.log('\nDuplicate ids:', dupes.map((d) => d.id));

images.resolveAll(CHARACTERS, { force: process.argv.includes('--refresh') }).then(() => process.exit(0));
