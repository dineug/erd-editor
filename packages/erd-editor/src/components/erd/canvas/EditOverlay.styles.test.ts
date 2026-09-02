import { describe, expect, it } from 'vite-plus/test';

import { adoptedRules, ruleOf } from '@/__test-utils__/adoptedCss';
import { cell } from '@/components/erd/canvas/EditOverlay.styles';
import { FOCUS_BORDER_HEIGHT } from '@/components/erd/canvas/sceneTokens';
import {
  CELL_TEXT_HEIGHT,
  CELL_UNDERLINE_Y,
} from '@/components/erd/canvas/table/cellLayout';
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
  it('paints the underline at the y the scene ran its own rect along', () => {
    const rule = ruleOf(rules(), scope());
    const style = rule.style;

    expect(style.backgroundImage).toContain(`${CELL_UNDERLINE_Y}px`);
    expect(style.backgroundImage).toContain('var(--input-active)');
    expect(style.backgroundSize).toBe(`100% ${CELL_TEXT_HEIGHT}px`);
    expect(style.backgroundRepeat).toBe('no-repeat');
    expect(style.backgroundPosition).toBe('0px 0px');
  });

  it('runs that band exactly as thick as the rect the scene drew', () => {
    expect(CELL_TEXT_HEIGHT - CELL_UNDERLINE_Y).toBe(FOCUS_BORDER_HEIGHT);
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
    expect(style.transform).toBe('translateY(var(--cell-text-snap, 0px))');
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
