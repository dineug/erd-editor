import { describe, expect, it } from 'vite-plus/test';

import { adoptedRules, ruleOf } from '@/__test-utils__/adoptedCss';
import { cell } from '@/components/erd/canvas/EditOverlay.styles';
import { CELL_TEXT_HEIGHT } from '@/components/erd/canvas/table/cellLayout';
import { root } from '@/components/primitives/edit-input/EditInput.styles';

const rules = () => adoptedRules();

const scope = () => `.${String(cell)}`;

/** The three selectors the scene box is written out of, in the order emitted. */
const INPUT_SELECTORS = [
  '.edit-input',
  '.edit-input.focus',
  '.edit-input.edit',
];

describe('the cell editor box over the scene', () => {
  it('paints no underline of its own, leaving the scene rect the only one', () => {
    const emitted = rules().filter(rule =>
      rule.selectorText.startsWith(scope())
    );

    expect(emitted.length).toBeGreaterThan(0);
    // Two rasterisers disagree over a half pixel: blink resolves a hard
    // gradient stop at the device pixel centre while konva antialiases the
    // edge of its rect, so one line drawn twice comes out two thicknesses.
    for (const rule of emitted) {
      expect(rule.style.backgroundImage).toBe('');
    }
  });

  it('gives the input the scene box and takes its own underline away', () => {
    const rule = ruleOf(
      rules(),
      INPUT_SELECTORS.map(selector => `${scope()} ${selector}`).join(',')
    );
    const style = rule.style;

    expect(style.height).toBe(`${CELL_TEXT_HEIGHT}px`);
    expect(style.borderBottomWidth).toBe('0px');
    expect(style.borderBottomStyle).toBe('none');
    expect(style.verticalAlign).toBe('top');
    // No transform of its own. The box already centres the input's line on the
    // baseline konva draws at, and a nudge on top of that is a guess about how
    // one rasteriser rounds a painted baseline, which is not portable.
    expect(style.transform).toBe('');
  });

  it('outranks the underline EditInput paints for a focused or edited cell', () => {
    const emitted = rules().map(rule => rule.selectorText);
    const scoped = emitted.find(selector =>
      selector.startsWith(`${scope()} .edit-input`)
    );

    expect(scoped).toBeTruthy();
    // EditInput writes its underline at .root.edit and .root.focus, which is
    // two classes; every selector here carries three and the scope on top.
    expect(scoped).toContain(`${scope()} .edit-input.edit`);
    expect(scoped).toContain(`${scope()} .edit-input.focus`);
    expect(emitted.some(selector => selector === `.${String(root)}.edit`)).toBe(
      true
    );
  });
});
