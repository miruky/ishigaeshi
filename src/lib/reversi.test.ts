import { describe, it, expect } from 'vitest';
import {
  SIZE,
  idx,
  initialBoard,
  legalMoves,
  applyMove,
  hasMove,
  nextTurn,
  isGameOver,
  score,
  winner,
} from './reversi';
import type { Board } from './types';

function moveSet(board: Board, player: 'black' | 'white'): Set<string> {
  return new Set(legalMoves(board, player).map((m) => `${m.r},${m.c}`));
}

describe('リバーシのルール', () => {
  it('初期局面の黒の合法手は4つ', () => {
    expect(moveSet(initialBoard(), 'black')).toEqual(new Set(['2,3', '3,2', '4,5', '5,4']));
  });

  it('初期局面の白の合法手は4つ(対称)', () => {
    expect(moveSet(initialBoard(), 'white')).toEqual(new Set(['2,4', '4,2', '3,5', '5,3']));
  });

  it('着手すると挟んだ石が返る', () => {
    const board = initialBoard();
    const move = legalMoves(board, 'black').find((m) => m.r === 2 && m.c === 3)!;
    const next = applyMove(board, move, 'black');
    expect(next[idx(2, 3)]).toBe('black');
    expect(next[idx(3, 3)]).toBe('black'); // 返った白石
    const s = score(next);
    expect(s).toEqual({ black: 4, white: 1 });
  });

  it('着手後は相手に手番が移る', () => {
    const board = initialBoard();
    const move = legalMoves(board, 'black')[0]!;
    const next = applyMove(board, move, 'black');
    expect(nextTurn(next, 'black')).toBe('white');
  });

  it('相手が打てない場合はパスして手番が戻る', () => {
    // ほぼ黒で埋め、空きは(0,0)のみ。黒は(0,0)に打てるが白は打てない。
    const board: Board = new Array(SIZE * SIZE).fill('black');
    board[idx(0, 0)] = null;
    board[idx(1, 0)] = 'white';
    board[idx(1, 1)] = 'white';
    expect(hasMove(board, 'black')).toBe(true);
    expect(hasMove(board, 'white')).toBe(false);
    expect(nextTurn(board, 'black')).toBe('black'); // 白はパス
    expect(isGameOver(board)).toBe(false);
  });

  it('両者打てなければ終局し、石数で勝者が決まる', () => {
    const board: Board = new Array(SIZE * SIZE).fill('black');
    board[idx(0, 0)] = 'white';
    expect(isGameOver(board)).toBe(true);
    expect(score(board)).toEqual({ black: 63, white: 1 });
    expect(winner(board)).toBe('black');
  });
});
