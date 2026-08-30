/**
 * JSX text semantics, applied at codegen time, mirroring Babel's
 * cleanJSXElementLiteralChild. JSX joins wrapped lines with a single space and
 * trims each one's indentation, which r-html's own splitTextNode does not.
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
