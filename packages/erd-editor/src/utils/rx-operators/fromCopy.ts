import { Observable } from 'rxjs';

import { Emitter } from '@/utils/emitter';

export const fromCopy = (emitter: Emitter) =>
  new Observable<ClipboardEvent>(subscriber =>
    emitter.on({
      copy: ({ payload: { event } }) => {
        subscriber.next(event);
      },
    })
  );
