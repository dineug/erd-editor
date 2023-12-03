import { Language } from '@/constants/schema';

export const LanguageToLangMap: Record<number, string> = {
  [Language.TypeScript]: 'typescript',
  [Language.GraphQL]: 'graphql',
  [Language.csharp]: 'csharp',
  [Language.Java]: 'java',
  [Language.Kotlin]: 'kotlin',
  [Language.Scala]: 'scala',
  [Language.JPA]: 'java',
};
