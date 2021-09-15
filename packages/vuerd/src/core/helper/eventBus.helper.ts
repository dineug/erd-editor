import { Observable } from 'rxjs';

export function createEventBus() {
  const bus = document.createElement('div');

  const on = (eventName: string) =>
    new Observable<any>(subscriber => {
      const handler = (event: any) => subscriber.next(event.detail);

      bus.addEventListener(eventName, handler);

      return () => bus.removeEventListener(eventName, handler);
    });

  const emit = (eventName: string, detail?: any) => {
    bus.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
      })
    );
  };

  return {
    on,
    emit,
  };
}

enum BalanceRange {
  move = 'BalanceRange.move',
}

enum Drawer {
  openTableProperties = 'Drawer.openTableProperties',
  close = 'Drawer.close',
}

enum Contextmenu {
  close = 'Contextmenu.close',
}

enum ColorPicker {
  close = 'ColorPicker.close',
  open = 'ColorPicker.open',
}

enum ToastBar {
  add = 'ToastBar.add',
}

enum Liquibase {
  progress = 'Liquibase.liquibase-progress',
  progressEnd = 'Liquibase.liquibase-progress-end',
}

export const Bus = {
  BalanceRange,
  Drawer,
  Contextmenu,
  Liquibase,
  ColorPicker,
  ToastBar,
};
