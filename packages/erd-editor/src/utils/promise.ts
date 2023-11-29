export function closePromise(): [Promise<void>, () => void] {
  let callback = () => {};
  return [
    new Promise<void>(resolve => {
      callback = resolve;
    }),
    () => callback(),
  ];
}
