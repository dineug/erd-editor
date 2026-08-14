export const groupBy = <T>(list: Array<T>, identity: (value: T) => string) =>
  list.reduce<Record<string, Array<T>>>((acc, cur) => {
    const key = identity(cur);
    const arr = acc[key];
    arr ? arr.push(cur) : (acc[key] = [cur]);
    return acc;
  }, Object.create(null));
