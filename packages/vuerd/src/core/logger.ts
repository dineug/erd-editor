export class Logger {
  static debug = (...args: any[]) => args.forEach(console.dir);
  static log = (...data: any[]) => {
    logEvent(data);
    console.log(data);
  };
  static warn = console.warn;
  static error = console.error;
}

function logEvent(...data: any[]) {
  const editor = document.querySelector('erd-editor');

  editor?.dispatchEvent(
    new CustomEvent('console-log', {
      detail: data,
    })
  );
}
