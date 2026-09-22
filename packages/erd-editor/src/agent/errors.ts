import type { ValuesType } from '@/internal-types';

/** Why a peer refused a call before dispatching anything. */
export const AgentToolErrorCode = {
  unknownTool: 'unknownTool',
  invalidArgs: 'invalidArgs',
  notFound: 'notFound',
  readonly: 'readonly',
  destroyed: 'destroyed',
} as const;
export type AgentToolErrorCode = ValuesType<typeof AgentToolErrorCode>;

/**
 * A refusal the caller can act on: the code says what kind, the message names
 * the argument or entity at fault, and nothing reached the document or a peer.
 */
export class AgentToolError extends Error {
  readonly code: AgentToolErrorCode;
  readonly tool: string;

  constructor(code: AgentToolErrorCode, tool: string, message: string) {
    super(message);
    this.name = 'AgentToolError';
    this.code = code;
    this.tool = tool;
  }
}
