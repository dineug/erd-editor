import { Channel } from '@/channel';
import { go } from '@/go';
import { take } from '@/operators/take';

export const debounce = <
  T = any,
  F extends (value: T) => any = (value: T) => any,
>(
  channel: Channel<T>,
  callback: F,
  ms: number
) =>
  go(function* () {
    let timerId = -1;

    while (true) {
      const value: any = yield take(channel);

      clearTimeout(timerId);
      timerId = setTimeout(go, ms, callback, value);
    }
  });
