import { HighlightTheme } from '@@types/engine/store/canvas.state';
import { MonokaiSublimeStyle } from '@/components/css/highlight/monokai-sublime.style';
import { AtomOneDarkStyle } from '@/components/css/highlight/atom-one-dark.style';
import { AtomOneLightStyle } from '@/components/css/highlight/atom-one-light.style';
import { GithubGistStyle } from '@/components/css/highlight/github-gist.style';
import { VS2015Style } from '@/components/css/highlight/vs2015.style';

export { hljs } from '@/core/config/highlight.config';

export type HighlightKey =
  | 'sql'
  | 'csharp'
  | 'java'
  | 'kotlin'
  | 'typescript'
  | 'graphql'
  | 'scala';

export type LanguageMap = Record<string, HighlightKey>;

export type HighlightThemeMap = Record<HighlightTheme, string>;

export const languageMap: LanguageMap = {
  GraphQL: 'graphql',
  'C#': 'csharp',
  Java: 'java',
  Kotlin: 'kotlin',
  TypeScript: 'typescript',
  JPA: 'java',
  Scala: 'scala',
};

export const highlightThemeMap: HighlightThemeMap = {
  AtomOneDark: AtomOneDarkStyle,
  AtomOneLight: AtomOneLightStyle,
  MonokaiSublime: MonokaiSublimeStyle,
  GithubGist: GithubGistStyle,
  VS2015: VS2015Style,
};
