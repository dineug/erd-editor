export default class Logger {
  public static debug(...logs: any) {
    if (process.env.NODE_ENV === "development") {
      logs.forEach((log: any) => {
        window.console.dir(log);
      });
    }
  }

  public static warn(...logs: any) {
    logs.forEach((log: any) => {
      window.console.warn(log);
    });
  }

  public static error(...logs: any) {
    logs.forEach((log: any) => {
      window.console.error(log);
    });
  }
}
