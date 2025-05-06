import { Channel } from '@/channel';
import { go } from '@/go';
import { attachCancel } from '@/operators/cancel';

export const take = <T = any>(channel: Channel<T>) =>
  go(function* () {
    let drop = () => false;

    const promise = new Promise<T>((resolve, reject) => {
      drop = channel.take(resolve, reject);
    });

    attachCancel(promise, () => {
      drop();
    });

    const value: T = yield promise;
    return value;
  });
