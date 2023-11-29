import { DOMTemplateLiterals, FC, html } from '@dineug/r-html';

import * as styles from './Toast.styles';

export type ToastProps = {
  title?: DOMTemplateLiterals | string;
  description?: DOMTemplateLiterals | string;
  action?: DOMTemplateLiterals | string;
};

const Toast: FC<ToastProps> = (props, ctx) => {
  return () => {
    const showText = props.title || props.description;
    const showButton = props.action;

    return html`
      <div class=${styles.root}>
        ${showText
          ? html`
              <div class=${styles.textWrap}>
                ${props.title
                  ? html`<div class=${styles.title}>${props.title}</div>`
                  : null}
                ${props.description
                  ? html`<div class=${styles.description}>
                      ${props.description}
                    </div>`
                  : null}
              </div>
            `
          : null}
        ${showButton
          ? html`<div class=${styles.action}>${props.action}</div>`
          : null}
      </div>
    `;
  };
};

export default Toast;
