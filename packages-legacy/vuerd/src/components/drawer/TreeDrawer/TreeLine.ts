import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';

import { css } from '@/core/tagged';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-line': TreeLineElement;
  }
}

export type LineShape = 'I' | 'L' | 'X' | 'NULL';

export interface TreeLineProps {
  shape: LineShape;
}

export interface TreeLineElement extends TreeLineProps, HTMLElement {}

const TreeLine: FunctionalComponent<TreeLineProps, TreeLineElement> = (
  props,
  ctx
) => {
  /**
   * Create svg based on type
   * @returns Svg coordinates
   */
  const getLine = () => {
    switch (props.shape) {
      case 'L':
        return 'M5,0 L5,10 L15,10';
      case 'X':
        return 'M5,0 L5,20 M5,10 L15,10';
      case 'I':
        return 'M5,0 L5,20';
      case 'NULL':
        return '';
    }
  };

  return () => html`
    <div class="vuerd-tree-line">
      <svg class="vuerd-tree-line-svg">
        <path d="${getLine()}" />
      </svg>
    </div>
  `;
};

const style = css`
  .vuerd-tree-line {
    width: 20px;
    height: 20px;
  }
  .vuerd-tree-line-svg {
    width: 20px;
    height: 20px;
  }

  .vuerd-tree-line-svg > path {
    stroke: var(--vuerd-color-font);
    fill: transparent;
  }
`;

defineComponent('vuerd-tree-line', {
  observedProps: [
    {
      name: 'shape',
      default: 'NULL',
    },
  ],
  style,
  render: TreeLine,
});
