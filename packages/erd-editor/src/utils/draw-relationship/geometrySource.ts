/**
 * Which coordinate system a geometry reader works in: the document, or a view
 * named by its kind. One mode that picks the coordinates, the shown set and the
 * sort channel at once, a value per kind so a Focus overlay never redraws the Flow scene under it.
 */
export type GeometrySource = 'document' | 'flow' | 'focus';

/** The sources that are views, which is also the kind of the view slot each reads. */
export type ViewSource = Exclude<GeometrySource, 'document'>;
