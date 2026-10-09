// Rust's char::is_alphanumeric is Alphabetic or a numeric general category,
// and its is_lowercase and is_uppercase are the derived properties.
const ALPHANUMERIC = /[\p{Alphabetic}\p{N}]/u;
const LOWERCASE = /\p{Lowercase}/u;
const UPPERCASE = /\p{Uppercase}/u;

type WordMode = 'boundary' | 'lowercase' | 'uppercase';

/** The words heck 0.5 cuts a name into, each as its code points. */
function heckWords(value: string): string[][] {
  const words: string[][] = [];
  const pieces: string[][] = [[]];

  for (const char of value) {
    if (ALPHANUMERIC.test(char)) {
      pieces[pieces.length - 1].push(char);
    } else {
      pieces.push([]);
    }
  }

  pieces.forEach(piece => {
    let start = 0;
    let mode: WordMode = 'boundary';

    for (let i = 0; i < piece.length; i++) {
      const char = piece[i];

      if (i === piece.length - 1) {
        words.push(piece.slice(start));
        break;
      }

      const next = piece[i + 1];
      const nextMode: WordMode = LOWERCASE.test(char)
        ? 'lowercase'
        : UPPERCASE.test(char)
          ? 'uppercase'
          : mode;

      if (nextMode === 'lowercase' && UPPERCASE.test(next)) {
        words.push(piece.slice(start, i + 1));
        start = i + 1;
        mode = 'boundary';
      } else if (
        mode === 'uppercase' &&
        UPPERCASE.test(char) &&
        LOWERCASE.test(next)
      ) {
        words.push(piece.slice(start, i));
        start = i;
        mode = 'boundary';
      } else {
        mode = nextMode;
      }
    }
  });

  return words;
}

// heck lowers a capital sigma ending the word to the final form and any other
// to the medial one, where toLowerCase on the whole word reads its context.
function lowerWord(chars: string[]): string {
  return chars
    .map((char, i) =>
      char === 'Σ' && i === chars.length - 1 ? 'ς' : char.toLowerCase()
    )
    .join('');
}

function capitalizeWord(chars: string[]): string {
  return chars.length === 0
    ? ''
    : chars[0].toUpperCase() + lowerWord(chars.slice(1));
}

/** heck's to_snake_case, which SeaORM's derive macros name columns by. */
export function toSnakeCase(value: string): string {
  return heckWords(value).map(lowerWord).join('_');
}

/** heck's to_upper_camel_case, which SeaORM's derive macros name variants by. */
export function toUpperCamelCase(value: string): string {
  return heckWords(value).map(capitalizeWord).join('');
}
