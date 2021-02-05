export const css = (arr: TemplateStringsArray, ...values: any[]) =>
  arr
    .reduce<Array<string>>(
      (acc, cur, i) => [...acc, cur, `${values[i] ?? ''}`],
      []
    )
    .join('');
