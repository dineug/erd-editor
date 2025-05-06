export type ChannelBuffer<T = any> = {
  isEmpty(): boolean;
  put(value: T): void;
  take(): T | undefined;
  flush(): Array<T>;
  drop(predicate: (value: T) => boolean): boolean;
};
