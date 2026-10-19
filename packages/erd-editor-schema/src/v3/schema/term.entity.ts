/**
 * A term of the dictionary: a logical name, matched to a column by its text,
 * with the physical name and the domain it gives that column.
 */
export type Term = {
  id: string;
  name: string;
  /** The physical name, '' to compose one from the words. */
  physicalName: string;
  /** The domain the term gives a column, '' for none. */
  domainId: string;
  description: string;
  /** Other spellings of the term, comma separated. */
  synonyms: string;
};
