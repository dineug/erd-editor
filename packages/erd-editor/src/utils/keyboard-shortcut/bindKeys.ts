import {
  isModifierHeld,
  type KeyBindingPress,
  matchesPress,
  parseKeybinding,
} from './utils';

/** A handler per shortcut, whose presses of a sequence a space separates. */
export type KeyBindingHandlers = Record<string, (event: KeyboardEvent) => void>;

/** How long a sequence waits between two keydowns before it starts over, in ms. */
const SEQUENCE_TIMEOUT = 1000;

/**
 * Calls each shortcut's handler on the target's keydown that completes it and
 * returns the unbinding. A modifier's own keydown keeps a sequence going; any
 * other miss, or a second with no keydown, sends it back to its first press.
 */
export function bindKeys(
  target: EventTarget,
  handlers: KeyBindingHandlers
): () => void {
  const bindings = Object.keys(handlers).map(
    shortcut => [parseKeybinding(shortcut), handlers[shortcut]] as const
  );
  const pending = new Map<KeyBindingPress[], KeyBindingPress[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handleKeydown = (event: Event) => {
    // Chrome's autofill sends a keydown that is no KeyboardEvent.
    if (!(event instanceof KeyboardEvent)) return;

    bindings.forEach(([sequence, handler]) => {
      const presses = pending.get(sequence) ?? sequence;

      if (!matchesPress(event, presses[0])) {
        if (!isModifierHeld(event, event.key)) pending.delete(sequence);
      } else if (presses.length > 1) {
        pending.set(sequence, presses.slice(1));
      } else {
        pending.delete(sequence);
        handler(event);
      }
    });

    clearTimeout(timer);
    timer = setTimeout(() => pending.clear(), SEQUENCE_TIMEOUT);
  };

  target.addEventListener('keydown', handleKeydown);

  return () => {
    target.removeEventListener('keydown', handleKeydown);
    clearTimeout(timer);
  };
}
