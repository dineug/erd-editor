// AC-61: the ERD tab's rendering, dimensions and gestures are what they were.
// A run proves the six suites below are green; that they were still asked is
// what it cannot, so their names are pinned here and read back off the source.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

/** The two globs vitest.config.ts collects on, which is the whole of how a named file reaches a run. */
const UNIT_GLOB = 'src/**/*.test.{ts,tsx}';

const BROWSER_GLOB = 'src/**/*.browser.test.{ts,tsx}';

type Suite = {
  /** Under src, in posix spelling, which is also how the plan names it. */
  path: string;
  /** What the suite is the ERD's proof of. */
  pins: string;
  /** Case and group titles that must still be declared in it, verbatim. */
  cases: string[];
};

const SUITES: Suite[] = [
  {
    path: 'components/erd/Erd.test.ts',
    pins: 'the gestures the ERD canvas answers',
    cases: [
      'scrolls the canvas',
      'maps a shift wheel onto the horizontal axis',
      'zooms out with the modifier key held',
      'zooms in with the modifier key held',
    ],
  },
  {
    path: 'konva/scene/metrics.test.ts',
    pins: 'the size and the place of a document table box and its rows',
    cases: [
      'a table box is the size the rest of the editor measures',
      'a column row sits inside the table it belongs to',
    ],
  },
  {
    path: 'constants/layout.test.ts',
    pins: 'the header and row heights the document draws at',
    cases: [
      'composes the table header from one padded input line and its band room',
      'composes the column row height from the padded input',
    ],
  },
  {
    path: 'utils/draw-relationship/pathFinding.test.ts',
    pins: 'the chamfered polyline a document connector is drawn as',
    cases: ['turns at right angles on the y axis, with the corners cut'],
  },
  {
    path: 'components/erd/floating-toolbar/FloatingToolbar.styles.test.ts',
    pins: 'where the ERD floating toolbar stands',
    cases: [
      'stands over the middle of the bottom edge of the canvas, in a row',
    ],
  },
  {
    path: 'components/erd/canvas/table/column/Column.browser.test.tsx',
    pins: 'the box an ERD column row is painted in',
    cases: ['spans the table box inside its border and one row tall'],
  },
];

/**
 * A declaration of the title given, as the source writes it. Both quotes are
 * tried because the formatter leaves a title holding an apostrophe in double
 * quotes, and neither spelling is the one a renamed case would keep.
 */
const declares = (text: string, title: string) =>
  text.includes(`it('${title}'`) ||
  text.includes(`describe('${title}'`) ||
  text.includes(`it("${title}"`) ||
  text.includes(`describe("${title}"`);

/** The modifiers that leave a case in the file and out of the run. */
const PARKED = /\b(?:it|test|describe)\s*\.\s*(?:skip|only|todo|fails)\b/;

const read = (path: string) => readFileSync(join(SOURCE_ROOT, path), 'utf8');

/**
 * A vitest include glob as a pattern over a path, in the three forms the two
 * globs above are written in: two stars reach across directories, one star
 * stops at the separator, and a brace lists the suffixes it accepts.
 *
 * @example
 * globToRegExp(UNIT_GLOB).test('src/a/b.test.tsx'); // true
 */
function globToRegExp(glob: string): RegExp {
  const source = glob.replace(/\*\*\/|\*|\{[^}]+\}|[.+^$()|[\]\\]/g, token => {
    if (token === '**/') return '(?:.*/)?';
    if (token === '*') return '[^/]*';
    if (token.startsWith('{')) {
      return `(${token.slice(1, -1).split(',').join('|')})`;
    }

    return `\\${token}`;
  });

  return new RegExp(`^${source}$`);
}

describe('the ERD suites the view work must leave standing', () => {
  // A read that found nothing would pass every case below without looking, so
  // the six files are opened first and the rest rest on that.
  it('opens six suites, which is what every case below rests on', () => {
    expect(SUITES).toHaveLength(6);

    for (const { path } of SUITES) {
      expect(read(path).length).toBeGreaterThan(0);
    }
  });

  it.each(SUITES)('$path still pins $pins', ({ path, cases }) => {
    const text = read(path);
    const missing = cases.filter(title => !declares(text, title));

    expect(missing).toEqual([]);
  });

  it.each(SUITES)('$path parks none of it behind a modifier', ({ path }) => {
    expect(PARKED.test(read(path))).toBe(false);
  });

  // Which suffix reaches a run is the config's to say, so the two globs are
  // read back off it and the six paths are matched against what they spell,
  // rather than against a suffix restated here.
  it('collects all six under the globs vitest.config.ts still spells', () => {
    const config = readFileSync(
      join(process.cwd(), 'vitest.config.ts'),
      'utf8'
    );

    expect(config).toContain(UNIT_GLOB);
    expect(config).toContain(BROWSER_GLOB);

    const collected = [UNIT_GLOB, BROWSER_GLOB].map(globToRegExp);
    const missed = SUITES.map(({ path }) => `src/${path}`).filter(
      path => !collected.some(glob => glob.test(path))
    );

    expect(missed).toEqual([]);
  });
});
