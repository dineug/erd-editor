import {
  KeymapOption,
  createKeymap,
  keymapMatch,
  keymapOptionToString,
  keymapOptionToStringJoin,
} from "@src/core/Keymap";

describe("command: canvas", () => {
  it("keymapMatch: keymap.addTable", () => {
    // given
    const keymap = createKeymap();

    // when
    const value = keymapMatch(
      new KeyboardEvent("keydown", {
        altKey: true,
        code: "N",
      }),
      keymap.addTable
    );

    // then
    expect(value).toBe(true);
  });

  it("keymapMatch: shiftKey", () => {
    // given
    const keymapOption: KeymapOption = {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
    };

    // when
    const value = keymapMatch(
      new KeyboardEvent("keydown", {
        shiftKey: true,
      }),
      [keymapOption]
    );

    // then
    expect(value).toBe(true);
  });
});

it("keymapOptionToString: All", () => {
  // given
  const keymapOption: KeymapOption = {
    metaKey: true,
    ctrlKey: true,
    altKey: true,
    shiftKey: true,
    key: "A",
  };

  // when
  const value = keymapOptionToString(keymapOption);

  // then
  expect(value).toBe("Cmd + Ctrl + Alt + Shift + A");
});

it("keymapOptionToStringJoin: All", () => {
  // given
  const keymapOption: KeymapOption = {
    metaKey: true,
    ctrlKey: true,
    altKey: true,
    shiftKey: true,
    key: "A",
  };

  // when
  const value = keymapOptionToStringJoin([keymapOption]);

  // then
  expect(value).toBe("Cmd + Ctrl + Alt + Shift + A");
});
