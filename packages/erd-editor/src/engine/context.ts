export type EngineContext = {
  toWidth: (text: string) => number;
};

export type InjectEngineContext = EngineContext;

export function createEngineContext(ctx: InjectEngineContext): EngineContext {
  return {
    ...ctx,
  };
}
