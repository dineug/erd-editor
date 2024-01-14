import * as opentype from 'opentype.js';
import * as vscode from 'vscode';

const TEXT_PADDING = 2;
const SIZE = 12;

let font: opentype.Font | null = null;

export async function createFont(context: vscode.ExtensionContext) {
  if (font) return;

  try {
    const fontUri = vscode.Uri.joinPath(
      context.extensionUri,
      'assets/fonts/roboto/Roboto-Regular.ttf'
    );
    const fontUint8Array = await vscode.workspace.fs.readFile(fontUri);
    font = opentype.parse(fontUint8Array.buffer);
  } catch {}
}

export function toWidth(text: string) {
  let width = 0;

  if (font) {
    try {
      const glyphs = font.stringToGlyphs(text);
      const advance = glyphs.reduce((acc, g) => acc + (g.advanceWidth ?? 0), 0);

      width = (advance / font.unitsPerEm) * SIZE;
    } catch {
      width = text.length * 10;
    }
  } else {
    width = text.length * 10;
  }

  return Math.round(width) + TEXT_PADDING;
}
