/**
 * A word of the dictionary: the logical words a name is composed of, with the
 * abbreviation each stands for in a physical name.
 */
export type Word = {
  id: string;
  name: string;
  abbreviation: string;
  englishName: string;
  description: string;
  /** Other spellings of the word, comma separated. */
  synonyms: string;
  /** Words that must not be used in its place, comma separated. */
  forbiddenWords: string;
  /**
   * Where the row stands in its sheet, a key compared in code unit order;
   * only the runtime value holds it, a file holding its rows in that order.
   */
  order: string;
};
