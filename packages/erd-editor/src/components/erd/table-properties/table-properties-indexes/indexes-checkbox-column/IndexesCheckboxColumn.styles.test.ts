import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { adoptedRules } from '@/__test-utils__/adoptedCss';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

/** The body of one nested rule, by its selector as the template spells it. */
const ruleBody = (selector: string) => {
  const text = staticText(styles.root);
  const start = text.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing rule: ${selector}`);

  return text.slice(start, text.indexOf('}', start));
};

const CHECKBOX = "& input[type='checkbox']";

describe('IndexesCheckboxColumn.styles', () => {
  it('exports a single `root` css template literal', () => {
    expect(Object.keys(styles)).toEqual(['root']);
    expect(Array.isArray(styles.root.strings)).toBe(true);
    expect(String(styles.root).startsWith('_')).toBe(true);
  });

  it('stacks the rows at their own width, the tint running to the end of each row', () => {
    const text = staticText(styles.root);

    expect(text).toContain('display: flex');
    expect(text).toContain('flex-direction: column');
    expect(text).toContain('width: max-content');
    expect(text).toContain('min-width: 100%');
  });

  it('leaves the scrolling to the panel around it, at any height', () => {
    const text = staticText(styles.root);

    expect(text).not.toContain('max-height');
    expect(text).not.toMatch(/overflow(-[xy])?:/);
  });

  it('interpolates nothing — it is a fully static rule', () => {
    expect(styles.root.values).toEqual([]);
  });

  it('marks a column of the picked index or key with the bar a picked row carries', () => {
    expect(ruleBody('& .column-row[data-selected]')).toContain(
      'box-shadow: inset 3px 0 0 var(--accent-color-10)'
    );
    expect(ruleBody('& .column-row[data-selected]:hover')).toContain(
      'background-color: var(--column-select-hover)'
    );
  });

  it('keeps an idle list from hovering a row it cannot change', () => {
    expect(
      ruleBody('&[data-idle] .column-row:not([data-selected]):hover')
    ).toContain('background-color: transparent');
  });

  it('draws the checkbox itself, ringed in a gray that holds 3:1 in both themes', () => {
    const body = ruleBody(CHECKBOX);

    expect(body).toContain('appearance: none');
    expect(body).toContain('display: block');
    expect(body).toContain('flex: none');
    expect(body).toContain('width: 14px');
    expect(body).toContain('height: 14px');
    expect(body).toContain('margin: 0');
    expect(body).toContain('border-radius: 3px');
    expect(body).toContain('background-color: transparent');
    expect(body).toContain('box-shadow: inset 0 0 0 1px var(--gray-color-10)');
    expect(body).toContain('background-size: 10px');
    expect(body).toContain('cursor: pointer');
  });

  it('darkens the ring of a box that can change under the pointer', () => {
    expect(ruleBody(`${CHECKBOX}:enabled:not(:checked):hover`)).toContain(
      'box-shadow: inset 0 0 0 1px var(--gray-color-11)'
    );
  });

  it('fills a checked box with the accent and a white check', () => {
    const body = ruleBody(`${CHECKBOX}:checked`);

    expect(body).toContain('background-color: var(--accent-color-9)');
    expect(body).toContain('box-shadow: none');
    expect(body).toContain('background-image: url("data:image/svg+xml,');
    expect(body).toContain("stroke='%23fff'");
  });

  it('rings a box the keyboard reached in the input colour', () => {
    const body = ruleBody(`${CHECKBOX}:focus-visible`);

    expect(body).toContain('outline: 2px solid var(--input-active)');
    expect(body).toContain('outline-offset: 1px');
  });

  it('fills a checked box of a key in gray at full opacity, and dims nothing else', () => {
    expect(ruleBody(`${CHECKBOX}:disabled`)).toContain('cursor: default');
    expect(ruleBody(`${CHECKBOX}:disabled`)).not.toContain('opacity');

    const body = ruleBody(`${CHECKBOX}:disabled:checked`);
    expect(body).toContain('opacity: 1');
    expect(body).toContain('background-color: var(--gray-color-9)');
  });

  it('hands the box back to the system in forced colours', () => {
    const text = staticText(styles.root);
    const media = text.slice(text.indexOf('@media (forced-colors: active)'));

    expect(media).toContain(CHECKBOX);
    expect(media).toContain('appearance: auto');
    expect(media).toContain('background-image: none');
    expect(media).toContain('box-shadow: none');
  });
});

describe('IndexesCheckboxColumn.styles emitted', () => {
  let rules: CSSRule[] = [];

  beforeAll(() => {
    rules = adoptedRules();
  });

  it('emits the forced colours fallback as a media rule over the scoped box', () => {
    const scope = `.${String(styles.root)}`;
    const media = rules.find(
      rule =>
        rule.cssText.startsWith('@media') &&
        rule.cssText.includes('forced-colors')
    );

    expect(media?.cssText).toContain(`${scope} input[type='checkbox']`);
    expect(media?.cssText).toContain('appearance: auto');
  });
});
