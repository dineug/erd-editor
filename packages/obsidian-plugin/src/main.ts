import { around } from 'monkey-around';
import {
  normalizePath,
  Notice,
  type OpenViewState,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from 'obsidian';

import {
  DIAGRAM_EXTENSIONS,
  ErdView,
  isDiagramJson,
  VIEW_TYPE_ERD,
} from '@/ErdView';
import { type ErdEditorModule, loadErdEditor } from '@/loadErdEditor';

export default class ErdEditorPlugin extends Plugin {
  private erdEditor: ErdEditorModule | null = null;

  async onload(): Promise<void> {
    this.erdEditor = loadErdEditor();
    this.erdEditor.setExportFileCallback((blob, { fileName }) => {
      void this.exportFile(blob, fileName).catch(error =>
        this.fail('Export failed', error)
      );
    });

    this.registerView(VIEW_TYPE_ERD, leaf => new ErdView(leaf));
    this.registerExtensions(DIAGRAM_EXTENSIONS, VIEW_TYPE_ERD);

    // Obsidian types a file by its last extension, and registering json would
    // take every JSON file in the vault, so only diagram JSON opens are rerouted.
    const { workspace } = this.app;
    this.register(
      around(WorkspaceLeaf.prototype, {
        openFile: next =>
          function (
            this: WorkspaceLeaf,
            file: TFile,
            openState: OpenViewState = {}
          ) {
            if (!(file instanceof TFile) || !isDiagramJson(file)) {
              return next.call(this, file, openState);
            }
            // What the core openFile builds, with the view type fixed.
            return this.setViewState(
              {
                type: VIEW_TYPE_ERD,
                state: { ...openState.state, file: file.path },
                active: openState.active ?? this === workspace.activeLeaf,
                group: openState.group,
              },
              openState.eState
            );
          },
      })
    );

    this.addCommand({
      id: 'create-diagram',
      name: 'Create new diagram',
      callback: () => this.createDiagram(),
    });
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem(item =>
          item
            .setTitle('New ERD')
            .setIcon('database')
            .onClick(() => this.createDiagram(file))
        );
      })
    );
  }

  onunload(): void {
    this.erdEditor?.setExportFileCallback(null);
    this.erdEditor = null;
  }

  private createDiagram(folder?: TFolder): void {
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? '';
    const parent = folder ?? this.app.fileManager.getNewFileParent(sourcePath);
    void this.availablePath(parent, 'Untitled', 'erd')
      .then(path => this.app.vault.create(path, ''))
      .then(file => this.app.workspace.getLeaf(true).openFile(file))
      .catch(error => this.fail('Could not create the diagram', error));
  }

  /** Export lands where the vault keeps attachments for the diagram it came from. */
  private async exportFile(blob: Blob, fileName: string): Promise<void> {
    const source = this.app.workspace.getActiveViewOfType(ErdView)?.file;
    const path = await this.app.fileManager.getAvailablePathForAttachment(
      // The file name comes from the database name, which may hold anything.
      fileName.replace(/[\\/:*?"<>|]/g, '-'),
      source?.path
    );
    const file = await this.app.vault.createBinary(
      path,
      await blob.arrayBuffer()
    );
    new Notice(`Exported ${file.path}`);
  }

  /** The adapter answers for the disk, which may ignore case where the vault index does not. */
  private async availablePath(
    parent: TFolder,
    name: string,
    ext: string
  ): Promise<string> {
    const dir = parent.isRoot() ? '' : `${parent.path}/`;
    for (let i = 0; ; i++) {
      const path = normalizePath(
        `${dir}${i === 0 ? name : `${name} ${i}`}.${ext}`
      );
      if (!(await this.app.vault.adapter.exists(path))) return path;
    }
  }

  private fail(message: string, error: unknown): void {
    console.error(error);
    new Notice(
      `${message}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
