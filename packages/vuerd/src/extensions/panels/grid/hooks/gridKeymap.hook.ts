import { beforeMount, closestElement, watch } from '@vuerd/lit-observable';

import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { keymapMatchAndStop } from '@/core/keymap';
import { moveKeys } from '@/engine/store/editor.state';
import { GridEditorElement } from '@/extensions/panels/grid/components/GridEditor';
import { useKeydown } from '@/extensions/panels/grid/hooks/keydown.hook';
import { MoveKey } from '@@types/engine/store/editor.state';

export function useGridKeymap(ctx: GridEditorElement) {
  const { unmountedGroup } = useUnmounted();
  const { keydown$ } = useKeydown(ctx);

  const onFocusEditor = () => {
    const vEditor = closestElement('vuerd-editor', ctx) as HTMLElement | null;
    const eEditor = closestElement('erd-editor', ctx) as HTMLElement | null;

    vEditor?.focus();
    eEditor?.focus();
  };

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
          ctx.focus();
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

      if (keymapMatchAndStop(event, keymap.stop)) {
        store.dispatch(command.editor.filterActiveEnd$());

        if (filterState.active) {
          ctx.focus();
        }
      }
    }
  };

  beforeMount(() => {
    const { filterState } = ctx.api.store.editorState;

    unmountedGroup.push(
      keydown$.subscribe(onKeydown),
      watch(filterState, propName => {
        if (propName !== 'active') return;

        filterState.active && onFocusEditor();
      })
    );
  });
}
