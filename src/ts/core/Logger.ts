export class Logger {
  static debug(...args: any[]) {
    console.dir(...args);
  }

  static log(...args: any[]) {
    console.log(...args);
  }

  static warn(...args: any[]) {
    console.warn(...args);
  }

  static error(...args: any[]) {
    console.error(...args);
  }
}
