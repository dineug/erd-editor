import { Language } from '@/constants/schema';

/**
 * Shiki grammar names. Spelled out rather than left as `string`, which is what
 * the annotation used to widen them to — `CodeBlock`'s `lang` is a union, and
 * widening here meant nothing checked that these were members of it.
 */
export type Lang =
  | 'csharp'
  | 'go'
  | 'graphql'
  | 'java'
  | 'kotlin'
  | 'python'
  | 'scala'
  | 'sql'
  | 'typescript';

export const LanguageToLangMap: Record<number, Lang> = {
  [Language.TypeScript]: 'typescript',
  [Language.GraphQL]: 'graphql',
  [Language.csharp]: 'csharp',
  [Language.Java]: 'java',
  [Language.Kotlin]: 'kotlin',
  [Language.Scala]: 'scala',
  [Language.JPA]: 'java',
  [Language.Go]: 'go',
  [Language.SQLAlchemy]: 'python',
  [Language.TypeORM]: 'typescript',
  [Language.Sequelize]: 'typescript',
  [Language.Drizzle]: 'typescript',
  [Language.DBML]: 'sql',
};
