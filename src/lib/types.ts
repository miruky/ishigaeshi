// リバーシの最小表現。描画から独立させ、ロジックとAIだけで完結させる。

export type Player = 'black' | 'white';

/** マスの状態。石が無ければnull。 */
export type Cell = Player | null;

/** 8x8の盤。idx = r * 8 + c。 */
export type Board = Cell[];

/** 着手。to(r,c)と、その手で返る石のマス番号の一覧。 */
export interface Move {
  r: number;
  c: number;
  /** 裏返る石の盤インデックス。 */
  flips: number[];
}

/** 探索結果。最善手・評価値・読み筋。 */
export interface Analysis {
  move: Move | null;
  /** 手番側から見た評価値(大きいほど有利)。 */
  score: number;
  /** 最善応手の連なり(読み筋)。 */
  pv: Move[];
}
