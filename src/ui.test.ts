// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  }
  await import('./main');
});

describe('UI のDOM結線', () => {
  it('盤と初期4石を描画する', () => {
    const board = document.getElementById('board')!;
    expect(board.querySelectorAll('.disc').length).toBe(4);
  });

  it('初期スコアは2対2で、黒の手番', () => {
    expect(document.getElementById('n-black')?.textContent).toBe('2');
    expect(document.getElementById('n-white')?.textContent).toBe('2');
    expect(document.getElementById('sb-black')?.className).toContain('active');
  });

  it('黒番では合法手のヒントが4つ出る', () => {
    expect(document.querySelectorAll('#board .hint').length).toBe(4);
  });

  it('読み筋を表示すると評価値が出る', () => {
    expect(document.getElementById('eval-val')?.textContent).not.toBe('--');
  });

  it('強さ・色のセレクタと操作ボタンが揃っている', () => {
    expect(document.getElementById('level')).toBeTruthy();
    expect(document.getElementById('color')).toBeTruthy();
    expect(document.getElementById('newgame')).toBeTruthy();
    expect(document.getElementById('undo')).toBeTruthy();
  });
});
