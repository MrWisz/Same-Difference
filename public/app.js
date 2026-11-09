/* Same Difference — client */
(() => {
  const { t, tH, L } = window.i18n;
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
  let lastLogKey = null;
  let lastCardsKey = null;
  let prevMyState = null;
  const params = new URLSearchParams(location.search);

  fetch('/api/meta').then((r) => r.json()).then((m) => { meta = m; render(true); });

  // Switching language re-draws the current screen (unsent text in inputs is kept).
  window.i18n.onChange(() => {
    const keep = ['name', 'code', 'guessInput', 'chatInput'].map((id) => [id, document.getElementById(id)?.value]);
    render(true);
    for (const [id, v] of keep) { const el = document.getElementById(id); if (el && v) el.value = v; }
  });

  // ── helpers ──
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#6b3df5', '#ff7a59', '#1f9d6b', '#e0447c', '#2f80ed', '#d98a00', '#8e44ad', '#16a2b8', '#c0392b', '#5b6b8a', '#27ae60', '#f06292'];
  const colorFor = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initials = (name) => String(name).split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const avatar = (p) => `<span class="avatar" style="background:${colorFor(p.pid)}">${esc(initials(p.name))}</span>`;
  const playerName = (id) => (state.players.find((p) => p.pid === id) || { name: '?' }).name;
  const isHost = () => state && state.hostPid === state.you;
  const charName = (ch) => (ch && !ch.missing ? L(ch.name) : t('game.ranOut'));
  const langPicker = () => window.i18n.picker();
  const bindLangPicker = () => {
    const sel = document.getElementById('langPick');
    if (sel) sel.onchange = () => window.i18n.setLang(sel.value);
  };

  function picture(ch) {
    const name = charName(ch);
    const key = ch && ch.name ? L(ch.name) : '?';
    const ph = `<div class="ph" style="background:${colorFor(key)}">${esc(initials(name))}</div>`;
    if (!ch || !ch.img) return ph;
    return `<img src="${esc(ch.img)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer" data-ph="${esc(initials(name))}" data-color="${colorFor(key)}">`;
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
  socket.on('join_failed', ({ key, vars }) => {
    LS.set('sd.room', null);
    state = null;
    render(true);
    toast(t(`err.${key}`, vars), 'error');
  });
  socket.on('state', (s) => { state = s; render(); });
  socket.on('toast', ({ key, vars, kind }) => toast(t(`err.${key}`, vars), kind));
  socket.on('kicked', () => { LS.set('sd.room', null); state = null; history.replaceState(null, '', '/'); render(true); toast(t('toast.kicked'), 'error'); });
  socket.on('disconnect', () => toast(t('toast.reconnecting')));

  // ── render dispatcher ──
  function render(force) {
    const want = !state ? 'home' : state.phase === 'lobby' ? 'lobby' : 'game';
    if (want !== screen || force) {
      screen = want;
      lastLogKey = null;
      lastCardsKey = null;
      ({ home: mountHome, lobby: mountLobby, game: mountGame })[want]();
      bindLangPicker();
    }
    if (state) ({ lobby: updateLobby, game: updateGame })[screen]?.();
  }

  // ───────────────── HOME ─────────────────
  function mountHome() {
    document.title = t('app.title');
    const savedName = LS.get('sd.name') || '';
    const code = (params.get('room') || '').toUpperCase();
    app.innerHTML = `
      <section class="home">
        <div class="row" style="justify-content:flex-end">${langPicker()}</div>
        <div class="logo">
          <div class="mark">🎭</div>
          <h1>${t('app.title')}</h1>
          <p>${t('app.tagline')}</p>
        </div>
        <div class="panel stack">
          <label class="muted" for="name">${t('home.name')}</label>
          <input id="name" type="text" maxlength="20" autocomplete="nickname" placeholder="${esc(t('home.namePlaceholder'))}" value="${esc(savedName)}">
          ${code ? `
            <button class="btn big block" id="joinBtn">${tH('home.joinCode', { code })}</button>
            <button class="linkish" id="notThis">${t('home.different')}</button>
          ` : `
            <button class="btn big block" id="createBtn">${t('home.create')}</button>
            <div class="divider">${t('home.or')}</div>
            <div class="row">
              <input id="code" class="code-input" type="text" maxlength="4" placeholder="${esc(t('home.codePlaceholder'))}" autocapitalize="characters" autocomplete="off">
              <button class="btn" id="joinBtn">${t('home.join')}</button>
            </div>
          `}
        </div>
        <details class="how panel">
          <summary>${t('how.title')}</summary>
          <ol>${[1, 2, 3, 4, 5].map((i) => `<li>${t(`how.${i}`)}</li>`).join('')}</ol>
        </details>
        ${meta ? `<p class="muted" style="text-align:center;font-size:.85rem">${t('home.stats', { chars: meta.characterCount, traits: meta.traitCount, href: '/gallery.html' })}</p>` : ''}
      </section>`;

    const nameEl = document.getElementById('name');
    const getName = () => { const n = nameEl.value.trim(); if (!n) { nameEl.focus(); toast(t('err.enterName'), 'error'); return null; } LS.set('sd.name', n); return n; };
    document.getElementById('createBtn')?.addEventListener('click', () => { const n = getName(); if (n) socket.emit('create', { name: n, pid }); });
    document.getElementById('joinBtn')?.addEventListener('click', () => {
      const n = getName(); if (!n) return;
      const c = code || document.getElementById('code').value.trim().toUpperCase();
      if (c.length !== 4) return toast(t('home.codeLength'), 'error');
      socket.emit('join', { code: c, name: n, pid });
    });
    document.getElementById('notThis')?.addEventListener('click', () => { params.delete('room'); history.replaceState(null, '', '/'); render(true); });
    document.getElementById('code')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('joinBtn').click(); });
    nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') (document.getElementById('createBtn') || document.getElementById('joinBtn')).click(); });
  }

  // ───────────────── LOBBY ─────────────────
  function mountLobby() {
    document.title = `${state.code} · ${t('app.title')}`;
    const url = joinUrl(state.code);
    const lan = meta && location.hostname === 'localhost' && meta.lanUrls[0] ? `${meta.lanUrls[0]}/?room=${state.code}` : null;
    const qrTarget = lan || url;
    app.innerHTML = `
      <div class="topbar">
        <h2 class="display">🎭 ${t('app.title')}</h2>
        <span class="spacer"></span>
        ${langPicker()}
        <button class="btn ghost small" id="leaveBtn">${t('common.leave')}</button>
      </div>
      <div class="lobby-grid">
        <section class="panel stack">
          <div class="muted" style="text-align:center;font-weight:800">${t('lobby.code')}</div>
          <div class="bigcode">${esc(state.code)}</div>
          <div class="share">
            <img src="/api/qr?u=${encodeURIComponent(qrTarget)}" alt="${esc(t('lobby.qrAlt'))}">
            <div class="links">
              <div class="muted">${t('lobby.scan')}</div>
              <div><b>${esc(qrTarget)}</b></div>
              ${lan ? `<div class="muted" style="margin-top:6px;font-size:.8rem">${t('lobby.lanNote')}</div>` : ''}
              <button class="btn ghost small" id="copyBtn" style="margin-top:8px">${t('lobby.copy')}</button>
            </div>
          </div>
        </section>
        <section class="panel stack">
          <div class="row"><h3>${t('lobby.players')}</h3><span class="muted" id="pcount"></span></div>
          <ul class="players" id="lobbyPlayers"></ul>
        </section>
        <section class="panel stack" style="grid-column: 1 / -1">
          <h3>${t('lobby.charsFrom')}</h3>
          <div class="chips" id="cats"></div>
          <label class="toggle"><input type="checkbox" id="showTrait"> ${t('lobby.showTrait')}</label>
          <div id="startArea"></div>
        </section>
      </div>`;
    document.getElementById('leaveBtn').onclick = leave;
    document.getElementById('copyBtn').onclick = () => navigator.clipboard?.writeText(qrTarget).then(() => toast(t('lobby.copied')));
    document.getElementById('showTrait').onchange = (e) => socket.emit('settings', { showTrait: e.target.checked });
  }

  function updateLobby() {
    const host = isHost();
    document.getElementById('pcount').textContent = `${state.players.length}/12`;
    document.getElementById('lobbyPlayers').innerHTML = state.players.map((p) => `
      <li>${avatar(p)}<b>${esc(p.name)}</b>
        ${p.pid === state.hostPid ? `<span class="tag">${t('common.host')}</span>` : ''}
        ${p.pid === state.you ? `<span class="tag">${t('common.you')}</span>` : ''}
        <span class="spacer"></span><span class="dot ${p.online ? '' : 'off'}" title="${t(p.online ? 'common.online' : 'common.offline')}"></span>
        ${host && p.pid !== state.you ? `<button class="linkish" data-kick="${esc(p.pid)}">${t('common.remove')}</button>` : ''}
      </li>`).join('');
    document.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = () => socket.emit('kick', { target: b.dataset.kick }); });

    const cats = meta ? meta.categories : [];
    document.getElementById('cats').innerHTML = cats.map((c) => {
      const on = state.settings.categories.includes(c.id);
      return `<label class="chip ${on ? 'on' : ''} ${host ? '' : 'disabled'}"><input type="checkbox" data-cat="${c.id}" ${on ? 'checked' : ''} ${host ? '' : 'disabled'}>${esc(L(c.label))} <small>${c.count}</small></label>`;
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
      ? `<button class="btn big accent block" id="startBtn" ${enough ? '' : 'disabled'}>${t(enough ? 'lobby.start' : 'lobby.needMore')}</button>`
      : `<p class="muted" style="text-align:center">${tH('lobby.waitingHost', { name: playerName(state.hostPid) })}</p>`;
    document.getElementById('startBtn')?.addEventListener('click', () => socket.emit('start'));
  }

  function leave() {
    if (!confirm(t('confirm.leave'))) return;
    socket.emit('leave');
    LS.set('sd.room', null);
    state = null;
    history.replaceState(null, '', '/');
    params.delete('room');
    render(true);
  }

  // ───────────────── GAME (round + reveal) ─────────────────
  function mountGame() {
    document.title = `${state.code} · ${t('app.title')}`;
    app.innerHTML = `
      <div class="topbar">
        <h2 class="display">🎭 <span id="roundLabel"></span></h2>
        <span class="roomcode">${esc(state.code)}</span>
        <span class="spacer"></span>
        ${langPicker()}
        <button class="btn ghost small" id="leaveBtn">${t('common.leave')}</button>
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
                <input type="text" id="guessInput" maxlength="60" placeholder="${esc(t('game.guessPlaceholder'))}" enterkeyhint="send">
                <button class="btn" type="submit">${t('game.guess')}</button>
              </form>
              <div class="row wrap" style="margin-top:8px" id="youActions">
                <button class="linkish" id="giveUpBtn">${t('game.giveUp')}</button>
              </div>
            </div>
          </section>
          <div class="section-title"><h3>${t('game.others')}</h3><span class="muted" id="othersHint"></span></div>
          <div class="cards" id="cards"></div>
          <div class="hostbar" id="hostbar"></div>
        </div>
        <aside class="side">
          <section class="panel">
            <h3 style="margin-bottom:10px">${t('game.scores')}</h3>
            <ul class="scores" id="scores"></ul>
          </section>
          <section class="panel">
            <h3 style="margin-bottom:10px">${t('game.talk')}</h3>
            <div class="log" id="log"></div>
            <form class="chat-form" id="chatForm" autocomplete="off">
              <input type="text" id="chatInput" maxlength="200" placeholder="${esc(t('game.chatPlaceholder'))}" enterkeyhint="send">
              <button class="btn small" type="submit">${t('game.send')}</button>
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
    document.getElementById('giveUpBtn').onclick = () => { if (confirm(t('confirm.giveUp'))) socket.emit('give_up'); };
    document.getElementById('chatForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById('chatInput');
      if (inp.value.trim()) socket.emit('chat', { text: inp.value });
      inp.value = '';
    };
  }

  function updateGame() {
    const r = state.round;
    const reveal = state.phase === 'reveal';
    document.getElementById('roundLabel').textContent = t(reveal ? 'game.results' : 'game.round', { n: state.roundNo });

    // Trait banner
    const tb = document.getElementById('traitBanner');
    tb.innerHTML = r.trait
      ? `<div class="trait-banner"><div class="label">${t(reveal ? 'game.linkWas' : 'game.everyone')}</div><div class="trait">${esc(L(r.trait))}</div></div>`
      : `<div class="trait-banner hidden-trait"><div class="label">${t('game.secret')}</div><div class="trait">${t('game.secretText')}</div></div>`;

    // My card
    const mine = r.cards.find((c) => c.pid === state.you);
    const youPic = document.getElementById('youPic');
    const playing = mine && mine.state === 'playing' && !reveal;
    const title = document.getElementById('youTitle');
    const sub = document.getElementById('youSub');
    if (!mine) {
      youPic.innerHTML = '<div class="mystery">…</div>';
      title.textContent = t('game.nextRound');
      sub.textContent = '';
    } else if (playing) {
      youPic.innerHTML = '<div class="mystery">?</div>';
      title.textContent = t('game.whoAreYou');
      sub.textContent = mine.guesses
        ? t('game.guessCount', { n: mine.guesses }) + (mine.lastGuess ? ` — ${t('game.lastGuess', { guess: mine.lastGuess })}` : '')
        : t('game.askTable');
    } else {
      const flip = prevMyState === 'playing';
      youPic.innerHTML = `<div class="yourpic ${flip ? 'reveal-pop' : ''}">${picture(mine.character)}</div>`;
      title.textContent = t('game.youWere', { name: charName(mine.character) });
      const status = mine.state === 'solved' ? t('game.youPoints', { n: mine.points }) : t(mine.state === 'gaveup' ? 'game.youGaveUp' : 'game.timesUp');
      sub.textContent = `${L(mine.character.from)} · ${status}`;
    }
    prevMyState = mine ? mine.state : null;
    document.getElementById('guessForm').classList.toggle('hidden', !playing);
    document.getElementById('youActions').classList.toggle('hidden', !playing);

    // Other cards — only rebuilt when something on them changed (avoids image flicker on chat).
    const others = r.cards.filter((c) => c.pid !== state.you);
    document.getElementById('othersHint').textContent = reveal ? '' : t('game.skipHint');
    const cardsKey = JSON.stringify([reveal, others, state.players.map((p) => p.name)]);
    if (cardsKey !== lastCardsKey) {
      lastCardsKey = cardsKey;
      document.getElementById('cards').innerHTML = others.map((c) => cardHtml(c, reveal)).join('') || `<p class="muted">${t('game.nobody')}</p>`;
      document.querySelectorAll('[data-skip]').forEach((b) => { b.onclick = () => socket.emit('skip', { target: b.dataset.skip }); });
      document.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = () => socket.emit('accept', { target: b.dataset.accept }); });
    }

    // Host controls
    const hb = document.getElementById('hostbar');
    if (isHost()) {
      hb.innerHTML = reveal
        ? `<button class="btn big accent" id="nextBtn">${t('game.next')}</button><button class="btn ghost" id="lobbyBtn">${t('game.settings')}</button><button class="btn ghost" id="resetBtn">${t('game.resetScores')}</button>`
        : `<button class="btn ghost" id="endBtn">${t('game.endRound')}</button>`;
      document.getElementById('nextBtn')?.addEventListener('click', () => socket.emit('start'));
      document.getElementById('lobbyBtn')?.addEventListener('click', () => socket.emit('back_to_lobby'));
      document.getElementById('resetBtn')?.addEventListener('click', () => { if (confirm(t('confirm.reset'))) socket.emit('reset_scores'); });
      document.getElementById('endBtn')?.addEventListener('click', () => { if (confirm(t('confirm.end'))) socket.emit('end_round'); });
    } else {
      hb.innerHTML = reveal ? `<p class="muted">${tH('game.waitingNext', { name: playerName(state.hostPid) })}</p>` : '';
    }

    // Scores
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    document.getElementById('scores').innerHTML = sorted.map((p, i) => `
      <li>${i === 0 && p.score > 0 ? '👑' : ''}${avatar(p)}<span>${esc(p.name)}${p.pid === state.you ? ` <span class="tag">${t('common.you')}</span>` : ''}</span>
      <span class="dot ${p.online ? '' : 'off'}"></span><span class="pts">${p.score}</span></li>`).join('');

    // Log — rebuilt only when it changes, keeping scroll position.
    const logEl = document.getElementById('log');
    const atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;
    const last = state.log[state.log.length - 1];
    const logKey = last ? last.id : '';
    if (logKey !== lastLogKey) {
      logEl.innerHTML = state.log.map((e) => e.type === 'chat'
        ? `<div class="entry"><b>${esc(e.who)}:</b> ${esc(e.text)}</div>`
        : `<div class="entry ${e.type}">${esc(e.key ? t(`log.${e.key}`, e.vars) : e.text)}</div>`).join('');
      if (atBottom || lastLogKey === null) logEl.scrollTop = logEl.scrollHeight;
      lastLogKey = logKey;
    }
  }

  function cardHtml(c, reveal) {
    const p = state.players.find((x) => x.pid === c.pid) || { pid: c.pid, name: '?' };
    const ch = c.character || { missing: true };
    const badge = c.state === 'solved' ? `<span class="badge solved">✅ +${c.points}</span>` : c.state === 'gaveup' ? `<span class="badge gaveup">${t('game.gaveUpBadge')}</span>` : '';
    let actions = '';
    if (!reveal && c.state === 'playing') {
      actions = `
        ${c.lastGuess ? `<div class="lastguess">${t('game.guessed')} <q>${esc(c.lastGuess)}</q><button class="btn good small" data-accept="${esc(c.pid)}" title="${esc(t('game.closeEnoughTitle'))}">${t('game.closeEnough')}</button></div>` : ''}
        <button class="btn ghost small" data-skip="${esc(c.pid)}">${t('game.skip')}</button>`;
    }
    const from = ch.missing ? '' : `${esc(L(ch.from))}${ch.catLabel ? ` · ${esc(L(ch.catLabel))}` : ''}`;
    return `
      <article class="card ${c.state}">
        <div class="owner">${avatar(p)}<span>${esc(p.name)} <span class="is">${t('game.is')}</span></span></div>
        <div class="pic">${picture(ch)}${badge}</div>
        <div class="meta"><div class="name">${esc(charName(ch))}</div><div class="from">${from}</div></div>
        <div class="actions">${actions}</div>
      </article>`;
  }

  render(true);
})();
