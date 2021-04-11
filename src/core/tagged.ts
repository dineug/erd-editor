export const css = (arr: TemplateStringsArray, ...values: any[]) =>
  arr
    .reduce<Array<string>>(
      (acc, cur, i) => acc.concat(cur, `${values[i] ?? ''}`),
      []
    )
    .join('');
