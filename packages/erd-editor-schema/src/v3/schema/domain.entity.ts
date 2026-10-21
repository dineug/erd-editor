/**
 * A domain of the dictionary: a named data type a column or a term links to by
 * its id, which then governs the data type of every column linked.
 */
export type Domain = {
  id: string;
  name: string;
  category: string;
  /** A data type as a column holds one, its length included. */
  dataType: string;
  description: string;
  /**
   * Where the row stands in its sheet, a key compared in code unit order;
   * only the runtime value holds it, a file holding its rows in that order.
   */
  order: string;
};
