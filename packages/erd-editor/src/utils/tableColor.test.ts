import { describe, expect, it } from 'vite-plus/test';

import {
  AML_COLORS,
  fromAMLColor,
  fromDBMLColor,
  toAMLColor,
  toDBMLColor,
} from '@/utils/tableColor';

describe('AML_COLORS', () => {
  it('names the eighteen AML colors with their Tailwind 500 hex', () => {
    expect(AML_COLORS).toEqual({
      red: '#ef4444',
      orange: '#f97316',
      amber: '#f59e0b',
      yellow: '#eab308',
      lime: '#84cc16',
      green: '#22c55e',
      emerald: '#10b981',
      teal: '#14b8a6',
      cyan: '#06b6d4',
      sky: '#0ea5e9',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a855f7',
      fuchsia: '#d946ef',
      pink: '#ec4899',
      rose: '#f43f5e',
      gray: '#6b7280',
    });
  });
});

describe('fromDBMLColor', () => {
  it('keeps a three or six digit hex as written', () => {
    expect(fromDBMLColor('#3498DB')).toBe('#3498DB');
    expect(fromDBMLColor('#abc')).toBe('#abc');
  });

  it('ignores anything else', () => {
    expect(fromDBMLColor('#aabbccdd')).toBe('');
    expect(fromDBMLColor('#abcd')).toBe('');
    expect(fromDBMLColor('#12345g')).toBe('');
    expect(fromDBMLColor('red')).toBe('');
    expect(fromDBMLColor('')).toBe('');
  });
});

describe('fromAMLColor', () => {
  it('reads every name as its hex', () => {
    for (const [name, hex] of Object.entries(AML_COLORS)) {
      expect(fromAMLColor(name)).toBe(hex);
    }
  });

  it('ignores a name spelled in another case than AML lists it', () => {
    expect(fromAMLColor('Red')).toBe('');
    expect(fromAMLColor('GRAY')).toBe('');
  });

  it('keeps a three, six or eight digit hex as written', () => {
    expect(fromAMLColor('#ccc')).toBe('#ccc');
    expect(fromAMLColor('#FF8800')).toBe('#FF8800');
    expect(fromAMLColor('#ff880080')).toBe('#ff880080');
  });

  it('ignores a value it does not know', () => {
    expect(fromAMLColor('#abcd')).toBe('');
    expect(fromAMLColor('magenta')).toBe('');
    expect(fromAMLColor('toString')).toBe('');
    expect(fromAMLColor('rgb(1, 2, 3)')).toBe('');
    expect(fromAMLColor('')).toBe('');
  });
});

describe('toDBMLColor', () => {
  it('keeps a three or six digit hex as stored', () => {
    expect(toDBMLColor('#FF8800')).toBe('#FF8800');
    expect(toDBMLColor('#abc')).toBe('#abc');
    expect(toDBMLColor(' #abc ')).toBe('#abc');
  });

  it('drops the alpha of an eight or four digit hex', () => {
    expect(toDBMLColor('#ff8800cc')).toBe('#ff8800');
    expect(toDBMLColor('#abcd')).toBe('#abc');
  });

  it('turns the rgb() and rgba() spellings into hex, alpha dropped', () => {
    expect(toDBMLColor('rgb(255,136,0)')).toBe('#ff8800');
    expect(toDBMLColor('rgba(255,136,0,0.5)')).toBe('#ff8800');
    expect(toDBMLColor('rgb(255 136 0 / 50%)')).toBe('#ff8800');
    expect(toDBMLColor('RGB(100%, 0%, 0%)')).toBe('#ff0000');
  });

  it('clamps an rgb() channel past its range', () => {
    expect(toDBMLColor('rgb(300, -20, 127.6)')).toBe('#ff0080');
  });

  it('turns the hsl() and hsla() spellings into hex, alpha dropped', () => {
    expect(toDBMLColor('hsl(0,100%,50%)')).toBe('#ff0000');
    expect(toDBMLColor('hsl(120deg 100% 25%)')).toBe('#008000');
    expect(toDBMLColor('hsla(240,100%,50%,0.3)')).toBe('#0000ff');
    expect(toDBMLColor('hsl(-120, 100%, 50%)')).toBe('#0000ff');
    expect(toDBMLColor('hsl(0, 0%, 100%)')).toBe('#ffffff');
  });

  it('is null for a color it cannot read', () => {
    expect(toDBMLColor('')).toBeNull();
    expect(toDBMLColor('red')).toBeNull();
    expect(toDBMLColor('#12345')).toBeNull();
    expect(toDBMLColor('rgb(1, 2)')).toBeNull();
    expect(toDBMLColor('rgb(a, b, c)')).toBeNull();
    expect(toDBMLColor('hsl(0.5turn, 100%, 50%)')).toBeNull();
    expect(toDBMLColor('rgb(1, 2, 3')).toBeNull();
  });
});

describe('toAMLColor', () => {
  it('names a hex that is one of the named colors by that name', () => {
    for (const [name, hex] of Object.entries(AML_COLORS)) {
      expect(toAMLColor(hex)).toBe(name);
      expect(toAMLColor(hex.toUpperCase())).toBe(name);
    }
  });

  it('names any other color by the nearest one in rgb', () => {
    expect(toAMLColor('#ff0000')).toBe('red');
    expect(toAMLColor('#FF8800')).toBe('amber');
    expect(toAMLColor('#888')).toBe('gray');
    expect(toAMLColor('#0000ff')).toBe('indigo');
    expect(toAMLColor('#3b82f680')).toBe('blue');
    expect(toAMLColor('rgb(16, 185, 129)')).toBe('emerald');
    expect(toAMLColor('hsl(0, 84%, 60%)')).toBe('red');
  });

  it('is null for a color it cannot read', () => {
    expect(toAMLColor('')).toBeNull();
    expect(toAMLColor('red')).toBeNull();
    expect(toAMLColor('hsl(x, 1%, 1%)')).toBeNull();
  });
});
