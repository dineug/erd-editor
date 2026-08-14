export const delay = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

export function closePromise(): [Promise<void>, () => void] {
  let callback = () => {};
  return [
    new Promise<void>(resolve => {
      callback = resolve;
    }),
    () => callback(),
  ];
}
