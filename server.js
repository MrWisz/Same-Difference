const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const { CHARACTERS, TRAITS, CATEGORIES, TRAIT_LABELS, CATEGORY_LABELS, BY_ID } = require('./data/characters');
const images = require('./lib/images');
const { isCorrectGuess } = require('./lib/match');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (_req, res) => {
  res.json({
    categories: Object.keys(CATEGORIES).map((id) => ({ id, label: CATEGORY_LABELS[id], count: CHARACTERS.filter((c) => c.cat === id).length })),
    traitCount: Object.keys(TRAITS).length,
    characterCount: CHARACTERS.length,
    lanUrls: lanUrls(),
  });
});

app.get('/api/qr', async (req, res) => {
  const text = String(req.query.u || '').slice(0, 300);
  if (!text) return res.status(400).end();
  res.type('svg').send(await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#1b1530', light: '#ffffff' } }));
});

// Browse every character + picture (handy for checking the data).
app.get('/api/gallery', (_req, res) => {
  res.json(CHARACTERS.map((c) => ({ ...publicChar(c), traits: c.traits.map((t) => TRAIT_LABELS[t]) })));
});

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  }
  return out;
}

// Display text is sent in every language ({ en, es }); each client shows its own.
const publicChar = (c) => c && ({
  id: c.id, cat: c.cat, img: images.imageFor(c),
  name: { en: c.name, es: c.nameEs }, from: { en: c.from, es: c.fromEs }, catLabel: CATEGORY_LABELS[c.cat],
});
const charName = (id) => { const c = BY_ID.get(id); return c ? { en: c.name, es: c.nameEs } : '???'; };

// ───────────────────────── rooms ─────────────────────────

const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  let code;
  do code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  while (rooms.has(code));
  return code;
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

function createRoom(hostPid) {
  const room = {
    code: newCode(),
    hostPid,
    players: new Map(), // pid -> { pid, name, score, sockets:Set, joinedAt }
    settings: { categories: Object.keys(CATEGORIES), showTrait: true },
    phase: 'lobby', // lobby | round | reveal
    roundNo: 0,
    round: null,
    recentTraits: [],
    log: [],
    touched: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

// Log entries are { type, key, vars } — the client turns them into text in the player's language.
function addLog(room, entry) {
  room.log.push({ id: Math.random().toString(36).slice(2), at: Date.now(), ...entry });
  if (room.log.length > 120) room.log.splice(0, room.log.length - 120);
}

const pool = (room) => CHARACTERS.filter((c) => room.settings.categories.includes(c.cat));
const activePlayers = (room) => [...room.players.values()];

// Pick a trait that has enough characters for everyone (+ spares for skips).
function pickTrait(room, needed) {
  const chars = pool(room);
  const counts = {};
  for (const c of chars) for (const t of c.traits) counts[t] = (counts[t] || 0) + 1;
  const fresh = (t) => !room.recentTraits.includes(t);
  for (const spare of [3, 1, 0]) {
    const ok = Object.keys(TRAITS).filter((t) => (counts[t] || 0) >= needed + spare);
    const notRecent = ok.filter(fresh);
    if (notRecent.length) return notRecent[Math.floor(Math.random() * notRecent.length)];
    if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
  }
  return null;
}

function drawCharacter(room) {
  const r = room.round;
  const options = pool(room).filter((c) => c.traits.includes(r.trait) && !r.used.has(c.id));
  if (!options.length) return null;
  const pick = options[Math.floor(Math.random() * options.length)];
  r.used.add(pick.id);
  return pick;
}

function startRound(room) {
  const players = activePlayers(room);
  if (players.length < 2) return 'needPlayers';
  if (!room.settings.categories.length) return 'needCategory';
  const trait = pickTrait(room, players.length);
  if (!trait) return 'notEnoughChars';
  room.recentTraits = [trait, ...room.recentTraits].slice(0, 12);
  room.roundNo += 1;
  room.phase = 'round';
  room.round = { trait, used: new Set(), cards: new Map() };
  for (const p of shuffle(players)) dealTo(room, p.pid);
  addLog(room, { type: 'system', key: 'roundStarted', vars: { n: room.roundNo } });
  return null;
}

function dealTo(room, pid) {
  const c = drawCharacter(room);
  room.round.cards.set(pid, { charId: c ? c.id : null, state: 'playing', points: 0, lastGuess: null, guesses: 0, skips: 0 });
}

function solve(room, pid, acceptedBy) {
  const r = room.round;
  const card = r.cards.get(pid);
  const solvedBefore = [...r.cards.values()].filter((c) => c.state === 'solved').length;
  card.state = 'solved';
  card.points = Math.max(1, r.cards.size - solvedBefore);
  const p = room.players.get(pid);
  p.score += card.points;
  addLog(room, acceptedBy
    ? { type: 'good', key: 'accepted', vars: { name: p.name, guess: card.lastGuess, by: acceptedBy, char: charName(card.charId), points: card.points } }
    : { type: 'good', key: 'solved', vars: { name: p.name, char: charName(card.charId), points: card.points } });
  maybeFinish(room);
}

function maybeFinish(room) {
  const r = room.round;
  if ([...r.cards.values()].every((c) => c.state !== 'playing')) endRound(room);
}

function endRound(room) {
  if (room.phase !== 'round') return;
  room.phase = 'reveal';
  addLog(room, { type: 'system', key: 'roundOver', vars: { trait: TRAIT_LABELS[room.round.trait] } });
}

// What a given player is allowed to see.
function viewFor(room, pid) {
  const r = room.round;
  const revealAll = room.phase === 'reveal';
  const showTrait = r && (room.settings.showTrait || revealAll);
  return {
    code: room.code,
    you: pid,
    hostPid: room.hostPid,
    phase: room.phase,
    roundNo: room.roundNo,
    settings: room.settings,
    players: activePlayers(room)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ pid: p.pid, name: p.name, score: p.score, online: p.sockets.size > 0 })),
    round: r && {
      trait: showTrait ? TRAIT_LABELS[r.trait] : null,
      cards: [...r.cards.entries()].map(([cpid, card]) => {
        const mine = cpid === pid;
        const visible = !mine || card.state !== 'playing' || revealAll;
        return {
          pid: cpid,
          state: card.state,
          points: card.points,
          lastGuess: card.lastGuess,
          guesses: card.guesses,
          character: visible ? publicChar(BY_ID.get(card.charId)) || { missing: true } : null,
        };
      }),
    },
    log: room.log.slice(-60),
  };
}

function broadcast(room) {
  room.touched = Date.now();
  for (const p of room.players.values()) {
    for (const sid of p.sockets) io.to(sid).emit('state', viewFor(room, p.pid));
  }
}

// ───────────────────────── sockets ─────────────────────────

io.on('connection', (socket) => {
  let room = null;
  let pid = null;

  const fail = (key, vars) => socket.emit('toast', { kind: 'error', key, vars });
  const me = () => room && room.players.get(pid);
  const isHost = () => room && room.hostPid === pid;

  function attach(r, playerId, name) {
    room = r;
    pid = clean(playerId, 40) || Math.random().toString(36).slice(2);
    let p = room.players.get(pid);
    if (!p) {
      if (room.players.size >= 12) return fail('roomFull');
      p = { pid, name, score: 0, sockets: new Set(), joinedAt: Date.now() };
      room.players.set(pid, p);
      addLog(room, { type: 'system', key: 'joined', vars: { name } });
      if (room.phase === 'round') dealTo(room, pid); // late joiner gets a card too
    } else if (name) {
      p.name = name;
    }
    p.sockets.add(socket.id);
    socket.join(room.code);
    socket.emit('joined', { code: room.code, pid });
    broadcast(room);
  }

  socket.on('create', ({ name, pid: playerId } = {}) => {
    name = clean(name, 20);
    if (!name) return fail('enterName');
    const r = createRoom(clean(playerId, 40));
    attach(r, playerId, name);
    r.hostPid = pid;
  });

  socket.on('join', ({ code, name, pid: playerId } = {}) => {
    const r = rooms.get(clean(code, 4).toUpperCase());
    if (!r) return socket.emit('join_failed', { key: 'noGame', vars: { code: clean(code, 4).toUpperCase() } });
    name = clean(name, 20);
    if (!name && !r.players.has(playerId)) return fail('enterName');
    attach(r, playerId, name);
  });

  socket.on('settings', (s = {}) => {
    if (!isHost()) return;
    if (Array.isArray(s.categories)) room.settings.categories = s.categories.filter((c) => CATEGORIES[c]);
    if (typeof s.showTrait === 'boolean') room.settings.showTrait = s.showTrait;
    broadcast(room);
  });

  socket.on('start', () => {
    if (!isHost() || room.phase === 'round') return;
    const err = startRound(room);
    if (err) return fail(err);
    broadcast(room);
  });

  socket.on('end_round', () => {
    if (!isHost() || room.phase !== 'round') return;
    endRound(room);
    broadcast(room);
  });

  socket.on('back_to_lobby', () => {
    if (!isHost()) return;
    room.phase = 'lobby';
    room.round = null;
    broadcast(room);
  });

  socket.on('reset_scores', () => {
    if (!isHost()) return;
    for (const p of room.players.values()) p.score = 0;
    addLog(room, { type: 'system', key: 'scoresReset' });
    broadcast(room);
  });

  // Someone doesn't recognise another player's character → swap it for a new one with the same trait.
  socket.on('skip', ({ target } = {}) => {
    if (!room || room.phase !== 'round' || !me()) return;
    const card = room.round.cards.get(target);
    if (!card || target === pid || card.state !== 'playing') return;
    const next = drawCharacter(room);
    if (!next) return fail('noMoreChars');
    card.charId = next.id;
    card.lastGuess = null;
    card.skips += 1;
    addLog(room, { type: 'skip', key: 'skipped', vars: { name: me().name, target: room.players.get(target).name } });
    broadcast(room);
  });

  socket.on('guess', ({ text } = {}) => {
    if (!room || room.phase !== 'round' || !me()) return;
    const card = room.round.cards.get(pid);
    text = clean(text, 60);
    if (!card || card.state !== 'playing' || !text) return;
    card.guesses += 1;
    const ch = BY_ID.get(card.charId);
    if (ch && isCorrectGuess(text, ch)) {
      solve(room, pid);
    } else {
      card.lastGuess = text;
      addLog(room, { type: 'miss', key: 'missed', vars: { name: me().name, guess: text } });
    }
    broadcast(room);
  });

  // Close-enough button: another player accepts someone's last guess.
  socket.on('accept', ({ target } = {}) => {
    if (!room || room.phase !== 'round' || !me() || target === pid) return;
    const card = room.round.cards.get(target);
    if (!card || card.state !== 'playing' || !card.lastGuess) return;
    solve(room, target, me().name);
    broadcast(room);
  });

  socket.on('give_up', () => {
    if (!room || room.phase !== 'round' || !me()) return;
    const card = room.round.cards.get(pid);
    if (!card || card.state !== 'playing') return;
    card.state = 'gaveup';
    addLog(room, { type: 'miss', key: 'gaveUp', vars: { name: me().name, char: charName(card.charId) } });
    maybeFinish(room);
    broadcast(room);
  });

  socket.on('chat', ({ text } = {}) => {
    if (!room || !me()) return;
    text = clean(text, 200);
    if (!text) return;
    addLog(room, { type: 'chat', who: me().name, text });
    broadcast(room);
  });

  socket.on('kick', ({ target } = {}) => {
    if (!isHost() || target === pid) return;
    const p = room.players.get(target);
    if (!p) return;
    for (const sid of p.sockets) io.to(sid).emit('kicked');
    room.players.delete(target);
    if (room.round) room.round.cards.delete(target);
    addLog(room, { type: 'system', key: 'removed', vars: { name: p.name } });
    if (room.phase === 'round') maybeFinish(room);
    broadcast(room);
  });

  socket.on('leave', () => {
    if (!room || !me()) return;
    const p = me();
    room.players.delete(pid);
    if (room.round) room.round.cards.delete(pid);
    addLog(room, { type: 'system', key: 'left', vars: { name: p.name } });
    if (room.hostPid === pid) {
      const next = activePlayers(room).find((x) => x.sockets.size) || activePlayers(room)[0];
      if (next) room.hostPid = next.pid;
    }
    if (room.phase === 'round' && room.round.cards.size) maybeFinish(room);
    socket.leave(room.code);
    const r = room;
    room = null;
    if (!r.players.size) rooms.delete(r.code);
    else broadcast(r);
  });

  socket.on('disconnect', () => {
    const p = me();
    if (!p) return;
    p.sockets.delete(socket.id);
    // If the host is gone for a while, hand host to someone who's still here.
    if (room.hostPid === pid && !p.sockets.size) {
      const r = room;
      setTimeout(() => {
        const host = r.players.get(r.hostPid);
        if (host && host.sockets.size) return;
        const next = activePlayers(r).find((x) => x.sockets.size);
        if (next) { r.hostPid = next.pid; addLog(r, { type: 'system', key: 'newHost', vars: { name: next.name } }); broadcast(r); }
      }, 30000);
    }
    broadcast(room);
  });
});

// Drop rooms nobody has touched for 6 hours.
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600 * 1000;
  for (const [code, r] of rooms) if (r.touched < cutoff) rooms.delete(code);
}, 15 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`\n  Same Difference is running:`);
  console.log(`    this computer:  http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`    same Wi-Fi:     ${u}`);
  console.log('');
  images.resolveAll(CHARACTERS).catch((e) => console.warn('[images]', e.message));
});
