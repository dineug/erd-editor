import {
  generateOrderKeys,
  isOrderKey,
  type Ordered,
} from '@dineug/erd-editor-schema';

/** The keys of the rows a placement adds, and the listed rows it keys again. */
export type OrderPlacement = {
  keys: string[];
  rekeyed: Ordered[];
};

/**
 * Keys for count new rows placed at index at of a sheet's rows in key order,
 * rows.length for its end. Where no key fits between the neighbours, the rows
 * around the place are keyed again with them, so the sheet reads as asked.
 */
export function placeOrderKeys(
  rows: ReadonlyArray<Ordered>,
  at: number,
  count: number
): OrderPlacement {
  // Rows with no key stand last, so a place among them keys those before it;
  // rows sharing the key below the place are keyed again after it.
  let start = at;
  while (start > 0 && !isOrderKey(rows[start - 1].order)) start--;
  const low = start > 0 ? rows[start - 1].order : null;

  let end = at;
  while (
    low !== null &&
    end < rows.length &&
    isOrderKey(rows[end].order) &&
    rows[end].order <= low
  ) {
    end++;
  }
  const high =
    end < rows.length && isOrderKey(rows[end].order) ? rows[end].order : null;

  const before = rows.slice(start, at);
  const after = rows.slice(at, end);
  const keys = generateOrderKeys(
    low,
    high,
    before.length + count + after.length
  );
  const rekeyed: Ordered[] = [];
  const rekey = (row: Ordered, order: string) => {
    if (row.order !== order) rekeyed.push({ id: row.id, order });
  };
  before.forEach((row, index) => rekey(row, keys[index]));
  after.forEach((row, index) =>
    rekey(row, keys[before.length + count + index])
  );

  return { keys: keys.slice(before.length, before.length + count), rekeyed };
}
