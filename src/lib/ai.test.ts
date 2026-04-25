import { describe, it, expect } from 'vitest';
import { analyze, evaluate } from './ai';
import {
  initialBoard,
  legalMoves,
  applyMove,
  isGameOver,
  opponent,
  idx,
  countEmpty,
  hasMove,
} from './reversi';
import type { Board, Player } from './types';

describe('評価関数', () => {
  it('黒から見た評価値は白から見た値の符号反転', () => {
    const board = applyMove(
      initialBoard(),
      legalMoves(initialBoard(), 'black').find((m) => m.r === 2 && m.c === 3)!,
      'black',
    );
    expect(evaluate(board, 'black')).toBe(-evaluate(board, 'white'));
  });
});

describe('探索', () => {
  it('初手は合法手のひとつを選び、読み筋の先頭と一致する', () => {
    const a = analyze(initialBoard(), 'black', 4);
    expect(a.move).not.toBeNull();
    const legal = new Set(legalMoves(initialBoard(), 'black').map((m) => `${m.r},${m.c}`));
    expect(legal.has(`${a.move!.r},${a.move!.c}`)).toBe(true);
    expect(a.pv.length).toBeGreaterThan(0);
    expect(`${a.pv[0]!.r},${a.pv[0]!.c}`).toBe(`${a.move!.r},${a.move!.c}`);
  });

  it('取れる隅があれば隅を選ぶ', () => {
    const board: Board = new Array(64).fill(null);
    board[idx(2, 0)] = 'black';
    board[idx(1, 0)] = 'white'; // (0,0)へ打つと隅が取れる
    board[idx(1, 2)] = 'black';
    board[idx(1, 3)] = 'white'; // (1,4)へ打つ別の合法手(隅でない)
    const a = analyze(board, 'black', 2);
    expect(a.move).toEqual(expect.objectContaining({ r: 0, c: 0 }));
  });

  it('終盤は浅い指定でも最後まで読み切り、確定した評価値を返す', () => {
    let board = initialBoard();
    let turn: Player = 'black';
    let guard = 0;
    while (countEmpty(board) > 8 && !isGameOver(board) && guard++ < 200) {
      const moves = legalMoves(board, turn);
      if (moves.length === 0) {
        turn = opponent(turn);
        continue;
      }
      const a = analyze(board, turn, 2);
      board = applyMove(board, a.move!, turn);
      turn = opponent(turn);
    }
    if (!isGameOver(board)) {
      const side = hasMove(board, turn) ? turn : opponent(turn);
      const a = analyze(board, side, 1); // 深さ1指定でも終盤は読み切る
      expect(Math.abs(a.score)).toBeGreaterThanOrEqual(100000 - 64);
    }
  });

  it('自己対戦が合法手だけで進み、必ず終局する', () => {
    let board = initialBoard();
    let turn: Player = 'black';
    let guard = 0;
    while (!isGameOver(board) && guard++ < 200) {
      const moves = legalMoves(board, turn);
      if (moves.length === 0) {
        turn = opponent(turn);
        continue;
      }
      const a = analyze(board, turn, 2);
      expect(moves.some((m) => m.r === a.move!.r && m.c === a.move!.c)).toBe(true);
      board = applyMove(board, a.move!, turn);
      turn = opponent(turn);
    }
    expect(isGameOver(board)).toBe(true);
  });
});
