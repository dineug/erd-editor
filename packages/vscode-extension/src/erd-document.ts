import * as vscode from 'vscode';

import { textDecoder } from '@/utils';

export class ErdDocument implements vscode.CustomDocument {
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  private readonly _onDidChangeContent = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;
  public readonly onDidChangeContent = this._onDidChangeContent.event;

  /**
   * The document as the last replica save held it, removed entities included,
   * for a second view or a joining agent. Memory only: nothing writes it.
   */
  public runtimeValue: string | undefined;

  private constructor(
    readonly uri: vscode.Uri,
    public content: Uint8Array
  ) {}

  static create(uri: vscode.Uri, initialContent: Uint8Array) {
    return new ErdDocument(uri, initialContent);
  }

  /** What a new view or a joining agent starts from: the runtime value, else the bytes. */
  seedValue(): string {
    return this.runtimeValue ?? textDecoder.decode(this.content);
  }

  async save() {
    await this.saveAs(this.uri);
  }

  async saveAs(destination: vscode.Uri) {
    return vscode.workspace.fs.writeFile(destination, this.content);
  }

  async update(content: Uint8Array) {
    this.content = content;
    this._onDidChangeContent.fire();
  }

  async revert() {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this.content = content;
  }

  async backup(destination: vscode.Uri): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination);

    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          // noop
        }
      },
    };
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidChangeContent.dispose();
  }
}
