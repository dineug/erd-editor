import { defineComponent, html } from '@vuerd/lit-observable';

import { css } from '@/core/tagged';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-alert': AlertElement;
  }
}

export interface AlertProps {
  message: string;
  onClose: () => void;
}

export interface AlertElement extends AlertProps, HTMLElement {}

const AlertStyle = css`
  @keyframes alert {
    0% {
      transform: translateY(-50px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 100;
    }
  }

  .vuerd-alert {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .vuerd-alert-header {
    width: 100%;
  }

  .vuerd-alert > .vuerd-alert-message {
    margin-bottom: 10px;
  }

  .vuerd-alert-message {
    word-break: break-all;
    margin: 10px 0;
  }

  .vuerd-button {
    fill: var(--vuerd-color-font);
    float: right;
  }

  .vuerd-button:hover {
    fill: var(--vuerd-color-font-active);
    cursor: pointer;
  }
`;

defineComponent('vuerd-alert', {
  shadow: false,
  observedProps: ['message', 'onClose', 'visible'],
  styleMap: {
    width: '200px',
    position: 'absolute',
    color: 'var(--vuerd-color-font-active)',
    backgroundColor: 'var(--vuerd-color-contextmenu)',
    margin: '10px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 6px var(--vuerd-color-minimap-shadow)',
    left: '50%',
    marginLeft: '-100px',
    marginTop: '40px',

    animation: 'alert 1s ease forwards',
  },
  style: AlertStyle,
  render(props: AlertProps, ctx: AlertElement) {
    const onClose = (e: Event) => {
      e.preventDefault();

      props.onClose();
    };

    return () => html`
      <div class="vuerd-alert">
        <div class="vuerd-alert-header">
          <vuerd-icon
            class="vuerd-button"
            name="times"
            size="12"
            @click=${(e: Event) => onClose(e)}
          ></vuerd-icon>
        </div>
        <span class="vuerd-alert-message"> ${props.message} </span>
      </div>
    `;
  },
});
