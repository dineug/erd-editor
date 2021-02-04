export interface CommandMap {}

export type CommandKey = keyof CommandMap;

export interface CommandType<K extends CommandKey> {
  name: K;
  data?: CommandMap[K];
}

export interface CommandTypeAny {
  name: string;
  data?: any;
}
