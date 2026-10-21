// A key is an integer part, whose head letter gives its length (a to z for
// two to 27 characters going up, Z to A for two to 27 going down), then a
// fraction with no trailing zero digit; keys sort in code unit order.
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0];
const LAST = DIGITS[DIGITS.length - 1];
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;
const FIRST_KEY = `a${ZERO}`;

/** A row's place in its sheet: its order key and, for rows of one key, its id. */
export type Ordered = {
  id: string;
  order: string;
};

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 95;
  if (head >= 'A' && head <= 'Z') return 92 - head.charCodeAt(0);
  return 0;
}

const KEY_CHARACTERS = /^[A-Za-z][0-9A-Za-z]*$/;

/** Whether a value is a key a row can be placed by, as every key this module makes is. */
export function isOrderKey(value: unknown): value is string {
  if (typeof value !== 'string' || !KEY_CHARACTERS.test(value)) return false;

  // The smallest integer has nothing below it but a fraction, so alone it is no key.
  const length = integerLength(value[0]);
  if (value.length < length || value === SMALLEST_INTEGER) return false;
  return value.length === length || value[value.length - 1] !== ZERO;
}

/** A fraction between a and b, b null for no bound above; both lack trailing zeros. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let shared = 0;
    while ((a[shared] ?? ZERO) === b[shared]) shared++;
    if (shared > 0) {
      return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
    }
  }

  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) {
    return DIGITS[Math.round((digitA + digitB) / 2)];
  }
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

function integerPart(key: string): string {
  return key.slice(0, integerLength(key[0]));
}

function incrementInteger(integer: string): string | null {
  const [head, ...digits] = integer.split('');
  let carry = true;

  for (let index = digits.length - 1; carry && index >= 0; index--) {
    const next = DIGITS.indexOf(digits[index]) + 1;
    if (next === DIGITS.length) {
      digits[index] = ZERO;
    } else {
      digits[index] = DIGITS[next];
      carry = false;
    }
  }
  if (!carry) return head + digits.join('');
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null;

  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digits.push(ZERO);
  else digits.pop();
  return nextHead + digits.join('');
}

function decrementInteger(integer: string): string | null {
  const [head, ...digits] = integer.split('');
  let borrow = true;

  for (let index = digits.length - 1; borrow && index >= 0; index--) {
    const next = DIGITS.indexOf(digits[index]) - 1;
    if (next === -1) {
      digits[index] = LAST;
    } else {
      digits[index] = DIGITS[next];
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join('');
  if (head === 'a') return `Z${LAST}`;
  if (head === 'A') return null;

  const nextHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (nextHead < 'Z') digits.push(LAST);
  else digits.pop();
  return nextHead + digits.join('');
}

/**
 * A key between a and b, null for no bound on that side. Both must be keys,
 * a below b, or it throws: a caller places rows between rows it has sorted.
 */
export function generateOrderKeyBetween(
  a: string | null,
  b: string | null
): string {
  if (a !== null && !isOrderKey(a)) throw new RangeError(`Bad key: ${a}`);
  if (b !== null && !isOrderKey(b)) throw new RangeError(`Bad key: ${b}`);
  if (a !== null && b !== null && a >= b) {
    throw new RangeError(`${a} is not below ${b}`);
  }

  if (a === null) {
    if (b === null) return FIRST_KEY;

    const integer = integerPart(b);
    const fraction = b.slice(integer.length);
    if (integer === SMALLEST_INTEGER) {
      return integer + midpoint('', fraction);
    }
    if (integer < b) return integer;

    const lower = decrementInteger(integer);
    if (lower === null) throw new RangeError('No key below');
    return lower;
  }

  const integer = integerPart(a);
  const fraction = a.slice(integer.length);
  if (b === null) {
    const higher = incrementInteger(integer);
    return higher === null ? integer + midpoint(fraction, null) : higher;
  }

  const integerB = integerPart(b);
  if (integer === integerB) {
    return integer + midpoint(fraction, b.slice(integerB.length));
  }

  const higher = incrementInteger(integer);
  if (higher !== null && higher < b) return higher;
  return integer + midpoint(fraction, null);
}

/** n keys in order between a and b, null for no bound on that side, kept short by halving. */
export function generateOrderKeys(
  a: string | null,
  b: string | null,
  n: number
): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateOrderKeyBetween(a, b)];

  if (b === null) {
    const keys = [generateOrderKeyBetween(a, null)];
    while (keys.length < n) {
      keys.push(generateOrderKeyBetween(keys[keys.length - 1], null));
    }
    return keys;
  }
  if (a === null) {
    const keys = [generateOrderKeyBetween(null, b)];
    while (keys.length < n) {
      keys.unshift(generateOrderKeyBetween(null, keys[0]));
    }
    return keys;
  }

  const half = Math.floor(n / 2);
  const middle = generateOrderKeyBetween(a, b);
  return [
    ...generateOrderKeys(a, middle, half),
    middle,
    ...generateOrderKeys(middle, b, n - half - 1),
  ];
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The order of a sheet's rows: by key in code unit order, a row with no key
 * after every row with one, and rows of one key, or none, by id. So peers that
 * hold the same rows and keys show them in the same order.
 */
export function compareByOrder(a: Ordered, b: Ordered): number {
  const keyedA = isOrderKey(a.order);
  const keyedB = isOrderKey(b.order);
  if (keyedA !== keyedB) return keyedA ? -1 : 1;

  return (keyedA && compareText(a.order, b.order)) || compareText(a.id, b.id);
}

/**
 * Gives each row without a key one after the greatest key held, the rows ids
 * lists first and in its order, then the rest, so the rows of a file, which
 * hold their order alone, read back in it on every peer.
 */
export function settleOrderKeys(
  entities: Record<string, Ordered>,
  ids: ReadonlyArray<string>
) {
  const keyless = new Set<Ordered>();
  let last: string | null = null;

  for (const id of ids) {
    const entity = entities[id];
    if (entity && !isOrderKey(entity.order)) keyless.add(entity);
  }
  for (const entity of Object.values(entities)) {
    if (!isOrderKey(entity.order)) keyless.add(entity);
    else if (last === null || entity.order > last) last = entity.order;
  }

  const keys = generateOrderKeys(last, null, keyless.size);
  let index = 0;
  for (const entity of keyless) entity.order = keys[index++];
}
