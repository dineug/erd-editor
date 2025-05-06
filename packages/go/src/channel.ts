import { buffers, type ChannelBuffer } from '@/buffers';

export type TakeCallback<T = any> = (value: T) => any;
export type CloseCallback = (error: typeof CLOSED) => void;
type CallbackTuple<T> = [TakeCallback<T>, CloseCallback | undefined];

export const CLOSED = Symbol.for('https://github.com/dineug/go.git#closed');
export const isClosed = (value: any): value is typeof CLOSED =>
  value === CLOSED;

export class Channel<T = any> {
  #buffer: ChannelBuffer<T>;
  #callbackBuffer: ChannelBuffer<CallbackTuple<T>> = buffers.limitBuffer();
  #closed = false;

  get closed() {
    return this.#closed;
  }

  constructor(buffer: ChannelBuffer<T> = buffers.limitBuffer()) {
    this.#buffer = buffer;
  }

  put(value: T) {
    if (this.#closed) return;

    this.#buffer.put(value);
    this.#notify();
  }

  take(callback: TakeCallback<T>, close?: (error: typeof CLOSED) => void) {
    if (this.#closed) {
      close?.(CLOSED);
      return () => false;
    }

    this.#callbackBuffer.put([callback, close]);
    this.#notify();

    return () => this.#callbackBuffer.drop(([cb]) => cb === callback);
  }

  flush(
    callback: (values: Array<T>) => void,
    close?: (error: typeof CLOSED) => void
  ) {
    if (this.#closed) {
      close?.(CLOSED);
      return;
    }

    callback(this.#buffer.flush());
  }

  close() {
    this.#closed = true;

    this.#callbackBuffer
      .flush()
      .forEach(([__callback, close]) => close?.(CLOSED));
  }

  #notify() {
    if (this.#callbackBuffer.isEmpty() || this.#buffer.isEmpty()) {
      return;
    }

    const [callback] = this.#callbackBuffer.take() as CallbackTuple<T>;
    const value = this.#buffer.take() as T;
    callback?.(value);
  }
}

export const channel = <T = any>(buffer?: ChannelBuffer<T>) =>
  new Channel(buffer);
