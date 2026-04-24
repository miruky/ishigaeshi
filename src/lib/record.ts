import { SIZE, initialBoard, legalMoves, applyMove, nextTurn } from './reversi';
import type { Board, Move, Player } from './types';

/** マス(r,c)を "d3" の座標表記にする(列=a〜h、行=1〜8)。棋譜表示と共有URLで共通に使う。 */
export function toNotation(r: number, c: number): string {
  return `${String.fromCharCode(97 + c)}${r + 1}`;
}

/** "d3" のような座標表記を (r,c) に戻す。長さ違いや盤外は null。 */
export function fromNotation(s: string): { r: number; c: number } | null {
  if (s.length !== 2) return null;
  const c = s.charCodeAt(0) - 97; // 'a'
  const r = s.charCodeAt(1) - 49; // '1'
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  return { r, c };
}

/** 着手の並びを座標表記の連結("d3c5e6")にする。1手=2文字なので区切り文字は要らない。 */
export function encodeRecord(moves: ReadonlyArray<{ r: number; c: number }>): string {
  return moves.map((m) => toNotation(m.r, m.c)).join('');
}

/** encodeRecord の逆。2文字ずつ区切って (r,c) に戻し、壊れた断片は無視する。 */
export function decodeRecord(s: string): Array<{ r: number; c: number }> {
  const out: Array<{ r: number; c: number }> = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const cell = fromNotation(s.slice(i, i + 2));
    if (cell) out.push(cell);
  }
  return out;
}

export interface ReplayResult {
  /** 初期盤に続けて各着手後の盤。長さは applied + 1。 */
  boards: Board[];
  /** boards と同じ長さ。各盤での手番(終局は null)。 */
  turns: Array<Player | null>;
  /** 実際に適用できた着手と、その時点の手番。 */
  moves: Array<{ move: Move; mover: Player }>;
  /** 記録のうち合法として適用できた手数。 */
  applied: number;
}

/**
 * 黒先手で記録の手を順に再生する。手番側に合法手が無いケースは nextTurn が
 * 既にパスを織り込んでいるため、記録には現れない。非合法な手に当たったら打ち切る。
 */
export function replayRecord(moves: ReadonlyArray<{ r: number; c: number }>): ReplayResult {
  let board = initialBoard();
  let turn: Player | null = 'black';
  const boards: Board[] = [board];
  const turns: Array<Player | null> = [turn];
  const applied: Array<{ move: Move; mover: Player }> = [];
  for (const want of moves) {
    if (turn === null) break;
    const legal = legalMoves(board, turn).find((m) => m.r === want.r && m.c === want.c);
    if (!legal) break;
    const mover = turn;
    board = applyMove(board, legal, mover);
    turn = nextTurn(board, mover);
    boards.push(board);
    turns.push(turn);
    applied.push({ move: legal, mover });
  }
  return { boards, turns, moves: applied, applied: applied.length };
}
