// Resolves a picture for every character and caches the result on disk.
//
// 1. Wikipedia (MediaWiki pageimages API, no key needed). Covers almost every
//    mainstream movie / TV / game / cartoon / anime character.
// 2. Jikan (unofficial MyAnimeList API, no key) as a fallback for anime.
// 3. A character can also set `img` directly in data/characters.js to override both.
//
// Images are hot-linked from upload.wikimedia.org / cdn.myanimelist.net, which is
// fine for a private party game. If you ever make this public, review the licenses.

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'image-cache.json');
const UA = 'SameDifferencePartyGame/0.1 (personal hobby project; node fetch)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }

function save() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1)); } catch (e) { console.warn('image cache save failed', e.message); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiBatch(titles) {
  const url = `${WIKI_API}?${new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', redirects: '1',
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400', pilicense: 'any',
    titles: titles.join('|'),
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const data = await res.json();
  const q = data.query || {};
  const follow = new Map();
  for (const n of q.normalized || []) follow.set(n.from, n.to);
  const redirects = new Map((q.redirects || []).map((r) => [r.from, r.to]));
  const byTitle = new Map((q.pages || []).map((p) => [p.title, p]));
  const out = {};
  for (const t of titles) {
    let title = follow.get(t) || t;
    title = redirects.get(title) || title;
    const page = byTitle.get(title);
    out[t] = page && page.thumbnail ? page.thumbnail.source.replace(/\?utm_.*$/, '') : null;
  }
  return out;
}

// Fallback when a page has no "page image": take the first decent picture in
// the article's infobox (common for non-free character art).
async function wikiInfobox(title) {
  const url = `${WIKI_API}?${new URLSearchParams({
    action: 'parse', format: 'json', formatversion: '2', redirects: '1',
    prop: 'text', section: '0', page: title,
  })}`;
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 429) break;
    await sleep(2000 * (attempt + 1)); // rate limited: back off
  }
  if (!res.ok) { console.warn('[images] parse failed', title, res.status); return null; }
  const data = await res.json();
  const html = data.parse && data.parse.text;
  if (!html) return null;
  const box = html.indexOf('infobox');
  if (box < 0) return null;
  const re = /<img[^>]+>/g;
  re.lastIndex = box;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = (tag.match(/src="([^"]+)"/) || [])[1];
    const width = Number((tag.match(/width="(\d+)"/) || [])[1] || 0);
    if (!src || width < 80 || /\.svg/i.test(src)) continue;
    // Prefer the sharpest version listed in srcset ("… 1.5x, … 2x").
    const srcset = (tag.match(/srcset="([^"]+)"/) || [])[1];
    const best = srcset ? srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).pop() : src;
    const url = best.replace(/&amp;/g, '&').replace(/\?utm_.*$/, '');
    return url.startsWith('//') ? `https:${url}` : url;
  }
  return null;
}

// Fallback #2: the franchise's Fandom wiki (same MediaWiki API, no key).
// Keyed by the character's `from` field; a character can also set `fandom`.
const FANDOM = {
  'Star Wars': 'starwars', 'Harry Potter': 'harrypotter', 'The Lord of the Rings': 'lotr',
  'Indiana Jones': 'indianajones', Beetlejuice: 'beetlejuice', "Child's Play": 'childsplay',
  Marvel: 'marvelcinematicuniverse', 'Guardians of the Galaxy': 'marvelcinematicuniverse', DC: 'dc',
  Shrek: 'shrek', 'Monsters, Inc.': 'disney', Aladdin: 'disney', 'Beauty and the Beast': 'disney',
  Moana: 'disney', 'Peter Pan': 'disney', Zootopia: 'disney', Frozen: 'disney', Mulan: 'disney',
  'The Little Mermaid': 'disney', 'The Lion King': 'disney', Tangled: 'disney', Disney: 'disney',
  'Toy Story': 'pixar', Cars: 'pixar', 'Finding Nemo': 'pixar', 'The Incredibles': 'pixar', Up: 'pixar',
  Ratatouille: 'pixar', 'WALL-E': 'pixar', 'E.T. the Extra-Terrestrial': 'et',
  'Game of Thrones': 'gameofthrones', 'Death Note': 'deathnote', 'My Neighbor Totoro': 'ghibli',
  'Spirited Away': 'ghibli', "Kiki's Delivery Service": 'ghibli', 'Sword Art Online': 'swordartonline',
  'Super Mario': 'mario', 'Red Dead Redemption 2': 'reddead', 'Angry Birds': 'angrybirds',
  'SpongeBob SquarePants': 'spongebob', 'The Fairly OddParents': 'fairlyoddparents',
  'The Powerpuff Girls': 'powerpuffgirls', 'Gravity Falls': 'gravityfalls',
  'How the Grinch Stole Christmas!': 'drseuss', 'Teen Titans': 'teentitans',
  'The Simpsons': 'simpsons', 'Family Guy': 'familyguy', 'Rick and Morty': 'rickandmorty',
  'Scooby-Doo': 'scoobydoo', 'Looney Tunes': 'looneytunes', 'Adventure Time': 'adventuretime',
  'Avatar: The Last Airbender': 'avatar', Naruto: 'naruto', 'One Piece': 'onepiece', 'Dragon Ball': 'dragonball',
  'Attack on Titan': 'attackontitan', 'My Hero Academia': 'myheroacademia', 'Demon Slayer': 'kimetsu-no-yaiba',
  Pokémon: 'pokemon', Sonic: 'sonic', 'The Legend of Zelda': 'zelda', 'Street Fighter': 'streetfighter',
  'Mortal Kombat': 'mortalkombat', 'Resident Evil': 'residentevil', 'Professor Layton': 'layton',
  "Five Nights at Freddy's": 'freddy-fazbears-pizza', 'The Office': 'theoffice', 'Friends': 'friends',
  'How I Met Your Mother': 'himym', 'Stranger Things': 'strangerthings', 'Breaking Bad': 'breakingbad',
};

async function fandom(character) {
  const sub = character.fandom || FANDOM[character.from];
  if (!sub) return null;
  const url = `https://${sub}.fandom.com/api.php?${new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', redirects: '1',
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '400', titles: character.fandomTitle || character.name,
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const page = data.query && data.query.pages && data.query.pages[0];
  return page && page.thumbnail ? page.thumbnail.source : null;
}

async function jikan(name) {
  const res = await fetch(`https://api.jikan.moe/v4/characters?${new URLSearchParams({ q: name, limit: '1', order_by: 'favorites', sort: 'desc' })}`);
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data.data && data.data[0];
  return hit ? hit.images?.webp?.image_url || hit.images?.jpg?.image_url || null : null;
}

let resolving = null;

function resolveAll(characters, { force = false } = {}) {
  if (resolving) return resolving;
  resolving = (async () => {
    // Missing pictures are retried on every start (cheap: only the gaps are fetched).
    const todo = characters.filter((c) => !c.img && (force || !cache[c.id]));
    if (!todo.length) return;
    console.log(`[images] resolving ${todo.length} character images…`);
    // Characters flagged imgFrom:'fandom' (Wikipedia's picture is wrong) go to Fandom first.
    for (const c of todo.filter((x) => x.imgFrom === 'fandom')) {
      try { cache[c.id] = await fandom(c); } catch { /* falls through to Wikipedia */ }
    }
    const wikiTodo = todo.filter((c) => !cache[c.id]);
    for (let i = 0; i < wikiTodo.length; i += 50) {
      const chunk = wikiTodo.slice(i, i + 50);
      try {
        const found = await wikiBatch(chunk.map((c) => c.wiki));
        for (const c of chunk) cache[c.id] = found[c.wiki] || null;
      } catch (e) {
        console.warn('[images] wikipedia batch failed:', e.message);
      }
      await sleep(250);
    }
    for (const c of todo.filter((x) => !cache[x.id])) {
      try { cache[c.id] = await wikiInfobox(c.wiki); } catch (e) { console.warn('[images] infobox failed', c.wiki, e.message); }
      await sleep(1000);
    }
    for (const c of todo.filter((x) => !cache[x.id])) {
      try { cache[c.id] = await fandom(c); } catch (e) { console.warn('[images] fandom failed', c.name, e.message); }
      await sleep(300);
    }
    const missingAnime = todo.filter((c) => !cache[c.id] && c.cat === 'anime');
    for (const c of missingAnime) {
      try { cache[c.id] = await jikan(c.name); } catch { /* ignore */ }
      await sleep(400); // Jikan allows ~3 req/s
    }
    save();
    const missing = characters.filter((c) => !c.img && !cache[c.id]);
    console.log(`[images] done. ${characters.length - missing.length}/${characters.length} have pictures.`);
    if (missing.length) console.log('[images] no picture for:', missing.map((c) => c.name).join(', '));
  })().finally(() => { resolving = null; });
  return resolving;
}

function imageFor(character) {
  return character.img || cache[character.id] || null;
}

module.exports = { resolveAll, imageFor, wikiInfobox };
