export const css = (arr: TemplateStringsArray, ...values: any[]) =>
  arr
    .reduce<Array<string>>((acc, cur, i) => {
      i < values.length ? acc.push(cur, values[i] ?? '') : acc.push(cur);
      return acc;
    }, [])
    .join('');
