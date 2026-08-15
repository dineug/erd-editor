import { isNull, isPrimitive, isUndefined } from '@/helpers/is-type';
import { CSS_SOURCE } from '@/template';
import { isCSSTemplateLiterals } from '@/template/helper';

/**
 * `statement` slots splice the child literal's source in; `inline` slots render it as a class
 * selector. Primitives ignore the verdict entirely — see `slotText()`.
 */
export type SlotKind = 'statement' | 'inline';

export interface Slot {
  kind: SlotKind;
  /**
   * `true` when the `statement` verdict rests on a delimiter rather than on text the rule cannot
   * read. `padding: ${a}px ${b}px` classifies its middle slot as a statement because `px ` holds
   * no colon, which is harmless for a primitive and wrong for a css literal.
   */
  provable: boolean;
}

/** Everything after the last `;`, `{` or `}` of the string in front of the slot. */
function headSegment(raw: string): string {
  const match = /[;{}][^;{}]*$/.exec(raw);
  return match ? match[0].slice(1) : raw;
}

/** Everything up to the first `;`, `}` or newline of the string behind the slot. */
function tailSegment(raw: string): string {
  const index = raw.search(/[;}\n]/);
  return index === -1 ? raw : raw.slice(0, index);
}

/**
 * One slot per gap, so `raw.length - 1` of them. The classification only depends on the strings,
 * which is why it is cached with the template and not with the values.
 */
export function classifySlots(raw: readonly string[]): Slot[] {
  const slots: Slot[] = [];

  for (let i = 0; i < raw.length - 1; i++) {
    const head = headSegment(raw[i]);
    const tail = tailSegment(raw[i + 1]);
    const kind: SlotKind =
      !head.includes(':') && !tail.includes('{') ? 'statement' : 'inline';

    slots.push({ kind, provable: head.trim().length === 0 });
  }

  return slots;
}

/**
 * A spliced source has to end in a delimiter or the next declaration is welded onto the last one:
 * `color:red\nfont-size:1px` compiles to the single declaration `color:red font-size:1px`.
 */
export function terminate(source: string): string {
  const trimmed = source.trimEnd();

  return !trimmed || trimmed.endsWith(';') || trimmed.endsWith('}')
    ? source
    : `${source};`;
}

export function slotText(value: any, kind: SlotKind): string {
  if (isCSSTemplateLiterals(value)) {
    return kind === 'statement'
      ? terminate(value[CSS_SOURCE] ?? '')
      : `.${String(value)}`;
  }

  return isPrimitive(value) && !isNull(value) && !isUndefined(value)
    ? String(value)
    : '';
}

/**
 * Substitution happens before compiling, so a value can change the rule structure the way a
 * post-substituted marker could not. Both findings are authoring mistakes with no occurrence in
 * this repository; they are reported unconditionally because r-html has no dev-only branch to
 * hang them on, and a flag nothing ever sets would only be dead code.
 */
function report(slot: Slot, value: any, text: string): void {
  if (isCSSTemplateLiterals(value)) {
    if (slot.kind === 'statement' && !slot.provable) {
      console.error(
        '[r-html] a css literal follows unterminated text, so it is spliced in as a statement. End the declaration in front of it with a `;`.'
      );
    }
    return;
  }

  if (text.includes('{') || text.includes('}')) {
    console.warn(
      `[r-html] interpolated value contains a brace and is substituted before compiling, so it can change the rule structure: ${text}`
    );
    return;
  }

  if (isUnbalanced(text, "'") || isUnbalanced(text, '"')) {
    console.warn(
      `[r-html] interpolated value has an unbalanced quote and is substituted before compiling: ${text}`
    );
  }
}

function isUnbalanced(text: string, quote: string): boolean {
  let count = 0;
  for (const char of text) if (char === quote) count++;
  return count % 2 === 1;
}

/** Called on a cache miss only: the memo key is built from `slotText()` without coming here. */
export function buildSource(
  raw: readonly string[],
  slots: Slot[],
  values: any[]
): string {
  let source = '';

  for (let i = 0; i < raw.length; i++) {
    source += raw[i];
    if (i >= slots.length) continue;

    const text = slotText(values[i], slots[i].kind);
    report(slots[i], values[i], text);
    source += text;
  }

  return source;
}
