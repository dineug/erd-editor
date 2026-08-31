// AC-L7 and AC-G16, and tsc is what runs them. This repository configures no
// vitest typecheck project, so the assertions below are enforced by the
// tsc --noEmit gate that fronts both the build and the test task.

import type { JSX } from '@dineug/r-html/jsx-runtime';

type Intrinsics = JSX.IntrinsicElements;

type KonvaTag = Extract<keyof Intrinsics, `k-${string}`>;

/** Refuses to instantiate on anything but true, which is the whole assertion. */
type Expect<T extends true> = T;

type IsNever<T> = [T] extends [never] ? true : false;

type Not<T extends boolean> = T extends true ? false : true;

type All<T extends readonly boolean[]> = T[number] extends true ? true : false;

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/**
 * True when JSX would accept the attribute object A on the element E. A JSX
 * opening tag is checked as an assignment of its attributes to the element
 * type, so an unassignable object here is a compile error at the call site.
 */
type Accepts<E extends keyof Intrinsics, A> = A extends Intrinsics[E]
  ? true
  : false;

/**
 * True when the key is declared and declared never. A key dropped altogether
 * fails on the lookup instead, which is loud in the same place, and the
 * optional marker is why undefined comes off first.
 */
type DeclaredNever<T> = IsNever<Exclude<T, undefined>>;

type Handler = (event: unknown) => void;

type BansTheHostsKeys<E extends KonvaTag> = All<
  [
    DeclaredNever<Intrinsics[E]['bool:visible']>,
    DeclaredNever<Intrinsics[E]['prop:textContent']>,
    DeclaredNever<Intrinsics[E]['class']>,
    DeclaredNever<Intrinsics[E]['style']>,
    DeclaredNever<Intrinsics[E]['zIndex']>,
    Not<Accepts<E, { 'bool:visible': true }>>,
    Not<Accepts<E, { 'prop:textContent': 'x' }>>,
    Not<Accepts<E, { class: 'a b' }>>,
    Not<Accepts<E, { style: 'color: red' }>>,
    Not<Accepts<E, { zIndex: 1 }>>,
  ]
>;

/**
 * Konva's own dragging is banned outright, so the attribute that arms it and
 * the three events only it fires are never here too. A drag in this scene is
 * the mouse stream the DOM scene already used, which no k-* attribute reaches.
 */
type BansKonvaDragging<E extends KonvaTag> = All<
  [
    DeclaredNever<Intrinsics[E]['draggable']>,
    DeclaredNever<Intrinsics[E]['on:dragstart']>,
    DeclaredNever<Intrinsics[E]['on:dragmove']>,
    DeclaredNever<Intrinsics[E]['on:dragend']>,
    DeclaredNever<Intrinsics[E]['on:dragstart__2']>,
    Not<Accepts<E, { draggable: true }>>,
    Not<Accepts<E, { 'on:dragstart': Handler }>>,
    Not<Accepts<E, { 'on:dragmove': Handler }>>,
    Not<Accepts<E, { 'on:dragend': Handler }>>,
    Not<Accepts<E, { 'on:dragstart__2': Handler }>>,
  ]
>;

/** The seven tags the host constructs; an eighth would let a typo typecheck. */
type _TagSet = Expect<
  Equals<
    KonvaTag,
    | 'k-circle'
    | 'k-group'
    | 'k-layer'
    | 'k-line'
    | 'k-path'
    | 'k-rect'
    | 'k-text'
  >
>;

type _CircleBans = Expect<BansTheHostsKeys<'k-circle'>>;
type _GroupBans = Expect<BansTheHostsKeys<'k-group'>>;
type _LayerBans = Expect<BansTheHostsKeys<'k-layer'>>;
type _LineBans = Expect<BansTheHostsKeys<'k-line'>>;
type _PathBans = Expect<BansTheHostsKeys<'k-path'>>;
type _RectBans = Expect<BansTheHostsKeys<'k-rect'>>;
type _TextBans = Expect<BansTheHostsKeys<'k-text'>>;

type _CircleDrag = Expect<BansKonvaDragging<'k-circle'>>;
type _GroupDrag = Expect<BansKonvaDragging<'k-group'>>;
type _LayerDrag = Expect<BansKonvaDragging<'k-layer'>>;
type _LineDrag = Expect<BansKonvaDragging<'k-line'>>;
type _PathDrag = Expect<BansKonvaDragging<'k-path'>>;
type _RectDrag = Expect<BansKonvaDragging<'k-rect'>>;
type _TextDrag = Expect<BansKonvaDragging<'k-text'>>;

/**
 * The control half. Without it every assertion above would still hold on an
 * element type that accepted nothing at all, which is a k-* tag no scene can
 * write to.
 */
type _AcceptsWhatAKonvaNodeCarries = Expect<
  All<
    [
      Accepts<'k-rect', { x: 1; y: 2; width: 3; height: 4; fill: 'red' }>,
      Accepts<'k-rect', { cornerRadius: [1, 2, 3, 4] }>,
      Accepts<'k-text', { text: 'name'; fontSize: 12; align: 'left' }>,
      Accepts<'k-line', { points: number[]; closed: true }>,
      Accepts<'k-path', { data: 'M0 0L1 1' }>,
      Accepts<'k-circle', { radius: 4 }>,
      Accepts<'k-group', { id: 'table-t1'; name: 'table'; kind: 'table' }>,
      Accepts<'k-group', { name: 'minimap-table'; tableId: 't1' }>,
      Accepts<'k-layer', { clearBeforeDraw: true; width: 10 }>,
      Accepts<'k-rect', { 'on:click': Handler }>,
      Accepts<'k-rect', { 'on:mousedown__2': Handler }>,
      Accepts<'k-rect', { 'use:ref': unknown }>,
    ]
  >
>;

/** A DOM tag stays a DOM tag: the ban above is the k-* namespace's alone. */
type _DomKeepsItsSigils = Expect<
  All<
    [
      Not<IsNever<Intrinsics['div']['bool:hidden']>>,
      Accepts<'div', { class: 'a b' }>,
      Accepts<'div', { draggable: true }>,
      Accepts<'div', { 'on:dragstart': Handler }>,
    ]
  >
>;
