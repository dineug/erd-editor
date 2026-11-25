import { toSvg } from '@dineug/erd-editor/svg.js';
import { toDocumentJson } from '@dineug/erd-editor-schema';
import { Effect, Semaphore } from 'effect';
import { McpSchema } from 'effect/ai';

import { type WithMode } from '@/session/manager';
import { type Notes } from '@/session/types';
import { fitsInRead, MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import type { DocumentReader } from '@/tools/read';
import { jsonBody } from '@/tools/result';

export const EXPORT_SVG_TOOL = 'erd_export_svg';

/** What an export asks for: the file to write, if any, and the two switches toSvg takes. */
export type SvgRequest = {
  readonly output?: string;
  readonly background?: boolean;
  readonly darkMode?: boolean;
};

/** The drawing, the real path it was written to when an output was named, and the read's notes. */
export type SvgOutcome = {
  svg: string;
  output?: string;
  notes: Notes;
};

/** The document as its file holds it, which the drawing loads, whatever its size. */
export const documentJsonReader: DocumentReader = {
  tool: EXPORT_SVG_TOOL,
  render: state => toDocumentJson(state),
};

/** One drawing in the whole process at a time: the scene draws in this process's globals. */
const drawing = Semaphore.makeUnsafe(1);

/**
 * Runs an export's drawing and write one at a time in this process, and to
 * their end once begun, so a cancelled drawing never runs on unseen beside
 * the next or leaves its temp file; waiting for the turn can still be cancelled.
 */
export const oneExportAtATime = <A, E, R>(
  task: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => drawing.withPermit(Effect.uninterruptible(task));

/** Draws a document's JSON text as an svg, failing with whatever toSvg threw. */
export const drawSvg = (
  json: string,
  { background, darkMode }: SvgRequest
): Effect.Effect<string, unknown> =>
  Effect.tryPromise({
    try: () => toSvg(json, { background, darkMode }),
    catch: error => error,
  });

/** The width and height the root element of a drawing gives, its viewBox's; NaN where one is missing. */
export function svgSize(svg: string): { width: number; height: number } {
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const read = (name: string) =>
    Number(new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1] ?? Number.NaN);
  return { width: read('width'), height: read('height') };
}

/**
 * The answer of an export: with an output, its mode, both paths, the bytes
 * written and the size as JSON; without one, the svg text as a read gives it,
 * the mode and notes in a second block, refused past what one read returns.
 */
export function svgResult({
  svg,
  output,
  mode,
  path,
  notes,
}: WithMode<SvgOutcome>): Effect.Effect<McpSchema.CallToolResult, ToolError> {
  if (output !== undefined) {
    const body = jsonBody({
      mode,
      path,
      output,
      bytes: Buffer.byteLength(svg, 'utf8'),
      ...svgSize(svg),
      notes,
    });
    return Effect.succeed(
      new McpSchema.CallToolResult({
        content: [{ type: 'text', text: JSON.stringify(body) }],
      })
    );
  }
  if (!fitsInRead(svg)) {
    return Effect.fail(
      new ToolError(
        ToolErrorCode.tooLarge,
        EXPORT_SVG_TOOL,
        `this svg is ${svg.length.toLocaleString('en-US')} characters, over the ${MAX_READ_CHARS.toLocaleString('en-US')} one answer returns; pass output, a .svg path, to have it written to that file`
      )
    );
  }
  return Effect.succeed(
    new McpSchema.CallToolResult({
      content: [
        { type: 'text', text: svg },
        { type: 'text', text: JSON.stringify(jsonBody({ mode, notes })) },
      ],
    })
  );
}
