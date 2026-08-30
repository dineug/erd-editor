/**
 * tokenizer.ts and parser.ts own every AML syntax concern, resolving
 * indentation, quoting and the constraint grammar into the flat fields below,
 * so convert.ts never sees a token and a nested attribute arrives dotted.
 */

export type AMLNamespace = {
  database: string;
  catalog: string;
  schema: string;
};

/** A dash on either end reads as 1, an angle bracket as n. */
export type AMLCardinality = '1' | 'n';

export type AMLEndpoint = {
  namespace: AMLNamespace;
  entityName: string;
  /** Dotted from the entity root, so a nested endpoint keeps settings.slug. */
  attributePaths: string[];
};

export type AMLRelation = {
  src: AMLEndpoint;
  ref: AMLEndpoint;
  srcCardinality: AMLCardinality;
  refCardinality: AMLCardinality;
  /** -item_kind=User>; the discriminator has no editor slot and is dropped. */
  polymorphic: boolean;
};

/**
 * One unique / unique=name / index / index=name constraint. A bare
 * unique is a column flag; every other spelling groups by name.
 */
export type AMLAttributeIndex = {
  name: string;
  unique: boolean;
};

export type AMLAttribute = {
  /** Dotted from the entity root; a root attribute is its own name. */
  path: string;
  comment: string;
  /** Holds the argument list and any array suffix; never the namespace. */
  typeName: string;
  /** Inline status post_status(draft, published) members. */
  enumValues: string[];
  /** AML is NOT NULL by default, so nullable is what clears this. */
  notNull: boolean;
  primaryKey: boolean;
  indexes: AMLAttributeIndex[];
  default: string;
  autoIncrement: boolean;
};

export type AMLEntity = {
  namespace: AMLNamespace;
  name: string;
  alias: string;
  comment: string;
  attributes: AMLAttribute[];
};

/** A struct and a custom type carry neither field, which is what stops a lookup. */
export type AMLType = {
  values: string[];
  /** type uid int -- the aliased name. */
  alias: string;
};

export type AMLModel = {
  entities: AMLEntity[];
  /** Inline and standalone relations in source order, both with src filled. */
  relations: AMLRelation[];
  /** Keyed by the qualified name, so cms.post_status and post_status stay apart. */
  types: Record<string, AMLType>;
  skipped: string[];
};

export type AMLParseResult =
  | { ok: true; model: AMLModel }
  | { ok: false; message: string };

export const EMPTY_NAMESPACE: AMLNamespace = {
  database: '',
  catalog: '',
  schema: '',
};
