const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');

const PORT = parseInt(process.env.PORT, 10) || 3000;

// ── Serve index.html ──
const htmlPath = path.join(__dirname, 'index.html');
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(htmlPath, (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ── WebSocket server ──
const wss = new WebSocketServer({ server });

// ── Game state ──
const ROUND_SIZE = 10;
let players = {};       // { slot: { ws, name, score, answered, streak } }
let currentProblem = -1;
let currentProblemData = null;
let gameActive = false;
let timerEnabled = false;
let timerSeconds = 10;
let timerHandle = null;
let firstAnsweredThisProblem = null; // slot of player who answered first (wrong counts)
let waitingForNext = false;
let gameOps = ['+', '\u2212'];
let gameMinNum = 1;
let gameMaxNum = 20;
// ── Persistent leaderboard (saved to file) ──
const LB_PATH = path.join(__dirname, 'leaderboard.json');
let leaderboard = [];
function loadLeaderboard() {
  try { leaderboard = JSON.parse(fs.readFileSync(LB_PATH, 'utf8')); } catch { leaderboard = []; }
}
function saveLeaderboard() {
  fs.writeFileSync(LB_PATH, JSON.stringify(leaderboard, null, 2));
}
loadLeaderboard();

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) return cfg.address;
    }
  }
  return 'localhost';
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const p of Object.values(players)) {
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

function sendTo(slot, msg) {
  const p = players[slot];
  if (p && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

function playerCount() {
  return Object.keys(players).length;
}

function getSlots() {
  return Object.keys(players);
}

function otherSlot(slot) {
  return slot === '1' ? '2' : '1';
}

function getDifficulty(streak) {
  if (streak >= 10) return 'expert';
  if (streak >= 6) return 'hard';
  if (streak >= 3) return 'medium';
  return 'easy';
}

function generateProblemByDifficulty(diff) {
  const ops = gameOps;
  const minNum = gameMinNum;
  const maxNum = gameMaxNum;
  const span = maxNum - minNum;

  let opMax, resMax;
  if (diff === 'easy') {
    opMax = minNum + Math.max(Math.ceil(span * 0.35), 1);
    resMax = minNum + Math.max(Math.ceil(span * 0.5), 2);
  } else if (diff === 'medium') {
    opMax = minNum + Math.max(Math.ceil(span * 0.6), 2);
    resMax = minNum + Math.max(Math.ceil(span * 0.75), 4);
  } else {
    opMax = maxNum;
    resMax = maxNum;
  }
  opMax = Math.min(opMax, maxNum);
  resMax = Math.min(resMax, maxNum);
  const rand = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

  for (let tries = 0; tries < 200; tries++) {
    if (diff === 'expert' && span >= 10) {
      const op1 = ops[Math.floor(Math.random() * ops.length)];
      const op2 = ops[Math.floor(Math.random() * ops.length)];
      const a = rand(minNum, opMax);
      const bMax = Math.max(minNum, minNum + Math.floor((opMax - minNum) * 0.7));
      const b = rand(minNum, bMax);
      const cMax = Math.max(minNum, minNum + Math.floor((opMax - minNum) * 0.5));
      const c = rand(minNum, cMax);
      const mid = op1 === '+' ? a + b : a - b;
      if (mid < 0 || mid > maxNum) continue;
      const answer = op2 === '+' ? mid + c : mid - c;
      if (answer < 0 || answer > maxNum) continue;
      return { a, b, c, op1, op2, twoStep: true, mid, answer, isAdd: op1 === '+' };
    }

    const op = ops[Math.floor(Math.random() * ops.length)];
    const isAdd = op === '+';
    let a = rand(minNum, opMax);
    let b = rand(minNum, opMax);

    if (isAdd) {
      const result = a + b;
      if (result > resMax || result < minNum) continue;
      return { a, b, op: '+', isAdd: true, answer: result };
    } else {
      if (a < b) { const tmp = a; a = b; b = tmp; }
      const result = a - b;
      if (result < 0 || result > resMax) continue;
      return { a, b, op: '\u2212', isAdd: false, answer: result };
    }
  }
  if (ops.includes('+') && minNum + minNum <= maxNum) {
    return { a: minNum, b: minNum, op: '+', isAdd: true, answer: minNum + minNum };
  }
  return { a: minNum + 1, b: minNum, op: '\u2212', isAdd: false, answer: 1 };
}

function getMaxDifficulty() {
  let maxStreak = 0;
  for (const p of Object.values(players)) {
    if (p.streak > maxStreak) maxStreak = p.streak;
  }
  return getDifficulty(maxStreak);
}

function streakState() {
  const s = {};
  for (const [slot, p] of Object.entries(players)) {
    s[slot] = p.streak;
  }
  return s;
}

function scoreState() {
  const s = {};
  for (const [slot, p] of Object.entries(players)) {
    s[slot] = { name: p.name, score: p.score };
  }
  return s;
}

function sendProblem() {
  if (currentProblem >= ROUND_SIZE) {
    endRound();
    return;
  }
  const diff = getMaxDifficulty();
  const p = generateProblemByDifficulty(diff);
  currentProblemData = p;
  firstAnsweredThisProblem = null;
  waitingForNext = false;
  for (const pl of Object.values(players)) pl.answered = false;

  const msg = {
    type: 'problem',
    index: currentProblem,
    total: ROUND_SIZE,
    a: p.a, b: p.b,
    scores: scoreState(),
    streaks: streakState(),
    timerEnabled,
    timerSeconds,
  };
  if (p.twoStep) { msg.twoStep = true; msg.op1 = p.op1; msg.op2 = p.op2; msg.c = p.c; }
  else { msg.op = p.op; }
  broadcast(msg);

  if (timerEnabled) {
    clearTimeout(timerHandle);
    timerHandle = setTimeout(() => {
      if (waitingForNext) return;
      waitingForNext = true;
      // Time's up — reset all streaks
      for (const pl of Object.values(players)) pl.streak = 0;
      const probData = p.twoStep
        ? { a: p.a, b: p.b, c: p.c, op1: p.op1, op2: p.op2, twoStep: true, mid: p.mid, isAdd: p.isAdd, answer: p.answer }
        : { a: p.a, b: p.b, op: p.op, isAdd: p.isAdd, answer: p.answer };
      broadcast({
        type: 'timeout',
        answer: p.answer,
        problem: probData,
        scores: scoreState(),
        streaks: streakState(),
      });
      setTimeout(() => {
        currentProblem++;
        sendProblem();
      }, 4000);
    }, timerSeconds * 1000);
  }
}

function endRound() {
  gameActive = false;
  clearTimeout(timerHandle);

  // Determine winner
  const slots = getSlots();
  let winnerSlot = null;
  if (slots.length === 2) {
    const s1 = players['1'].score, s2 = players['2'].score;
    if (s1 > s2) winnerSlot = '1';
    else if (s2 > s1) winnerSlot = '2';
  } else if (slots.length === 1) {
    winnerSlot = slots[0];
  }

  // Update leaderboard
  for (const p of Object.values(players)) {
    const existing = leaderboard.find(e => e.name.toLowerCase() === p.name.toLowerCase());
    if (existing) {
      existing.stars += p.score;
      existing.rounds++;
      existing.name = p.name;
    } else {
      leaderboard.push({ name: p.name, stars: p.score, rounds: 1 });
    }
  }
  leaderboard.sort((a, b) => b.stars - a.stars);
  leaderboard = leaderboard.slice(0, 10);
  saveLeaderboard();

  broadcast({
    type: 'round-end',
    scores: scoreState(),
    winnerSlot,
    winnerName: winnerSlot ? players[winnerSlot].name : null,
    leaderboard,
  });
}

wss.on('connection', (ws) => {
  // Assign slot
  let slot = null;
  if (!players['1']) slot = '1';
  else if (!players['2']) slot = '2';
  else {
    ws.send(JSON.stringify({ type: 'full' }));
    ws.close();
    return;
  }

  players[slot] = { ws, name: slot === '1' ? 'Dad' : 'Vasilije', score: 0, answered: false, streak: 0 };

  ws.send(JSON.stringify({
    type: 'welcome',
    slot,
    defaultName: players[slot].name,
    ip: getLocalIP(),
    port: PORT,
    leaderboard,
  }));

  // Notify other player
  const other = otherSlot(slot);
  if (players[other]) {
    sendTo(other, {
      type: 'player-joined',
      slot,
      name: players[slot].name,
    });
  }

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'set-name') {
      players[slot].name = (msg.name || '').trim().slice(0, 20) || 'Player';
      // Notify everyone
      broadcast({
        type: 'player-update',
        players: Object.fromEntries(
          Object.entries(players).map(([s, p]) => [s, { name: p.name }])
        ),
      });
    }

    if (msg.type === 'start-game' && slot === '1') {
      if (playerCount() < 1) return;
      timerEnabled = !!msg.timerEnabled;
      timerSeconds = [5, 10, 15].includes(msg.timerSeconds) ? msg.timerSeconds : 10;
      // Apply game settings from host
      if (msg.settings) {
        const s = msg.settings;
        if (Array.isArray(s.ops) && s.ops.length > 0) gameOps = s.ops.filter(o => o === '+' || o === '\u2212');
        if (gameOps.length === 0) gameOps = ['+', '\u2212'];
        gameMinNum = Math.max(1, Math.min(99, parseInt(s.minNum, 10) || 1));
        gameMaxNum = Math.max(gameMinNum + 1, Math.min(100, parseInt(s.maxNum, 10) || 20));
      } else {
        gameOps = ['+', '\u2212'];
        gameMinNum = 1;
        gameMaxNum = 20;
      }
      currentProblem = 0;
      gameActive = true;
      for (const p of Object.values(players)) { p.score = 0; p.answered = false; p.streak = 0; }
      broadcast({ type: 'game-start', scores: scoreState(), maxNum: gameMaxNum });
      setTimeout(() => sendProblem(), 500);
    }

    if (msg.type === 'answer' && gameActive && !waitingForNext) {
      const p = currentProblemData;
      if (!p || players[slot].answered) return;

      const num = parseInt(msg.value, 10);

      if (num === p.answer) {
        // Correct — lock this player and end the problem
        players[slot].answered = true;
        clearTimeout(timerHandle);
        players[slot].score++;
        players[slot].streak++;
        // Other player's streak resets (they didn't get it)
        const otherS = otherSlot(slot);
        if (players[otherS]) players[otherS].streak = 0;
        waitingForNext = true;

        broadcast({
          type: 'correct',
          slot,
          name: players[slot].name,
          scores: scoreState(),
          streaks: streakState(),
          answer: p.answer,
        });

        setTimeout(() => {
          currentProblem++;
          sendProblem();
        }, 2200);

      } else {
        // Wrong — mark this player as failed, but they can't retry
        players[slot].answered = true;
        players[slot].streak = 0;

        sendTo(slot, {
          type: 'wrong',
          slot,
        });

        // If all connected players have answered wrong, reveal the answer
        const allAnswered = Object.values(players).every(pl => pl.answered);
        if (allAnswered) {
          clearTimeout(timerHandle);
          waitingForNext = true;
          const probData = p.twoStep
            ? { a: p.a, b: p.b, c: p.c, op1: p.op1, op2: p.op2, twoStep: true, mid: p.mid, isAdd: p.isAdd, answer: p.answer }
            : { a: p.a, b: p.b, op: p.op, isAdd: p.isAdd, answer: p.answer };
          broadcast({
            type: 'both-wrong',
            answer: p.answer,
            problem: probData,
            scores: scoreState(),
            streaks: streakState(),
          });
          setTimeout(() => {
            currentProblem++;
            sendProblem();
          }, 4000);
        } else {
          // Other player still has a chance to steal
          const otherS = otherSlot(slot);
          if (players[otherS]) {
            sendTo(otherS, {
              type: 'steal-chance',
              name: players[slot].name,
            });
          }
        }
      }
    }
  });

  ws.on('close', () => {
    const name = players[slot]?.name || 'Player';
    delete players[slot];
    if (gameActive) {
      gameActive = false;
      clearTimeout(timerHandle);
      broadcast({ type: 'player-left', name });
    } else {
      broadcast({ type: 'player-left', name });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  ==============================');
  console.log('   Space Math Server Running!');
  console.log('  ==============================');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log('');
  console.log('  Share the Network address with the other player!');
  console.log('');
});
