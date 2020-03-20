export class Logger {
  static debug(...args: any) {
    args.forEach((arg: any) => console.dir(arg));
  }

  static log(...args: any) {
    args.forEach((arg: any) => console.log(arg));
  }

  static error(...args: any) {
    args.forEach((arg: any) => console.error(arg));
  }
}
