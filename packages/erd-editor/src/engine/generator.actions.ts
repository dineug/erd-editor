import { AnyAction, GeneratorActionCreator } from '@dineug/r-html';

import { Context } from '@/engine/context';
import { RootState } from '@/engine/state';

export type GeneratorAction = GeneratorActionCreator<
  AnyAction,
  RootState,
  Context
>;
