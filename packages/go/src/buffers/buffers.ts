import { LimitBuffer, type LimitBufferConfig } from '@/buffers/limitBuffer';

const limitBuffer = <T = any>(config?: LimitBufferConfig) =>
  new LimitBuffer<T>(config);

export const buffers = {
  limitBuffer,
} as const;
