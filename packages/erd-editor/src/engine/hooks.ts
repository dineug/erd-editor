import type { Channel, CoroutineCreator } from '@dineug/go';
import { type AnyAction, createAction } from '@dineug/r-html';

import type { EngineContext } from '@/engine/context';
import type { RootState } from '@/engine/state';

type ActionCreator = ReturnType<typeof createAction<any>>;

export type CO = (
  channel: Channel<AnyAction>,
  state: RootState,
  ctx: EngineContext
) => ReturnType<CoroutineCreator>;

export type Hook = [Array<ActionCreator | string>, CO];
