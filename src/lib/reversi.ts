import type { Board, Move, Player } from './types';

export const SIZE = 8;

export function idx(r: number, c: number): number {
  return r * SIZE + c;
}

function inBoard(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function opponent(p: Player): Player {
  return p === 'black' ? 'white' : 'black';
}

const DIRS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** 初期配置。中央4石、黒が先手。 */
export function initialBoard(): Board {
  const b: Board = new Array(SIZE * SIZE).fill(null);
  b[idx(3, 3)] = 'white';
  b[idx(3, 4)] = 'black';
  b[idx(4, 3)] = 'black';
  b[idx(4, 4)] = 'white';
  return b;
}

/** (r,c)へplayerが置いたとき裏返る石の一覧。空なら非合法。 */
export function flipsAt(board: Board, r: number, c: number, player: Player): number[] {
  if (board[idx(r, c)] !== null) return [];
  const foe = opponent(player);
  const flips: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBoard(nr, nc) && board[idx(nr, nc)] === foe) {
      line.push(idx(nr, nc));
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && inBoard(nr, nc) && board[idx(nr, nc)] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

/** playerの合法手をすべて返す。 */
export function legalMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[idx(r, c)] !== null) continue;
      const flips = flipsAt(board, r, c, player);
      if (flips.length > 0) moves.push({ r, c, flips });
    }
  }
  return moves;
}

export function hasMove(board: Board, player: Player): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[idx(r, c)] === null && flipsAt(board, r, c, player).length > 0) return true;
    }
  }
  return false;
}

/** 着手を適用した新しい盤を返す(元は変更しない)。 */
export function applyMove(board: Board, move: Move, player: Player): Board {
  const next = board.slice();
  next[idx(move.r, move.c)] = player;
  for (const f of move.flips) next[f] = player;
  return next;
}

export function isGameOver(board: Board): boolean {
  return !hasMove(board, 'black') && !hasMove(board, 'white');
}

/**
 * playerが着手した後、次に手番を持つ者を返す。
 * 相手に手があれば相手、相手が打てずに自分に手が残ればパスで自分、両者打てなければnull(終局)。
 */
export function nextTurn(board: Board, justMoved: Player): Player | null {
  const foe = opponent(justMoved);
  if (hasMove(board, foe)) return foe;
  if (hasMove(board, justMoved)) return justMoved;
  return null;
}

export function score(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === 'black') black++;
    else if (cell === 'white') white++;
  }
  return { black, white };
}

export function winner(board: Board): Player | 'draw' {
  const s = score(board);
  if (s.black > s.white) return 'black';
  if (s.white > s.black) return 'white';
  return 'draw';
}

export function countEmpty(board: Board): number {
  let n = 0;
  for (const cell of board) if (cell === null) n++;
  return n;
}
