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
  }
`;

defineComponent('vuerd-prompt', {
  observedProps: ['prompt', 'onSubmit', 'visible'],
  styleMap: {
    width: '200px',
    position: 'absolute',
    color: 'var(--vuerd-color-font-active)',
    backgroundColor: 'var(--vuerd-color-contextmenu)',
    margin: '10px',
    padding: '5px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 6px var(--vuerd-color-minimap-shadow)',
    left: '50%',
    marginLeft: '-100px',
  },
  style: PromptStyle,
  render(props: PromptProps, ctx: PromptElement) {
    const state = observable({ input: '' });

    const onInput = (event: InputEvent) => {
      const input = event.target as HTMLInputElement;
      state.input = input.value;
    };

    const onSubmit = (e: Event) => {
      e.preventDefault();
      props.onSubmit(state.input);
      state.input = '';
    };

    return () => html` <div class="vuerd-prompt">
      <span> ${props.prompt} </span>
      <vuerd-input
        .width=${60}
        .edit=${true}
        .value=${state.input}
        .placeholder=${'unknown'}
        class="vuerd-prompt-input"
        @input=${(event: InputEvent) => onInput(event)}
      ></vuerd-input>
      <button @click=${onSubmit}>Confirm</button>
    </div>`;
  },
});
