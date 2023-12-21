export type ValuesType<T extends Record<string, string>> = T[keyof T];

type Action<K extends keyof M, M> = {
  type: K;
  payload: M[K];
};

export type AnyAction<P = any> = {
  type: string;
  payload: P;
};

type Reducer<K extends keyof M, M> = (action: Action<K, M>) => void;

export type ReducerRecord<K extends keyof M, M> = {
  [P in K]: Reducer<P, M>;
};

export type Callback = (...args: any[]) => any;
