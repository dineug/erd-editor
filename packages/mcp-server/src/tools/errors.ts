/** Why a tool call was refused before anything was dispatched. */
export const ToolErrorCode = {
  unknownTool: 'unknownTool',
  invalidArgs: 'invalidArgs',
  notFound: 'notFound',
  tooLarge: 'tooLarge',
} as const;
export type ToolErrorCode = (typeof ToolErrorCode)[keyof typeof ToolErrorCode];

/**
 * A refusal the caller can act on: the code says what kind, the message names
 * the argument or entity at fault, and nothing reached the document or a peer.
 */
export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly tool: string;

  constructor(code: ToolErrorCode, tool: string, message: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.tool = tool;
  }
}
