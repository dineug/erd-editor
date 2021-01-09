export class Logger {
  static debug = (...args: any[]) => args.forEach(console.dir);
  static log = console.log;
  static warn = console.warn;
  static error = console.error;
}
