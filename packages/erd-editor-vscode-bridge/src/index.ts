import {
  AnyAction,
  Callback,
  ReducerRecord,
  ValuesType,
} from '@/internal-types';
import {
  AccentColor,
  Appearance,
  GrayColor,
  ThemeOptions,
} from '@/themes/radix-ui-theme';

export type { AnyAction, ThemeOptions };

export { AccentColor, Appearance, GrayColor };

const BridgeActionType = {
  vscodeExportFile: 'vscodeExportFile',
  vscodeImportFile: 'vscodeImportFile',
  vscodeSaveValue: 'vscodeSaveValue',
  vscodeInitial: 'vscodeInitial',
  vscodeSaveTheme: 'vscodeSaveTheme',
  webviewImportFile: 'webviewImportFile',
  webviewInitialValue: 'webviewInitialValue',
  webviewUpdateTheme: 'webviewUpdateTheme',
} as const;
type BridgeActionType = ValuesType<typeof BridgeActionType>;

type BridgeActionMap = {
  [BridgeActionType.vscodeExportFile]: {
    value: number[];
    fileName: string;
  };
  [BridgeActionType.vscodeImportFile]: {
    type: 'json' | 'sql';
    accept: string;
  };
  [BridgeActionType.vscodeSaveValue]: {
    value: number[];
  };
  [BridgeActionType.vscodeInitial]: void;
  [BridgeActionType.vscodeSaveTheme]: ThemeOptions;
  [BridgeActionType.webviewImportFile]: {
    type: 'json' | 'sql';
    value: number[];
  };
  [BridgeActionType.webviewInitialValue]: {
    value: number[];
  };
  [BridgeActionType.webviewUpdateTheme]: Partial<ThemeOptions>;
};

function safeCallback<F extends Callback>(
  callback?: F | void,
  ...args: Parameters<F>
) {
  try {
    return callback?.(...args);
  } catch (e) {
    console.error(e);
  }
}

function createAction<P = void>(type: string) {
  function actionCreator(payload: P): AnyAction<P> {
    return { type, payload };
  }

  actionCreator.toString = () => `${type}`;
  actionCreator.type = type;
  return actionCreator;
}

export class Emitter<M extends BridgeActionMap> {
  #observers = new Set<Partial<ReducerRecord<keyof M, M>>>();

  on(reducers: Partial<ReducerRecord<keyof M, M>>) {
    this.#observers.has(reducers) || this.#observers.add(reducers);

    return () => {
      this.#observers.delete(reducers);
    };
  }

  emit(action: AnyAction) {
    this.#observers.forEach(reducers => {
      const reducer = Reflect.get(reducers, action.type);
      safeCallback(reducer, action);
    });
  }
}

export const vscodeExportFileAction = createAction<
  BridgeActionMap[typeof BridgeActionType.vscodeExportFile]
>(BridgeActionType.vscodeExportFile);

export const vscodeImportFileAction = createAction<
  BridgeActionMap[typeof BridgeActionType.vscodeImportFile]
>(BridgeActionType.vscodeImportFile);

export const vscodeSaveValueAction = createAction<
  BridgeActionMap[typeof BridgeActionType.vscodeSaveValue]
>(BridgeActionType.vscodeSaveValue);

export const vscodeInitialAction = createAction<
  BridgeActionMap[typeof BridgeActionType.vscodeInitial]
>(BridgeActionType.vscodeInitial);

export const vscodeSaveThemeAction = createAction<
  BridgeActionMap[typeof BridgeActionType.vscodeSaveTheme]
>(BridgeActionType.vscodeSaveTheme);

export const webviewImportFileAction = createAction<
  BridgeActionMap[typeof BridgeActionType.webviewImportFile]
>(BridgeActionType.webviewImportFile);

export const webviewInitialValueAction = createAction<
  BridgeActionMap[typeof BridgeActionType.webviewInitialValue]
>(BridgeActionType.webviewInitialValue);

export const webviewUpdateThemeAction = createAction<
  BridgeActionMap[typeof BridgeActionType.webviewUpdateTheme]
>(BridgeActionType.webviewUpdateTheme);
