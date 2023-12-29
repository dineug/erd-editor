import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { last } from 'lodash-es';
import { map, Observable, throttleTime } from 'rxjs';

import {
  SharedStreamActionTypes,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { pushStreamHistoryMap } from '@/engine/history.actions';
import { groupByStreamActions } from '@/engine/rx-operators/groupByStreamActions';

const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);
const hasSharedStreamActionTypes = arrayHas<string>(SharedStreamActionTypes);

export const sharedStreamActionsCompressor = (
  source$: Observable<Array<AnyAction>>
) =>
  source$.pipe(
    groupByStreamActions(SharedStreamActionTypes, [], throttleTime(100)),
    map(actions =>
      hasSharedStreamActionTypes(actions[0]?.type)
        ? [last(actions) as AnyAction]
        : actions
    ),
    groupByStreamActions(StreamActionTypes, [
      ['@@move', StreamRegroupMoveActionTypes],
      ['@@scroll', StreamRegroupScrollActionTypes],
      ['@@color', StreamRegroupColorActionTypes],
    ]),
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
