import { Effect, Schema } from 'effect';

import { describeArg } from '@/tools/copy';
import { addTextTool } from '@/tools/read.tool';
import { EXPORT_SVG_TOOL, svgResult } from '@/tools/svg';

const prose = (name: string) => ({
  description: describeArg(EXPORT_SVG_TOOL, name),
});

export const ExportSvgParams = Schema.Struct({
  path: Schema.String.annotate(prose('path')),
  output: Schema.optionalKey(Schema.String.annotate(prose('output'))),
  darkMode: Schema.optionalKey(Schema.Boolean.annotate(prose('darkMode'))),
  background: Schema.optionalKey(Schema.Boolean.annotate(prose('background'))),
});

/**
 * erd_export_svg, added by hand as the read tools are, since it may answer the
 * svg text itself. It writes no document but may write over an svg file, and
 * the same call writes the same file again.
 */
export const registerExportTool = addTextTool(
  EXPORT_SVG_TOOL,
  ExportSvgParams,
  { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ({ path, ...request }, sessions) =>
    sessions.exportSvg(path, request).pipe(Effect.flatMap(svgResult))
);
