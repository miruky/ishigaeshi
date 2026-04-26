import './style.css';
import {
  SIZE,
  idx,
  opponent,
  initialBoard,
  legalMoves,
  hasMove,
  applyMove,
  isGameOver,
  nextTurn,
  score,
  winner,
  analyze,
  evaluate,
  toNotation,
  encodeRecord,
  decodeRecord,
  replayRecord,
} from './lib';
import type { Analysis, Board, Move, Player } from './lib';

const CELL = 46;
const PAD = 16;
const VB = PAD + SIZE * CELL + PAD;
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PLAYER_JA: Record<Player, string> = { black: '黒', white: '白' };
const STONE: Record<Player, string> = { black: '●', white: '○' };

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 保存できなくても続行 */
    }
  },
};

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function cellCenter(r: number, c: number): { x: number; y: number } {
  return { x: PAD + c * CELL + CELL / 2, y: PAD + r * CELL + CELL / 2 };
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`要素が見つからない: ${id}`);
  return node as T;
}

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" role="img" aria-labelledby="logo-title">
  <title id="logo-title">ishigaeshi</title>
  <rect x="7" y="7" width="50" height="50" rx="11" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <circle cx="24" cy="24" r="9" fill="currentColor"/>
  <circle cx="40" cy="40" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <path d="M30 34 L34 30 M34 34 L30 30" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
</svg>`;

function shell(): string {
  return `
<header class="masthead reveal">
  <div class="brand">
    ${LOGO}
    <div>
      <div class="wordmark">ishigaeshi</div>
      <div class="tagline">AIの評価と読み筋を映すリバーシ盤</div>
    </div>
  </div>
  <div class="masthead__tools">
    <button id="share" class="btn" type="button">URLを共有</button>
    <button id="theme" class="btn" type="button">テーマ: 自動</button>
  </div>
</header>

<main class="layout">
  <section class="stage reveal d1">
    <div>
      <span class="kicker" style="margin-bottom:12px">対局盤</span>
      <svg id="board" viewBox="0 0 ${VB} ${VB}" role="application" tabindex="0"
        aria-label="リバーシ盤。矢印キーでマスを選びEnterで石を置く。空きマスのクリックでも置ける"></svg>
    </div>

    <div class="scoreline">
      <div class="score black active" id="sb-black">
        <span class="chip black"></span>
        <span class="num" id="n-black">2</span>
        <span class="turn-flag">手番</span>
      </div>
      <span class="vs">対</span>
      <div class="score white" id="sb-white">
        <span class="turn-flag">手番</span>
        <span class="num" id="n-white">2</span>
        <span class="chip white"></span>
      </div>
      <div class="ratio"><span class="b" id="bar-b"></span><span class="w" id="bar-w"></span></div>
    </div>
    <p class="status" id="status" aria-live="polite"></p>

    <div class="block">
      <span class="kicker">形勢の推移</span>
      <svg id="evalgraph" class="evalgraph" viewBox="0 0 460 92" role="img"
        aria-label="黒から見た形勢の推移グラフ"></svg>
    </div>
  </section>

  <aside class="analysis reveal d2">
    <div class="block">
      <span class="kicker">評価</span>
      <div class="eval-figure" id="eval-val">--</div>
      <div class="eval-note" id="eval-note"></div>
      <div class="pv" id="pvline"></div>
    </div>

    <div class="block">
      <span class="kicker">設定</span>
      <div class="controls">
        <div class="field">
          <label for="color">あなたの石</label>
          <select id="color">
            <option value="black">黒(先手)</option>
            <option value="white">白(後手)</option>
          </select>
        </div>
        <div class="field">
          <label for="level">AIの強さ</label>
          <select id="level">
            <option value="2">やさしい</option>
            <option value="4">ふつう</option>
            <option value="6">つよい</option>
          </select>
        </div>
        <div class="field">
          <label class="toggle" for="show-read"><input type="checkbox" id="show-read" /> 読み筋を盤に表示</label>
        </div>
        <div class="field">
          <label class="toggle" for="watch"><input type="checkbox" id="watch" /> AI同士の対戦を観る</label>
        </div>
        <div class="btn-row">
          <button id="undo" class="btn" type="button">待った</button>
          <button id="redo" class="btn" type="button">進む</button>
          <button id="hint" class="btn" type="button">ヒント</button>
          <button id="newgame" class="btn btn--primary" type="button">新規対局</button>
        </div>
      </div>
    </div>

    <div class="block">
      <div class="kifu-head">
        <span class="kicker">棋譜</span>
        <span class="ply-count" id="ply-count"></span>
      </div>
      <ol class="kifu" id="kifu"></ol>
      <div class="review-tag" id="review-tag">
        <span id="review-label">検討中</span>
        <button class="btn" id="to-live" type="button">対局へ戻る</button>
      </div>
      <button id="copy-kifu" class="btn block-btn" type="button">棋譜をコピー</button>
    </div>
  </aside>
</main>

<footer class="site-footer reveal d3">
  <span>ヒントをクリック、または矢印キー+Enterで着手。u=待った r=進む h=ヒント n=新規。</span>
  <a href="https://github.com/miruky/ishigaeshi">ソースコード</a>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

interface Ply {
  move: Move;
  mover: Player;
}

function formatEval(blackScore: number): { fig: string; note: string } {
  if (Math.abs(blackScore) >= 100000) {
    return { fig: blackScore > 0 ? '黒 勝勢' : '白 勝勢', note: '決着が見えている' };
  }
  const fig = `${blackScore > 0 ? '+' : ''}${blackScore}`;
  const note = blackScore > 0 ? '黒が有利' : blackScore < 0 ? '白が有利' : '互角';
  return { fig, note };
}

class Game {
  private board: Board = initialBoard();
  private turn: Player = 'black';
  private human: Player = 'black';
  private depth = 4;
  private showRead = true;
  private watch = false;
  private over = false;
  private thinking = false;
  private lastMove: Move | null = null;
  private changed = new Set<number>();
  private placed: number | null = null;
  private analysis: Analysis | null = null;
  private analysisColor: Player = 'black';

  // 棋譜と各局面。positions[i] は record の i 手目までを適用した盤。
  private record: Ply[] = [];
  private positions: Board[] = [initialBoard()];
  private turnsAt: Array<Player | null> = ['black'];
  private evalLog: number[] = [0];
  private redo: Ply[] = [];

  private reviewIndex: number | null = null; // null=対局中、数値=その局面を検討表示
  private kb: { r: number; c: number } | null = null;
  private bestFlash: Move | null = null;
  private toastTimer = 0;
  private numShown: Record<string, number> = { 'n-black': 2, 'n-white': 2 };
  private numRaf: Record<string, number> = {};

  private boardEl = el<HTMLElement>('board') as unknown as SVGSVGElement;
  private bg = svg('g');
  private discLayer = svg('g');
  private overlay = svg('g');

  constructor() {
    this.buildStatic();
    this.boardEl.append(this.bg, this.discLayer, this.overlay);
    this.loadSettings();
    this.bind();
    const shared = this.sharedRecord();
    if (shared && shared.length > 0) this.newGame(shared);
    else this.newGame();
  }

  // --- 設定の永続化 ----------------------------------------------------------

  private loadSettings(): void {
    const color = store.get('ishi-color');
    if (color === 'black' || color === 'white') this.human = color;
    const level = Number(store.get('ishi-level'));
    if ([2, 4, 6].includes(level)) this.depth = level;
    const read = store.get('ishi-read');
    if (read === '0') this.showRead = false;
    el<HTMLSelectElement>('color').value = this.human;
    el<HTMLSelectElement>('level').value = String(this.depth);
    el<HTMLInputElement>('show-read').checked = this.showRead;
  }

  private sharedRecord(): Array<{ r: number; c: number }> | null {
    try {
      const g = new URLSearchParams(location.search).get('g');
      if (!g) return null;
      const coords = decodeRecord(g);
      return coords.length > 0 ? coords : null;
    } catch {
      return null;
    }
  }

  // --- 盤の静的部分 ----------------------------------------------------------

  private buildStatic(): void {
    const grad = (id: string, r: string, c0: string, c1: string): SVGRadialGradientElement => {
      const g = svg('radialGradient', { id, cx: '36%', cy: '32%', r });
      g.append(svg('stop', { offset: '0%', class: c0 }), svg('stop', { offset: '100%', class: c1 }));
      return g;
    };
    const defs = svg('defs');
    defs.append(grad('grad-black', '72%', 'g-b0', 'g-b1'), grad('grad-white', '74%', 'g-w0', 'g-w1'));
    this.bg.appendChild(defs);

    this.bg.appendChild(
      svg('rect', { class: 'felt', x: PAD, y: PAD, width: SIZE * CELL, height: SIZE * CELL, rx: 3 }),
    );
    for (let i = 0; i <= SIZE; i++) {
      this.bg.appendChild(
        svg('line', {
          class: 'felt-line',
          x1: PAD + i * CELL,
          y1: PAD,
          x2: PAD + i * CELL,
          y2: PAD + SIZE * CELL,
        }),
      );
      this.bg.appendChild(
        svg('line', {
          class: 'felt-line',
          x1: PAD,
          y1: PAD + i * CELL,
          x2: PAD + SIZE * CELL,
          y2: PAD + i * CELL,
        }),
      );
    }
    this.bg.appendChild(
      svg('rect', { class: 'felt-edge', x: PAD, y: PAD, width: SIZE * CELL, height: SIZE * CELL, rx: 3 }),
    );
    for (const [r, c] of [
      [2, 2],
      [2, 6],
      [6, 2],
      [6, 6],
    ] as const) {
      this.bg.appendChild(
        svg('circle', { class: 'felt-dot', cx: PAD + c * CELL, cy: PAD + r * CELL, r: 2.4 }),
      );
    }
    for (let c = 0; c < SIZE; c++) {
      const t = svg('text', { class: 'coord', x: PAD + c * CELL + CELL / 2, y: PAD - 5 });
      t.textContent = String.fromCharCode(97 + c);
      this.bg.appendChild(t);
    }
    for (let r = 0; r < SIZE; r++) {
      const t = svg('text', { class: 'coord', x: PAD - 7, y: PAD + r * CELL + CELL / 2 + 3 });
      t.textContent = String(r + 1);
      this.bg.appendChild(t);
    }
  }

  // --- 局面の管理 ------------------------------------------------------------

  private newGame(coords?: Array<{ r: number; c: number }>): void {
    this.board = initialBoard();
    this.turn = 'black';
    this.over = false;
    this.thinking = false;
    this.lastMove = null;
    this.placed = null;
    this.changed.clear();
    this.analysis = null;
    this.record = [];
    this.positions = [initialBoard()];
    this.turnsAt = ['black'];
    this.evalLog = [0];
    this.redo = [];
    this.reviewIndex = null;
    this.kb = null;
    this.bestFlash = null;

    if (coords && coords.length > 0) {
      const replay = replayRecord(coords);
      this.positions = replay.boards;
      this.turnsAt = replay.turns;
      this.record = replay.moves.map((m) => ({ move: m.move, mover: m.mover }));
      this.evalLog = replay.boards.map((b) => evaluate(b, 'black'));
      this.board = replay.boards[replay.boards.length - 1]!;
      this.turn = (this.turnsAt[this.turnsAt.length - 1] ?? this.turn) as Player;
      this.over = this.turnsAt[this.turnsAt.length - 1] === null;
      const last = this.record[this.record.length - 1];
      if (last) {
        this.lastMove = last.move;
        this.changed = new Set([idx(last.move.r, last.move.c), ...last.move.flips]);
      }
    }

    this.syncUrl();
    this.render();
    this.step();
  }

  private step(): void {
    if (this.over || this.reviewIndex !== null) return;
    if (isGameOver(this.board)) {
      this.over = true;
      this.render();
      return;
    }
    if (!hasMove(this.board, this.turn)) {
      this.setStatus(`${PLAYER_JA[this.turn]}は打てる手がなくパス`);
      this.turn = opponent(this.turn);
      window.setTimeout(() => this.step(), reduceMotion ? 0 : 480);
      return;
    }
    if (!this.watch && this.turn === this.human) {
      if (this.showRead) this.computeAnalysis(this.human);
      this.render();
      return;
    }
    this.thinking = true;
    const who = this.watch ? `${PLAYER_JA[this.turn]}` : `${PLAYER_JA[this.turn]}(AI)`;
    this.setStatus(`${who}が読んでいます`);
    this.render();
    window.setTimeout(
      () => {
        if (this.reviewIndex !== null) {
          this.thinking = false;
          return;
        }
        // 思考中に観戦モードを切ったなら、その手は指さず人間に戻す。
        if (!this.watch && this.turn === this.human) {
          this.thinking = false;
          this.render();
          return;
        }
        const a = analyze(this.board, this.turn, this.depth);
        this.analysis = a;
        this.analysisColor = this.turn;
        if (a.move) this.commit(a.move, this.turn);
        this.thinking = false;
        this.render();
        window.setTimeout(() => this.step(), reduceMotion ? 0 : 320);
      },
      reduceMotion ? 0 : 340,
    );
  }

  private commit(move: Move, mover: Player, clearRedo = true): void {
    this.board = applyMove(this.board, move, mover);
    this.lastMove = move;
    this.placed = idx(move.r, move.c);
    this.changed = new Set([idx(move.r, move.c), ...move.flips]);
    this.record.push({ move, mover });
    this.positions.push(this.board);
    this.evalLog.push(evaluate(this.board, 'black'));
    const nt = nextTurn(this.board, mover);
    this.turnsAt.push(nt);
    if (nt === null) this.over = true;
    else this.turn = nt;
    if (clearRedo) this.redo = [];
    this.bestFlash = null;
    this.syncUrl();
  }

  private onHumanMove(move: Move): void {
    if (this.watch || this.thinking || this.over || this.turn !== this.human || this.reviewIndex !== null)
      return;
    this.commit(move, this.human);
    this.analysis = null;
    this.kb = { r: move.r, c: move.c };
    this.render();
    window.setTimeout(() => this.step(), reduceMotion ? 0 : 180);
  }

  private computeAnalysis(color: Player): void {
    this.analysis = analyze(this.board, color, this.depth);
    this.analysisColor = color;
  }

  private undo(): void {
    if (this.thinking) return;
    this.reviewIndex = null;
    let poppedHuman = false;
    while (this.record.length > 0) {
      const popped = this.record.pop()!;
      this.positions.pop();
      this.turnsAt.pop();
      this.evalLog.pop();
      this.redo.unshift(popped);
      if (popped.mover === this.human) poppedHuman = true;
      const turnNow = this.turnsAt[this.turnsAt.length - 1];
      if (poppedHuman && turnNow === this.human) break;
    }
    this.restoreLive();
    this.render();
    this.step();
  }

  private redoMoves(): void {
    if (this.thinking || this.redo.length === 0) return;
    this.reviewIndex = null;
    const seq = this.redo.slice();
    this.redo = [];
    for (const ply of seq) {
      const legal = legalMoves(this.board, ply.mover).find(
        (m) => m.r === ply.move.r && m.c === ply.move.c,
      );
      if (!legal || this.turn !== ply.mover || this.over) break;
      this.commit(legal, ply.mover, false);
    }
    this.analysis = null;
    this.render();
    this.step();
  }

  private restoreLive(): void {
    this.board = this.positions[this.positions.length - 1]!;
    const t = this.turnsAt[this.turnsAt.length - 1];
    this.over = t === null;
    if (t) this.turn = t;
    const last = this.record[this.record.length - 1];
    this.lastMove = last ? last.move : null;
    this.placed = null;
    this.changed.clear();
    this.analysis = null;
    this.bestFlash = null;
  }

  private hint(): void {
    if (this.over || this.thinking || this.reviewIndex !== null) return;
    if (this.turn !== this.human || !hasMove(this.board, this.human)) return;
    const a = analyze(this.board, this.human, Math.max(this.depth, 4));
    this.analysis = a;
    this.analysisColor = this.human;
    this.bestFlash = a.move;
    if (a.move) this.kb = { r: a.move.r, c: a.move.c };
    this.render();
  }

  // --- 検討(棋譜ジャンプ) --------------------------------------------------

  private review(index: number): void {
    if (index < 0 || index >= this.positions.length) return;
    this.reviewIndex = index === this.positions.length - 1 ? null : index;
    this.render();
    try {
      this.boardEl.focus();
    } catch {
      /* フォーカスできなくても表示は更新済み */
    }
  }

  private toLive(): void {
    this.reviewIndex = null;
    this.render();
  }

  private displayBoard(): Board {
    return this.reviewIndex === null ? this.board : this.positions[this.reviewIndex]!;
  }

  // --- 描画 ------------------------------------------------------------------

  private render(): void {
    this.renderDiscs();
    this.renderOverlay();
    this.renderSide();
    this.renderEvalGraph();
    this.renderKifu();
  }

  private renderDiscs(): void {
    this.discLayer.replaceChildren();
    const board = this.displayBoard();
    const live = this.reviewIndex === null;
    const rad = CELL * 0.4;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = board[idx(r, c)];
        if (!cell) continue;
        const { x, y } = cellCenter(r, c);
        let cls = `disc ${cell}`;
        if (live && !reduceMotion) {
          if (this.placed === idx(r, c)) cls += ' place';
          else if (this.changed.has(idx(r, c))) cls += ' flip';
        }
        this.discLayer.appendChild(svg('circle', { class: cls, cx: x, cy: y, r: rad }));
      }
    }
  }

  private renderOverlay(): void {
    this.overlay.replaceChildren();
    const live = this.reviewIndex === null;

    if (this.lastMove && live) {
      const { x, y } = cellCenter(this.lastMove.r, this.lastMove.c);
      this.overlay.appendChild(
        svg('rect', {
          class: 'last-ring',
          x: x - CELL * 0.46,
          y: y - CELL * 0.46,
          width: CELL * 0.92,
          height: CELL * 0.92,
          rx: 4,
        }),
      );
    }

    if (live && !this.watch && !this.over && !this.thinking && this.turn === this.human) {
      for (const m of legalMoves(this.board, this.human)) {
        const { x, y } = cellCenter(m.r, m.c);
        const dot = svg('circle', { class: 'hint', cx: x, cy: y, r: CELL * 0.15 });
        dot.addEventListener('click', () => this.onHumanMove(m));
        this.overlay.appendChild(dot);
      }
    }

    if (this.bestFlash && live) {
      const { x, y } = cellCenter(this.bestFlash.r, this.bestFlash.c);
      this.overlay.appendChild(
        svg('rect', {
          class: 'best-ring',
          x: x - CELL * 0.44,
          y: y - CELL * 0.44,
          width: CELL * 0.88,
          height: CELL * 0.88,
          rx: 4,
        }),
      );
    }

    if (this.kb && live && !this.watch && !this.over && this.turn === this.human) {
      const { x, y } = cellCenter(this.kb.r, this.kb.c);
      this.overlay.appendChild(
        svg('rect', {
          class: 'kb-cursor',
          x: x - CELL * 0.47,
          y: y - CELL * 0.47,
          width: CELL * 0.94,
          height: CELL * 0.94,
          rx: 4,
        }),
      );
    }

    if (this.showRead && live && this.analysis && this.analysis.pv.length > 0) {
      this.analysis.pv.slice(0, 5).forEach((m, i) => {
        const { x, y } = cellCenter(m.r, m.c);
        this.overlay.appendChild(svg('circle', { class: 'pv-ghost', cx: x, cy: y, r: CELL * 0.33 }));
        const num = svg('text', { class: 'pv-num', x, y: y + 2.4 });
        num.textContent = String(i + 1);
        this.overlay.appendChild(num);
      });
    }
  }

  private renderSide(): void {
    const board = this.displayBoard();
    const s = score(board);
    this.setNum('n-black', s.black);
    this.setNum('n-white', s.white);
    const total = Math.max(1, s.black + s.white);
    el('bar-b').style.width = `${(s.black / total) * 100}%`;
    el('bar-w').style.width = `${(s.white / total) * 100}%`;

    const liveTurn = this.over ? null : this.turn;
    el('sb-black').classList.toggle('active', liveTurn === 'black' && this.reviewIndex === null);
    el('sb-white').classList.toggle('active', liveTurn === 'white' && this.reviewIndex === null);

    const status = el('status');
    if (this.reviewIndex !== null) {
      status.className = 'status';
      status.textContent = `検討: ${this.reviewIndex}手目の局面`;
    } else if (this.over) {
      const w = winner(this.board);
      status.className = 'status win';
      status.textContent = w === 'draw' ? '引き分け' : `${PLAYER_JA[w]}の勝ち`;
    } else if (!this.thinking) {
      status.className = 'status';
      status.textContent = this.watch
        ? `AI同士が対戦中 ・ ${PLAYER_JA[this.turn]}の番`
        : this.turn === this.human
          ? 'あなたの番です'
          : `${PLAYER_JA[this.turn]}(AI)の番`;
    }

    el<HTMLButtonElement>('undo').disabled = this.record.length === 0 || this.thinking;
    el<HTMLButtonElement>('redo').disabled = this.redo.length === 0 || this.thinking;
    el<HTMLButtonElement>('hint').disabled =
      this.watch ||
      this.over ||
      this.thinking ||
      this.turn !== this.human ||
      this.reviewIndex !== null;
    el('review-tag').classList.toggle('on', this.reviewIndex !== null);

    this.renderAnalysis();
  }

  private renderAnalysis(): void {
    const evalVal = el('eval-val');
    const evalNote = el('eval-note');
    const pvline = el('pvline');
    if (!this.analysis || this.reviewIndex !== null) {
      evalVal.textContent = this.reviewIndex !== null ? '検討中' : '--';
      evalNote.textContent = '';
      pvline.textContent = '';
      return;
    }
    const blackScore =
      this.analysisColor === 'black' ? this.analysis.score : -this.analysis.score;
    const { fig, note } = formatEval(blackScore);
    evalVal.textContent = fig;
    evalNote.textContent = `${note} ・ ${this.depth}手読み`;

    pvline.replaceChildren();
    let color = this.analysisColor;
    for (const m of this.analysis.pv.slice(0, 6)) {
      const span = document.createElement('span');
      span.className = 'mv';
      span.textContent = `${STONE[color]}${toNotation(m.r, m.c)}`;
      pvline.appendChild(span);
      color = opponent(color);
    }
  }

  private renderEvalGraph(): void {
    const g = el('evalgraph') as unknown as SVGSVGElement;
    g.replaceChildren();
    const W = 460;
    const H = 92;
    const padY = 10;
    const zeroY = H / 2;
    const span = H / 2 - padY;
    const CLAMP = 220;
    const n = this.evalLog.length;

    g.appendChild(svg('line', { class: 'eg-zero', x1: 0, y1: zeroY, x2: W, y2: zeroY }));
    const top = svg('text', { class: 'eg-axis', x: 3, y: 9 });
    top.textContent = '黒';
    const bot = svg('text', { class: 'eg-axis', x: 3, y: H - 3 });
    bot.textContent = '白';
    g.append(top, bot);

    if (n <= 1) {
      const t = svg('text', { class: 'eg-empty', x: W / 2, y: zeroY + 4 });
      t.textContent = '対局するとここに形勢が出る';
      g.appendChild(t);
      return;
    }

    const xAt = (i: number): number => (n === 1 ? 0 : (i / (n - 1)) * W);
    const yAt = (v: number): number => {
      const clamped = Math.max(-CLAMP, Math.min(CLAMP, v));
      return zeroY - (clamped / CLAMP) * span;
    };

    const pts = this.evalLog.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
    const area = `0,${zeroY} ${pts.join(' ')} ${W},${zeroY}`;
    g.appendChild(svg('polygon', { class: 'eg-area-b', points: area }));
    g.appendChild(svg('polyline', { class: 'eg-line', points: pts.join(' ') }));

    const cur = this.reviewIndex ?? n - 1;
    const cx = xAt(cur);
    g.appendChild(svg('line', { class: 'eg-cursor', x1: cx, y1: 0, x2: cx, y2: H }));
    g.appendChild(svg('circle', { class: 'eg-dot', cx, cy: yAt(this.evalLog[cur]!), r: 2.6 }));

    g.style.cursor = 'pointer';
    g.onclick = (e: MouseEvent) => {
      const rect = g.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.round((x / W) * (n - 1));
      this.review(Math.max(0, Math.min(n - 1, i)));
    };
  }

  private renderKifu(): void {
    const list = el('kifu');
    list.replaceChildren();
    el('ply-count').textContent = this.record.length > 0 ? `${this.record.length}手` : '';
    if (this.record.length === 0) {
      const li = document.createElement('li');
      li.className = 'kifu-empty';
      li.textContent = 'まだ着手がありません';
      list.appendChild(li);
      return;
    }
    this.record.forEach((ply, i) => {
      const li = document.createElement('li');
      if (this.reviewIndex === i + 1) li.className = 'current';
      const no = document.createElement('span');
      no.className = 'no';
      no.textContent = `${i + 1}.`;
      const stone = document.createElement('span');
      stone.className = 'stone';
      stone.textContent = STONE[ply.mover];
      const mv = document.createElement('span');
      mv.textContent = toNotation(ply.move.r, ply.move.c);
      li.append(no, stone, mv);
      li.addEventListener('click', () => this.review(i + 1));
      list.appendChild(li);
    });
  }

  private setStatus(text: string): void {
    const status = el('status');
    status.className = 'status';
    status.textContent = text;
  }

  /** 石数をなめらかに数え上げて更新する(reduced-motionや検討中は即時)。 */
  private setNum(id: string, to: number): void {
    const node = el(id);
    const from = this.numShown[id] ?? to;
    this.numShown[id] = to;
    if (reduceMotion || this.reviewIndex !== null || from === to) {
      node.textContent = String(to);
      return;
    }
    if (this.numRaf[id]) cancelAnimationFrame(this.numRaf[id]);
    const start = performance.now();
    const dur = 320;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) this.numRaf[id] = requestAnimationFrame(tick);
    };
    this.numRaf[id] = requestAnimationFrame(tick);
  }

  private toast(text: string): void {
    const t = el('toast');
    t.textContent = text;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 2000);
  }

  private syncUrl(): void {
    try {
      const code = encodeRecord(this.record.map((p) => p.move));
      const url = new URL(location.href);
      if (code) url.searchParams.set('g', code);
      else url.searchParams.delete('g');
      history.replaceState(null, '', url);
    } catch {
      /* 履歴を更新できなくても対局は続けられる */
    }
  }

  private async shareUrl(): Promise<void> {
    this.syncUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      this.toast('共有URLをコピーしました');
    } catch {
      this.toast('URLをコピーできませんでした');
    }
  }

  private async copyKifu(): Promise<void> {
    if (this.record.length === 0) {
      this.toast('棋譜がまだありません');
      return;
    }
    const text = this.record
      .map((p, i) => `${i + 1}. ${STONE[p.mover]}${toNotation(p.move.r, p.move.c)}`)
      .join(' ');
    try {
      await navigator.clipboard.writeText(text);
      this.toast('棋譜をコピーしました');
    } catch {
      this.toast('棋譜をコピーできませんでした');
    }
  }

  // --- 入力 ------------------------------------------------------------------

  private cellFromEvent(e: MouseEvent): { r: number; c: number } | null {
    const rect = this.boardEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB - PAD;
    const y = ((e.clientY - rect.top) / rect.height) * VB - PAD;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return { r, c };
  }

  private onBoardKey(e: KeyboardEvent): void {
    // 検討中は矢印キーで棋譜を1手ずつ行き来する。
    if (this.reviewIndex !== null) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.review(this.reviewIndex - 1);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.review(this.reviewIndex + 1);
        return;
      }
    }
    const move = (dr: number, dc: number): void => {
      e.preventDefault();
      const cur = this.kb ?? { r: 3, c: 3 };
      this.kb = {
        r: Math.max(0, Math.min(SIZE - 1, cur.r + dr)),
        c: Math.max(0, Math.min(SIZE - 1, cur.c + dc)),
      };
      this.render();
    };
    switch (e.key) {
      case 'ArrowUp':
        return move(-1, 0);
      case 'ArrowDown':
        return move(1, 0);
      case 'ArrowLeft':
        return move(0, -1);
      case 'ArrowRight':
        return move(0, 1);
      case 'Enter':
      case ' ': {
        if (!this.kb) return;
        e.preventDefault();
        const legal = legalMoves(this.board, this.human).find(
          (m) => m.r === this.kb!.r && m.c === this.kb!.c,
        );
        if (legal) this.onHumanMove(legal);
        return;
      }
      default:
        return;
    }
  }

  private bind(): void {
    this.boardEl.addEventListener('click', (e) => {
      if (this.watch || this.thinking || this.over || this.turn !== this.human || this.reviewIndex !== null)
        return;
      const cell = this.cellFromEvent(e);
      if (!cell) return;
      const move = legalMoves(this.board, this.human).find((m) => m.r === cell.r && m.c === cell.c);
      if (move) this.onHumanMove(move);
    });
    this.boardEl.addEventListener('keydown', (e) => this.onBoardKey(e));

    el<HTMLSelectElement>('color').addEventListener('change', (e) => {
      this.human = (e.target as HTMLSelectElement).value as Player;
      store.set('ishi-color', this.human);
      this.newGame();
    });
    el<HTMLSelectElement>('level').addEventListener('change', (e) => {
      this.depth = Number((e.target as HTMLSelectElement).value);
      store.set('ishi-level', String(this.depth));
    });
    el<HTMLInputElement>('show-read').addEventListener('change', (e) => {
      this.showRead = (e.target as HTMLInputElement).checked;
      store.set('ishi-read', this.showRead ? '1' : '0');
      if (this.showRead && this.turn === this.human && !this.over && this.reviewIndex === null) {
        this.computeAnalysis(this.human);
      }
      this.render();
    });
    el<HTMLInputElement>('watch').addEventListener('change', (e) => {
      this.watch = (e.target as HTMLInputElement).checked;
      this.reviewIndex = null;
      this.analysis = null;
      this.render();
      this.step();
    });
    el<HTMLButtonElement>('undo').addEventListener('click', () => this.undo());
    el<HTMLButtonElement>('redo').addEventListener('click', () => this.redoMoves());
    el<HTMLButtonElement>('hint').addEventListener('click', () => this.hint());
    el<HTMLButtonElement>('newgame').addEventListener('click', () => this.newGame());
    el<HTMLButtonElement>('to-live').addEventListener('click', () => this.toLive());
    el<HTMLButtonElement>('share').addEventListener('click', () => void this.shareUrl());
    el<HTMLButtonElement>('copy-kifu').addEventListener('click', () => void this.copyKifu());
    el<HTMLButtonElement>('theme').addEventListener('click', () => cycleTheme());

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'u':
          this.undo();
          break;
        case 'r':
          this.redoMoves();
          break;
        case 'h':
          this.hint();
          break;
        case 'n':
          this.newGame();
          break;
        default:
          return;
      }
    });
  }
}

function cycleTheme(): void {
  const order = ['auto', 'light', 'dark'] as const;
  const cur = (store.get('ishi-theme') as (typeof order)[number]) || 'auto';
  const next = order[(order.indexOf(cur) + 1) % order.length]!;
  store.set('ishi-theme', next);
  applyTheme(next);
}

function applyTheme(mode: 'auto' | 'light' | 'dark'): void {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const btn = document.getElementById('theme');
  if (btn) btn.textContent = `テーマ: ${{ auto: '自動', light: '明', dark: '暗' }[mode]}`;
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = shell();
  applyTheme((store.get('ishi-theme') as 'auto' | 'light' | 'dark') || 'auto');
  new Game();
}

boot();
