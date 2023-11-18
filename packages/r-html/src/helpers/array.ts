export const groupBy = <T>(list: Array<T>, identity: (value: T) => string) =>
  list.reduce<Record<string, Array<T>>>((acc, cur) => {
    const arr = acc[identity(cur)];
    arr ? arr.push(cur) : (acc[identity(cur)] = [cur]);
    return acc;
  }, {});
