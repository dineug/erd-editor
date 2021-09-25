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

export const eventBus = createEventBus();

enum EditorTab {
  draggableStart = 'EditorTab.draggableStart',
  draggableEnd = 'EditorTab.draggableEnd',
}

enum EditorViewer {
  dropStart = 'EditorViewer.dropStart',
  dropEnd = 'EditorViewer.dropEnd',
  dropViewStart = 'EditorViewer.dropViewStart',
  dropViewEnd = 'EditorViewer.dropViewEnd',
  editorLoad = 'EditorViewer.editorLoad',
}

enum Editor {
  dragstart = 'Editor.dragstart',
  dragend = 'Editor.dragend',
}

enum TreeNode {
  draggableStart = 'TreeNode.draggableStart',
  draggableEnd = 'TreeNode.draggableEnd',
}

enum OpenFile {
  draggableStart = 'OpenFile.draggableStart',
  draggableEnd = 'OpenFile.draggableEnd',
}

enum App {
  save = 'App.save',
}

export const Bus = {
  EditorTab,
  EditorViewer,
  Editor,
  TreeNode,
  OpenFile,
  App,
};
