import { closestElement, mounted } from '@dineug/lit-observable';
import { fromEvent } from 'rxjs';
import { GridElement } from '@/extensions/panels/grid/components/Grid';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { ignoreEnterProcess } from '@/core/operators/ignoreEnterProcess';
import { keymapMatchAndStop } from '@/core/keymap';

export function useGridKeymap(ctx: GridElement) {
  const { unmountedGroup } = useUnmounted();
  let $editor: HTMLElement | null = null;

  const onKeydown = (event: KeyboardEvent) => {
    const { keymap, store, command } = ctx.api;
    const { filterState } = store.editorState;

    if (keymapMatchAndStop(event, keymap.find)) {
      if (filterState.active) {
        store.dispatch(command.editor.filterActiveEnd());
      } else {
        store.dispatch(command.editor.filterActive());
      }
    }

    keymapMatchAndStop(event, keymap.stop) &&
      store.dispatch(command.editor.filterActiveEnd());
  };

  mounted(() => {
    $editor = closestElement('.vuerd-editor', ctx) as HTMLElement;

    unmountedGroup.push(
      fromEvent<KeyboardEvent>($editor, 'keydown')
        .pipe(ignoreEnterProcess)
        .subscribe(onKeydown)
    );
  });
}
