import { defineComponent, html, observable } from '@vuerd/lit-observable';

import { css } from '@/core/tagged';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-prompt': PromptElement;
  }
}

export interface PromptProps {
  prompt: string;
  onSubmit: (message: string) => void;
}

export interface PromptElement extends PromptProps, HTMLElement {}

const PromptStyle = css`
  .vuerd-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .vuerd-prompt-header {
    width: 100%;
  }

  .vuerd-prompt > .vuerd-prompt-message,
  .vuerd-prompt > .vuerd-prompt-input {
    margin-bottom: 10px;
  }

  .vuerd-prompt-message {
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

  .vuerd-prompt-button {
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
    cursor: pointer;
    fill: var(--vuerd-color-font);
  }

  .vuerd-prompt-button:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
    fill: var(--vuerd-color-font-active);
  }
`;

defineComponent('vuerd-prompt', {
  shadow: false,
  observedProps: ['prompt', 'onSubmit', 'visible'],
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
  },
  style: PromptStyle,
  render(props: PromptProps, ctx: PromptElement) {
    const state = observable({ input: '' });

    const onInput = (event: InputEvent) => {
      const input = event.target as HTMLInputElement;
      state.input = input.value;
    };

    const onSubmit = (e: Event, cancel: boolean) => {
      e.preventDefault();
      props.onSubmit(cancel ? '' : state.input.trim());
      state.input = '';
    };

    return () => html`
      <div class="vuerd-prompt">
        <div class="vuerd-prompt-header">
          <vuerd-icon
            class="vuerd-button"
            name="times"
            size="12"
            @click=${(e: Event) => onSubmit(e, true)}
          ></vuerd-icon>
        </div>
        <span class="vuerd-prompt-message"> ${props.prompt} </span>
        <vuerd-input
          .width=${170}
          .edit=${true}
          .value=${state.input}
          .placeholder=${'unknown'}
          class="vuerd-prompt-input"
          @input=${onInput}
          @keyup-enter=${onSubmit}
        ></vuerd-input>
        <div class="vuerd-prompt-button" @click=${onSubmit}>Confirm</div>
      </div>
    `;
  },
});
