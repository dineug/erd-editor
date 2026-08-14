import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vitest';

import { Show } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ActionType } from '@/engine/modules/settings/actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  settingsPushStreamHistoryMap,
  settingsPushUndoHistoryMap,
} from '@/engine/modules/settings/history';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';

const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  const store = createStore({ toWidth, clock: new Clock() });
  store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  return store;
}

describe('settings/history', () => {
  let store: Store;

  beforeEach(() => {
    store = createTestStore();
  });

  const state = () => store.state as RootState;

  describe('settingsPushUndoHistoryMap', () => {
    it('covers exactly the undoable settings actions', () => {
      expect(Object.keys(settingsPushUndoHistoryMap).sort()).toEqual(
        [
          ActionType.resize,
          ActionType.scrollTo,
          ActionType.changeShow,
          ActionType.changeZoomLevel,
        ].sort()
      );
    });

    it('resize pushes the pre-change canvas size', () => {
      store.dispatchSync(resizeAction({ width: 3000, height: 4000 }));

      const undoActions: AnyAction[] = [];
      settingsPushUndoHistoryMap[ActionType.resize](
        undoActions,
        resizeAction({ width: 5000, height: 6000 }),
        state()
      );

      expect(undoActions).toEqual([
        resizeAction({ width: 3000, height: 4000 }),
      ]);
    });

    it('scrollTo pushes the pre-change scroll offsets', () => {
      store.dispatchSync(scrollToAction({ scrollLeft: -120, scrollTop: -240 }));

      const undoActions: AnyAction[] = [];
      settingsPushUndoHistoryMap[ActionType.scrollTo](
        undoActions,
        scrollToAction({ scrollLeft: -1, scrollTop: -2 }),
        state()
      );

      expect(undoActions).toEqual([
        scrollToAction({ scrollLeft: -120, scrollTop: -240 }),
      ]);
    });

    it('changeShow inverts the value from the action payload', () => {
      const undoActions: AnyAction[] = [];
      settingsPushUndoHistoryMap[ActionType.changeShow](
        undoActions,
        changeShowAction({ show: Show.columnUnique, value: true }),
        state()
      );
      settingsPushUndoHistoryMap[ActionType.changeShow](
        undoActions,
        changeShowAction({ show: Show.columnUnique, value: false }),
        state()
      );

      expect(undoActions).toEqual([
        changeShowAction({ show: Show.columnUnique, value: false }),
        changeShowAction({ show: Show.columnUnique, value: true }),
      ]);
    });

    it('changeZoomLevel pushes the pre-change zoom level', () => {
      store.dispatchSync(changeZoomLevelAction({ value: 0.6 }));

      const undoActions: AnyAction[] = [];
      settingsPushUndoHistoryMap[ActionType.changeZoomLevel](
        undoActions,
        changeZoomLevelAction({ value: 0.2 }),
        state()
      );

      expect(undoActions).toEqual([changeZoomLevelAction({ value: 0.6 })]);
    });
  });

  describe('settingsPushStreamHistoryMap', () => {
    it('covers exactly the streaming settings actions', () => {
      expect(Object.keys(settingsPushStreamHistoryMap).sort()).toEqual(
        [ActionType.streamScrollTo, ActionType.streamZoomLevel].sort()
      );
    });

    describe('streamScrollTo', () => {
      const run = (actions: AnyAction[]) => {
        const undoActions: AnyAction[] = [];
        const redoActions: AnyAction[] = [];
        settingsPushStreamHistoryMap[ActionType.streamScrollTo](
          undoActions,
          redoActions,
          actions
        );
        return { undoActions, redoActions };
      };

      it('does nothing when no streamScrollTo action is present', () => {
        const { undoActions, redoActions } = run([
          changeZoomLevelAction({ value: 0.5 }),
        ]);

        expect(undoActions).toEqual([]);
        expect(redoActions).toEqual([]);
      });

      it('does nothing when the accumulated movement is below the minimum', () => {
        const { undoActions, redoActions } = run([
          streamScrollToAction({ movementX: 5, movementY: 5 }),
          streamScrollToAction({ movementX: 4, movementY: 5 }),
        ]);

        expect(undoActions).toEqual([]);
        expect(redoActions).toEqual([]);
      });

      it('pushes the summed movement and its inverse once past the minimum', () => {
        const { undoActions, redoActions } = run([
          streamScrollToAction({ movementX: 10, movementY: -6 }),
          changeZoomLevelAction({ value: 0.5 }),
          streamScrollToAction({ movementX: 5, movementY: -4 }),
        ]);

        expect(redoActions).toEqual([
          streamScrollToAction({ movementX: 15, movementY: -10 }),
        ]);
        expect(undoActions).toEqual([
          streamScrollToAction({ movementX: -15, movementY: 10 }),
        ]);
      });

      it('measures the threshold on the sum of absolute components', () => {
        const exactlyAtMin = run([
          streamScrollToAction({ movementX: 20, movementY: 0 }),
        ]);
        expect(exactlyAtMin.redoActions).toEqual([
          streamScrollToAction({ movementX: 20, movementY: 0 }),
        ]);

        const justBelow = run([
          streamScrollToAction({ movementX: -19.9, movementY: 0 }),
        ]);
        expect(justBelow.redoActions).toEqual([]);
      });
    });

    describe('streamZoomLevel', () => {
      const run = (actions: AnyAction[]) => {
        const undoActions: AnyAction[] = [];
        const redoActions: AnyAction[] = [];
        settingsPushStreamHistoryMap[ActionType.streamZoomLevel](
          undoActions,
          redoActions,
          actions
        );
        return { undoActions, redoActions };
      };

      it('does nothing when no streamZoomLevel action is present', () => {
        const { undoActions, redoActions } = run([
          streamScrollToAction({ movementX: 100, movementY: 100 }),
        ]);

        expect(undoActions).toEqual([]);
        expect(redoActions).toEqual([]);
      });

      it('pushes the summed delta and its inverse without a threshold', () => {
        const { undoActions, redoActions } = run([
          streamZoomLevelAction({ value: -0.1 }),
          streamScrollToAction({ movementX: 1, movementY: 1 }),
          streamZoomLevelAction({ value: -0.2 }),
        ]);

        expect(redoActions).toHaveLength(1);
        expect(redoActions[0].type).toBe(streamZoomLevelAction.type);
        expect(redoActions[0].payload.value).toBeCloseTo(-0.3, 10);

        expect(undoActions).toHaveLength(1);
        expect(undoActions[0].type).toBe(streamZoomLevelAction.type);
        expect(undoActions[0].payload.value).toBeCloseTo(0.3, 10);
      });
    });
  });
});
