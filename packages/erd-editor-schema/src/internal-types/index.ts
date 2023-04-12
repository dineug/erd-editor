export type ValuesType<T extends Record<string, string>> = T[keyof T];

export type DeepPartial<T> = T extends
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | symbol
  ? T | undefined
  : T extends Array<infer ArrayType>
  ? Array<DeepPartial<ArrayType>>
  : T extends ReadonlyArray<infer ArrayType>
  ? ReadonlyArray<ArrayType>
  : {
      [K in keyof T]?: DeepPartial<T[K]>;
    };

export type PartialRecord<T> = Partial<Record<string, T>>;

export type EntityMeta = {
  updateAt: string;
  createAt: string;
};

export type EntityType<T> = T & {
  meta: EntityMeta;
};
