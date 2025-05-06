import { Channel } from '@/channel';
import { go } from '@/go';
import { take } from '@/operators/take';

export type ThrottleConfig = Partial<{
  leading: boolean;
  trailing: boolean;
}>;

const defaultConfig: Required<ThrottleConfig> = {
  leading: true,
  trailing: false,
};

export const throttle = <
  T = any,
  F extends (value: T) => any = (value: T) => any,
>(
  channel: Channel<T>,
  callback: F,
  ms: number,
  config?: ThrottleConfig
) =>
  go(function* () {
    const options = Object.assign({}, defaultConfig, {
      ...config,
    });
    let timerId = -1;
    let leadingValue: any;
    let trailingValue: any;

    while (true) {
      const value: any = yield take(channel);
      trailingValue = value;

      if (timerId !== -1) continue;

      if (options.leading) {
        leadingValue = value;
        // @ts-ignore
        go(callback, value);
      }

      timerId = setTimeout(() => {
        if (
          options.trailing &&
          (!options.leading || leadingValue !== trailingValue)
        ) {
          // @ts-ignore
          go(callback, trailingValue);
        }
        timerId = -1;
      }, ms);
    }
  });
