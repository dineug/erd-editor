import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { observable } from '@vuerd/lit-observable';
import * as R from 'ramda';
import { createTheme } from './theme';
import { createKeymap } from './keymap';
import { createGlobalEventObservable } from './helper/event.helper';
import { createEventBus } from './helper/eventBus.helper';
import { createStore } from '@/engine/store';
import { createCommand } from '@/engine/command';
import { createHelper } from '@/core/helper/editor.helper';

export function createdERDEditorContext(): IERDEditorContext {
  const helper = createHelper();

  return {
    theme: observable(createTheme()),
    keymap: observable(createKeymap()),
    globalEvent: createGlobalEventObservable(),
    eventBus: createEventBus(),
    store: createStore(helper),
    command: createCommand(),
    helper,
  };
}

export const omitERDEditorContext = R.pipe<
  IERDEditorContext,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  ERDEditorContext
>(
  R.omit(['globalEvent', 'eventBus']),
  R.dissocPath(['store', 'history$']),
  R.dissocPath(['store', 'change$']),
  R.dissocPath(['store', 'destroy']),
  R.dissocPath(['helper', 'keydown$']),
  R.dissocPath(['helper', 'setGhostText']),
  R.dissocPath(['helper', 'setGhostInput']),
  R.dissocPath(['helper', 'focus']),
  R.dissocPath(['helper', 'blur']),
  R.dissocPath(['helper', 'destroy'])
);
