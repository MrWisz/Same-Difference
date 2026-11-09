/* Same Difference — UI translations.
 *
 * To add a language: copy the `en` block, translate the values, add its code to
 * LANGS, and add the matching labels in data/characters.<lang>.js on the server.
 * {placeholders} are filled from the vars passed to t().
 */
(() => {
  const LANGS = { en: 'English', es: 'Español' };

  const STRINGS = {
    en: {
      'app.title': 'Same Difference',
      'app.tagline': 'Everyone can see your character — except you.',
      'lang.label': 'Language',

      'home.name': 'Your name',
      'home.namePlaceholder': 'e.g. Luis',
      'home.create': '✨ Create a game',
      'home.or': 'or join one',
      'home.codePlaceholder': 'CODE',
      'home.join': 'Join',
      'home.joinCode': 'Join game {code}',
      'home.different': 'Start a different game instead',
      'home.stats': '{chars} characters · {traits} themes · <a href="{href}" class="muted">browse them</a>',
      'home.codeLength': 'Room codes are 4 letters.',

      'how.title': 'How to play',
      'how.1': 'Everyone joins on their own phone — same room or over a video call.',
      'how.2': 'Each round, every player is dealt a character from movies, TV, anime, games or cartoons. <b>You see everyone\'s character but your own.</b>',
      'how.3': 'All characters in a round share something — a look, a trait, or something they\'re known for. Use it as a hint!',
      'how.4': 'Take turns asking yes/no questions or giving clues, then type your guess. Faster guesses score more.',
      'how.5': 'Don\'t recognise someone\'s character? Hit <b>Skip</b> and they get a new one.',

      'common.leave': 'Leave',
      'common.you': 'you',
      'common.host': 'host',
      'common.online': 'online',
      'common.offline': 'offline',
      'common.remove': 'remove',

      'lobby.code': 'GAME CODE',
      'lobby.qrAlt': 'QR code to join',
      'lobby.scan': 'Scan, or open:',
      'lobby.lanNote': 'Phones must be on the same Wi-Fi as this computer. For remote friends, deploy online (see README).',
      'lobby.copy': 'Copy link',
      'lobby.copied': 'Link copied!',
      'lobby.players': 'Players',
      'lobby.charsFrom': 'Characters from',
      'lobby.showTrait': 'Show the round\'s shared trait as a hint',
      'lobby.start': '🎬 Start round',
      'lobby.needMore': 'Waiting for at least 2 players…',
      'lobby.waitingHost': 'Waiting for <b>{name}</b> to start…',
      'confirm.leave': 'Leave this game?',

      'game.round': 'Round {n}',
      'game.results': 'Round {n} — results',
      'game.everyone': 'Everyone this round…',
      'game.linkWas': 'This round’s link was',
      'game.secret': 'Secret link',
      'game.secretText': 'All characters share something… what is it?',
      'game.whoAreYou': 'Who are you?',
      'game.guessPlaceholder': 'Who are you?',
      'game.guess': 'Guess',
      'game.giveUp': 'I give up — show me',
      'game.askTable': 'Ask the table questions, then guess.',
      'game.guessCount': '{n} guess(es) so far',
      'game.lastGuess': 'last: “{guess}”',
      'game.nextRound': 'You’ll be dealt in next round',
      'game.youWere': 'You were {name}',
      'game.youPoints': '✅ +{n} points',
      'game.youGaveUp': '🏳️ gave up',
      'game.timesUp': '⏱ time’s up',
      'game.others': 'Everyone else',
      'game.skipHint': 'Tap Skip if you don’t know a character',
      'game.nobody': 'Nobody else yet.',
      'game.is': 'is…',
      'game.guessed': 'Guessed',
      'game.closeEnough': 'Close enough ✓',
      'game.closeEnoughTitle': 'Count this guess as correct',
      'game.skip': '🤷 Don\'t know — skip',
      'game.gaveUpBadge': 'gave up',
      'game.ranOut': '(ran out of characters)',
      'game.next': '▶ Next round',
      'game.settings': '⚙ Change settings',
      'game.resetScores': 'Reset scores',
      'game.endRound': 'End round & reveal all',
      'game.waitingNext': 'Waiting for <b>{name}</b> to start the next round…',
      'game.scores': 'Scores',
      'game.talk': 'Table talk',
      'game.chatPlaceholder': 'Ask a question / give a clue',
      'game.send': 'Send',
      'confirm.giveUp': 'Give up and reveal your character? You get 0 points this round.',
      'confirm.reset': 'Reset everyone’s score to 0?',
      'confirm.end': 'End the round and reveal every character?',

      'toast.kicked': 'You were removed from the game.',
      'toast.reconnecting': 'Connection lost — reconnecting…',

      'err.enterName': 'Enter your name first.',
      'err.roomFull': 'Room is full (12 players max).',
      'err.noGame': 'No game with code "{code}".',
      'err.needPlayers': 'Need at least 2 players.',
      'err.needCategory': 'Pick at least one category.',
      'err.notEnoughChars': 'Not enough characters in the selected categories for this many players. Turn on more categories.',
      'err.noMoreChars': 'No more characters left for this round’s theme — try guessing anyway!',

      'log.joined': '{name} joined.',
      'log.roundStarted': 'Round {n} started. Everyone’s character has something in common…',
      'log.solved': '{name} guessed it — they’re {char}! +{points}',
      'log.accepted': '{name} got it ("{guess}", accepted by {by}) — they’re {char}! +{points}',
      'log.roundOver': 'Round over! The link was: {trait}.',
      'log.scoresReset': 'Scores reset.',
      'log.skipped': '{name} didn’t know {target}’s character — swapped in a new one.',
      'log.missed': '{name} guessed "{guess}" — nope.',
      'log.gaveUp': '{name} gave up. They were {char}.',
      'log.removed': '{name} was removed.',
      'log.left': '{name} left.',
      'log.newHost': '{name} is now the host.',

      'gallery.title': 'Character gallery',
      'gallery.back': 'Back to game',
      'gallery.search': 'Search name, show, or trait (e.g. “cape”, “Marvel”)',
      'gallery.all': 'All',
      'gallery.count': '{n} characters · {missing} without picture',
    },

    es: {
      'app.title': 'Same Difference',
      'app.tagline': 'Todos pueden ver tu personaje… menos tú.',
      'lang.label': 'Idioma',

      'home.name': 'Tu nombre',
      'home.namePlaceholder': 'p. ej. Luis',
      'home.create': '✨ Crear partida',
      'home.or': 'o únete a una',
      'home.codePlaceholder': 'CÓDIGO',
      'home.join': 'Unirse',
      'home.joinCode': 'Unirse a la partida {code}',
      'home.different': 'Mejor crear otra partida',
      'home.stats': '{chars} personajes · {traits} temas · <a href="{href}" class="muted">verlos</a>',
      'home.codeLength': 'Los códigos tienen 4 letras.',

      'how.title': 'Cómo se juega',
      'how.1': 'Cada quien entra desde su celular — en la misma sala o por videollamada.',
      'how.2': 'En cada ronda, a cada jugador le toca un personaje de películas, series, anime, videojuegos o caricaturas. <b>Ves el personaje de todos menos el tuyo.</b>',
      'how.3': 'Todos los personajes de la ronda tienen algo en común — su apariencia, un rasgo o algo por lo que son famosos. ¡Úsalo como pista!',
      'how.4': 'Por turnos, hagan preguntas de sí o no o den pistas, y luego escribe tu respuesta. Mientras más rápido adivines, más puntos.',
      'how.5': '¿No conoces el personaje de alguien? Toca <b>Saltar</b> y le toca otro.',

      'common.leave': 'Salir',
      'common.you': 'tú',
      'common.host': 'anfitrión',
      'common.online': 'conectado',
      'common.offline': 'desconectado',
      'common.remove': 'quitar',

      'lobby.code': 'CÓDIGO DE PARTIDA',
      'lobby.qrAlt': 'Código QR para unirse',
      'lobby.scan': 'Escanea, o abre:',
      'lobby.lanNote': 'Los celulares deben estar en la misma red Wi-Fi que esta computadora. Para jugar a distancia, publícalo en línea (ver README).',
      'lobby.copy': 'Copiar enlace',
      'lobby.copied': '¡Enlace copiado!',
      'lobby.players': 'Jugadores',
      'lobby.charsFrom': 'Personajes de',
      'lobby.showTrait': 'Mostrar lo que tienen en común como pista',
      'lobby.start': '🎬 Empezar ronda',
      'lobby.needMore': 'Esperando al menos 2 jugadores…',
      'lobby.waitingHost': 'Esperando a que <b>{name}</b> empiece…',
      'confirm.leave': '¿Salir de esta partida?',

      'game.round': 'Ronda {n}',
      'game.results': 'Ronda {n} — resultados',
      'game.everyone': 'En esta ronda todos…',
      'game.linkWas': 'Lo que tenían en común',
      'game.secret': 'Conexión secreta',
      'game.secretText': 'Todos los personajes comparten algo… ¿qué será?',
      'game.whoAreYou': '¿Quién eres?',
      'game.guessPlaceholder': '¿Quién eres?',
      'game.guess': 'Adivinar',
      'game.giveUp': 'Me rindo — muéstramelo',
      'game.askTable': 'Hazle preguntas al grupo y luego adivina.',
      'game.guessCount': '{n} intento(s) hasta ahora',
      'game.lastGuess': 'último: “{guess}”',
      'game.nextRound': 'Entrarás en la próxima ronda',
      'game.youWere': 'Eras {name}',
      'game.youPoints': '✅ +{n} puntos',
      'game.youGaveUp': '🏳️ te rendiste',
      'game.timesUp': '⏱ se acabó el tiempo',
      'game.others': 'Los demás',
      'game.skipHint': 'Toca Saltar si no conoces a un personaje',
      'game.nobody': 'Todavía no hay nadie más.',
      'game.is': 'es…',
      'game.guessed': 'Dijo',
      'game.closeEnough': 'Se vale ✓',
      'game.closeEnoughTitle': 'Contar esta respuesta como correcta',
      'game.skip': '🤷 No lo conozco — saltar',
      'game.gaveUpBadge': 'se rindió',
      'game.ranOut': '(se acabaron los personajes)',
      'game.next': '▶ Siguiente ronda',
      'game.settings': '⚙ Cambiar ajustes',
      'game.resetScores': 'Reiniciar puntos',
      'game.endRound': 'Terminar ronda y revelar todo',
      'game.waitingNext': 'Esperando a que <b>{name}</b> empiece la siguiente ronda…',
      'game.scores': 'Puntos',
      'game.talk': 'Charla',
      'game.chatPlaceholder': 'Haz una pregunta / da una pista',
      'game.send': 'Enviar',
      'confirm.giveUp': '¿Rendirte y ver tu personaje? Ganas 0 puntos esta ronda.',
      'confirm.reset': '¿Poner en 0 los puntos de todos?',
      'confirm.end': '¿Terminar la ronda y revelar todos los personajes?',

      'toast.kicked': 'Te sacaron de la partida.',
      'toast.reconnecting': 'Se perdió la conexión — reconectando…',

      'err.enterName': 'Primero escribe tu nombre.',
      'err.roomFull': 'La partida está llena (máximo 12 jugadores).',
      'err.noGame': 'No hay ninguna partida con el código "{code}".',
      'err.needPlayers': 'Se necesitan al menos 2 jugadores.',
      'err.needCategory': 'Elige al menos una categoría.',
      'err.notEnoughChars': 'No hay suficientes personajes en las categorías elegidas para tantos jugadores. Activa más categorías.',
      'err.noMoreChars': 'Ya no quedan personajes para el tema de esta ronda — ¡intenta adivinar!',

      'log.joined': '{name} se unió.',
      'log.roundStarted': 'Empezó la ronda {n}. Todos los personajes tienen algo en común…',
      'log.solved': '¡{name} adivinó — es {char}! +{points}',
      'log.accepted': '¡{name} lo logró ("{guess}", aceptado por {by}) — es {char}! +{points}',
      'log.roundOver': '¡Se acabó la ronda! Lo que tenían en común: {trait}.',
      'log.scoresReset': 'Se reiniciaron los puntos.',
      'log.skipped': '{name} no conocía el personaje de {target} — le tocó uno nuevo.',
      'log.missed': '{name} dijo "{guess}" — no.',
      'log.gaveUp': '{name} se rindió. Era {char}.',
      'log.removed': 'Sacaron a {name}.',
      'log.left': '{name} salió.',
      'log.newHost': 'Ahora {name} es el anfitrión.',

      'gallery.title': 'Galería de personajes',
      'gallery.back': 'Volver al juego',
      'gallery.search': 'Busca nombre, serie o rasgo (p. ej. “capa”, “Marvel”)',
      'gallery.all': 'Todos',
      'gallery.count': '{n} personajes · {missing} sin imagen',
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem('sd.lang');
      if (saved && STRINGS[saved]) return saved;
    } catch { /* ignore */ }
    const nav = (navigator.languages || [navigator.language || 'en']).map((l) => String(l).slice(0, 2).toLowerCase());
    return nav.find((l) => STRINGS[l]) || 'en';
  }

  let lang = detect();
  document.documentElement.lang = lang;
  const listeners = [];

  // Server-sent labels look like { en, es }; plain strings pass through.
  function L(v) {
    if (v && typeof v === 'object') return v[lang] ?? v.en ?? '';
    return v ?? '';
  }

  // t('key', { name: 'Ana' }) — vars may themselves be {en, es} objects.
  function t(key, vars) {
    let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? L(vars[k]) : m));
    return s;
  }

  // Same as t(), but HTML-escapes the vars. Use when inserting into innerHTML.
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function tH(key, vars) {
    if (!vars) return t(key);
    return t(key, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(L(v))])));
  }

  function setLang(next) {
    if (!STRINGS[next] || next === lang) return;
    lang = next;
    document.documentElement.lang = lang;
    try { localStorage.setItem('sd.lang', lang); } catch { /* ignore */ }
    listeners.forEach((fn) => fn(lang));
  }

  // <select> markup for a language picker.
  function picker(id = 'langPick') {
    return `<select id="${id}" class="lang-pick" aria-label="${t('lang.label')}">${Object.entries(LANGS)
      .map(([code, name]) => `<option value="${code}" ${code === lang ? 'selected' : ''}>${name}</option>`).join('')}</select>`;
  }

  window.i18n = { t, tH, L, setLang, picker, get lang() { return lang; }, onChange: (fn) => listeners.push(fn), LANGS };
})();
