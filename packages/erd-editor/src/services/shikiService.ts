import { loadShikiServiceAction } from '@/utils/emitter';
import { globalEmitter } from '@/utils/globalEmitter';

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

let getService: () => ShikiService | null = () => null;

export function setGetShikiServiceCallback(
  callback: () => ShikiService | null
) {
  getService = callback;
  globalEmitter.emit(loadShikiServiceAction());
}

export function getShikiService() {
  return getService();
}
