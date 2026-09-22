/** Diagnostics go to stderr only: stdout is the MCP channel, and one stray line breaks the client. */
export function log(...details: unknown[]): void {
  console.error('[erd-editor-mcp]', ...details);
}
