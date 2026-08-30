/// <reference types="vite/client" />
import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

const styleModules: Record<string, () => Promise<unknown>> = {
  ...import.meta.glob('../**/*.styles.ts'),
  ...import.meta.glob('../**/*.style.ts'),
  /** The one shipped module declaring a css template without a *.styles.ts name. */
  '../utils/text.ts': () => import('@/utils/text'),
};

/** A glob key back to a repo-relative source path. Vite re-relativizes against this file. */
const toSourcePath = (path: string) =>
  path.startsWith('./')
    ? path.replace(/^\.\//, 'src/styles/')
    : path.replace(/^\.\.\//, 'src/');

const DRAG_SELECT = 'src/components/erd/drag-select/DragSelect.styles.ts';
const COLOR_PICKER = 'src/styles/colorPicker.style.ts';

/**
 * The only two modules allowed a fill: DragSelect paints a marquee on an svg of
 * its own, and colorPicker's fills are all scoped under a subtree this package
 * renders no Icon into. Both claims are asserted below rather than trusted.
 */
const FILL_ALLOW_LIST = [DRAG_SELECT, COLOR_PICKER];

type FillRule = { module: string; selector: string; value: string };

/** Every rule reachable from a sheet, flattening @keyframes and any other grouping rule. */
function flatten(rules: CSSRuleList): CSSRule[] {
  return Array.from(rules).flatMap(rule => {
    const nested = (rule as CSSGroupingRule).cssRules;
    return nested ? [rule, ...flatten(nested)] : [rule];
  });
}

const adoptedRules = (host: ShadowRoot): CSSRule[] =>
  host.adoptedStyleSheets.flatMap(sheet => flatten(sheet.cssRules));

/** A fresh shadow root carrying every sheet registered so far, in cascade order. */
function createHost(): ShadowRoot {
  const hostElement = document.createElement('div');
  document.body.append(hostElement);
  const host = hostElement.attachShadow({ mode: 'open' });
  addCSSHost(host);
  return host;
}

let fills: FillRule[] = [];

beforeAll(async () => {
  const host = createHost();

  // Nothing may have registered before the walk, or the first module absorbs it — which is why
  // this file static-imports no style module and reaches every one it needs through import().
  expect(adoptedRules(host)).toEqual([]);

  // A rule's first appearance names the module that registered it; the shared sheet map has no
  // delete path, so that attribution holds for the rest of the run.
  const owner = new Map<string, string>();
  for (const path of Object.keys(styleModules).sort()) {
    await styleModules[path]();
    for (const rule of adoptedRules(host)) {
      if (!owner.has(rule.cssText)) owner.set(rule.cssText, toSourcePath(path));
    }
  }

  fills = adoptedRules(host).flatMap(rule => {
    // getPropertyValue is exact where a text search is not: it sees neither
    // fill-opacity nor -webkit-text-fill-color. style is present on every
    // keyframe, so a fill animation is caught here under its keyText.
    const styleRule = rule as CSSStyleRule;
    const value = styleRule.style?.getPropertyValue('fill');
    if (!value) return [];

    return [
      {
        module: owner.get(rule.cssText) as string,
        selector: styleRule.selectorText ?? rule.cssText,
        value,
      },
    ];
  });
});

describe('icon paint', () => {
  it('declares fill in no module but the two that paint a non-icon shape', () => {
    // The whole point of the file. An icon is stroked from currentColor, so a fill aimed at one
    // renders it invisible while failing nothing else — reach for color instead.
    expect(
      fills.filter(fill => !FILL_ALLOW_LIST.includes(fill.module))
    ).toEqual([]);

    // …and the allow-list is exactly true, so an entry that stops being needed gets deleted rather
    // than left standing as licence for the next one.
    expect([...new Set(fills.map(fill => fill.module))].sort()).toEqual(
      [...FILL_ALLOW_LIST].sort()
    );
  });

  it('keeps the drag box fill on the drag box, not on a class an icon shares', async () => {
    const styles =
      await import('@/components/erd/drag-select/DragSelect.styles');

    // Read through the export rather than a hashed class literal: this is the one selector
    // DragSelect.tsx puts on its own <svg>, and nothing else carries it.
    expect(
      fills
        .filter(fill => fill.module === DRAG_SELECT)
        .map(fill => fill.selector)
    ).toEqual([`.${String(styles.dragSelect)}`]);
  });

  it('keeps every color picker fill under the upstream class name', () => {
    // Six of these end in .icon svg path, the exact shape Icon renders, and are
    // inert only because of the head of the selector. Never simplify one:
    // dropping the ancestor turns it into a fill over every icon in the editor.
    const colorPicker = fills.filter(fill => fill.module === COLOR_PICKER);

    expect(colorPicker).not.toEqual([]);
    expect(
      colorPicker.filter(
        fill => !fill.selector.startsWith('.easylogic-colorpicker')
      )
    ).toEqual([]);
  });
});

/** A sentinel per token, so the assertions read the cascade rather than the active theme. */
const FOREGROUND = 'rgb(1, 2, 3)';
const ACTIVE = 'rgb(4, 5, 6)';

type IconPlacement = {
  /** The row that goes color: transparent at rest and --foreground on hover. */
  row: string;
  /** The class carrying the --active hover rule. */
  button: string;
  /** Whether button sits on a wrapper around the .icon, or on the .icon itself. */
  wraps: boolean;
};

/**
 * The colour resolved at a row icon's svg in each pointer state. happy-dom has
 * no pointer, so hover is applied by re-adopting the component's own hover rules
 * last, which is where a hovered element's declarations land in any case.
 */
function iconColors({ row, button, wraps }: IconPlacement) {
  const read = (hovered: string[]) => {
    const host = createHost();

    const texts = adoptedRules(host)
      .map(rule => rule as CSSStyleRule)
      .filter(
        rule =>
          rule.selectorText?.includes(':hover') &&
          hovered.some(scope => rule.selectorText.includes(scope))
      )
      .map(rule => rule.cssText.replaceAll(':hover', ''));

    if (texts.length) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(texts.join('\n'));
      host.adoptedStyleSheets = [...host.adoptedStyleSheets, sheet];
    }

    // The shape Icon renders — a .icon wrapper holding one <svg>, with props.class landing
    // on the wrapper — built by hand so this reads the cascade and not whatever a component happens
    // to render around it.
    const themed = document.createElement('div');
    themed.style.setProperty('--foreground', FOREGROUND);
    themed.style.setProperty('--active', ACTIVE);
    const rowElement = document.createElement('div');
    rowElement.className = row;
    const icon = document.createElement('div');
    icon.className = wraps ? 'icon' : `icon ${button}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    icon.append(svg);
    if (wraps) {
      const wrap = document.createElement('div');
      wrap.className = button;
      wrap.append(icon);
      rowElement.append(wrap);
    } else {
      rowElement.append(icon);
    }
    themed.append(rowElement);
    host.append(themed);

    return getComputedStyle(svg).color;
  };

  return {
    rest: read([]),
    rowHover: read([row]),
    iconHover: read([row, button]),
  };
}

describe('hide-until-hover', () => {
  const placements: Array<[string, () => Promise<IconPlacement>]> = [
    [
      'table header',
      async () => {
        const styles =
          await import('@/components/erd/canvas/table/Table.styles');
        return {
          row: String(styles.root),
          button: String(styles.headerButtonWrap),
          wraps: true,
        };
      },
    ],
    [
      'memo header',
      async () => {
        const styles = await import('@/components/erd/canvas/memo/Memo.styles');
        return {
          row: String(styles.root),
          button: String(styles.headerButtonWrap),
          wraps: true,
        };
      },
    ],
    [
      'column row',
      async () => {
        const styles =
          await import('@/components/erd/canvas/table/column/Column.styles');
        return {
          row: String(styles.root),
          button: String(styles.iconButton),
          wraps: false,
        };
      },
    ],
    [
      'index row',
      async () => {
        const styles =
          await import('@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles');
        return {
          row: String(styles.row),
          button: String(styles.iconButton),
          wraps: false,
        };
      },
    ],
  ];

  for (const [name, placement] of placements) {
    it(`hides the ${name} icon until the pointer arrives`, async () => {
      // Behaviour, not rule text. color: transparent on the row is what hides the glyph, because
      // its stroke="currentColor" resolves from whatever colour reaches it — and nothing in
      // either rule names the element being painted.
      expect(iconColors(await placement())).toEqual({
        rest: 'transparent',
        rowHover: FOREGROUND,
        iconHover: ACTIVE,
      });
    });
  }
});
