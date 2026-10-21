const QUOTE = 34;
const COMMA = 44;
const LF = 10;
const CR = 13;
const BOM = 0xfeff;

const NEEDS_QUOTES = /[",\r\n]/;

/**
 * Reads CSV text as RFC 4180 writes it: a quoted field holds commas, line
 * breaks and doubled quotes. A record ends at CRLF, LF or CR, a blank line is
 * no record, and a stray quote stays as text, so no input throws.
 */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  const end = text.length;
  let index = text.charCodeAt(0) === BOM ? 1 : 0;
  let record: string[] = [];

  while (index < end) {
    let value = '';

    if (text.charCodeAt(index) === QUOTE) {
      index++;
      for (;;) {
        const close = text.indexOf('"', index);
        if (close === -1) {
          value += text.slice(index);
          index = end;
          break;
        }
        value += text.slice(index, close);
        index = close + 1;
        if (text.charCodeAt(index) !== QUOTE) break;
        value += '"';
        index++;
      }
    }

    let stop = index;
    while (stop < end) {
      const code = text.charCodeAt(stop);
      if (code === COMMA || code === LF || code === CR) break;
      stop++;
    }
    record.push(value + text.slice(index, stop));
    index = stop;

    if (text.charCodeAt(index) === COMMA) {
      index++;
      if (index === end) record.push('');
      continue;
    }

    const crlf =
      text.charCodeAt(index) === CR && text.charCodeAt(index + 1) === LF;
    index += crlf ? 2 : 1;
    if (record.length > 1 || record[0] !== '') records.push(record);
    record = [];
  }

  if (record.length) records.push(record);
  return records;
}

/**
 * Writes records as CSV text a spreadsheet opens as UTF-8: a byte order mark
 * first and CRLF after every record. Only a field holding a quote, a comma or
 * a line break is quoted, its quotes doubled.
 */
export function serializeCsv(
  records: ReadonlyArray<ReadonlyArray<string>>
): string {
  let text = String.fromCharCode(BOM);
  for (const record of records) {
    text += `${record.map(quoteField).join(',')}\r\n`;
  }
  return text;
}

function quoteField(value: string) {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
