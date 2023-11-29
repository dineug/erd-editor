import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from './Button.styles';

export type ButtonProps = {
  size: '1' | '2' | '3';
  text: string | DOMTemplateLiterals;
  onClick?: (event: PointerEvent) => void;
};

const Button: FC<ButtonProps> = (props, ctx) => {
  return () =>
    html`
      <button
        class=${[
          styles.button,
          styles.soft,
          Reflect.get(styles, `size${props.size ?? 2}`),
        ]}
        type="button"
        @click=${props.onClick}
      >
        ${props.text}
      </button>
    `;
};

export default Button;
