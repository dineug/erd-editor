import { onMounted, Ref, watch } from '@dineug/r-html';
import { Subject } from 'rxjs';

import { useAppContext } from '@/components/context';
import { KeyBindingName, shortcutToTuple } from '@/keyboard-shortcut';
import { tinykeys } from '@/keyboard-shortcut/tinykeys';

import { useUnmounted } from './useUnmounted';

export function useKeyBindingMap(
  ctx: Parameters<typeof useAppContext>[0],
  root: Ref<HTMLDivElement>
) {
  const app = useAppContext(ctx);
  const perform$ = new Subject<KeyBindingName>();
  const { addUnsubscribe } = useUnmounted();

  let unbinding = () => {};

  const keyBinding = () => {
    const { keyBindingMap } = app.value;
    unbinding();
    unbinding = tinykeys(
      root.value,
      Object.keys(keyBindingMap).reduce<
        Record<string, (event: KeyboardEvent) => void>
      >((acc, key) => {
        const name = key as KeyBindingName;
        const options = keyBindingMap[name];

        options.forEach(option => {
          acc[option.shortcut] = (event: KeyboardEvent) => {
            if (option.preventDefault) {
              event.preventDefault();
            }

            if (option.stopPropagation) {
              event.stopPropagation();
            }

            perform$.next(name);
          };
        });

        return acc;
      }, {})
    );
  };

  const perform = (name: KeyBindingName) => {
    const { store, keyBindingMap } = app.value;
    const { editor } = store.state;
    console.log('shortcut:', name, shortcutToTuple(keyBindingMap[name]));
  };

  onMounted(() => {
    const { keyBindingMap } = app.value;
    keyBinding();
    addUnsubscribe(
      watch(keyBindingMap).subscribe(keyBinding),
      () => unbinding(),
      perform$.subscribe(perform)
    );
  });
}
