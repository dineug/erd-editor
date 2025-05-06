import { Channel } from '@/channel';

export const flush = <T = any>(channel: Channel<T>) =>
  new Promise<Array<T>>((resolve, reject) => channel.flush(resolve, reject));
