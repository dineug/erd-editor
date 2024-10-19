import { isObject, isString, safeCallback } from '@dineug/shared';

export type Command<P> = {
  type: string;
};

export type CommandListener<P> = (payload: P) => void;

export type CommandPayload<T extends Command<unknown>> =
  T extends Command<infer P> ? P : never;

export type Dispose = () => void;

export type AnyAction<P = any> = {
  type: string;
  payload: P;
};

export function createCommand<T = void>(type: string): Command<T> {
  return { type };
}

export class Bridge {
  #commands = new Map<string, Set<CommandListener<any>>>();

  static mergeRegister(...disposables: Dispose[]) {
    return () => {
      disposables.forEach(dispose => dispose());
    };
  }

  static executeCommand<T extends Command<unknown>>(
    command: T,
    payload: CommandPayload<T>
  ): AnyAction {
    return {
      type: command.type,
      payload,
    };
  }

  registerCommand<P>(
    command: Command<P>,
    listener: CommandListener<P>
  ): Dispose {
    const listeners = this.#commands.get(command.type) ?? new Set();
    listeners.add(listener);

    if (!this.#commands.has(command.type)) {
      this.#commands.set(command.type, listeners);
    }

    return () => {
      listeners.delete(listener);
    };
  }

  executeAction(action: AnyAction) {
    if (!isAction(action)) return;

    const listeners = this.#commands.get(action.type);
    listeners?.forEach(listener => safeCallback(listener, action.payload));
  }
}

function isAction(action: AnyAction) {
  return isObject(action) && isString(action.type);
}
