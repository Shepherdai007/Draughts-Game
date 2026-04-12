/**
 * ai.js - Computer AI for Draughts
 * Easy mode: random moves with capture preference
 * Hard mode: minimax with alpha-beta pruning (depth 6)
 */

class DraughtsAI {
  constructor(difficulty = 'easy') {
    this.difficulty = difficulty;
    this.maxDepth = difficulty === 'easy' ? 2 : 6;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.maxDepth = difficulty === 'easy' ? 2 : 6;
  }

  /**
   * Returns the best move for the computer player.
   * @param {number[][]} board
   * @returns {object|null} move object
   */
  getBestMove(board) {
    const moves = DraughtsGame.getAllMoves(board, COMPUTER);
    if (moves.length === 0) return null;

    if (this.difficulty === 'easy') {
      return this._getEasyMove(board, moves);
    }
    return this._getHardMove(board, moves);
  }

  _getEasyMove(board, moves) {
    // Prefer captures, otherwise random
    const captures = moves.filter(m => m.captures.length > 0);
    const pool = (captures.length > 0 && Math.random() > 0.15) ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _getHardMove(board, moves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
      const newBoard = DraughtsGame.applyMove(board, move);
      const score = this._minimax(newBoard, this.maxDepth - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    // Among equal-score moves, pick randomly for variety
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  _minimax(board, depth, alpha, beta, isMaximizing) {
    const player = isMaximizing ? COMPUTER : PLAYER;
    const moves = DraughtsGame.getAllMoves(board, player);

    if (depth === 0 || moves.length === 0) {
      return this._evaluate(board, moves, isMaximizing);
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const newBoard = DraughtsGame.applyMove(board, move);
        const score = this._minimax(newBoard, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const newBoard = DraughtsGame.applyMove(board, move);
        const score = this._minimax(newBoard, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Evaluation function: positive = good for computer, negative = good for player
   */
  _evaluate(board, moves, isMaximizing) {
    // If no moves available
    if (moves.length === 0) {
      return isMaximizing ? -1000 : 1000;
    }

    let score = 0;

    // Piece value table: center is more valuable
    const posValue = [
      [0, 4, 0, 4, 0, 4, 0, 4],
      [4, 0, 3, 0, 3, 0, 3, 0],
      [0, 3, 0, 2, 0, 2, 0, 3],
      [4, 0, 2, 0, 2, 0, 2, 0],
      [0, 4, 0, 2, 0, 2, 0, 4],
      [4, 0, 3, 0, 2, 0, 3, 0],
      [0, 3, 0, 3, 0, 3, 0, 3],
      [4, 0, 4, 0, 4, 0, 4, 0],
    ];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        const pos = posValue[r][c];
        if (p === COMPUTER) {
          score += 10 + pos + (7 - r); // advance bonus
        } else if (p === COMPUTER_KING) {
          score += 22 + pos;
        } else if (p === PLAYER) {
          score -= 10 + pos + r;       // advance bonus (player goes up)
        } else if (p === PLAYER_KING) {
          score -= 22 + pos;
        }
      }
    }

    return score;
  }
}
