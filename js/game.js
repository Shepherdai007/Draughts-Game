/**
 * game.js - Draughts (Checkers) Game Engine
 * Implements all standard English draughts rules:
 * - 8x8 board, dark squares only
 * - Men move forward diagonally, kings move all directions
 * - Mandatory capture rule
 * - Chain (multi-jump) captures
 * - King promotion
 */

const EMPTY = 0;
const PLAYER = 1;
const PLAYER_KING = 2;
const COMPUTER = -1;
const COMPUTER_KING = -2;

class DraughtsGame {
  constructor() {
    this.board = DraughtsGame.createInitialBoard();
    this.currentPlayer = PLAYER;
    this.gameOver = false;
    this.winner = null;
    this.moveHistory = [];
    this.scores = { player: 0, computer: 0 };
    this.loadScores();
  }

  static createInitialBoard() {
    const board = Array.from({ length: 8 }, () => new Array(8).fill(EMPTY));
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) board[row][col] = COMPUTER;
      }
    }
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) board[row][col] = PLAYER;
      }
    }
    return board;
  }

  static cloneBoard(board) {
    return board.map(row => row.slice());
  }

  static inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  static isPlayerPiece(piece) {
    return piece === PLAYER || piece === PLAYER_KING;
  }

  static isComputerPiece(piece) {
    return piece === COMPUTER || piece === COMPUTER_KING;
  }

  static isKing(piece) {
    return piece === PLAYER_KING || piece === COMPUTER_KING;
  }

  static getDirections(piece) {
    if (piece === PLAYER) return [[-1, -1], [-1, 1]];          // upward
    if (piece === COMPUTER) return [[1, -1], [1, 1]];          // downward
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];              // kings: all
  }

  /**
   * Get all normal (non-capture) moves for a piece at (row, col)
   */
  static getNormalMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];
    const moves = [];
    for (const [dr, dc] of DraughtsGame.getDirections(piece)) {
      const nr = row + dr, nc = col + dc;
      if (DraughtsGame.inBounds(nr, nc) && board[nr][nc] === EMPTY) {
        moves.push({ from: [row, col], to: [nr, nc], captures: [], path: [[nr, nc]] });
      }
    }
    return moves;
  }

  /**
   * Get all capture moves (with chains) for a piece at (row, col).
   * Returns an array of complete multi-jump sequences.
   */
  static getCaptureMoves(board, row, col, visited = new Set()) {
    const piece = board[row][col];
    if (!piece) return [];
    const results = [];

    for (const [dr, dc] of DraughtsGame.getDirections(piece)) {
      const mr = row + dr, mc = col + dc;   // middle (captured) square
      const nr = row + 2 * dr, nc = col + 2 * dc; // landing square

      if (!DraughtsGame.inBounds(nr, nc)) continue;
      if (board[nr][nc] !== EMPTY) continue;
      if (visited.has(`${mr},${mc}`)) continue;

      const mid = board[mr][mc];
      if (!mid) continue;
      const opponent =
        (DraughtsGame.isPlayerPiece(piece) && DraughtsGame.isComputerPiece(mid)) ||
        (DraughtsGame.isComputerPiece(piece) && DraughtsGame.isPlayerPiece(mid));
      if (!opponent) continue;

      // Simulate jump
      const tmpBoard = DraughtsGame.cloneBoard(board);
      tmpBoard[nr][nc] = tmpBoard[row][col];
      tmpBoard[row][col] = EMPTY;
      tmpBoard[mr][mc] = EMPTY;
      // Promote mid-jump if landed on back row (stays king for rest of chain)
      if (tmpBoard[nr][nc] === PLAYER && nr === 0) tmpBoard[nr][nc] = PLAYER_KING;
      if (tmpBoard[nr][nc] === COMPUTER && nr === 7) tmpBoard[nr][nc] = COMPUTER_KING;

      const newVisited = new Set(visited);
      newVisited.add(`${mr},${mc}`);

      const continuations = DraughtsGame.getCaptureMoves(tmpBoard, nr, nc, newVisited);
      if (continuations.length > 0) {
        for (const cont of continuations) {
          results.push({
            from: [row, col],
            to: cont.to,
            captures: [[mr, mc], ...cont.captures],
            path: [[nr, nc], ...cont.path],
          });
        }
      } else {
        results.push({
          from: [row, col],
          to: [nr, nc],
          captures: [[mr, mc]],
          path: [[nr, nc]],
        });
      }
    }
    return results;
  }

  /**
   * Get ALL legal moves for the given side.
   * Mandatory capture: if any capture exists, only captures are returned.
   */
  static getAllMoves(board, player) {
    const isP = player === PLAYER;
    let captures = [], normals = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        if (isP && !DraughtsGame.isPlayerPiece(piece)) continue;
        if (!isP && !DraughtsGame.isComputerPiece(piece)) continue;
        captures.push(...DraughtsGame.getCaptureMoves(board, r, c));
        normals.push(...DraughtsGame.getNormalMoves(board, r, c));
      }
    }
    return captures.length > 0 ? captures : normals;
  }

  /**
   * Apply a move to a board (immutably) and return the new board.
   */
  static applyMove(board, move) {
    const b = DraughtsGame.cloneBoard(board);
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    b[tr][tc] = b[fr][fc];
    b[fr][fc] = EMPTY;
    for (const [cr, cc] of (move.captures || [])) {
      b[cr][cc] = EMPTY;
    }
    // Promotion
    if (b[tr][tc] === PLAYER && tr === 0) b[tr][tc] = PLAYER_KING;
    if (b[tr][tc] === COMPUTER && tr === 7) b[tr][tc] = COMPUTER_KING;
    return b;
  }

  /**
   * Execute a move in the game state.
   * Returns metadata: captured pieces, promotion, gameOver.
   */
  executeMove(move) {
    const prevBoard = this.board;
    this.board = DraughtsGame.applyMove(this.board, move);
    this.moveHistory.push({ move, board: prevBoard });

    const [tr, tc] = move.to;
    const promoted = (prevBoard[move.from[0]][move.from[1]] !== PLAYER_KING &&
                      prevBoard[move.from[0]][move.from[1]] !== COMPUTER_KING) &&
                     (this.board[tr][tc] === PLAYER_KING || this.board[tr][tc] === COMPUTER_KING);

    // Switch turn before checking game over so check uses next player's perspective
    this.currentPlayer = this.currentPlayer === PLAYER ? COMPUTER : PLAYER;
    this.checkGameOver();

    return {
      captured: move.captures || [],
      promoted,
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }

  checkGameOver() {
    let playerPieces = 0, computerPieces = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (DraughtsGame.isPlayerPiece(this.board[r][c])) playerPieces++;
        if (DraughtsGame.isComputerPiece(this.board[r][c])) computerPieces++;
      }
    }
    if (playerPieces === 0) {
      this._setWinner(COMPUTER);
      return;
    }
    if (computerPieces === 0) {
      this._setWinner(PLAYER);
      return;
    }
    // Check if current player has any legal move
    const moves = DraughtsGame.getAllMoves(this.board, this.currentPlayer);
    if (moves.length === 0) {
      const winner = this.currentPlayer === PLAYER ? COMPUTER : PLAYER;
      this._setWinner(winner);
    }
  }

  _setWinner(winner) {
    this.gameOver = true;
    this.winner = winner;
    if (winner === PLAYER) this.scores.player++;
    else this.scores.computer++;
    this.saveScores();
  }

  /**
   * Get legal moves for the current player from a specific piece (for UI highlighting).
   */
  getMovesForPiece(row, col) {
    const allMoves = DraughtsGame.getAllMoves(this.board, this.currentPlayer);
    return allMoves.filter(m => m.from[0] === row && m.from[1] === col);
  }

  getPieceCount() {
    let player = 0, computer = 0, playerKings = 0, computerKings = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p === PLAYER) player++;
        else if (p === PLAYER_KING) { player++; playerKings++; }
        else if (p === COMPUTER) computer++;
        else if (p === COMPUTER_KING) { computer++; computerKings++; }
      }
    }
    return { player, computer, playerKings, computerKings };
  }

  resetGame() {
    this.board = DraughtsGame.createInitialBoard();
    this.currentPlayer = PLAYER;
    this.gameOver = false;
    this.winner = null;
    this.moveHistory = [];
  }

  loadScores() {
    try {
      const saved = localStorage.getItem('kingsmakers_scores');
      if (saved) {
        const s = JSON.parse(saved);
        this.scores.player = s.player || 0;
        this.scores.computer = s.computer || 0;
      }
    } catch (e) {}
  }

  saveScores() {
    try {
      localStorage.setItem('kingsmakers_scores', JSON.stringify(this.scores));
    } catch (e) {}
  }

  resetScores() {
    this.scores = { player: 0, computer: 0 };
    this.saveScores();
  }
}
