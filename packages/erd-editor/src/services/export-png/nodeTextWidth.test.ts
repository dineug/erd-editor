// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { createPeerStore, measureTableSize } from '@/peer';

import {
  measureTableText,
  tableToWidth,
  TO_WIDTH_MARGIN,
} from './nodeTextWidth';

const TEXT_FONT =
  "normal normal 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BOLD_FONT = TEXT_FONT.replace('normal normal', 'bold normal');
const CODE_FONT = "normal normal 10px 'Menlo', 'Consolas', monospace";

const widthOf = (text: string, font = TEXT_FONT) =>
  measureTableText(text, font).width;

describe('measureTableText', () => {
  it('reads each printable ASCII character off the table, wide letters wider', () => {
    expect(widthOf('W')).toBeGreaterThan(widthOf('n'));
    expect(widthOf('n')).toBeGreaterThan(widthOf('i'));
    expect(widthOf('users')).toBeCloseTo(
      [...'users'].reduce((sum, char) => sum + widthOf(char), 0),
      10
    );
    expect(widthOf('')).toBe(0);
  });

  it('scales with the size the font names, ten px where it names none', () => {
    expect(widthOf('users', TEXT_FONT.replace('12px', '24px'))).toBeCloseTo(
      widthOf('users') * 2,
      10
    );
    expect(widthOf('users', 'sans-serif')).toBeCloseTo(
      (widthOf('users') * 10) / 12,
      10
    );
  });

  it('measures a bold weight off its own row, wider than the regular one', () => {
    expect(widthOf('Orders', BOLD_FONT)).toBeGreaterThan(widthOf('Orders'));
    expect(widthOf('Orders', TEXT_FONT.replace('normal normal', '700'))).toBe(
      widthOf('Orders', BOLD_FONT)
    );
    expect(widthOf('Orders', TEXT_FONT.replace('normal normal', '400'))).toBe(
      widthOf('Orders')
    );
  });

  it('gives every character of a monospace stack the same advance', () => {
    expect(widthOf('i', CODE_FONT)).toBe(widthOf('W', CODE_FONT));
    expect(widthOf('D:C U:R', CODE_FONT)).toBeCloseTo(
      widthOf('i', CODE_FONT) * 7,
      10
    );
  });

  it('gives a wide East Asian character a whole em', () => {
    for (const char of ['漢', '字', '가', 'テ', '，']) {
      expect(widthOf(char)).toBe(12);
    }
    expect(widthOf('회원 정보')).toBeCloseTo(12 * 4 + widthOf(' '), 10);
  });

  it('gives an emoji an em and a quarter, a joined sequence or a flag counted once', () => {
    expect(widthOf('😀')).toBe(15);
    expect(widthOf('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}')).toBe(15);
    expect(widthOf('🇰🇷')).toBe(15);
    expect(widthOf('\u{2764}\u{FE0F}')).toBe(15);
    expect(widthOf('ship it 🚀')).toBeCloseTo(widthOf('ship it ') + 15, 10);
  });

  it('measures an accented letter as the letter it decomposes to', () => {
    expect(widthOf('é')).toBe(widthOf('e'));
    expect(widthOf('e\u{301}')).toBe(widthOf('e'));
    expect(widthOf('Ångström')).toBeCloseTo(widthOf('Angstrom'), 10);
  });

  it('gives any other character the mean of its weight’s row, and a lone mark none', () => {
    const regular = widthOf('Ж');
    expect(regular).toBeGreaterThan(widthOf('i'));
    expect(regular).toBeLessThan(widthOf('W'));
    expect(widthOf('—')).toBe(regular);
    expect(widthOf('Ж', BOLD_FONT)).toBeGreaterThan(regular);
    expect(widthOf('\u{200D}')).toBe(0);
    expect(widthOf('\u{301}')).toBe(0);
  });

  it('answers the face’s own box, which konva sets a line’s baseline by', () => {
    expect(measureTableText('M', TEXT_FONT)).toMatchObject({
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 3,
    });
    const code = measureTableText('M', CODE_FONT.replace('10px', '12px'));
    expect(code.fontBoundingBoxAscent).toBeCloseTo(11, 1);
    expect(code.fontBoundingBoxDescent).toBe(3);
  });
});

describe('tableToWidth', () => {
  it.each([
    '',
    'users',
    'created_at',
    'Wide WWW',
    '회원 정보 테이블',
    'ship it 🚀',
  ])(
    'reads the table konva reads, past the margin and the two px padding: %j',
    text => {
      expect(tableToWidth(text)).toBe(
        Math.round(widthOf(text) * TO_WIDTH_MARGIN) + 2
      );
    }
  );

  it('leaves room past what konva measures, so the cell never cuts its text', () => {
    expect(tableToWidth('created_at') - 2).toBeGreaterThan(
      widthOf('created_at')
    );
  });
});

describe('the boxes a document’s tables take at the table’s widths', () => {
  const FIXTURES = ['embed-small.erd.json', 'bookstore.erd.json', 'test.json'];

  it.each(FIXTURES)(
    'overlap nowhere the editor placed them apart: %s',
    fixture => {
      const value = readFileSync(
        join(process.cwd(), '..', '..', 'data', fixture),
        'utf8'
      );
      const peer = createPeerStore({ nickname: 'width', presence: false });
      peer.setInitialValue(value);
      const { state } = peer;
      const boxes = state.doc.tableIds.map(id => {
        const table = state.collections.tableEntities[id]!;
        const { width, height } = measureTableSize(table, state, tableToWidth);
        return { id, x: table.ui.x, y: table.ui.y, width, height };
      });
      peer.destroy();

      const overlapping = boxes.flatMap((a, index) =>
        boxes
          .slice(index + 1)
          .filter(
            b =>
              a.x < b.x + b.width &&
              b.x < a.x + a.width &&
              a.y < b.y + b.height &&
              b.y < a.y + a.height
          )
          .map(b => `${a.id} ${b.id}`)
      );

      expect(boxes.length).toBeGreaterThan(3);
      expect(overlapping).toEqual([]);
    }
  );
});
