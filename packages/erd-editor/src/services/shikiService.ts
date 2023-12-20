import { loadShikiServiceAction } from '@/utils/emitter';
import { globalEmitter } from '@/utils/globalEmitter';

type LazyShikiService = {
  getInstance(): ShikiService;
};

export type ShikiService = {
  codeToHtml(
    code: string,
    {
      lang,
      theme,
    }: {
      lang:
        | 'sql'
        | 'typescript'
        | 'graphql'
        | 'csharp'
        | 'java'
        | 'kotlin'
        | 'scala';
      theme?: 'dark' | 'light';
    }
  ): Promise<string>;
};

let shikiService: LazyShikiService | null;

export function setShikiService(service: LazyShikiService) {
  shikiService = service;
  globalEmitter.emit(loadShikiServiceAction());
}

export function getShikiService() {
  return shikiService?.getInstance() ?? null;
}
