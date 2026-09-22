import { AnyAction } from '@dineug/r-html';
import { last } from 'es-toolkit';
import { map, Observable, throttleTime } from 'rxjs';

import {
  SharedStreamActionTypes,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { pushStreamHistoryMap } from '@/engine/history.actions';
import {
  groupByStreamActions,
  type StreamBufferOperator,
} from '@/engine/rx-operators/groupByStreamActions';
import { arrayHas } from '@/utils/arrayHas';

const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);
const hasSharedStreamActionTypes = arrayHas<string>(SharedStreamActionTypes);

/**
 * Builds the outbound compressor around what closes an edit stream's group,
 * left to groupByStreamActions' 200 ms quiet period when omitted. Presence
 * keeps its own 100 ms throttle either way.
 */
export const createSharedStreamActionsCompressor =
  (streamBufferOperator?: StreamBufferOperator) =>
  (source$: Observable<Array<AnyAction>>) =>
    source$.pipe(
      groupByStreamActions(
        SharedStreamActionTypes,
        [],
        throttleTime(100, undefined, { leading: true, trailing: true })
      ),
      map(actions =>
        hasSharedStreamActionTypes(actions[0]?.type)
          ? [last(actions) as AnyAction]
          : actions
      ),
      groupByStreamActions(
        StreamActionTypes,
        [
          ['@@move', StreamRegroupMoveActionTypes],
          ['@@scroll', StreamRegroupScrollActionTypes],
          ['@@color', StreamRegroupColorActionTypes],
        ],
        streamBufferOperator
      ),
      map(actions => {
        if (!hasStreamActionTypes(actions[0]?.type)) {
          return actions;
        }

        const redoActions: AnyAction[] = [];
        for (const key of Object.keys(pushStreamHistoryMap)) {
          pushStreamHistoryMap[key]([], redoActions, actions);
        }

        return redoActions.length ? redoActions : actions;
      })
    );
