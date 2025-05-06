import { Channel } from '@/channel';

export const put = <T = any>(channel: Channel<T>, value: T) => {
  channel.put(value);
};
