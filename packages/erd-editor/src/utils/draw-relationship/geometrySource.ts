/**
 * Which coordinate system a geometry reader works in: the document, or the
 * view named by its kind. One mode that picks the coordinates, the shown set
 * and the sort channel at once, so a view never redraws the document under it.
 */
export type GeometrySource = 'document' | 'flow';

/** The sources that are views, which is also the kind of the view slot each reads. */
export type ViewSource = Exclude<GeometrySource, 'document'>;
