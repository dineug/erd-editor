import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { observable } from '@dineug/lit-observable';
import { createTheme } from './theme';
import { createKeymap } from './keymap';
import { createGlobalEventObservable } from './helper/event.helper';
import { createEventBus } from './helper/eventBus.helper';
import { createStore } from '@/engine/store';
import { createCommand } from '@/engine/command';
import { createHelper } from '@/core/helper/editor.helper';
import * as R from 'ramda';

export const createdERDEditorContext = (): IERDEditorContext => ({
  theme: observable(createTheme()),
  keymap: observable(createKeymap()),
  globalEvent: createGlobalEventObservable(),
  eventBus: createEventBus(),
  store: createStore(),
  command: createCommand(),
  helper: createHelper(),
});

export const omitERDEditorContext = R.pipe(
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
