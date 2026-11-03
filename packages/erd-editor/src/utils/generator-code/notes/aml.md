# aml.ts

**Parent context:** `../AGENTS.md`
**Generated:** 2026-10-11 · **Updated:** 2026-11-03

- **What it writes.** `aml.ts` repairs the document as `dbml.ts` does, with these differences.
  - It keeps typeless attributes.
  - It writes `nullable`.
- **Types.** A type is quoted unless it is a bare identifier that is no AML keyword.
  - `int` and `varchar` stay bare.
  - `"varchar(100)"` is quoted.
- **Table colors.** A table color is written as `{color: name}`. The name is one of the 18 that AML takes (`AML_COLORS`, Tailwind's 500 shades).
  - A color whose OKLab chroma is under 0.04 is `gray`, however light or dark (owner decisions).
  - The reason: a neutral's hue is rounding noise. By hue alone, `#ffffff` and `#cccccc` would be `yellow` and `#000000` `pink`.
  - Any other color takes, of the other 17 names, the one whose 500 shade is nearest in OKLCH hue (`atan2(b, a)`) around the circle.
  - Lightness and chroma are left aside (owner decisions). Full OKLab distance is pulled by lightness: it named `#fecaca` `yellow` and `#0000ff` `indigo`.
  - On a tie, the first name in AML's order wins.
  - So `#fecaca` is `rose`, `#0000ff` is `blue` and a dark `#800000` is `red`. `utils/tableColor.test.ts` pins these.
- **Importer read-back of colors.** The importer reads a color name back as its hex, in any letter case (an owner decision).
  - It reads the name bare or quoted, as it reads every property value.
  - It reads a quoted `#rgb`, `#rrggbb` or `#rrggbbaa` as written.
  - It drops any other color.
  - It drops the color property on an attribute or a relation the same way.
- **Highlighting.** AML highlights as `sql` (`LanguageToLangMap`), as DBML does.
