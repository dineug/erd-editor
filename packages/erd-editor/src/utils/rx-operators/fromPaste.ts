import { Observable } from 'rxjs';

import { Emitter } from '@/utils/emitter';

export const fromPaste = (emitter: Emitter) =>
  new Observable<ClipboardEvent>(subscriber =>
    emitter.on({
      paste: ({ payload: { event } }) => {
        subscriber.next(event);
      },
    })
  );
