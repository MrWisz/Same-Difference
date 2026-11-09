// Dev helper: fill a room with bot players so you can test alone.
// Usage: node scripts/bots.js ROOMCODE [count] [url]
// Bots just sit in the game and post one chat message per round.
const { io } = require('socket.io-client');

const [code, count = '2', url = 'http://localhost:3000'] = process.argv.slice(2);
if (!code) { console.log('usage: node scripts/bots.js ROOMCODE [count] [url]'); process.exit(1); }

const NAMES = ['Robo Ana', 'Bot Ben', 'Cyber Cleo', 'Droid Dan', 'Mecha Mia'];
const LINES = ['Am I a villain?', 'Am I from a cartoon?', 'Do I have superpowers?', 'Am I an animal?'];

for (let i = 0; i < Number(count); i++) {
  const s = io(url);
  const name = NAMES[i % NAMES.length];
  let lastRound = 0;
  s.on('connect', () => s.emit('join', { code, name, pid: `bot-${i}` }));
  s.on('join_failed', (e) => { console.log(name, e.text); process.exit(1); });
  s.on('state', (st) => {
    if (st.phase === 'round' && st.roundNo !== lastRound) {
      lastRound = st.roundNo;
      setTimeout(() => s.emit('chat', { text: LINES[(i + st.roundNo) % LINES.length] }), 3000 + i * 1500);
    }
  });
  console.log(`${name} joining ${code}`);
}
