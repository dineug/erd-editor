/**
 * JSX text semantics, applied at codegen time.
 *
 * JSX and r-html disagree about whitespace. r-html's `splitTextNode` drops a
 * whitespace-only text node only when it starts with a newline; JSX also joins
 * wrapped lines with a single space and trims the indentation off each one. If
 * the codegen copied JSX text through verbatim, an author's wrapped sentence
 * would render with its source indentation baked in.
 *
 * So the cleaning happens here, and the template literal receives text that
 * already means what JSX says it means. This mirrors Babel's
 * `cleanJSXElementLiteralChild`.
 */
export function cleanJsxText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);

  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i])) {
      lastNonEmptyLine = i;
    }
  }

  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;

    let line = lines[i].replace(/\t/g, ' ');
    if (!isFirstLine) line = line.replace(/^ +/, '');
    if (!isLastLine) line = line.replace(/ +$/, '');

    if (line) {
      result += isLastNonEmptyLine ? line : `${line} `;
    }
  }

  return result;
}
