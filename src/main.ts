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
} from './lib';
import type { Analysis, Board, Move, Player } from './lib';

const CELL = 46;
const PAD = 14;
const VB = PAD + SIZE * CELL + 4;
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function coordName(r: number, c: number): string {
  return `${String.fromCharCode(97 + c)}${r + 1}`;
}

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" role="img" aria-labelledby="logo-title">
  <title id="logo-title">ishigaeshi</title>
  <rect x="7" y="7" width="50" height="50" rx="10" fill="none" stroke="currentColor" stroke-width="3"/>
  <circle cx="24" cy="24" r="9" fill="currentColor"/>
  <circle cx="40" cy="40" r="9" fill="none" stroke="currentColor" stroke-width="3"/>
  <path d="M33 24h8M37 20v8" stroke="var(--logo-accent, #11865c)" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const PLAYER_JA: Record<Player, string> = { black: '黒', white: '白' };

function shell(): string {
  return `
<header class="site-header">
  <div class="brand">
    ${LOGO}
    <div>
      <h1>ishigaeshi</h1>
      <div class="tagline">AIの評価と読み筋を見ながら指すリバーシ</div>
    </div>
  </div>
  <div class="header-tools">
    <button id="theme" type="button">テーマ: 自動</button>
  </div>
</header>

<main class="layout">
  <section class="pane board-pane">
    <svg id="board" viewBox="0 0 ${VB} ${VB}" role="application" aria-label="リバーシ盤。空きマスをクリックして石を置く"></svg>
  </section>

  <aside class="pane side">
    <section>
      <h2>スコア</h2>
      <div class="scores">
        <div class="scorebox" id="sb-black"><span class="chip black"></span><span class="num" id="n-black">2</span></div>
        <div class="scorebox" id="sb-white"><span class="num" id="n-white">2</span><span class="chip white"></span></div>
      </div>
      <div class="scorebar" style="margin-top:8px"><span class="b" id="bar-b"></span><span class="w" id="bar-w"></span></div>
      <p class="status" id="status" aria-live="polite"></p>
    </section>

    <section>
      <h2>対局</h2>
      <div class="controls">
        <div class="row">
          <label for="color">あなたの石</label>
          <select id="color">
            <option value="black">黒(先手)</option>
            <option value="white">白(後手)</option>
          </select>
        </div>
        <div class="row">
          <label for="level">AIの強さ</label>
          <select id="level">
            <option value="2">やさしい</option>
            <option value="4" selected>ふつう</option>
            <option value="6">つよい</option>
          </select>
        </div>
        <div class="row">
          <button id="undo" type="button">待った</button>
          <button id="newgame" type="button" class="primary">新規対局</button>
        </div>
        <label class="toggle"><input type="checkbox" id="show-read" checked /> 読み筋を盤に表示</label>
      </div>
    </section>

    <section>
      <h2>AIの読み</h2>
      <div class="analysis">
        <div class="evalrow"><span id="eval-label">評価値</span><b id="eval-val">--</b></div>
        <div class="pvline" id="pvline"></div>
      </div>
    </section>
  </aside>
</main>

<footer class="site-footer">
  空きマスのヒントをクリックして石を置く。AIの評価値と読み筋を手がかりに、隅を狙って打つ。
  <a href="https://github.com/miruky/ishigaeshi">ソース</a>
</footer>`;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`要素が見つからない: ${id}`);
  return node as T;
}

class Game {
  private board: Board = initialBoard();
  private turn: Player = 'black';
  private human: Player = 'black';
  private depth = 4;
  private showRead = true;
  private over = false;
  private thinking = false;
  private lastMove: Move | null = null;
  private changed = new Set<number>();
  private analysis: Analysis | null = null;
  private analysisColor: Player = 'black';
  private history: Array<{ board: Board; turn: Player; last: Move | null }> = [];

  private boardEl = el<HTMLElement>('board') as unknown as SVGSVGElement;
  private bg = svg('g');
  private discLayer = svg('g');
  private overlay = svg('g');

  constructor() {
    this.buildStatic();
    this.boardEl.append(this.bg, this.discLayer, this.overlay);
    this.bind();
    this.newGame();
  }

  private buildStatic(): void {
    this.bg.appendChild(
      svg('rect', {
        class: 'felt',
        x: PAD,
        y: PAD,
        width: SIZE * CELL,
        height: SIZE * CELL,
        rx: 4,
      }),
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
    for (const [r, c] of [
      [2, 2],
      [2, 6],
      [6, 2],
      [6, 6],
    ] as const) {
      this.bg.appendChild(
        svg('circle', { class: 'felt-dot', cx: PAD + c * CELL, cy: PAD + r * CELL, r: 2.5 }),
      );
    }
    for (let c = 0; c < SIZE; c++) {
      const t = svg('text', { class: 'coord', x: PAD + c * CELL + CELL / 2, y: PAD - 4 });
      t.textContent = String.fromCharCode(97 + c);
      this.bg.appendChild(t);
    }
    for (let r = 0; r < SIZE; r++) {
      const t = svg('text', { class: 'coord', x: PAD - 6, y: PAD + r * CELL + CELL / 2 + 3 });
      t.textContent = String(r + 1);
      this.bg.appendChild(t);
    }
  }

  private newGame(): void {
    this.board = initialBoard();
    this.turn = 'black';
    this.over = false;
    this.thinking = false;
    this.lastMove = null;
    this.changed.clear();
    this.analysis = null;
    this.history = [];
    this.render();
    this.step();
  }

  // --- 進行 -----------------------------------------------------------------

  private step(): void {
    if (this.over) return;
    if (isGameOver(this.board)) {
      this.over = true;
      this.render();
      return;
    }
    if (!hasMove(this.board, this.turn)) {
      this.setStatus(`${PLAYER_JA[this.turn]}は打てる手がなくパス`);
      this.turn = opponent(this.turn);
      window.setTimeout(() => this.step(), reduceMotion ? 0 : 500);
      return;
    }
    if (this.turn === this.human) {
      if (this.showRead) this.computeAnalysis(this.human);
      this.render();
      return;
    }
    this.thinking = true;
    this.setStatus(`${PLAYER_JA[this.turn]}(AI)が考えています…`);
    this.render();
    window.setTimeout(
      () => {
        const a = analyze(this.board, this.turn, this.depth);
        this.analysis = a;
        this.analysisColor = this.turn;
        if (a.move) this.commit(a.move, this.turn);
        this.thinking = false;
        this.render();
        window.setTimeout(() => this.step(), reduceMotion ? 0 : 360);
      },
      reduceMotion ? 0 : 360,
    );
  }

  private commit(move: Move, mover: Player): void {
    this.history.push({ board: this.board.slice(), turn: this.turn, last: this.lastMove });
    if (this.history.length > 80) this.history.shift();
    this.board = applyMove(this.board, move, mover);
    this.lastMove = move;
    this.changed = new Set([idx(move.r, move.c), ...move.flips]);
    const nt = nextTurn(this.board, mover);
    if (nt === null) this.over = true;
    else this.turn = nt;
  }

  private onHumanMove(move: Move): void {
    if (this.thinking || this.over || this.turn !== this.human) return;
    this.commit(move, this.human);
    this.analysis = null;
    this.render();
    window.setTimeout(() => this.step(), reduceMotion ? 0 : 200);
  }

  private computeAnalysis(color: Player): void {
    this.analysis = analyze(this.board, color, this.depth);
    this.analysisColor = color;
  }

  private undo(): void {
    if (this.thinking) return;
    let target = this.history.length;
    while (target > 0) {
      target--;
      if (this.history[target]!.turn === this.human) break;
    }
    if (target < this.history.length) {
      const snap = this.history[target]!;
      this.board = snap.board.slice();
      this.turn = snap.turn;
      this.lastMove = snap.last;
      this.history = this.history.slice(0, target);
      this.over = false;
      this.changed.clear();
      this.analysis = null;
      this.render();
      this.step();
    }
  }

  // --- 描画 -----------------------------------------------------------------

  private render(): void {
    this.renderDiscs();
    this.renderOverlay();
    this.renderSide();
  }

  private renderDiscs(): void {
    this.discLayer.replaceChildren();
    const rad = CELL * 0.4;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = this.board[idx(r, c)];
        if (!cell) continue;
        const { x, y } = cellCenter(r, c);
        const flip = !reduceMotion && this.changed.has(idx(r, c));
        this.discLayer.appendChild(
          svg('circle', { class: `disc ${cell}${flip ? ' flip' : ''}`, cx: x, cy: y, r: rad }),
        );
        this.discLayer.appendChild(
          svg('circle', {
            class: 'disc-hi',
            cx: x - rad * 0.3,
            cy: y - rad * 0.34,
            r: rad * 0.4,
            fill: cell === 'black' ? 'var(--disc-black-hi)' : 'var(--disc-white-hi)',
            opacity: cell === 'black' ? 0.5 : 0.85,
          }),
        );
      }
    }
  }

  private renderOverlay(): void {
    this.overlay.replaceChildren();
    if (this.lastMove) {
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
    if (!this.over && !this.thinking && this.turn === this.human) {
      for (const m of legalMoves(this.board, this.human)) {
        const { x, y } = cellCenter(m.r, m.c);
        const dot = svg('circle', { class: 'hint', cx: x, cy: y, r: CELL * 0.16 });
        dot.addEventListener('click', () => this.onHumanMove(m));
        this.overlay.appendChild(dot);
      }
    }
    if (this.showRead && this.analysis && this.analysis.pv.length > 0) {
      this.analysis.pv.slice(0, 5).forEach((m, i) => {
        const { x, y } = cellCenter(m.r, m.c);
        this.overlay.appendChild(
          svg('circle', { class: 'pv-ghost', cx: x, cy: y, r: CELL * 0.34 }),
        );
        const num = svg('text', { class: 'pv-num', x, y: y + 2.5 });
        num.textContent = String(i + 1);
        this.overlay.appendChild(num);
      });
    }
  }

  private renderSide(): void {
    const s = score(this.board);
    el('n-black').textContent = String(s.black);
    el('n-white').textContent = String(s.white);
    const total = Math.max(1, s.black + s.white);
    el('bar-b').style.width = `${(s.black / total) * 100}%`;
    el('bar-w').style.width = `${(s.white / total) * 100}%`;
    el('sb-black').classList.toggle('active', !this.over && this.turn === 'black');
    el('sb-white').classList.toggle('active', !this.over && this.turn === 'white');

    const status = el('status');
    if (this.over) {
      const w = winner(this.board);
      status.className = 'status win';
      status.textContent = w === 'draw' ? '引き分け' : `${PLAYER_JA[w]}の勝ち`;
    } else if (!this.thinking) {
      status.className = 'status';
      status.textContent =
        this.turn === this.human ? 'あなたの番です' : `${PLAYER_JA[this.turn]}(AI)の番`;
    }

    this.renderAnalysis();
  }

  private renderAnalysis(): void {
    const evalVal = el('eval-val');
    const pvline = el('pvline');
    if (!this.analysis) {
      evalVal.textContent = '--';
      pvline.textContent = '';
      return;
    }
    const blackScore = this.analysisColor === 'black' ? this.analysis.score : -this.analysis.score;
    if (Math.abs(blackScore) >= 100000) {
      evalVal.textContent = `${blackScore > 0 ? '黒' : '白'}の勝勢`;
    } else {
      const side = blackScore > 0 ? '黒+' : blackScore < 0 ? '白+' : '';
      evalVal.textContent = `${side}${Math.abs(blackScore)}`;
    }
    pvline.replaceChildren();
    let color = this.analysisColor;
    for (const m of this.analysis.pv.slice(0, 6)) {
      const span = document.createElement('span');
      span.className = 'mv';
      span.textContent = `${color === 'black' ? '●' : '○'}${coordName(m.r, m.c)}`;
      pvline.appendChild(span);
      color = opponent(color);
    }
  }

  private setStatus(text: string): void {
    const status = el('status');
    status.className = 'status';
    status.textContent = text;
  }

  private cellFromEvent(e: MouseEvent): { r: number; c: number } | null {
    const rect = this.boardEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB - PAD;
    const y = ((e.clientY - rect.top) / rect.height) * VB - PAD;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    return { r, c };
  }

  private bind(): void {
    this.boardEl.addEventListener('click', (e) => {
      if (this.thinking || this.over || this.turn !== this.human) return;
      const cell = this.cellFromEvent(e);
      if (!cell) return;
      const move = legalMoves(this.board, this.human).find((m) => m.r === cell.r && m.c === cell.c);
      if (move) this.onHumanMove(move);
    });

    el<HTMLSelectElement>('color').addEventListener('change', (e) => {
      this.human = (e.target as HTMLSelectElement).value as Player;
      this.newGame();
    });
    el<HTMLSelectElement>('level').addEventListener('change', (e) => {
      this.depth = Number((e.target as HTMLSelectElement).value);
    });
    el<HTMLInputElement>('show-read').addEventListener('change', (e) => {
      this.showRead = (e.target as HTMLInputElement).checked;
      if (this.showRead && this.turn === this.human && !this.over) this.computeAnalysis(this.human);
      this.render();
    });
    el<HTMLButtonElement>('undo').addEventListener('click', () => this.undo());
    el<HTMLButtonElement>('newgame').addEventListener('click', () => this.newGame());
    el<HTMLButtonElement>('theme').addEventListener('click', () => cycleTheme());
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
