import { describe, it, expect } from 'vitest';
import {
  toNotation,
  fromNotation,
  encodeRecord,
  decodeRecord,
  replayRecord,
} from './record';
import { initialBoard, legalMoves, applyMove, isGameOver, opponent } from './reversi';
import { analyze } from './ai';
import type { Player } from './types';

describe('座標表記', () => {
  it('(r,c)と表記を相互変換する', () => {
    expect(toNotation(0, 0)).toBe('a1');
    expect(toNotation(2, 3)).toBe('d3');
    expect(toNotation(7, 7)).toBe('h8');
    expect(fromNotation('a1')).toEqual({ r: 0, c: 0 });
    expect(fromNotation('d3')).toEqual({ r: 2, c: 3 });
  });

  it('盤外や長さ違いは null を返す', () => {
    expect(fromNotation('i1')).toBeNull();
    expect(fromNotation('a9')).toBeNull();
    expect(fromNotation('d')).toBeNull();
    expect(fromNotation('')).toBeNull();
  });
});

describe('棋譜の符号化', () => {
  it('着手列を符号化して元に戻せる', () => {
    const moves = [
      { r: 2, c: 3 },
      { r: 2, c: 2 },
      { r: 4, c: 5 },
    ];
    const s = encodeRecord(moves);
    expect(s).toBe('d3c3f5');
    expect(decodeRecord(s)).toEqual(moves);
  });

  it('壊れた断片を含む文字列は読める分だけ拾う', () => {
    expect(decodeRecord('d3z9c3')).toEqual([
      { r: 2, c: 3 },
      { r: 2, c: 2 },
    ]);
    expect(decodeRecord('d3x')).toEqual([{ r: 2, c: 3 }]); // 末尾の余りは捨てる
  });
});

describe('棋譜の再生', () => {
  it('空の記録は初期盤だけを返す', () => {
    const r = replayRecord([]);
    expect(r.applied).toBe(0);
    expect(r.boards).toHaveLength(1);
    expect(r.boards[0]).toEqual(initialBoard());
    expect(r.turns).toEqual(['black']);
  });

  it('正しい記録を最後まで適用し、手番も復元する', () => {
    const opening = [
      { r: 2, c: 3 }, // 黒
      { r: 2, c: 2 }, // 白
      { r: 2, c: 1 }, // 黒
    ];
    const r = replayRecord(opening);
    expect(r.applied).toBe(3);
    expect(r.moves.map((m) => m.mover)).toEqual(['black', 'white', 'black']);
    expect(r.turns[r.turns.length - 1]).toBe('white');
  });

  it('非合法な手に当たるとそこで打ち切る', () => {
    const r = replayRecord([
      { r: 2, c: 3 }, // 合法
      { r: 0, c: 0 }, // この局面では非合法
      { r: 4, c: 5 },
    ]);
    expect(r.applied).toBe(1);
  });

  it('自己対戦の棋譜が符号化と再生を一巡しても同じ終局盤になる', () => {
    let board = initialBoard();
    let turn: Player = 'black';
    const played: Array<{ r: number; c: number }> = [];
    let guard = 0;
    while (!isGameOver(board) && guard++ < 200) {
      const moves = legalMoves(board, turn);
      if (moves.length === 0) {
        turn = opponent(turn);
        continue;
      }
      const a = analyze(board, turn, 2);
      played.push({ r: a.move!.r, c: a.move!.c });
      board = applyMove(board, a.move!, turn);
      turn = opponent(turn);
    }
    const replayed = replayRecord(decodeRecord(encodeRecord(played)));
    expect(replayed.applied).toBe(played.length);
    expect(replayed.boards[replayed.boards.length - 1]).toEqual(board);
  });
});
