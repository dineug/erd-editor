import { type AnyAction, createAction } from '@dineug/r-html';
import type { Observable, Subscription } from 'rxjs';

import type { EngineContext } from '@/engine/context';
import type { RootState } from '@/engine/state';

type ActionCreator = ReturnType<typeof createAction<any>>;

export type HookEffect = (
  action$: Observable<AnyAction>,
  getState: () => RootState,
  ctx: EngineContext
) => Subscription;

export type Hook = [Array<ActionCreator | string>, HookEffect];
