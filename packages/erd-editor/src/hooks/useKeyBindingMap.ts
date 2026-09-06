import { onMounted, Ref, watch } from '@dineug/r-html';
// @ts-ignore
import { tinykeys } from 'tinykeys';

import { useAppContext } from '@/components/appContext';
import { Ctx } from '@/internal-types';
import { isComposing, KeyBindingName } from '@/utils/keyboard-shortcut';
import { isEditableTarget } from '@/utils/validation';

import { useUnmounted } from './useUnmounted';

/**
 * The bindings a caret owns first. $mod+A is select all text wherever one is,
 * and a binding that swallowed it there would spend the press selecting
 * entities nobody was looking at.
 */
const YIELDS_TO_A_CARET = new Set<KeyBindingName>([
  KeyBindingName.selectAllTable,
]);

export function useKeyBindingMap(ctx: Ctx, root: Ref<HTMLDivElement>) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  let unbinding = () => {};

  const keyBinding = () => {
    const { keyBindingMap, shortcut$ } = app.value;
    const $root = root.value;

    unbinding();
    unbinding = tinykeys(
      $root,
      Object.keys(keyBindingMap).reduce<
        Record<string, (event: KeyboardEvent) => void>
      >((acc, key) => {
        const type = key as KeyBindingName;
        const options = keyBindingMap[type];

        options.forEach(option => {
          acc[option.shortcut] = (event: KeyboardEvent) => {
            if (isComposing(event)) {
              return;
            }

            if (YIELDS_TO_A_CARET.has(type) && isEditableTarget(event.target)) {
              return;
            }

            if (option.preventDefault) {
              event.preventDefault();
            }

            if (option.stopPropagation) {
              event.stopPropagation();
            }

            shortcut$.next({ type, event });
          };
        });

        return acc;
      }, {})
    );
  };

  onMounted(() => {
    const { keyBindingMap } = app.value;
    keyBinding();
    addUnsubscribe(watch(keyBindingMap).subscribe(keyBinding), () => {
      unbinding();
    });
  });
}
