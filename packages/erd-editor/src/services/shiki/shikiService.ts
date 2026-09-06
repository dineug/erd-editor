import csharp from '@shikijs/langs/csharp';
import go from '@shikijs/langs/go';
import graphql from '@shikijs/langs/graphql';
import java from '@shikijs/langs/java';
import kotlin from '@shikijs/langs/kotlin';
import python from '@shikijs/langs/python';
import scala from '@shikijs/langs/scala';
import sql from '@shikijs/langs/sql';
import typescript from '@shikijs/langs/typescript';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import type { Lang } from '@/constants/language';

const themeMap = {
  dark: 'github-dark',
  light: 'github-light',
} as const;

function getThemeKey(theme?: string): 'dark' | 'light' {
  return theme === 'dark' || theme === 'light' ? theme : 'dark';
}

/**
 * Shiki behind the one method the code panels call, instantiated in the shared
 * worker and nowhere else. The grammars are exactly what constants/language.ts
 * maps a Language onto, imported one by one so the worker carries no others.
 *
 * @example
 * const html = await new ShikiService().codeToHtml('select 1', { lang: 'sql' });
 */
export class ShikiService {
  private highlighter: Promise<HighlighterCore>;

  constructor() {
    this.highlighter = createHighlighterCore({
      themes: [githubDark, githubLight],
      langs: [
        sql,
        typescript,
        graphql,
        csharp,
        java,
        kotlin,
        scala,
        go,
        python,
      ],
      // Plain javascript rather than oniguruma, so no host needs wasm-unsafe-eval
      // in its policy; forgiving turns a grammar the engine cannot transpile into
      // missing colour instead of a throw.
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  }

  async codeToHtml(
    code: string,
    { lang, theme }: { lang: Lang; theme?: 'dark' | 'light' }
  ): Promise<string> {
    const highlighter = await this.highlighter;

    return highlighter.codeToHtml(code, {
      lang,
      theme: themeMap[getThemeKey(theme)],
    });
  }
}
