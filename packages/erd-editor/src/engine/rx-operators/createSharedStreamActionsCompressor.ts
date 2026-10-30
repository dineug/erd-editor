import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { isNil, last } from 'es-toolkit';
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
  moveMemoAction,
  moveToMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  moveTableAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  moveTableGroupAction,
  moveToTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import {
  groupByStreamActions,
  type StreamBufferOperator,
} from '@/engine/rx-operators/groupByStreamActions';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { arrayHas } from '@/utils/arrayHas';

const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);
const hasSharedStreamActionTypes = arrayHas<string>(SharedStreamActionTypes);
const hasMoveActionTypes = arrayHas<string>(StreamRegroupMoveActionTypes);
const hasScrollActionTypes = arrayHas<string>(StreamRegroupScrollActionTypes);

/** Each step type of a drag, the collection it moves and its absolute twin, in the order they are sent. */
const MOVES = [
  [moveTableAction.type, 'tableEntities', moveToTableAction],
  [moveMemoAction.type, 'memoEntities', moveToMemoAction],
  [moveTableGroupAction.type, 'tableGroupEntities', moveToTableGroupAction],
] as const;

/**
 * The version and tags an absolute write is sent with, each only when there is
 * one. The drag's tag stays behind: a write is one jump, whose connectors a
 * receiver sorts before the next frame, as it does an undo's.
 */
function stamped(
  action: AnyAction,
  version: number | undefined,
  tags: number | undefined
): AnyAction {
  const sentTags = isNil(tags) ? 0 : tags & ~Tag.drag;
  return {
    ...action,
    ...(isNil(version) ? {} : { version }),
    ...(sentTags ? { tags: sentTags } : {}),
  };
}

/**
 * What the steps naming one entity or path leave to send with it: their highest
 * version, which the absolute write goes out at, and the last one's tags.
 */
type Stamp = { version?: number; tags?: number };

const stampWith = (
  stamp: Stamp | undefined,
  { version, tags }: AnyAction
): Stamp => ({
  version: isNil(version)
    ? stamp?.version
    : Math.max(version, stamp?.version ?? version),
  tags,
});

const stampOf = (steps: AnyAction[]): Stamp | undefined =>
  steps.reduce<Stamp | undefined>(stampWith, undefined);

/**
 * A drag's steps as the absolute position each entity they name ends at, read
 * off the state at the highest version of that entity's own steps, which no
 * handshake raises as it can raise the register. A removed entity is sent too.
 */
function toAbsoluteMoves(steps: AnyAction[], state: RootState): AnyAction[] {
  const absolute: AnyAction[] = [];

  for (const [type, collectionKey, moveTo] of MOVES) {
    const named = new Map<string, Stamp>();
    for (const step of steps) {
      if (step.type !== type) continue;
      for (const id of step.payload.ids as string[]) {
        named.set(id, stampWith(named.get(id), step));
      }
    }

    const collection = query(state.collections).collection(collectionKey);
    named.forEach(({ version, tags }, id) => {
      const entity = collection.selectById(id);
      if (!entity) return;

      absolute.push(
        stamped(moveTo({ id, x: entity.ui.x, y: entity.ui.y }), version, tags)
      );
    });
  }

  return absolute;
}

/**
 * A pan's or a zoom's steps as the origin or the zoom they end at, read off
 * the document's own viewport, the one a readonly screen keeps aside included,
 * at the highest version of the steps of each.
 */
function toAbsoluteViewport(steps: AnyAction[], state: RootState): AnyAction[] {
  const viewport = state.editor.screenBaseline?.viewport ?? state.settings;
  const absolute: AnyAction[] = [];
  const scrolls = stampOf(
    steps.filter(({ type }) => type === streamScrollToAction.type)
  );
  const zooms = stampOf(
    steps.filter(({ type }) => type === streamZoomLevelAction.type)
  );

  if (scrolls) {
    absolute.push(
      stamped(
        scrollToAction({
          originX: viewport.originX,
          originY: viewport.originY,
        }),
        scrolls.version,
        scrolls.tags
      )
    );
  }
  if (zooms) {
    absolute.push(
      stamped(
        changeZoomLevelAction({ value: viewport.zoomLevel }),
        zooms.version,
        zooms.tags
      )
    );
  }

  return absolute;
}

/**
 * Builds the outbound compressor around what closes an edit stream's group,
 * groupByStreamActions' 200 ms quiet period when undefined, and the state a
 * closed drag or pan is read off. Presence keeps its own 100 ms throttle.
 */
export const createSharedStreamActionsCompressor =
  (
    streamBufferOperator: StreamBufferOperator | undefined,
    getState: () => RootState
  ) =>
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
        const type = actions[0]?.type;
        if (!hasStreamActionTypes(type)) {
          return actions;
        }
        // Read off the steps, not their history redo, which drops a list
        // under 20 px, so each such drag still sends where it ends.
        if (hasMoveActionTypes(type)) {
          return toAbsoluteMoves(actions, getState());
        }
        if (hasScrollActionTypes(type)) {
          return toAbsoluteViewport(actions, getState());
        }

        const redoActions: AnyAction[] = [];
        for (const key of Object.keys(pushStreamHistoryMap)) {
          pushStreamHistoryMap[key]([], redoActions, actions);
        }

        return redoActions.length ? redoActions : actions;
      }),
      notEmptyActions
    );
