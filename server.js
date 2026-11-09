const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const { CHARACTERS, TRAITS, CATEGORIES, BY_ID } = require('./data/characters');
const images = require('./lib/images');
const { isCorrectGuess } = require('./lib/match');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (_req, res) => {
  res.json({
    categories: Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, count: CHARACTERS.filter((c) => c.cat === id).length })),
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
  res.json(CHARACTERS.map((c) => ({ ...publicChar(c), traits: c.traits.map((t) => TRAITS[t]) })));
});

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  }
  return out;
}

const publicChar = (c) => c && ({ id: c.id, name: c.name, from: c.from, cat: c.cat, catLabel: CATEGORIES[c.cat], img: images.imageFor(c) });

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
  if (players.length < 2) return 'Need at least 2 players.';
  if (!room.settings.categories.length) return 'Pick at least one category.';
  const trait = pickTrait(room, players.length);
  if (!trait) return 'Not enough characters in the selected categories for this many players. Turn on more categories.';
  room.recentTraits = [trait, ...room.recentTraits].slice(0, 12);
  room.roundNo += 1;
  room.phase = 'round';
  room.round = { trait, used: new Set(), cards: new Map() };
  for (const p of shuffle(players)) dealTo(room, p.pid);
  addLog(room, { type: 'system', text: `Round ${room.roundNo} started. Everyone's character has something in common…` });
  return null;
}

function dealTo(room, pid) {
  const c = drawCharacter(room);
  room.round.cards.set(pid, { charId: c ? c.id : null, state: 'playing', points: 0, lastGuess: null, guesses: 0, skips: 0 });
}

function solve(room, pid, how) {
  const r = room.round;
  const card = r.cards.get(pid);
  const solvedBefore = [...r.cards.values()].filter((c) => c.state === 'solved').length;
  card.state = 'solved';
  card.points = Math.max(1, r.cards.size - solvedBefore);
  const p = room.players.get(pid);
  p.score += card.points;
  const ch = BY_ID.get(card.charId);
  addLog(room, { type: 'good', text: `${p.name} ${how} — they're ${ch ? ch.name : '???'}! +${card.points}` });
  maybeFinish(room);
}

function maybeFinish(room) {
  const r = room.round;
  if ([...r.cards.values()].every((c) => c.state !== 'playing')) endRound(room);
}

function endRound(room) {
  if (room.phase !== 'round') return;
  room.phase = 'reveal';
  addLog(room, { type: 'system', text: `Round over! The link was: ${TRAITS[room.round.trait]}.` });
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
      trait: showTrait ? TRAITS[r.trait] : null,
      cards: [...r.cards.entries()].map(([cpid, card]) => {
        const mine = cpid === pid;
        const visible = !mine || card.state !== 'playing' || revealAll;
        return {
          pid: cpid,
          state: card.state,
          points: card.points,
          lastGuess: card.lastGuess,
          guesses: card.guesses,
          character: visible ? publicChar(BY_ID.get(card.charId)) || { name: '(ran out of characters)', from: '' } : null,
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

  const fail = (msg) => socket.emit('toast', { kind: 'error', text: msg });
  const me = () => room && room.players.get(pid);
  const isHost = () => room && room.hostPid === pid;

  function attach(r, playerId, name) {
    room = r;
    pid = clean(playerId, 40) || Math.random().toString(36).slice(2);
    let p = room.players.get(pid);
    if (!p) {
      if (room.players.size >= 12) return fail('Room is full (12 players max).');
      p = { pid, name, score: 0, sockets: new Set(), joinedAt: Date.now() };
      room.players.set(pid, p);
      addLog(room, { type: 'system', text: `${name} joined.` });
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
    if (!name) return fail('Enter your name first.');
    const r = createRoom(clean(playerId, 40));
    attach(r, playerId, name);
    r.hostPid = pid;
  });

  socket.on('join', ({ code, name, pid: playerId } = {}) => {
    const r = rooms.get(clean(code, 4).toUpperCase());
    if (!r) return socket.emit('join_failed', { text: `No game with code "${clean(code, 4).toUpperCase()}".` });
    name = clean(name, 20);
    if (!name && !r.players.has(playerId)) return fail('Enter your name first.');
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
    addLog(room, { type: 'system', text: 'Scores reset.' });
    broadcast(room);
  });

  // Someone doesn't recognise another player's character → swap it for a new one with the same trait.
  socket.on('skip', ({ target } = {}) => {
    if (!room || room.phase !== 'round' || !me()) return;
    const card = room.round.cards.get(target);
    if (!card || target === pid || card.state !== 'playing') return;
    const next = drawCharacter(room);
    if (!next) return fail('No more characters left for this round’s theme — try guessing anyway!');
    card.charId = next.id;
    card.lastGuess = null;
    card.skips += 1;
    addLog(room, { type: 'skip', text: `${me().name} didn't know ${room.players.get(target).name}'s character — swapped in a new one.` });
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
      solve(room, pid, 'guessed it');
    } else {
      card.lastGuess = text;
      addLog(room, { type: 'miss', text: `${me().name} guessed "${text}" — nope.` });
    }
    broadcast(room);
  });

  // Close-enough button: another player accepts someone's last guess.
  socket.on('accept', ({ target } = {}) => {
    if (!room || room.phase !== 'round' || !me() || target === pid) return;
    const card = room.round.cards.get(target);
    if (!card || card.state !== 'playing' || !card.lastGuess) return;
    solve(room, target, `got it ("${card.lastGuess}", accepted by ${me().name})`);
    broadcast(room);
  });

  socket.on('give_up', () => {
    if (!room || room.phase !== 'round' || !me()) return;
    const card = room.round.cards.get(pid);
    if (!card || card.state !== 'playing') return;
    card.state = 'gaveup';
    const ch = BY_ID.get(card.charId);
    addLog(room, { type: 'miss', text: `${me().name} gave up. They were ${ch ? ch.name : '???'}.` });
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
    addLog(room, { type: 'system', text: `${p.name} was removed.` });
    if (room.phase === 'round') maybeFinish(room);
    broadcast(room);
  });

  socket.on('leave', () => {
    if (!room || !me()) return;
    const p = me();
    room.players.delete(pid);
    if (room.round) room.round.cards.delete(pid);
    addLog(room, { type: 'system', text: `${p.name} left.` });
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
        if (next) { r.hostPid = next.pid; addLog(r, { type: 'system', text: `${next.name} is now the host.` }); broadcast(r); }
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
