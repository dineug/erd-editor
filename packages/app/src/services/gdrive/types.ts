/** fetch as the client calls it: always without a receiver, so bind it where it is assembled. */
export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type MessageListener = (event: MessageEvent) => void;

/** A BroadcastChannel, or the test hub's stand-in for one. */
export type ChannelLike = {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
  close(): void;
};

export type CreateChannel = (name: string) => ChannelLike;

/** navigator.locks as far as an exclusive request goes. */
export type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};
