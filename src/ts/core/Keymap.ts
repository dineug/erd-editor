/**
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 * https://developer.mozilla.org/ko/docs/Web/API/KeyboardEvent/key/Key_Values
 */
type Key =
  | string
  | "Escape"
  | "Enter"
  | "Delete"
  | "Tab"
  | "ArrowUp"
  | "ArrowRight"
  | "ArrowDown"
  | "ArrowLeft"
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "Q"
  | "W"
  | "E"
  | "R"
  | "T"
  | "Y"
  | "U"
  | "I"
  | "O"
  | "P"
  | "A"
  | "S"
  | "D"
  | "F"
  | "G"
  | "H"
  | "J"
  | "K"
  | "L"
  | "Z"
  | "X"
  | "C"
  | "V"
  | "B"
  | "N"
  | "M";

export interface KeymapOption {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key?: Key;
}

export interface Keymap {
  addTable: KeymapOption[];
  removeTable: KeymapOption[];
  addColumn: KeymapOption[];
}

export function createKeymap(): Keymap {
  return {
    addTable: [
      {
        meta: false,
        ctrl: false,
        alt: true,
        shift: false,
        key: "N"
      }
    ],
    removeTable: [
      {
        meta: false,
        ctrl: true,
        alt: false,
        shift: false,
        key: "Delete"
      }
    ],
    addColumn: [
      {
        meta: false,
        ctrl: false,
        alt: true,
        shift: false,
        key: "Enter"
      }
    ]
  };
}

type MultipleKey = "altKey" | "metaKey" | "ctrlKey" | "shiftKey";
function getMultipleKeys(keymapOption: KeymapOption): MultipleKey[] {
  const result: MultipleKey[] = [];
  if (keymapOption.meta) {
    result.push("metaKey");
  }
  if (keymapOption.ctrl) {
    result.push("ctrlKey");
  }
  if (keymapOption.alt) {
    result.push("altKey");
  }
  if (keymapOption.shift) {
    result.push("shiftKey");
  }
  return result;
}

export function keymapMatch(
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
): boolean {
  let result = false;
  for (const keymapOption of keymapOptions) {
    const multipleKeys = getMultipleKeys(keymapOption);
    const m = !multipleKeys.some(multipleKey => !event[multipleKey]);
    if (keymapOption.key) {
      result = m && event.key.toUpperCase() === keymapOption.key.toUpperCase();
    } else {
      result = m;
    }
  }
  return result;
}

export function keymapOptionToString(keymapOption?: KeymapOption): string {
  if (!keymapOption) return "";
  const result: string[] = [];
  if (keymapOption.meta) {
    result.push("Meta");
  }
  if (keymapOption.ctrl) {
    result.push("Ctrl");
  }
  if (keymapOption.alt) {
    result.push("Alt");
  }
  if (keymapOption.shift) {
    result.push("Shift");
  }
  if (keymapOption.key) {
    result.push(keymapOption.key);
  }
  return result.join(" + ");
}
