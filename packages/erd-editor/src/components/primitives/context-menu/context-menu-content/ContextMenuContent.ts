import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from './ContextMenuContent.styles';

export type ContextMenuContentProps = {
  id: string;
  x: number;
  y: number;
  children?: DOMTemplateLiterals;
};

const ContextMenuContent: FC<ContextMenuContentProps> = (props, ctx) => () =>
  html`
    <div
      class=${['context-menu-content', styles.content]}
      style=${{ left: `${props.x}px`, top: `${props.y}px` }}
      data-id=${props.id}
    >
      ${props.children}
    </div>
  `;

export default ContextMenuContent;
