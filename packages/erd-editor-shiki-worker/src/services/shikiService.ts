import { getHighlighter, setWasm, toShikiTheme } from 'shiki';
// @ts-ignore
import wasmUrl from 'shiki/dist/onig.wasm?url';
import csharp from 'shiki/languages/csharp.tmLanguage.json';
import graphql from 'shiki/languages/graphql.tmLanguage.json';
import java from 'shiki/languages/java.tmLanguage.json';
import kotlin from 'shiki/languages/kotlin.tmLanguage.json';
import scala from 'shiki/languages/scala.tmLanguage.json';
import sql from 'shiki/languages/sql.tmLanguage.json';
import typescript from 'shiki/languages/typescript.tmLanguage.json';
import githubDark from 'shiki/themes/github-dark.json';
import githubLight from 'shiki/themes/github-light.json';

const themeMap: Record<string, any> = {
  dark: githubDark,
  light: githubLight,
};

const languages: Array<any> = [
  {
    id: 'typescript',
    scopeName: 'source.ts',
    displayName: 'TypeScript',
    aliases: ['ts'],
    grammar: typescript,
  },
  {
    id: 'sql',
    scopeName: 'source.sql',
    displayName: 'SQL',
    grammar: sql,
  },
  {
    id: 'graphql',
    scopeName: 'source.graphql',
    displayName: 'GraphQL',
    aliases: ['gql'],
    grammar: graphql,
  },
  {
    id: 'csharp',
    scopeName: 'source.cs',
    displayName: 'C#',
    aliases: ['c#', 'cs'],
    grammar: csharp,
  },
  {
    id: 'java',
    scopeName: 'source.java',
    displayName: 'Java',
    grammar: java,
  },
  {
    id: 'kotlin',
    scopeName: 'source.kotlin',
    displayName: 'Kotlin',
    aliases: ['kt', 'kts'],
    grammar: kotlin,
  },
  {
    id: 'scala',
    scopeName: 'source.scala',
    displayName: 'Scala',
    grammar: scala,
  },
];

function getThemeKey(theme?: string): 'dark' | 'light' {
  return theme === 'dark' || theme === 'light' ? theme : 'dark';
}

export class ShikiService {
  private ready: Promise<void>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      fetch(wasmUrl)
        .then(wasmResponse => {
          setWasm(wasmResponse);
          resolve();
        })
        .catch(reject);
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
        | 'scala';
      theme?: 'dark' | 'light';
    }
  ): Promise<string> {
    return await this.ready.then(async () => {
      const highlighter = await getHighlighter({
        theme: toShikiTheme(Reflect.get(themeMap, getThemeKey(theme))),
        langs: languages,
      });

      return highlighter.codeToHtml(code, { lang });
    });
  }
}
