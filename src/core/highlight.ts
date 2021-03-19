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

export const languageMap: LanguageMap = {
  GraphQL: 'graphql',
  'C#': 'csharp',
  Java: 'java',
  Kotlin: 'kotlin',
  TypeScript: 'typescript',
  JPA: 'java',
  Scala: 'scala',
};
