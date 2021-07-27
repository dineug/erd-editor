import '@/components/Prompt';

import { html, observable } from '@vuerd/lit-observable';

import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { ERDEditorProps } from '@@types/components/ERDEditorElement';

export type showPromptDef = (
  prompt: string,
  callback: (reply: string) => void
) => void;

export function usePrompt(
  props: ERDEditorProps,
  { store: { editorState, canvasState } }: IERDEditorContext
) {
  const state = observable({
    prompt: '',
    callback: (reply: string) => {},
    visible: false,
  });

  const showPrompt: showPromptDef = (
    prompt: string,
    callback: (reply: string) => void
  ): void => {
    state.prompt = prompt;
    state.callback = callback;
    state.visible = true;
  };

  return {
    showPrompt,
    promptTpl() {
      return state.visible
        ? html`
            <vuerd-prompt
              .prompt=${state.prompt}
              .onSubmit=${(message: string) => {
                state.visible = false;
                state.callback(message);
              }}
            ></vuerd-prompt>
          `
        : null;
    },
  };
}
