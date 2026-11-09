/* Same Difference — client */
(() => {
  const socket = io();
  const app = document.getElementById('app');

  // ── persistent identity (survives refresh / phone sleep) ──
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  let pid = LS.get('sd.pid');
  if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); LS.set('sd.pid', pid); }

  let state = null;
  let meta = null;
  let screen = null;
  let lastLogId = null;
  const params = new URLSearchParams(location.search);

  fetch('/api/meta').then((r) => r.json()).then((m) => { meta = m; render(true); });

  // ── helpers ──
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#6b3df5', '#ff7a59', '#1f9d6b', '#e0447c', '#2f80ed', '#d98a00', '#8e44ad', '#16a2b8', '#c0392b', '#5b6b8a', '#27ae60', '#f06292'];
  const colorFor = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = (name) => String(name).split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const avatar = (p) => `<span class="avatar" style="background:${colorFor(p.pid)}">${esc(initials(p.name))}</span>`;
  const playerName = (id) => (state.players.find((p) => p.pid === id) || { name: '?' }).name;
  const isHost = () => state && state.hostPid === state.you;

  function picture(ch) {
    const ph = `<div class="ph" style="background:${colorFor(ch.name)}">${esc(initials(ch.name))}</div>`;
    if (!ch.img) return ph;
    return `<img src="${esc(ch.img)}" alt="${esc(ch.name)}" loading="lazy" referrerpolicy="no-referrer" data-ph="${esc(initials(ch.name))}" data-color="${colorFor(ch.name)}">`;
  }
  // Broken image → coloured initials
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.ph) {
      const d = document.createElement('div');
      d.className = 'ph'; d.style.background = img.dataset.color; d.textContent = img.dataset.ph;
      img.replaceWith(d);
    }
  }, true);

  function toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function joinUrl(code) { return `${location.origin}/?room=${code}`; }

  // ── socket events ──
  socket.on('connect', () => {
    const code = LS.get('sd.room');
    const name = LS.get('sd.name');
    if (code && name) socket.emit('join', { code, name, pid });
  });
  socket.on('joined', ({ code }) => {
    LS.set('sd.room', code);
    history.replaceState(null, '', `/?room=${code}`);
  });
  socket.on('join_failed', ({ text }) => {
    LS.set('sd.room', null);
    state = null;
    render(true);
    toast(text, 'error');
  });
  socket.on('state', (s) => { state = s; render(); });
  socket.on('toast', ({ text, kind }) => toast(text, kind));
  socket.on('kicked', () => { LS.set('sd.room', null); state = null; history.replaceState(null, '', '/'); render(true); toast('You were removed from the game.', 'error'); });
  socket.on('disconnect', () => toast('Connection lost — reconnecting…'));

  // ── render dispatcher ──
  function render(force) {
    const want = !state ? 'home' : state.phase === 'lobby' ? 'lobby' : 'game';
    if (want !== screen || force) {
      screen = want;
      lastLogId = null;
      lastCardsKey = null;
      ({ home: mountHome, lobby: mountLobby, game: mountGame })[want]();
    }
    if (state) ({ lobby: updateLobby, game: updateGame })[screen]?.();
  }

  // ───────────────── HOME ─────────────────
  function mountHome() {
    const savedName = LS.get('sd.name') || '';
    const code = (params.get('room') || '').toUpperCase();
    app.innerHTML = `
      <section class="home">
        <div class="logo">
          <div class="mark">🎭</div>
          <h1>Same Difference</h1>
          <p>Everyone can see your character — except you.</p>
        </div>
        <div class="panel stack">
          <label class="muted" for="name">Your name</label>
          <input id="name" type="text" maxlength="20" autocomplete="nickname" placeholder="e.g. Luis" value="${esc(savedName)}">
          ${code ? `
            <button class="btn big block" id="joinBtn">Join game ${esc(code)}</button>
            <button class="linkish" id="notThis">Start a different game instead</button>
          ` : `
            <button class="btn big block" id="createBtn">✨ Create a game</button>
            <div class="divider">or join one</div>
            <div class="row">
              <input id="code" class="code-input" type="text" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off">
              <button class="btn" id="joinBtn">Join</button>
            </div>
          `}
        </div>
        <details class="how panel">
          <summary>How to play</summary>
          <ol>
            <li>Everyone joins on their own phone — same room or over a video call.</li>
            <li>Each round, every player is dealt a character from movies, TV, anime, games or cartoons. <b>You see everyone's character but your own.</b></li>
            <li>All characters in a round share something — a look, a trait, or something they're known for. Use it as a hint!</li>
            <li>Take turns asking yes/no questions or giving clues, then type your guess. Faster guesses score more.</li>
            <li>Don't recognise someone's character? Hit <b>Skip</b> and they get a new one.</li>
          </ol>
        </details>
        ${meta ? `<p class="muted" style="text-align:center;font-size:.85rem">${meta.characterCount} characters · ${meta.traitCount} themes · <a href="/gallery.html" class="muted">browse them</a></p>` : ''}
      </section>`;

    const nameEl = document.getElementById('name');
    const getName = () => { const n = nameEl.value.trim(); if (!n) { nameEl.focus(); toast('Enter your name first.', 'error'); return null; } LS.set('sd.name', n); return n; };
    document.getElementById('createBtn')?.addEventListener('click', () => { const n = getName(); if (n) socket.emit('create', { name: n, pid }); });
    document.getElementById('joinBtn')?.addEventListener('click', () => {
      const n = getName(); if (!n) return;
      const c = code || document.getElementById('code').value.trim().toUpperCase();
      if (c.length !== 4) return toast('Room codes are 4 letters.', 'error');
      socket.emit('join', { code: c, name: n, pid });
    });
    document.getElementById('notThis')?.addEventListener('click', () => { params.delete('room'); history.replaceState(null, '', '/'); mountHome(); });
    document.getElementById('code')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('joinBtn').click(); });
    nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') (document.getElementById('createBtn') || document.getElementById('joinBtn')).click(); });
  }

  // ───────────────── LOBBY ─────────────────
  function mountLobby() {
    const url = joinUrl(state.code);
    const lan = meta && location.hostname === 'localhost' && meta.lanUrls[0] ? `${meta.lanUrls[0]}/?room=${state.code}` : null;
    const qrTarget = lan || url;
    app.innerHTML = `
      <div class="topbar">
        <h2 class="display">🎭 Same Difference</h2>
        <span class="spacer"></span>
        <button class="btn ghost small" id="leaveBtn">Leave</button>
      </div>
      <div class="lobby-grid">
        <section class="panel stack">
          <div class="muted" style="text-align:center;font-weight:800">GAME CODE</div>
          <div class="bigcode">${esc(state.code)}</div>
          <div class="share">
            <img src="/api/qr?u=${encodeURIComponent(qrTarget)}" alt="QR code to join">
            <div class="links">
              <div class="muted">Scan, or open:</div>
              <div><b>${esc(qrTarget)}</b></div>
              ${lan ? `<div class="muted" style="margin-top:6px;font-size:.8rem">Phones must be on the same Wi-Fi as this computer. For remote friends, deploy online (see README).</div>` : ''}
              <button class="btn ghost small" id="copyBtn" style="margin-top:8px">Copy link</button>
            </div>
          </div>
        </section>
        <section class="panel stack">
          <div class="row"><h3>Players</h3><span class="muted" id="pcount"></span></div>
          <ul class="players" id="lobbyPlayers"></ul>
        </section>
        <section class="panel stack" style="grid-column: 1 / -1">
          <h3>Characters from</h3>
          <div class="chips" id="cats"></div>
          <label class="toggle"><input type="checkbox" id="showTrait"> Show the round's shared trait as a hint</label>
          <div id="startArea"></div>
        </section>
      </div>`;
    document.getElementById('leaveBtn').onclick = leave;
    document.getElementById('copyBtn').onclick = () => navigator.clipboard?.writeText(qrTarget).then(() => toast('Link copied!'));
    document.getElementById('showTrait').onchange = (e) => socket.emit('settings', { showTrait: e.target.checked });
  }

  function updateLobby() {
    const host = isHost();
    document.getElementById('pcount').textContent = `${state.players.length}/12`;
    document.getElementById('lobbyPlayers').innerHTML = state.players.map((p) => `
      <li>${avatar(p)}<b>${esc(p.name)}</b>
        ${p.pid === state.hostPid ? '<span class="tag">host</span>' : ''}
        ${p.pid === state.you ? '<span class="tag">you</span>' : ''}
        <span class="spacer"></span><span class="dot ${p.online ? '' : 'off'}" title="${p.online ? 'online' : 'offline'}"></span>
        ${host && p.pid !== state.you ? `<button class="linkish" data-kick="${esc(p.pid)}">remove</button>` : ''}
      </li>`).join('');
    document.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = () => socket.emit('kick', { target: b.dataset.kick }); });

    const cats = meta ? meta.categories : [];
    document.getElementById('cats').innerHTML = cats.map((c) => {
      const on = state.settings.categories.includes(c.id);
      return `<label class="chip ${on ? 'on' : ''} ${host ? '' : 'disabled'}"><input type="checkbox" data-cat="${c.id}" ${on ? 'checked' : ''} ${host ? '' : 'disabled'}>${esc(c.label)} <small>${c.count}</small></label>`;
    }).join('');
    document.querySelectorAll('[data-cat]').forEach((cb) => {
      cb.onchange = () => {
        const chosen = [...document.querySelectorAll('[data-cat]')].filter((x) => x.checked).map((x) => x.dataset.cat);
        socket.emit('settings', { categories: chosen });
      };
    });
    const st = document.getElementById('showTrait');
    st.checked = state.settings.showTrait;
    st.disabled = !host;

    const enough = state.players.length >= 2;
    document.getElementById('startArea').innerHTML = host
      ? `<button class="btn big accent block" id="startBtn" ${enough ? '' : 'disabled'}>${enough ? '🎬 Start round' : 'Waiting for at least 2 players…'}</button>`
      : `<p class="muted" style="text-align:center">Waiting for <b>${esc(playerName(state.hostPid))}</b> to start…</p>`;
    document.getElementById('startBtn')?.addEventListener('click', () => socket.emit('start'));
  }

  function leave() {
    if (!confirm('Leave this game?')) return;
    socket.emit('leave');
    LS.set('sd.room', null);
    state = null;
    history.replaceState(null, '', '/');
    params.delete('room');
    render(true);
  }

  // ───────────────── GAME (round + reveal) ─────────────────
  function mountGame() {
    app.innerHTML = `
      <div class="topbar">
        <h2 class="display">🎭 <span id="roundLabel"></span></h2>
        <span class="roomcode">${esc(state.code)}</span>
        <span class="spacer"></span>
        <button class="btn ghost small" id="leaveBtn">Leave</button>
      </div>
      <div id="traitBanner"></div>
      <div class="game-grid">
        <div>
          <section class="panel you" id="youPanel">
            <div id="youPic"></div>
            <div>
              <h2 id="youTitle"></h2>
              <div class="muted" id="youSub"></div>
              <form class="guess-form" id="guessForm" autocomplete="off">
                <input type="text" id="guessInput" maxlength="60" placeholder="Who are you?" enterkeyhint="send">
                <button class="btn" type="submit">Guess</button>
              </form>
              <div class="row wrap" style="margin-top:8px" id="youActions">
                <button class="linkish" id="giveUpBtn">I give up — show me</button>
              </div>
            </div>
          </section>
          <div class="section-title"><h3 id="othersTitle">Everyone else</h3><span class="muted" id="othersHint"></span></div>
          <div class="cards" id="cards"></div>
          <div class="hostbar" id="hostbar"></div>
        </div>
        <aside class="side">
          <section class="panel">
            <h3 style="margin-bottom:10px">Scores</h3>
            <ul class="scores" id="scores"></ul>
          </section>
          <section class="panel">
            <h3 style="margin-bottom:10px">Table talk</h3>
            <div class="log" id="log"></div>
            <form class="chat-form" id="chatForm" autocomplete="off">
              <input type="text" id="chatInput" maxlength="200" placeholder="Ask a question / give a clue" enterkeyhint="send">
              <button class="btn small" type="submit">Send</button>
            </form>
          </section>
        </aside>
      </div>`;
    document.getElementById('leaveBtn').onclick = leave;
    document.getElementById('guessForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById('guessInput');
      if (inp.value.trim()) socket.emit('guess', { text: inp.value });
      inp.value = '';
    };
    document.getElementById('giveUpBtn').onclick = () => { if (confirm('Give up and reveal your character? You get 0 points this round.')) socket.emit('give_up'); };
    document.getElementById('chatForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById('chatInput');
      if (inp.value.trim()) socket.emit('chat', { text: inp.value });
      inp.value = '';
    };
  }

  let prevMyState = null;
  let lastCardsKey = null;
  function updateGame() {
    const r = state.round;
    const reveal = state.phase === 'reveal';
    document.getElementById('roundLabel').textContent = reveal ? `Round ${state.roundNo} — results` : `Round ${state.roundNo}`;

    // Trait banner
    const tb = document.getElementById('traitBanner');
    tb.innerHTML = r.trait
      ? `<div class="trait-banner"><div class="label">${reveal ? 'This round’s link was' : 'Everyone this round…'}</div><div class="trait">${esc(r.trait)}</div></div>`
      : `<div class="trait-banner hidden-trait"><div class="label">Secret link</div><div class="trait">All characters share something… what is it?</div></div>`;

    // My card
    const mine = r.cards.find((c) => c.pid === state.you);
    const youPic = document.getElementById('youPic');
    const playing = mine && mine.state === 'playing' && !reveal;
    if (!mine) {
      youPic.innerHTML = '<div class="mystery">…</div>';
      document.getElementById('youTitle').textContent = 'You’ll be dealt in next round';
      document.getElementById('youSub').textContent = '';
    } else if (playing) {
      youPic.innerHTML = '<div class="mystery">?</div>';
      document.getElementById('youTitle').textContent = 'Who are you?';
      document.getElementById('youSub').textContent = mine.guesses ? `${mine.guesses} guess${mine.guesses > 1 ? 'es' : ''} so far${mine.lastGuess ? ` — last: “${mine.lastGuess}”` : ''}` : 'Ask the table questions, then guess.';
    } else {
      const flip = prevMyState === 'playing';
      youPic.innerHTML = `<div class="yourpic ${flip ? 'reveal-pop' : ''}">${picture(mine.character)}</div>`;
      document.getElementById('youTitle').textContent = `You were ${mine.character.name}`;
      document.getElementById('youSub').textContent = `${mine.character.from} · ${mine.state === 'solved' ? `✅ +${mine.points} points` : mine.state === 'gaveup' ? '🏳️ gave up' : '⏱ time’s up'}`;
    }
    prevMyState = mine ? mine.state : null;
    document.getElementById('guessForm').classList.toggle('hidden', !playing);
    document.getElementById('youActions').classList.toggle('hidden', !playing);

    // Other cards
    const others = r.cards.filter((c) => c.pid !== state.you);
    document.getElementById('othersHint').textContent = reveal ? '' : 'Tap Skip if you don’t know a character';
    // Only rebuild the card grid when something on it changed (avoids image flicker on chat messages).
    const cardsKey = JSON.stringify([reveal, others, state.players.map((p) => p.name)]);
    if (cardsKey !== lastCardsKey) {
      lastCardsKey = cardsKey;
      document.getElementById('cards').innerHTML = others.map((c) => cardHtml(c, reveal)).join('') || '<p class="muted">Nobody else yet.</p>';
      document.querySelectorAll('[data-skip]').forEach((b) => { b.onclick = () => socket.emit('skip', { target: b.dataset.skip }); });
      document.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = () => socket.emit('accept', { target: b.dataset.accept }); });
    }

    // Host controls
    const hb = document.getElementById('hostbar');
    if (isHost()) {
      hb.innerHTML = reveal
        ? `<button class="btn big accent" id="nextBtn">▶ Next round</button><button class="btn ghost" id="lobbyBtn">⚙ Change settings</button><button class="btn ghost" id="resetBtn">Reset scores</button>`
        : `<button class="btn ghost" id="endBtn">End round & reveal all</button>`;
      document.getElementById('nextBtn')?.addEventListener('click', () => socket.emit('start'));
      document.getElementById('lobbyBtn')?.addEventListener('click', () => socket.emit('back_to_lobby'));
      document.getElementById('resetBtn')?.addEventListener('click', () => { if (confirm('Reset everyone’s score to 0?')) socket.emit('reset_scores'); });
      document.getElementById('endBtn')?.addEventListener('click', () => { if (confirm('End the round and reveal every character?')) socket.emit('end_round'); });
    } else {
      hb.innerHTML = reveal ? `<p class="muted">Waiting for <b>${esc(playerName(state.hostPid))}</b> to start the next round…</p>` : '';
    }

    // Scores
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    document.getElementById('scores').innerHTML = sorted.map((p, i) => `
      <li>${i === 0 && p.score > 0 ? '👑' : ''}${avatar(p)}<span>${esc(p.name)}${p.pid === state.you ? ' <span class="tag">you</span>' : ''}</span>
      <span class="dot ${p.online ? '' : 'off'}"></span><span class="pts">${p.score}</span></li>`).join('');

    // Log (append-only so scroll position is kept)
    const logEl = document.getElementById('log');
    const atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;
    const last = state.log[state.log.length - 1];
    if (!last || last.id !== lastLogId) {
      logEl.innerHTML = state.log.map((e) => e.type === 'chat'
        ? `<div class="entry"><b>${esc(e.who)}:</b> ${esc(e.text)}</div>`
        : `<div class="entry ${e.type}">${esc(e.text)}</div>`).join('');
      if (atBottom || lastLogId === null) logEl.scrollTop = logEl.scrollHeight;
      lastLogId = last && last.id;
    }
  }

  function cardHtml(c, reveal) {
    const p = state.players.find((x) => x.pid === c.pid) || { pid: c.pid, name: '?' };
    const ch = c.character || { name: '???', from: '' };
    const badge = c.state === 'solved' ? `<span class="badge solved">✅ +${c.points}</span>` : c.state === 'gaveup' ? '<span class="badge gaveup">gave up</span>' : '';
    let actions = '';
    if (!reveal && c.state === 'playing') {
      actions = `
        ${c.lastGuess ? `<div class="lastguess">Guessed <q>${esc(c.lastGuess)}</q><button class="btn good small" data-accept="${esc(c.pid)}" title="Count this guess as correct">Close enough ✓</button></div>` : ''}
        <button class="btn ghost small" data-skip="${esc(c.pid)}">🤷 Don't know — skip</button>`;
    }
    return `
      <article class="card ${c.state}">
        <div class="owner">${avatar(p)}<span>${esc(p.name)} <span class="is">is…</span></span></div>
        <div class="pic">${picture(ch)}${badge}</div>
        <div class="meta"><div class="name">${esc(ch.name)}</div><div class="from">${esc(ch.from)}${ch.catLabel ? ` · ${esc(ch.catLabel)}` : ''}</div></div>
        <div class="actions">${actions}</div>
      </article>`;
  }

  render(true);
})();
