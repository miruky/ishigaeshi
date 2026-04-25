import { applyMove, countEmpty, idx, isGameOver, legalMoves, opponent, score } from './reversi';
import type { Analysis, Board, Move, Player } from './types';

// マスの価値。隅は高く、隅の隣(X・C)は低い。角を取り、悪マスを避ける指針になる。
// prettier-ignore
const WEIGHTS: readonly number[] = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
   20,  -5, 15,  3,  3, 15,  -5,  20,
    5,  -5,  3,  3,  3,  3,  -5,   5,
    5,  -5,  3,  3,  3,  3,  -5,   5,
   20,  -5, 15,  3,  3, 15,  -5,  20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

/**
 * playerから見た評価値。盤の配置価値、着手可能数(機動力)、石差を、
 * 終盤ほど石差を重く見るように合成する。乱数は使わない。
 */
export function evaluate(board: Board, player: Player): number {
  const foe = opponent(player);
  let positional = 0;
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (cell === player) {
      positional += WEIGHTS[i]!;
      mine++;
    } else if (cell === foe) {
      positional -= WEIGHTS[i]!;
      theirs++;
    }
  }
  const mobility = legalMoves(board, player).length - legalMoves(board, foe).length;
  const discDiff = mine - theirs;
  const discWeight = countEmpty(board) <= 14 ? 18 : 1;
  return positional + 12 * mobility + discWeight * discDiff;
}

function terminalScore(board: Board, player: Player): number {
  const s = score(board);
  const diff = player === 'black' ? s.black - s.white : s.white - s.black;
  return 100000 * Math.sign(diff) + diff;
}

interface SearchResult {
  score: number;
  pv: Move[];
}

function search(
  board: Board,
  player: Player,
  depth: number,
  alpha: number,
  beta: number,
): SearchResult {
  if (isGameOver(board)) return { score: terminalScore(board, player), pv: [] };
  if (depth <= 0) return { score: evaluate(board, player), pv: [] };

  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    // 手が無ければパス。相手の手番で読み進める。
    const r = search(board, opponent(player), depth - 1, -beta, -alpha);
    return { score: -r.score, pv: r.pv };
  }

  // 良マスから調べると枝刈りが効きやすい。
  moves.sort((a, b) => WEIGHTS[idx(b.r, b.c)]! - WEIGHTS[idx(a.r, a.c)]!);

  let best = -Infinity;
  let bestPv: Move[] = [];
  let a = alpha;
  for (const m of moves) {
    const r = search(applyMove(board, m, player), opponent(player), depth - 1, -beta, -a);
    const s = -r.score;
    if (s > best) {
      best = s;
      bestPv = [m, ...r.pv];
    }
    if (s > a) a = s;
    if (a >= beta) break;
  }
  return { score: best, pv: bestPv };
}

/** この数以下の空きマスになったら、固定深さに関わらず最後まで読み切る。 */
const ENDGAME_EXACT = 10;

/**
 * playerにとっての最善手・評価値・読み筋を返す。
 * 終盤(空きが ENDGAME_EXACT 以下)では深さを空きマス数まで伸ばし、勝敗を読み切る。
 */
export function analyze(board: Board, player: Player, depth: number): Analysis {
  const empties = countEmpty(board);
  const effective = empties <= ENDGAME_EXACT ? Math.max(depth, empties) : depth;
  const r = search(board, player, effective, -Infinity, Infinity);
  return { move: r.pv[0] ?? null, score: r.score, pv: r.pv };
}
