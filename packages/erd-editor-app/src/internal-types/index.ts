export type EntityType<T> = T & {
  id: string;
  updateAt: number;
  createAt: number;
};
