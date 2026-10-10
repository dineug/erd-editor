import { Language } from '@/constants/schema';

/**
 * The extension each language's code is saved under. Java and JPA save their
 * classes in one .java file as is, which works as a paste (an owner decision).
 */
export const LanguageToExtensionMap: Readonly<Record<number, string>> = {
  [Language.csharp]: '.cs',
  [Language.Go]: '.go',
  [Language.Java]: '.java',
  [Language.Kotlin]: '.kt',
  [Language.PHP]: '.php',
  [Language.Rust]: '.rs',
  [Language.Scala]: '.scala',
  [Language.Swift]: '.swift',
  [Language.TypeScript]: '.ts',
  [Language.Doctrine]: '.php',
  [Language.Drizzle]: '.ts',
  [Language.JPA]: '.java',
  [Language.SeaORM]: '.rs',
  [Language.Sequelize]: '.ts',
  [Language.SQLAlchemy]: '.py',
  [Language.TypeORM]: '.ts',
  [Language.AML]: '.aml',
  [Language.DBML]: '.dbml',
  [Language.GraphQL]: '.graphql',
  [Language.JSONSchema]: '.json',
  [Language.Mermaid]: '.mmd',
  [Language.Zod]: '.ts',
};

/** The extension a language's code saves under, .txt for a language this editor does not know. */
export const codeFileExtension = (language: number): string =>
  LanguageToExtensionMap[language] ?? '.txt';

/** DBML, AML and Mermaid write every data type as is, whatever the database. */
const DATABASE_IGNORED: ReadonlyArray<number> = [
  Language.DBML,
  Language.AML,
  Language.Mermaid,
];

/** SeaORM names tables and columns its own way, and the schema languages keep the names as written. */
const NAME_CASES_IGNORED: ReadonlyArray<number> = [
  Language.SeaORM,
  Language.DBML,
  Language.AML,
  Language.Mermaid,
];

/**
 * The languages offered the bracket type (owner decisions): Doctrine and SeaORM
 * quote names by it, and JPA quotes a reserved table name only under it.
 */
const BRACKET_READ: ReadonlyArray<number> = [
  Language.Doctrine,
  Language.JPA,
  Language.SeaORM,
];

/** Whether a language's code follows the database. */
export const readsDatabase = (language: number): boolean =>
  !DATABASE_IGNORED.includes(language);

/** Whether a language's code follows the table and column name cases, which go together. */
export const readsNameCases = (language: number): boolean =>
  !NAME_CASES_IGNORED.includes(language);

/** Whether the panel, the context menu and the palette offer a language the bracket type. */
export const readsBracket = (language: number): boolean =>
  BRACKET_READ.includes(language);
