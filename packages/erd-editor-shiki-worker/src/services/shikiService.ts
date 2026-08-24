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

const themeMap = {
  dark: 'github-dark',
  light: 'github-light',
} as const;

function getThemeKey(theme?: string): 'dark' | 'light' {
  return theme === 'dark' || theme === 'light' ? theme : 'dark';
}

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
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  }

  async codeToHtml(
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
        | 'scala'
        | 'go'
        | 'python';
      theme?: 'dark' | 'light';
    }
  ): Promise<string> {
    const highlighter = await this.highlighter;

    return highlighter.codeToHtml(code, {
      lang,
      theme: themeMap[getThemeKey(theme)],
    });
  }
}
