import { MoveKey } from '@@types/engine/store/editor.state';
import { beforeMount } from '@dineug/lit-observable';
import { GridElement } from '@/extensions/panels/grid/components/Grid';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useKeydown } from '@/extensions/panels/grid/hooks/keydown.hook';
import { moveKeys } from '@/engine/store/editor.state';
import { keymapMatchAndStop } from '@/core/keymap';

export function useGridKeymap(ctx: GridElement) {
  const { unmountedGroup } = useUnmounted();
  const { keydown$ } = useKeydown(ctx);

  const onKeydown = (event: KeyboardEvent) => {
    const { keymap, store, command } = ctx.api;
    const { filterState } = store.editorState;
    const {
      editFilterEnd,
      editFilter,
      focusMoveFilter,
      focusMoveFilter$,
      addFilter$,
      selectAllFilter,
      removeFilter$,
    } = command.editor;

    if (!filterState.focus || !filterState.focus.edit) {
      if (keymapMatchAndStop(event, keymap.find)) {
        if (filterState.active) {
          store.dispatch(command.editor.filterActiveEnd$());
        } else {
          store.dispatch(command.editor.filterActive$());
        }
      }

      filterState.active &&
        keymapMatchAndStop(event, keymap.addColumn) &&
        store.dispatch(addFilter$());
    }

    if (filterState.active) {
      if (filterState.active && filterState.focus && !filterState.focus.edit) {
        keymapMatchAndStop(event, keymap.selectAllColumn) &&
          store.dispatch(selectAllFilter());

        filterState.focus.selectFilterIds.length &&
          keymapMatchAndStop(event, keymap.removeColumn) &&
          store.dispatch(
            removeFilter$(store, filterState.focus.selectFilterIds)
          );

        event.key !== 'Tab' &&
          moveKeys.includes(event.key as MoveKey) &&
          store.dispatch(focusMoveFilter(event.key as MoveKey, event.shiftKey));
      }

      if (filterState.focus && event.key === 'Tab') {
        event.preventDefault();
        store.dispatch(
          focusMoveFilter$(store, event.key as MoveKey, event.shiftKey)
        );

        setTimeout(() => store.dispatch(editFilter()), 0);
      }

      if (filterState.focus && keymapMatchAndStop(event, keymap.edit)) {
        const focus = filterState.focus;

        focus.edit
          ? store.dispatch(editFilterEnd())
          : store.dispatch(editFilter());
      }

      keymapMatchAndStop(event, keymap.stop) &&
        store.dispatch(command.editor.filterActiveEnd$());
    }
  };

  beforeMount(() => unmountedGroup.push(keydown$.subscribe(onKeydown)));
}
