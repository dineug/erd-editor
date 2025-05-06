import { Channel, type TakeCallback } from '@/channel';
import { go } from '@/go';
import { take } from '@/operators/take';

export const takeEvery = <T = any, F extends TakeCallback<T> = TakeCallback<T>>(
  channel: Channel<T>,
  callback: F
) =>
  go(function* () {
    while (true) {
      const value = yield take(channel);
      // @ts-ignore
      go(callback, value);
    }
  });
