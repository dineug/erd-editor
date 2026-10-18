import type { DuplicateSuffix, EventHandler } from '@dineug/r-html/jsx-runtime';
import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';

/** The Konva event names a scene binds; Konva routes them off its own tree. */
type KonvaEventName =
  | 'click'
  | 'contextmenu'
  | 'dblclick'
  | 'dbltap'
  | 'mousedown'
  | 'mouseenter'
  | 'mouseleave'
  | 'mousemove'
  | 'mouseout'
  | 'mouseover'
  | 'mouseup'
  | 'pointerdown'
  | 'pointerenter'
  | 'pointerleave'
  | 'pointermove'
  | 'pointerup'
  | 'tap'
  | 'touchend'
  | 'touchmove'
  | 'touchstart'
  | 'wheel';

type KonvaDrawFunction = (context: Context, shape: Shape) => void;

type KonvaEventHandlers = {
  [K in KonvaEventName as `on:${K}${DuplicateSuffix}`]?: EventHandler<any>;
};

/**
 * What every k-* tag carries. The never members keep out what a Konva node
 * cannot take: the DOM sigils write through paths a Konva node has none of, and
 * z-order and dragging belong to the host and to the scene's own mouse streams.
 */
interface KonvaBaseAttributes extends KonvaEventHandlers {
  [bool: `bool:${string}`]: never;
  [prop: `prop:${string}`]: never;
  [use: `use:${string}`]: unknown;
  // Konva's built-in dragging moves a node behind the ledger and reorders its
  // siblings, so a column drag is drag$ over the same mouse stream the DOM
  // scene used, and these three events never fire for want of a dragger.
  [drag: `on:drag${string}`]: never;
  class?: never;
  draggable?: never;
  style?: never;
  zIndex?: never;
  children?: unknown;
  /** Main canvas nodes only: a minimap node is found by name plus tableId. */
  id?: string;
  /** What an ancestor walk reads in place of the DOM closest it replaces. */
  kind?: string;
  listening?: boolean;
  name?: string;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  /** Whether the editor holds this entity in its selection. */
  selected?: boolean;
  /** The colour a collaborator's focus paints, and null when nobody holds it. */
  sharedFocus?: string | null;
  /** The colour a collaborator's selection paints, null when nobody holds it. */
  sharedSelect?: string | null;
  /** What finds a minimap node beside its name, since an id there is refused. */
  tableId?: string;
  visible?: boolean;
  x?: number;
  y?: number;
}

interface KonvaShapeAttributes extends KonvaBaseAttributes {
  dash?: number[];
  fill?: string;
  /** What the shape puts on the hit canvas in place of what it paints. */
  hitFunc?: KonvaDrawFunction;
  hitStrokeWidth?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'bevel' | 'miter' | 'round';
  perfectDrawEnabled?: boolean;
  shadowBlur?: number;
  shadowColor?: string;
  shadowForStrokeEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

interface KonvaContainerAttributes extends KonvaBaseAttributes {
  clipHeight?: number;
  clipWidth?: number;
  clipX?: number;
  clipY?: number;
  height?: number;
  width?: number;
}

interface KonvaLayerAttributes extends KonvaContainerAttributes {
  clearBeforeDraw?: boolean;
  imageSmoothingEnabled?: boolean;
}

interface KonvaRectAttributes extends KonvaShapeAttributes {
  cornerRadius?: number | number[];
  height?: number;
  width?: number;
}

interface KonvaTextAttributes extends KonvaShapeAttributes {
  align?: 'center' | 'left' | 'right';
  ellipsis?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  height?: number;
  lineHeight?: number;
  padding?: number;
  text?: string;
  verticalAlign?: 'bottom' | 'middle' | 'top';
  width?: number;
  wrap?: 'char' | 'none' | 'word';
}

interface KonvaPathAttributes extends KonvaShapeAttributes {
  data?: string;
}

interface KonvaLineAttributes extends KonvaShapeAttributes {
  closed?: boolean;
  points?: number[];
  tension?: number;
}

interface KonvaCircleAttributes extends KonvaShapeAttributes {
  radius?: number;
}

/**
 * A shape that paints itself. It takes no fill or stroke of its own, since its
 * scene function draws everything it shows in the shape's own space.
 */
interface KonvaCustomShapeAttributes extends KonvaBaseAttributes {
  height?: number;
  /** What goes on the hit canvas; konva falls back to sceneFunc without one. */
  hitFunc?: KonvaDrawFunction;
  /**
   * Called on every draw of the layer. The host skips a write of the same
   * reference, so a function that reads changed state asks markDirty instead.
   */
  sceneFunc?: KonvaDrawFunction;
  width?: number;
}

/** The eight k-* tags the host constructs, each with the attributes it takes. */
export interface KonvaIntrinsicElements {
  'k-circle': KonvaCircleAttributes;
  'k-group': KonvaContainerAttributes;
  'k-layer': KonvaLayerAttributes;
  'k-line': KonvaLineAttributes;
  'k-path': KonvaPathAttributes;
  'k-rect': KonvaRectAttributes;
  'k-shape': KonvaCustomShapeAttributes;
  'k-text': KonvaTextAttributes;
}

/**
 * Merged into r-html's own map, which has no index signature, so a consumer's
 * JSX accepts the k-* tags once its program reads this file through the type
 * the entry re-exports.
 */
declare module '@dineug/r-html/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends KonvaIntrinsicElements {}
  }
}
