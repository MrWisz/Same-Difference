// Fuzzy guess matching: forgiving of case, accents, punctuation, small typos,
// articles ("the", "el", "la"…) and Spanish word order / vocabulary.
//
// How a guess is accepted (any one is enough):
//   1. It matches the name or an alias (incl. Spanish names from characters.es.js),
//      allowing small typos.
//   2. It matches the character's first name ("Homer" for "Homer Simpson").
//   3. Word-by-word: both sides are translated to the same vocabulary and compared
//      ignoring word order. So "Linterna Verde" = "Green Lantern",
//      "el increíble Hulk" = "Incredible Hulk", "Gandalf el Gris" = "Gandalf the Grey".

// Leading articles dropped from every guess/answer.
const ARTICLES = /^(the|a|an|el|la|los|las|lo|un|una) /;

// Filler words ignored in the word-by-word comparison.
const FILLER = new Set(['the', 'a', 'an', 'of', 'and', 'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'de', 'del', 'y', 'e']);

// Spanish (and English variants) → one shared word. Only needs words that appear in names.
const WORDS = {
  // titles
  capitan: 'captain', capitana: 'captain', rey: 'king', reina: 'queen', principe: 'prince', princesa: 'princess',
  senor: 'mr', senora: 'mrs', sr: 'mr', sra: 'mrs', mister: 'mr', missus: 'mrs', dr: 'doctor', doc: 'doctor',
  profesor: 'professor', profesora: 'professor', prof: 'professor', maestro: 'master', maestra: 'master',
  tio: 'uncle', tia: 'aunt', conde: 'count', condesa: 'countess', senorita: 'miss', agente: 'agent',
  detective: 'detective', inspector: 'inspector', general: 'general', sargento: 'sergeant', teniente: 'lieutenant',
  // people
  hombre: 'man', mujer: 'woman', chica: 'girl', chico: 'boy', nino: 'kid', nina: 'kid', bebe: 'baby',
  // colors
  negro: 'black', negra: 'black', rojo: 'red', roja: 'red', verde: 'green', azul: 'blue', blanco: 'white',
  blanca: 'white', amarillo: 'yellow', amarilla: 'yellow', rosa: 'pink', rosado: 'pink', morado: 'purple',
  morada: 'purple', gris: 'grey', gray: 'grey', naranja: 'orange', dorado: 'golden', plateado: 'silver',
  // animals & creatures
  perro: 'dog', perrito: 'dog', gato: 'cat', gatito: 'cat', pato: 'duck', raton: 'mouse', ratoncito: 'mouse',
  oso: 'bear', osito: 'bear', pajaro: 'bird', ave: 'bird', rana: 'frog', leon: 'lion', tigre: 'tiger',
  mono: 'monkey', conejo: 'bunny', rabbit: 'bunny', cerdo: 'pig', cerdito: 'pig', cerdita: 'pig', caracol: 'snail',
  ornitorrinco: 'platypus', dinosaurio: 'dinosaur', dragon: 'dragon', pantera: 'panther', hormiga: 'ant',
  arana: 'spider', murcielago: 'bat', pinguino: 'penguin', lobo: 'wolf', zorro: 'fox', tortuga: 'turtle',
  tortugas: 'turtles', pez: 'fish', payaso: 'clown', marciano: 'martian', fantasma: 'ghost', monstruo: 'monster',
  bruja: 'witch', mago: 'wizard', hechicero: 'sorcerer', vampiro: 'vampire', vampira: 'vampire', bestia: 'beast',
  gigante: 'giant', demonio: 'devil', diablo: 'devil', robot: 'robot', caballero: 'knight', pirata: 'pirate',
  // descriptive words that show up in names
  hierro: 'iron', maravilla: 'wonder', increible: 'incredible', increibles: 'incredibles', linterna: 'lantern',
  flecha: 'arrow', halcon: 'hawk', ojo: 'eye', escarlata: 'scarlet', malvada: 'evil', malvado: 'evil',
  malo: 'bad', mala: 'bad', bueno: 'good', buena: 'good', estrella: 'star', estrellas: 'stars', guerra: 'war',
  explorador: 'explorer', exploradora: 'explorer', constructor: 'builder', gran: 'big', grande: 'big',
  pequeno: 'little', pequena: 'little', nieve: 'snow', hielo: 'ice', helado: 'ice', fuego: 'fire', mar: 'sea',
  marinero: 'sailor', marino: 'sailor', cazador: 'hunter', joven: 'young', viejo: 'old', loco: 'mad', loca: 'mad',
  sombrerero: 'hatter', hojalata: 'tin', espantapajaros: 'scarecrow', cobarde: 'cowardly', capa: 'cape',
  sombrero: 'hat', botas: 'boots', calamar: 'squid', esponja: 'sponge', grunon: 'grouch',
  humano: 'human', extraterrestre: 'alien', alienigena: 'alien', bigotes: 'whiskers',
  calabaza: 'pumpkin', vaquera: 'cowgirl', vaquerita: 'cowgirl', comisario: 'sheriff', alguacil: 'sheriff',
  erizo: 'hedgehog', equidna: 'echidna', cazafantasmas: 'ghostbuster', viuda: 'widow',
};

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
    .trim()
    .replace(ARTICLES, '')
    .trim();
}

const canon = (w) => WORDS[w] || w;

// Meaningful words of a normalized string, translated to the shared vocabulary.
function words(n) {
  return n.split(' ').filter((w) => w && !FILLER.has(w)).map(canon);
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

const close = (a, b) => a === b || lev(a, b) <= tolerance(Math.max(a.length, b.length));

// Same words in any order (each word may have a small typo).
function sameWords(a, b) {
  if (a.length !== b.length || !a.length) return false;
  const left = [...b];
  return a.every((w) => {
    const i = left.findIndex((x) => close(w, x));
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
}

// A first name only counts if it's a real name, not a title or a common word
// ("Capitán", "Pato", "Princesa" alone shouldn't win the round).
const COMMON = new Set(Object.values(WORDS));
const isNameWord = (w) => w.length >= 4 && !STOP.has(w) && !WORDS[w] && !COMMON.has(w) && !STOP.has(canon(w));

// Every full name / alias in the game → which characters own it. A guess that is
// exactly another character's name is never accepted ("Wario" when you're Mario).
let reserved = null;
function reservedNames() {
  if (reserved) return reserved;
  reserved = new Map();
  const { CHARACTERS } = require('../data/characters');
  for (const c of CHARACTERS) {
    for (const raw of [c.name, c.nameEs, ...(c.aliases || [])]) {
      for (const n of [norm(raw), norm(raw).replace(/ /g, '')]) {
        if (!n) continue;
        if (!reserved.has(n)) reserved.set(n, new Set());
        reserved.get(n).add(c.id);
      }
    }
  }
  return reserved;
}

// All accepted answers for a character: its name, aliases, and its first name
// when the name has two+ words (e.g. "Homer" for "Homer Simpson").
// A first name is skipped when it's another character's own name
// ("Steve" is Steve from Minecraft, not Steve Rogers).
function answersFor(character) {
  const out = new Set();
  const firstNames = new Set();
  for (const raw of [character.name, ...(character.aliases || [])]) {
    const n = norm(raw);
    if (!n) continue;
    out.add(n);
    out.add(n.replace(/ /g, ''));
    const parts = n.split(' ');
    if (parts.length >= 2 && isNameWord(parts[0])) firstNames.add(parts[0]);
  }
  for (const f of firstNames) {
    if (out.has(f)) continue;
    const owners = reservedNames().get(f);
    if (!owners || (owners.size === 1 && owners.has(character.id))) out.add(f);
  }
  return [...out];
}

function isCorrectGuess(guess, character) {
  const g = norm(guess);
  if (!g) return false;
  const gCompact = g.replace(/ /g, '');
  const answers = answersFor(character);
  // 1. Exact match with one of this character's names.
  if (answers.some((a) => a === g || a === gCompact)) return true;
  // 2. Exactly someone else's name → wrong, even if it's only a letter off.
  for (const n of [g, gCompact]) {
    const owners = reservedNames().get(n);
    if (owners && !owners.has(character.id)) return false;
  }
  // 3. Small typos (first letter must match).
  const typo = (a, x) => a[0] === x[0] && lev(a, x) <= tolerance(a.length);
  if (answers.some((a) => typo(a, g) || typo(a, gCompact))) return true;
  // 4. Same words in any order, Spanish or English ("Linterna Verde" = "Green Lantern").
  const gw = words(g);
  return answers.some((a) => a.includes(' ') && sameWords(gw, words(a)));
}

module.exports = { isCorrectGuess, norm };
