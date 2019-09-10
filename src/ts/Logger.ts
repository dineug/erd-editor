enum Level {
  info = 'info',
  debug = 'debug',
  warn = 'warn',
  error = 'error',
}

interface Option {
  level: Level;
}

export default class Logger {
  public static info(...logs: any) {
    Logger.log(logs, {
      level: Level.info,
    });
  }

  public static debug(...logs: any) {
    Logger.log(logs, {
      level: Level.debug,
    });
  }

  public static warn(...logs: any) {
    Logger.log(logs, {
      level: Level.warn,
    });
  }

  public static error(...logs: any) {
    Logger.log(logs, {
      level: Level.error,
    });
  }

  private static log(logs: any[], option: Option) {
    if (process.env.NODE_ENV === 'production') {
      logs.forEach((log: any) => {
        switch (option.level) {
          case Level.warn:
            window.console.warn(log);
            break;
          case Level.error:
            window.console.error(log);
            break;
        }
      });
    } else if (process.env.NODE_ENV === 'development') {
      logs.forEach((log: any) => {
        switch (option.level) {
          case Level.info:
          case Level.debug:
            window.console.dir(log);
            break;
          case Level.warn:
            window.console.warn(log);
            break;
          case Level.error:
            window.console.error(log);
            break;
        }
      });
    }
  }
}
