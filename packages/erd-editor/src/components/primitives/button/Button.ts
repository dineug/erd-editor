import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from './Button.styles';

export type ButtonProps = {
  size?: '1' | '2' | '3';
  variant?: 'solid' | 'soft';
  text: string | DOMTemplateLiterals;
  onClick?: (event: PointerEvent) => void;
};

const Button: FC<ButtonProps> = (props, ctx) => {
  return () => html`
    <button
      class=${[
        styles.button,
        Reflect.get(styles, props.variant ?? 'solid'),
        Reflect.get(styles, `size${props.size ?? '2'}`),
      ]}
      type="button"
      @click=${props.onClick}
    >
      ${props.text}
    </button>
  `;
};

export default Button;
