/**
 * app.js - Main application controller
 * Manages screens, game flow, theme switching, scoreboard, and UI
 */

class App {
  constructor() {
    this.game = null;
    this.ai = null;
    this.board3d = null;
    this.sounds = null;
    this.currentTheme = THEMES.classic;
    this.difficulty = 'easy';
    this.selectedPiece = null;
    this.validMoves = [];
    this._intermediateSquares = new Map(); // key: "row,col" -> first chain move containing that step
    this.isComputerThinking = false;
    this.currentScreen = null;
    this._loadSettings();
  }

  _loadSettings() {
    try {
      const s = localStorage.getItem('kingsmakers_settings');
      if (s) {
        const data = JSON.parse(s);
        this.currentTheme = THEMES[data.theme] || THEMES.classic;
        this.difficulty = data.difficulty || 'easy';
      }
    } catch (e) {}
  }

  _saveSettings() {
    try {
      localStorage.setItem('kingsmakers_settings', JSON.stringify({
        theme: this.currentTheme.id,
        difficulty: this.difficulty,
      }));
    } catch (e) {}
  }

  init() {
    this.sounds = new SoundManager();
    this._applyThemeToUI(this.currentTheme);
    this._bindMenuButtons();
    this.showScreen('intro');
    this._startIntro();
  }

  // ──────────────── SCREENS ────────────────

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.pointerEvents = 'none';
    });
    const screen = document.getElementById(`screen-${id}`);
    if (screen) {
      screen.classList.add('active');
      screen.style.pointerEvents = 'all';
      this.currentScreen = id;
    }
  }

  // ──────────────── INTRO ────────────────

  _startIntro() {
    const canvas = document.getElementById('intro-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;

    let phase = 0;     // 0=logo, 1=explosion, 2=done
    let t = 0;
    const particles = [];
    const LOGO_DUR = 2.2;
    const EXPLODE_DUR = 1.8;
    let exploded = false;

    // Logo text properties
    const logoText = 'KingsMakers';
    const subText = 'GAMES';

    const spawnExplosion = () => {
      if (exploded) return;
      exploded = true;
      this.sounds.playExplosion();
      this.sounds.playIntroStrike();
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (let i = 0; i < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 6;
        const size = 3 + Math.random() * 8;
        const color = [`#ffd700`, `#ff8800`, `#ff4400`, `#ffff00`, `#ffffff`,
                       `#00ffff`, `#ff00ff`][Math.floor(Math.random() * 7)];
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size, color, alpha: 1,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
        });
      }
    };

    let lastTime = 0;
    const render = (ts) => {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      t += dt;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
      );
      bgGrad.addColorStop(0, '#0d0020');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      ctx.save();
      for (let i = 0; i < 120; i++) {
        const sx = ((i * 137.508 + 30) % canvas.width);
        const sy = ((i * 97.3 + 20) % canvas.height);
        const size = (i % 3 === 0) ? 2 : 1;
        const alpha = 0.4 + 0.5 * Math.sin(t * 2 + i);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.restore();

      if (phase === 0) {
        // Logo entry animation
        const progress = Math.min(t / LOGO_DUR, 1);
        const logoAlpha = progress < 0.3 ? progress / 0.3 : 1;

        ctx.save();
        ctx.globalAlpha = logoAlpha;

        // Crown icon
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const crownSize = 60 * Math.min(canvas.width / 600, 1.5);
        const crownY = cy - 90 * Math.min(canvas.height / 800, 1.5);

        // Draw crown
        ctx.save();
        ctx.translate(cx, crownY);
        const scale = 0.7 + 0.3 * progress;
        ctx.scale(scale, scale);
        drawCrown(ctx, 0, 0, crownSize, '#ffd700');
        ctx.restore();

        // Main title
        const titleSize = Math.floor(Math.min(canvas.width / 10, 72));
        ctx.font = `900 ${titleSize}px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow/glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 30;
        const grad = ctx.createLinearGradient(cx - 200, 0, cx + 200, 0);
        grad.addColorStop(0, '#ffd700');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, '#ffd700');
        ctx.fillStyle = grad;
        ctx.fillText(logoText, cx, cy);

        // Subtitle — draw with manual spacing for canvas compatibility
        ctx.shadowBlur = 15;
        ctx.font = `700 ${Math.floor(titleSize * 0.45)}px 'Segoe UI', Arial, sans-serif`;
        ctx.fillStyle = '#c8a0ff';
        // Render spaced subtitle by drawing chars individually
        const chars = subText.split('');
        const charW = Math.floor(titleSize * 0.45) * 0.72;
        const totalW = chars.length * charW;
        chars.forEach((ch, i) => {
          ctx.fillText(ch, cx - totalW / 2 + i * charW + charW / 2, cy + titleSize * 0.75);
        });
        ctx.fillText(subText, cx, cy + titleSize * 0.75);

        ctx.shadowBlur = 0;
        ctx.restore();

        if (t >= LOGO_DUR) {
          phase = 1;
          t = 0;
          spawnExplosion();
        }
      } else if (phase === 1) {
        // Explosion phase
        const progress = Math.min(t / EXPLODE_DUR, 1);

        // Flash
        if (t < 0.15) {
          ctx.fillStyle = `rgba(255,200,50,${0.8 * (1 - t / 0.15)})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Update & draw particles
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12; // gravity
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.rot += p.rotSpeed;
          p.alpha = Math.max(0, 1 - (t / EXPLODE_DUR) * 1.2);

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }

        // Fading logo
        const logoAlpha = 1 - progress;
        if (logoAlpha > 0) {
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          ctx.save();
          ctx.globalAlpha = logoAlpha;
          const titleSize = Math.floor(Math.min(canvas.width / 10, 72));
          ctx.font = `900 ${titleSize}px 'Segoe UI', Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 40;
          ctx.fillStyle = '#ffd700';
          ctx.fillText('KingsMakers', cx, cy);
          ctx.restore();
        }

        if (t >= EXPLODE_DUR) {
          phase = 2;
          // Transition to menu
          setTimeout(() => this._showMenu(), 400);
        }
      } else {
        // Fade out
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 0.0) * 2)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (phase < 2 || t < 0.8) {
        requestAnimationFrame(render);
      }
    };

    requestAnimationFrame(render);
  }

  _showMenu() {
    this.showScreen('menu');
    this._updateScoreDisplay();
  }

  // ──────────────── MENU ────────────────

  _bindMenuButtons() {
    // Play button
    document.getElementById('btn-play').addEventListener('click', () => {
      this.sounds.playClick();
      this.showScreen('game');
      this._startNewGame();
    });

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.sounds.playClick();
      this._renderSettings();
      this.showScreen('settings');
    });

    // Scoreboard
    document.getElementById('btn-scoreboard').addEventListener('click', () => {
      this.sounds.playClick();
      this._renderScoreboard();
      this.showScreen('scoreboard');
    });

    // Back from settings
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      this.sounds.playClick();
      this.showScreen('menu');
    });

    // Back from scoreboard
    document.getElementById('btn-scoreboard-back').addEventListener('click', () => {
      this.sounds.playClick();
      this.showScreen('menu');
    });

    // Game screen buttons
    document.getElementById('btn-game-menu').addEventListener('click', () => {
      this.sounds.playClick();
      if (this.board3d) { this.board3d.destroy(); this.board3d = null; }
      this.showScreen('menu');
      this._updateScoreDisplay();
    });

    document.getElementById('btn-game-restart').addEventListener('click', () => {
      this.sounds.playClick();
      this._startNewGame();
    });

    document.getElementById('btn-game-hint').addEventListener('click', () => {
      this.sounds.playClick();
      this._showHint();
    });

    // Game over screen
    document.getElementById('btn-gameover-play').addEventListener('click', () => {
      this.sounds.playClick();
      document.getElementById('screen-gameover').classList.remove('active');
      this._startNewGame();
    });

    document.getElementById('btn-gameover-menu').addEventListener('click', () => {
      this.sounds.playClick();
      document.getElementById('screen-gameover').classList.remove('active');
      if (this.board3d) { this.board3d.destroy(); this.board3d = null; }
      this.showScreen('menu');
      this._updateScoreDisplay();
    });

    // Sound toggle
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const muted = this.sounds.toggleMute();
      document.getElementById('btn-sound-toggle').textContent = muted ? '🔇' : '🔊';
    });

    // Theme pickers (settings screen)
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.theme;
        this.sounds.playClick();
        this.currentTheme = THEMES[themeId];
        this._saveSettings();
        this._applyThemeToUI(this.currentTheme);
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (this.board3d) this.board3d.applyTheme(this.currentTheme);
      });
    });

    // Difficulty picker
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sounds.playClick();
        this.difficulty = btn.dataset.diff;
        this._saveSettings();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (this.ai) this.ai.setDifficulty(this.difficulty);
      });
    });

    // Skip intro (click anywhere on intro)
    const introScreen = document.getElementById('screen-intro');
    if (introScreen) {
      introScreen.addEventListener('click', () => {
        if (this.currentScreen === 'intro') {
          this.sounds.playClick();
          this._showMenu();
        }
      });
    }
  }

  _applyThemeToUI(theme) {
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.uiAccent);
    root.style.setProperty('--primary', theme.uiPrimary);
    root.style.setProperty('--text', theme.uiText);
    root.style.setProperty('--ui-bg', theme.uiBg);
    document.body.style.background = theme.uiBg;

    // Sync settings panel selections
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.theme === theme.id);
    });
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.diff === this.difficulty);
    });
  }

  _renderSettings() {
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.theme === this.currentTheme.id);
    });
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.diff === this.difficulty);
    });
    const muted = this.sounds.isMuted();
    document.getElementById('btn-sound-toggle').textContent = muted ? '🔇' : '🔊';
  }

  // ──────────────── SCOREBOARD ────────────────

  _updateScoreDisplay() {
    if (!this.game) {
      // Load scores from localStorage
      let player = 0, computer = 0;
      try {
        const s = localStorage.getItem('kingsmakers_scores');
        if (s) { const d = JSON.parse(s); player = d.player || 0; computer = d.computer || 0; }
      } catch (e) {}
      document.getElementById('score-player').textContent = player;
      document.getElementById('score-computer').textContent = computer;
    } else {
      document.getElementById('score-player').textContent = this.game.scores.player;
      document.getElementById('score-computer').textContent = this.game.scores.computer;
    }
  }

  _renderScoreboard() {
    let player = 0, computer = 0;
    try {
      const s = localStorage.getItem('kingsmakers_scores');
      if (s) { const d = JSON.parse(s); player = d.player || 0; computer = d.computer || 0; }
    } catch (e) {}
    if (this.game) { player = this.game.scores.player; computer = this.game.scores.computer; }

    const total = player + computer;
    const playerPct = total > 0 ? Math.round((player / total) * 100) : 50;
    const computerPct = total > 0 ? Math.round((computer / total) * 100) : 50;

    document.getElementById('sb-player-wins').textContent = player;
    document.getElementById('sb-computer-wins').textContent = computer;
    document.getElementById('sb-total').textContent = total;
    document.getElementById('sb-player-bar').style.width = `${playerPct}%`;
    document.getElementById('sb-computer-bar').style.width = `${computerPct}%`;
    document.getElementById('sb-player-pct').textContent = `${playerPct}%`;
    document.getElementById('sb-computer-pct').textContent = `${computerPct}%`;

    // Reset scores button
    const resetBtn = document.getElementById('btn-reset-scores');
    if (resetBtn && !resetBtn._bound) {
      resetBtn._bound = true;
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all scores?')) {
          this.sounds.playClick();
          if (this.game) this.game.resetScores();
          else {
            try { localStorage.setItem('kingsmakers_scores', JSON.stringify({ player: 0, computer: 0 })); } catch (e) {}
          }
          this._renderScoreboard();
        }
      });
    }
  }

  // ──────────────── GAME ────────────────

  _startNewGame() {
    if (this.board3d) {
      this.board3d.destroy();
      this.board3d = null;
    }

    this.game = new DraughtsGame();
    this.ai = new DraughtsAI(this.difficulty);
    this.selectedPiece = null;
    this.validMoves = [];
    this.isComputerThinking = false;

    this._updateGameStatus('Your turn — select a piece');
    this._updateScoreDisplay();
    this._updatePieceCount();

    // Init 3D board
    this.board3d = new Board3D('game-canvas');
    this.board3d.theme = this.currentTheme;
    this.board3d.init();
    this.board3d.updateBoard(this.game.board);
    this.board3d.onSquareClick = (row, col) => this._handleSquareClick(row, col);
  }

  _handleSquareClick(row, col) {
    if (!this.game || this.game.gameOver) return;
    if (this.game.currentPlayer !== PLAYER) return;
    if (this.isComputerThinking) return;

    const piece = this.game.board[row][col];

    if (this.selectedPiece) {
      // Try to execute a move to this square (final destination)
      const move = this.validMoves.find(m => m.to[0] === row && m.to[1] === col);
      if (move) {
        this._executePlayerMove(move);
        return;
      }
      // If clicked on an intermediate step of a multi-jump chain, execute that full chain
      const chainMove = this._intermediateSquares.get(`${row},${col}`);
      if (chainMove) {
        this._executePlayerMove(chainMove);
        return;
      }
      // If clicked on own piece, select it instead
      if (DraughtsGame.isPlayerPiece(piece)) {
        this._selectPiece(row, col);
        return;
      }
      // Deselect
      this.selectedPiece = null;
      this.validMoves = [];
      this._intermediateSquares = new Map();
      this.board3d.clearHighlights();
      return;
    }

    // Select a piece
    if (DraughtsGame.isPlayerPiece(piece)) {
      this._selectPiece(row, col);
    }
  }

  _selectPiece(row, col) {
    const moves = this.game.getMovesForPiece(row, col);
    if (moves.length === 0) {
      this._updateGameStatus('This piece has no valid moves!');
      this.sounds.playClick();
      return;
    }
    this.selectedPiece = [row, col];
    this.validMoves = moves;
    this.sounds.playSelect();

    // Build lookup for intermediate path squares in multi-jump chains.
    // Key: "row,col" of any intermediate step → the chain move to execute for it.
    this._intermediateSquares = new Map();
    const pathSet = new Set();
    for (const m of moves) {
      if (m.path && m.path.length > 1) {
        for (let i = 0; i < m.path.length - 1; i++) {
          const key = `${m.path[i][0]},${m.path[i][1]}`;
          if (!this._intermediateSquares.has(key)) {
            this._intermediateSquares.set(key, m);
          }
          pathSet.add(key);
        }
      }
    }
    const pathSquares = [...pathSet].map(k => k.split(',').map(Number));

    // Highlight final landing squares and intermediate path squares
    const dests = moves.map(m => m.to);
    this.board3d.showHighlights(dests, [row, col], pathSquares);
    this._updateGameStatus('Choose where to move');
  }

  _executePlayerMove(move) {
    this.selectedPiece = null;
    this.validMoves = [];
    this._intermediateSquares = new Map();
    this.board3d.clearHighlights();

    const captured = move.captures || [];
    const path = move.path || [move.to];

    // Animate the move
    this.board3d.animateMove(
      move.from, move.to, path, captured,
      () => {
        // Apply move to game state
        const result = this.game.executeMove(move);

        // Sound
        if (captured.length > 0) this.sounds.playCapture();
        else this.sounds.playMove();

        // Promotion sound/visual
        if (result.promoted) {
          const [tr, tc] = move.to;
          this.board3d.promoteToKing(tr, tc, true);
          this.sounds.playKingPromotion();
        }

        this._updatePieceCount();
        this._updateScoreDisplay();

        if (result.gameOver) {
          this._onGameOver(result.winner);
        } else {
          this._updateGameStatus('Computer is thinking...');
          this.isComputerThinking = true;
          const thinkTime = this.difficulty === 'easy' ? 600 : 1200;
          setTimeout(() => this._doComputerMove(), thinkTime);
        }
      }
    );
  }

  _doComputerMove() {
    if (!this.game || this.game.gameOver) return;

    const move = this.ai.getBestMove(this.game.board);
    if (!move) {
      this._onGameOver(PLAYER);
      return;
    }

    const captured = move.captures || [];
    const path = move.path || [move.to];

    this.board3d.animateMove(
      move.from, move.to, path, captured,
      () => {
        const result = this.game.executeMove(move);

        if (captured.length > 0) this.sounds.playCapture();
        else this.sounds.playMove();

        if (result.promoted) {
          const [tr, tc] = move.to;
          this.board3d.promoteToKing(tr, tc, false);
          this.sounds.playKingPromotion();
        }

        this.isComputerThinking = false;
        this._updatePieceCount();
        this._updateScoreDisplay();

        if (result.gameOver) {
          this._onGameOver(result.winner);
        } else {
          this._updateGameStatus('Your turn — select a piece');
        }
      }
    );
  }

  _showHint() {
    if (!this.game || this.game.gameOver) return;
    if (this.game.currentPlayer !== PLAYER) return;
    const moves = DraughtsGame.getAllMoves(this.game.board, PLAYER);
    if (moves.length === 0) return;

    // Pick a random move to hint
    const hint = moves[Math.floor(Math.random() * moves.length)];
    this.board3d.showHighlights([hint.to], hint.from);
    this._updateGameStatus(`Hint: move from (${hint.from[1] + 1},${8 - hint.from[0]}) to (${hint.to[1] + 1},${8 - hint.to[0]})`);
    setTimeout(() => this.board3d.clearHighlights(), 2000);
  }

  _onGameOver(winner) {
    this.isComputerThinking = false;
    const playerWon = winner === PLAYER;
    this._updateScoreDisplay();

    if (playerWon) {
      this.sounds.playVictory();
    } else {
      this.sounds.playDefeat();
    }

    // Show game over overlay
    const overlay = document.getElementById('screen-gameover');
    const title = document.getElementById('gameover-title');
    const msg = document.getElementById('gameover-msg');
    const icon = document.getElementById('gameover-icon');

    if (playerWon) {
      title.textContent = '🎉 Congratulations!';
      msg.textContent = 'You defeated the computer! You are the Draughts Champion!';
      icon.textContent = '🏆';
      overlay.className = 'gameover-overlay win';
    } else {
      title.textContent = '😔 Game Over';
      msg.textContent = 'The computer wins this round. Try again!';
      icon.textContent = '💻';
      overlay.className = 'gameover-overlay lose';
    }

    // Add confetti for win
    if (playerWon) {
      this._spawnConfetti();
    }

    overlay.classList.add('active');
  }

  _spawnConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#ffd700', '#ff4444', '#44ff88', '#4488ff', '#ff44ff', '#ffffff'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-delay: ${Math.random() * 2}s;
        animation-duration: ${2 + Math.random() * 2}s;
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;
      container.appendChild(el);
    }
  }

  _updateGameStatus(msg) {
    const el = document.getElementById('game-status');
    if (el) el.textContent = msg;
  }

  _updatePieceCount() {
    if (!this.game) return;
    const counts = this.game.getPieceCount();
    const playerEl = document.getElementById('player-pieces');
    const compEl = document.getElementById('computer-pieces');
    if (playerEl) playerEl.textContent = `♟ ${counts.player} (${counts.playerKings}👑)`;
    if (compEl) compEl.textContent = `♟ ${counts.computer} (${counts.computerKings}👑)`;
  }
}

// ──────────────── Crown drawing helper ────────────────
function drawCrown(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#aa8800';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const s = size;
  // Crown base
  ctx.moveTo(x - s, y + s * 0.4);
  ctx.lineTo(x - s, y - s * 0.1);
  ctx.lineTo(x - s * 0.5, y - s * 0.6);
  ctx.lineTo(x, y - s * 0.1);
  ctx.lineTo(x + s * 0.5, y - s * 0.6);
  ctx.lineTo(x + s, y - s * 0.1);
  ctx.lineTo(x + s, y + s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gems
  const gemColors = ['#ff4444', '#44ff88', '#4488ff'];
  [[x - s * 0.5, y - s * 0.62], [x, y - s * 0.12], [x + s * 0.5, y - s * 0.62]].forEach(([gx, gy], i) => {
    ctx.beginPath();
    ctx.arc(gx, gy, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = gemColors[i];
    ctx.fill();
  });
}

// ──────────────── Boot ────────────────
window.addEventListener('DOMContentLoaded', () => {
  window._app = new App();
  window._app.init();
});
