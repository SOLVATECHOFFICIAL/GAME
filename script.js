/* ============================================================
   EMMIE's game — script.js
   ============================================================ */

const TOTAL_LEVELS = 40;
const ULTRA_FROM   = 5;
const BLUNDER = { 1: 0.85, 2: 0.65, 3: 0.40, 4: 0.15 };
const DIFF_NAMES  = ['Easy', 'Normal', 'Hard', 'Expert'];
const STORAGE_KEY = 'emmie-game-v1';
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const HUMAN = 'X';
const AI    = 'O';

let save = loadSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        name: typeof p.name === 'string' ? p.name.slice(0, 16) : '',
        cleared: clamp(parseInt(p.cleared, 10) || 0, 0, TOTAL_LEVELS)
      };
    }
  } catch (e) {}
  return { name: '', cleared: 0 };
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) {}
}

function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

const screens = {
  name:   document.getElementById('screen-name'),
  levels: document.getElementById('screen-levels'),
  game:   document.getElementById('screen-game')
};

function show(which) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[which].classList.add('active');
}

/* Screen 1 */
const nameForm  = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
nameInput.value = save.name;

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const n = nameInput.value.trim();
  if (!n) { nameInput.focus(); return; }
  save.name = n;
  persist();
  openLevels();
});

document.getElementById('change-name').addEventListener('click', () => {
  show('name');
  nameInput.focus();
  nameInput.select();
});

/* Screen 2 */
const levelGrid    = document.getElementById('level-grid');
const playerNameEl = document.getElementById('player-name');
const hintEl       = document.getElementById('level-hint');

function openLevels() {
  playerNameEl.textContent = save.name || 'Player';
  renderLevels();
  show('levels');
}

function renderLevels() {
  const unlocked = Math.min(save.cleared + 1, TOTAL_LEVELS);

  hintEl.textContent = save.cleared === TOTAL_LEVELS
    ? 'All 40 levels cleared. EMMIE bows to you.'
    : save.cleared + " / " + TOTAL_LEVELS + " cleared · Win a level to unlock the next. Draws don't count.";

  levelGrid.innerHTML = '';

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level';

    if (i <= save.cleared) {
      btn.classList.add('done');
      btn.textContent = i;
      btn.addEventListener('click', () => startLevel(i));
    } else if (i === unlocked) {
      btn.classList.add('current');
      btn.textContent = i;
      btn.addEventListener('click', () => startLevel(i));
    } else {
      btn.classList.add('locked');
      btn.textContent = '🔒';
      btn.disabled = true;
    }
    levelGrid.appendChild(btn);
  }
}

/* Screen 3 */
const boardEl     = document.getElementById('board');
const statusEl    = document.getElementById('status');
const gameLevelEl = document.getElementById('game-level');
const gameDiffEl  = document.getElementById('game-diff');

let board         = Array(9).fill('');
let currentPlayer = HUMAN;
let gameOver      = false;
let busy          = false;
let level         = 1;
let gameToken     = 0;

function diffFor(lvl) {
  return lvl >= ULTRA_FROM ? 'Ultra' : (DIFF_NAMES[lvl - 1] || 'Ultra');
}

function startLevel(lvl) {
  level = lvl;
  board = Array(9).fill('');
  currentPlayer = HUMAN;
  gameOver = false;
  busy = false;
  gameToken++;

  gameLevelEl.textContent = "Level " + lvl;
  gameDiffEl.textContent  = diffFor(lvl);
  gameDiffEl.classList.toggle('ultra', lvl >= ULTRA_FROM);

  buildBoard();
  setStatus('Your turn — you are X');
  show('game');
}

function buildBoard() {
  boardEl.innerHTML = '';
  boardEl.classList.remove('waiting');

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.addEventListener('click', () => humanMove(i));
    boardEl.appendChild(cell);
  }
}

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

function place(index, mark) {
  board[index] = mark;
  const cell = boardEl.children[index];
  cell.textContent = mark;
  cell.classList.add(mark.toLowerCase(), 'placed');
  cell.disabled = true;
}

function humanMove(index) {
  if (gameOver || busy || currentPlayer !== HUMAN || board[index]) return;
  place(index, HUMAN);
  const result = evaluate(board);
  if (finishIfOver(result)) return;
  currentPlayer = AI;
  aiTurn();
}

function aiTurn() {
  busy = true;
  boardEl.classList.add('waiting');
  setStatus('EMMIE is thinking…');
  const token = gameToken;
  const delay = 260 + Math.random() * 320;

  setTimeout(() => {
    if (token !== gameToken || gameOver) return;
    const move = chooseAiMove(board, level);
    place(move, AI);
    busy = false;
    boardEl.classList.remove('waiting');
    const result = evaluate(board);
    if (finishIfOver(result)) return;
    currentPlayer = HUMAN;
    setStatus('Your turn');
  }, delay);
}

function evaluate(b) {
  for (const [a, c, d] of WIN_LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line: [a, c, d], draw: false };
    }
  }
  return { winner: null, line: [], draw: b.every(v => v !== '') };
}

function finishIfOver(result) {
  if (result.winner) {
    gameOver = true;
    result.line.forEach(i => boardEl.children[i].classList.add('win'));
    boardEl.classList.add('waiting');

    if (result.winner === HUMAN) {
      onWin();
    } else {
      setStatus('EMMIE wins this round. Try again!', 'lose');
      setTimeout(() => {
        if (screens.game.classList.contains('active') && gameOver) startLevel(level);
      }, 2500);
    }
    return true;
  }

  if (result.draw) {
    gameOver = true;
    boardEl.classList.add('waiting');
    setStatus("It's a draw! Restarting level...", 'lose');
    setTimeout(() => {
      if (screens.game.classList.contains('active') && gameOver) startLevel(level);
    }, 2500);
    return true;
  }
  return false;
}

function onWin() {
  if (level >= TOTAL_LEVELS) {
    setStatus("Level 40 cleared. You beat EMMIE's game!", 'win');
    return;
  }
  const isNew = level > save.cleared;
  if (isNew) {
    save.cleared = level;
    persist();
  }
  setStatus("Level " + level + " won! Level " + (level + 1) + " unlocked.", 'win');
  setTimeout(() => {
    if (screens.game.classList.contains('active') && gameOver) openLevels();
  }, 2000);
}

function chooseAiMove(b, lvl) {
  const empties = [];
  for (let i = 0; i < 9; i++) if (!b[i]) empties.push(i);
  if (empties.length === 0) return -1;
  const blunder = lvl >= ULTRA_FROM ? 0 : (BLUNDER[lvl] || 0);
  if (Math.random() < blunder) {
    return empties[Math.floor(Math.random() * empties.length)];
  }
  return bestMove(b);
}

function bestMove(b) {
  let bestScore = -Infinity;
  let moves = [];
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = AI;
    const score = minimax(b, 0, false);
    b[i] = '';
    if (score > bestScore) {
      bestScore = score;
      moves = [i];
    } else if (score === bestScore) {
      moves.push(i);
    }
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

function minimax(b, depth, isMax) {
  const result = evaluate(b);
  if (result.winner === AI)    return 10 - depth;
  if (result.winner === HUMAN) return depth - 10;
  if (result.draw)             return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = AI;
      best = Math.max(best, minimax(b, depth + 1, false));
      b[i] = '';
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = HUMAN;
      best = Math.min(best, minimax(b, depth + 1, true));
      b[i] = '';
    }
    return best;
  }
}

document.getElementById('back-btn').addEventListener('click', openLevels);

/* Start app */
show('name');
nameInput.focus();
