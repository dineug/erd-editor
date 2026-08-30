/**
 * parser.ts owns every graphql AST concern -- directives are resolved into
 * the flat fields below, so convert.ts never imports from graphql.
 */

export type GraphQLTypeRef = {
  named: string;
  /** The outermost wrapper is NonNull -- the column-level NOT NULL signal. */
  nonNull: boolean;
  isList: boolean;
  /** The ! inside [T!] -- a cardinality signal, never a column one. */
  itemNonNull: boolean;
};

export type GraphQLField = {
  /** Already rewritten by @map / @column(name:) when either is present. */
  name: string;
  comment: string;
  typeRef: GraphQLTypeRef;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  default: string;
  /** @db.* or @column(dataType:); wins over the scalar lookup when set. */
  dataType: string;
  relationName: string;
  /** Columns on this type. */
  relationFields: string[];
  /** Columns on the target type. */
  relationReferences: string[];
  /** Resolver fields keep their arguments; the target type decides the rest. */
  hasArguments: boolean;
};

export type GraphQLIndex = {
  name: string;
  unique: boolean;
  fieldNames: string[];
};

export type GraphQLTable = {
  name: string;
  comment: string;
  fields: GraphQLField[];
  indexes: GraphQLIndex[];
};

export type GraphQLModel = {
  tables: GraphQLTable[];
  enums: Record<string, string[]>;
  /** scalar X declarations, so an unknown name can be told from a typo. */
  customScalars: string[];
  unions: Record<string, string[]>;
  /** Pruned type names, so a field pointing at one is dropped rather than read. */
  skipped: string[];
};

export type GraphQLParseResult =
  | { ok: true; model: GraphQLModel }
  | { ok: false; message: string };
