import { escapeRegExp } from 'es-toolkit';

export type FindOptions = {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type TextRange = {
  start: number;
  end: number;
};

export type Matcher = {
  /** Every occurrence in the text, in order. An empty match is never one. */
  find: (text: string) => TextRange[];
  /**
   * The text with its occurrences replaced, or only the one starting at the
   * offset given. A regular expression expands $1, $<name>, $& and $$ in the
   * replacement; plain text is inserted as it is.
   */
  replace: (text: string, replacement: string, onlyAt?: number) => string;
};

export type MatcherResult =
  | { matcher: Matcher; error: null }
  | { matcher: null; error: 'empty' | 'invalid' };

export const DEFAULT_FIND_OPTIONS: FindOptions = Object.freeze({
  matchCase: false,
  wholeWord: false,
  regex: false,
});

/** A letter or digit of any script, or an underscore, which an identifier keeps inside one word. */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const isWordChar = (text: string, index: number): boolean =>
  index >= 0 && index < text.length && WORD_CHAR.test(text[index]);

const isWholeWord = (text: string, start: number, end: number): boolean =>
  !isWordChar(text, start - 1) && !isWordChar(text, end);

/**
 * What a replacement template becomes for one match, by the rules of
 * String.prototype.replace, which offers no way to expand a template for a
 * match it is handed one at a time.
 */
export function expandReplacement(
  template: string,
  match: string,
  captures: Array<string | undefined>,
  position: number,
  subject: string,
  groups?: Record<string, string | undefined>
): string {
  return template.replace(
    /\$(?:([$&`'])|(\d\d?)|<([^>]*)>)/g,
    (token, symbol?: string, digits?: string, name?: string) => {
      if (symbol === '$') return '$';
      if (symbol === '&') return match;
      if (symbol === '`') return subject.slice(0, position);
      if (symbol === "'") return subject.slice(position + match.length);

      if (name !== undefined) {
        return groups ? (groups[name] ?? '') : token;
      }

      const number = digits as string;
      const count = captures.length;
      const index = Number(number);
      if (index >= 1 && index <= count) return captures[index - 1] ?? '';

      // $12 with fewer than twelve groups reads as $1 followed by a 2.
      const first = Number(number[0]);
      if (number.length === 2 && first >= 1 && first <= count) {
        return (captures[first - 1] ?? '') + number[1];
      }
      return token;
    }
  );
}

/** What unicode mode takes escaped as itself besides a letter or a digit: a syntax character or the solidus. */
const SYNTAX_CHARACTERS = new Set('^$\\.*+?()[]{}|/');

/** A quantifier in braces, read from where an opening brace stands. */
const BRACED_QUANTIFIER = /\{\d+(?:,\d*)?\}/y;

/** An escaped character as unicode mode reads it, which refuses \_ and \- though people type them in names. */
function escapeFor(char: string): string {
  if (/^[\dA-Za-z]$/.test(char) || SYNTAX_CHARACTERS.has(char)) {
    return `\\${char}`;
  }
  // A hyphen by its code unit, which reads as one inside a class and out.
  if (char === '-') return '\\x2d';
  return `\\u{${(char.codePointAt(0) as number).toString(16)}}`;
}

/**
 * A typed pattern spelled for unicode mode, read the way people type it: an
 * escaped character other than a letter, a digit or a syntax character by its
 * code point, and a stray ] or a brace no quantifier owns as itself.
 */
export function toUnicodeSource(source: string): string {
  let result = '';
  let inClass = false;
  let index = 0;
  const readAt = (at: number) =>
    String.fromCodePoint(source.codePointAt(at) as number);

  while (index < source.length) {
    const char = readAt(index);
    index += char.length;

    if (char === '\\') {
      if (index >= source.length) return `${result}${char}`;

      const escaped = readAt(index);
      index += escaped.length;
      result += escapeFor(escaped);
      // A property or a code point in braces keeps them as written.
      if ('pPu'.includes(escaped) && source[index] === '{') {
        const close = source.indexOf('}', index);
        const end = close === -1 ? source.length : close + 1;
        result += source.slice(index, end);
        index = end;
      }
    } else if (inClass) {
      inClass = char !== ']';
      result += char;
    } else if (char === '[') {
      inClass = true;
      result += char;
    } else if (char === '{') {
      BRACED_QUANTIFIER.lastIndex = index - 1;
      const quantifier = BRACED_QUANTIFIER.exec(source)?.[0];
      result += quantifier ?? '\\{';
      index += quantifier ? quantifier.length - 1 : 0;
    } else {
      result += char === ']' || char === '}' ? `\\${char}` : char;
    }
  }

  return result;
}

/**
 * Builds the search a find and replace runs over every field, or says why
 * there is none: nothing to look for, or a regular expression that does not parse.
 *
 * @example
 * const { matcher } = createMatcher('user', { ...DEFAULT_FIND_OPTIONS, wholeWord: true });
 */
export function createMatcher(
  query: string,
  options: FindOptions
): MatcherResult {
  if (!query) return { matcher: null, error: 'empty' };

  // Unicode mode always, for \p{L} and whole code points: a match never
  // starts or ends inside a surrogate pair, so a replacement never splits one.
  const flags = options.matchCase ? 'gu' : 'giu';
  let pattern: RegExp;
  try {
    pattern = new RegExp(
      options.regex ? toUnicodeSource(query) : escapeRegExp(query),
      flags
    );
  } catch {
    return { matcher: null, error: 'invalid' };
  }

  const accepts = (text: string, start: number, end: number) =>
    end > start && (!options.wholeWord || isWholeWord(text, start, end));

  const find = (text: string): TextRange[] => {
    const ranges: TextRange[] = [];
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (accepts(text, start, end)) ranges.push({ start, end });
    }
    return ranges;
  };

  const replace = (text: string, replacement: string, onlyAt?: number) =>
    text.replace(pattern, (...args: any[]) => {
      const hasGroups = typeof args[args.length - 1] === 'object';
      const groups = hasGroups ? args[args.length - 1] : undefined;
      const tail = hasGroups ? 3 : 2;
      const match: string = args[0];
      const position: number = args[args.length - tail];
      const captures: Array<string | undefined> = args.slice(
        1,
        args.length - tail
      );

      if (!accepts(text, position, position + match.length)) return match;
      if (onlyAt !== undefined && position !== onlyAt) return match;

      return options.regex
        ? expandReplacement(
            replacement,
            match,
            captures,
            position,
            text,
            groups
          )
        : replacement;
    });

  return { matcher: { find, replace }, error: null };
}
