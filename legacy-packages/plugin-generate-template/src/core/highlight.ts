import { AtomOneDarkStyle } from '@/components/css/highlight/atom-one-dark.style';
import { AtomOneLightStyle } from '@/components/css/highlight/atom-one-light.style';
import { GithubGistStyle } from '@/components/css/highlight/github-gist.style';
import { MonokaiSublimeStyle } from '@/components/css/highlight/monokai-sublime.style';
import { VS2015Style } from '@/components/css/highlight/vs2015.style';

export const highlightThemeMap: Record<string, string> = {
  AtomOneDark: AtomOneDarkStyle,
  AtomOneLight: AtomOneLightStyle,
  MonokaiSublime: MonokaiSublimeStyle,
  GithubGist: GithubGistStyle,
  VS2015: VS2015Style,
};
