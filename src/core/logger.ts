export class Logger {
  static debug(...args: any[]) {
    args.forEach(arg => console.dir(arg));
  }
  static log = console.log;
  static warn = console.warn;
  static error = console.error;
}
