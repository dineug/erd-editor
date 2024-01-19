declare global {
  interface Window {
    cefQuery: (arg: any) => number;
  }
}
