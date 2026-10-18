// The k-* tags reach this program only through the declarations the Konva host
// package ships, so the tsc --noEmit gate fails here once its build drops the
// JSX merge. The package's own type spec reads its source and cannot see that.

import type { JSX } from '@dineug/r-html/jsx-runtime';

/** Refuses to instantiate on anything but true, which is the whole assertion. */
type Expect<T extends true> = T;

/** True when the key is declared never; an optional key adds the undefined. */
type DeclaredNever<T> = [Exclude<T, undefined>] extends [never] ? true : false;

/** Konva's own dragging stays refused on a tag as this package sees it. */
type _RectRefusesDragging = Expect<
  DeclaredNever<JSX.IntrinsicElements['k-rect']['draggable']>
>;
