import { AnyAction, GeneratorActionCreator } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';

export type GeneratorAction = GeneratorActionCreator<
  AnyAction,
  RootState,
  EngineContext
>;
