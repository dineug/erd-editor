import { isAbsolute, relative, sep } from 'node:path';

import { isSamePath, type Platform } from '@dineug/erd-editor-agent-hub';
import {
  erdFileProblem,
  nativeFileSystemLayer,
  nodeHubServices,
  realpathOrSelf,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, Layer } from 'effect';
import { around } from 'monkey-around';
import {
  type App,
  FileSystemAdapter,
  normalizePath,
  Notice,
  type OpenViewState,
  Plugin,
  PluginSettingTab,
  Setting,
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
import {
  createHubRuntime,
  createObsidianHost,
  type CreateOutcome,
  DocumentRegistry,
  HubLifecycle,
  HubSwitch,
  type HubVault,
  pidSandbox,
} from '@/hub';
import { type ErdEditorModule, loadErdEditor } from '@/loadErdEditor';
import {
  ACCENT_COLORS,
  DEFAULT_SETTINGS,
  GRAY_COLORS,
  type PluginSettings,
  readSettings,
  resolveTheme,
  themeFromBuilder,
  type ThemeHost,
  type ThemeSettings,
} from '@/settings';

/** Obsidian's own light or dark, which an auto appearance follows. */
const isObsidianDark = () => document.body.hasClass('theme-dark');

/** The native real path, or the path itself when it has none, as the hub spells every path. */
function realpath(path: string): Promise<string> {
  return Effect.runPromise(
    realpathOrSelf(path).pipe(Effect.provide(nativeFileSystemLayer))
  ).catch(() => path);
}

export default class ErdEditorPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };

  private erdEditor: ErdEditorModule | null = null;
  private readonly hubSwitch = new HubSwitch(DEFAULT_SETTINGS.agentHub);
  private registry: DocumentRegistry<ErdView> | null = null;
  private hub: HubLifecycle | null = null;
  private settingTab: ErdEditorSettingTab | null = null;
  private unloaded = false;
  /** Set when a sandbox keeps this window from serving coding agents; checked once, on load. */
  hubSandbox: string | null = null;

  /** What every ERD tab of this vault shows, and where its theme builder saves. */
  private readonly theme: ThemeHost = {
    current: () => resolveTheme(this.settings, isObsidianDark()),
    picked: picked => {
      void this.setTheme(
        themeFromBuilder(this.settings, picked, isObsidianDark())
      );
      this.settingTab?.refresh();
    },
  };

  async onload(): Promise<void> {
    this.erdEditor = loadErdEditor();
    this.erdEditor.setExportFileCallback((blob, { fileName }) => {
      void this.exportFile(blob, fileName).catch(error =>
        this.fail('Export failed', error)
      );
    });

    // Before any tab can open, so every version a tab emits is observed
    // whether or not the hub listens.
    const adapter = this.app.vault.adapter;
    const registry = new DocumentRegistry<ErdView>({
      platform: process.platform as Platform,
      fullPath: file =>
        adapter instanceof FileSystemAdapter
          ? adapter.getFullPath(file.path)
          : file.path,
      realpath,
    });
    this.registry = registry;

    this.registerView(
      VIEW_TYPE_ERD,
      leaf => new ErdView(leaf, registry, this.theme)
    );
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
    this.registerEvent(
      this.app.vault.on('rename', file => {
        if (file instanceof TFile) registry.renamed(file);
      })
    );
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        if (this.settings.appearance === 'auto') this.applyTheme();
      })
    );

    this.settings = readSettings(await this.loadData());
    // A plugin turned off while its settings loaded starts no hub.
    if (this.unloaded) return;
    // Tabs restored with the layout may have opened on the defaults.
    this.applyTheme();
    this.hubSwitch.set(this.settings.agentHub);
    this.settingTab = new ErdEditorSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    if (adapter instanceof FileSystemAdapter) this.startHub(adapter);
  }

  onunload(): void {
    this.unloaded = true;
    this.erdEditor?.setExportFileCallback(null);
    this.erdEditor = null;
    // Not awaited by Obsidian; the next instance of this window awaits it.
    void this.hub?.stop();
    this.hub = null;
  }

  /** data.json changed under the plugin, as a sync brings another device's settings. */
  async onExternalSettingsChange(): Promise<void> {
    this.settings = readSettings(await this.loadData());
    this.applyTheme();
    this.hubSwitch.set(this.settings.agentHub);
    this.settingTab?.refresh();
  }

  async setAgentHub(enabled: boolean): Promise<void> {
    this.settings.agentHub = enabled;
    this.hubSwitch.set(enabled);
    await this.saveData(this.settings);
  }

  /** From the settings tab or a theme builder: every open diagram of the vault shows it at once. */
  async setTheme(theme: Partial<ThemeSettings>): Promise<void> {
    Object.assign(this.settings, theme);
    this.applyTheme();
    await this.saveData(this.settings);
  }

  /** Re-themes every ERD tab of this vault, those in popout windows too. */
  private applyTheme(): void {
    const theme = this.theme.current();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ERD)) {
      if (leaf.view instanceof ErdView) leaf.view.applyTheme(theme);
    }
  }

  /**
   * One hub per vault window, keyed by the renderer's pid. A window closing,
   * reloading or quitting never runs onunload; the quit event and the page
   * hiding release the lock and the socket at once, and add no quit task.
   */
  private startHub(adapter: FileSystemAdapter): void {
    const registry = this.registry;
    if (!registry) return;
    // No lock, and no sweep of other windows' locks, from where pids mislead.
    this.hubSandbox = pidSandbox();
    if (this.hubSandbox) {
      if (this.settings.agentHub) {
        new Notice(sandboxNotice(this.hubSandbox), SANDBOX_NOTICE_MS);
      }
      return;
    }

    const vault = this.hubVault(adapter, registry);
    const host = createObsidianHost(this.hubSwitch, () =>
      adapter.getBasePath()
    );
    const version = this.manifest.version;
    const hub = new HubLifecycle(registry, () =>
      createHubRuntime({
        registry,
        vault,
        host,
        fileSystem: nativeFileSystemLayer,
        machine: Layer.mergeAll(
          nodeHubServices(version),
          nativeFileSystemLayer
        ),
      })
    );
    this.hub = hub;
    this.registerEvent(this.app.workspace.on('quit', () => hub.releaseSync()));
    // Newer Obsidian fires quit only when the window closes, not on a reload.
    this.registerDomEvent(window, 'pagehide', () => hub.releaseSync());
    void hub.start();
  }

  /** The vault as the hub handler reads, creates and opens its files. */
  private hubVault(
    adapter: FileSystemAdapter,
    registry: DocumentRegistry<ErdView>
  ): HubVault {
    const { vault, workspace } = this.app;
    const platform = registry.platform;

    /** A file by its real path: under the vault folder's real path, else any ERD file resolving to it. */
    const fileAt = async (path: string): Promise<TFile | null> => {
      const vaultPath = await vaultPathOf(path);
      const indexed =
        vaultPath === null ? null : vault.getFileByPath(vaultPath);
      if (indexed) return indexed;
      for (const file of vault.getFiles()) {
        if (erdFileProblem(file.path)) continue;
        const real = await realpath(adapter.getFullPath(file.path));
        if (isSamePath(real, path, platform)) return file;
      }
      return null;
    };

    const vaultPathOf = async (path: string): Promise<string | null> => {
      const within = relative(await realpath(adapter.getBasePath()), path);
      if (
        !within ||
        within === '..' ||
        within.startsWith(`..${sep}`) ||
        isAbsolute(within)
      ) {
        return null;
      }
      return normalizePath(within.split(sep).join('/'));
    };

    const leafShowing = (file: TFile): WorkspaceLeaf | null => {
      let found: WorkspaceLeaf | null = null;
      workspace.iterateAllLeaves(leaf => {
        const { type, state } = leaf.getViewState();
        if (!found && type === VIEW_TYPE_ERD && state?.file === file.path) {
          found = leaf;
        }
      });
      return found;
    };

    return {
      files: () => vault.getFiles().map(file => adapter.getFullPath(file.path)),

      create: async (path, data): Promise<CreateOutcome> => {
        const vaultPath = await vaultPathOf(path);
        if (vaultPath === null) throw new Error(`${path} is not in the vault`);
        const parent = vaultPath.includes('/')
          ? vaultPath.slice(0, vaultPath.lastIndexOf('/'))
          : '';
        if (parent && !(await adapter.exists(parent))) return 'noFolder';
        // The disk, not the vault index, which can lag a file made outside Obsidian.
        if (await adapter.exists(vaultPath)) return 'exists';
        try {
          await vault.create(vaultPath, data);
          return 'created';
        } catch (error) {
          if (await adapter.exists(vaultPath)) return 'exists';
          throw error;
        }
      },

      open: async path => {
        const file = await fileAt(path);
        if (!file) throw new Error('the vault does not list the file');
        const leaf = leafShowing(file);
        if (leaf) {
          // A background tab restored at startup holds no view until shown.
          if (typeof leaf.loadIfDeferred === 'function') {
            await leaf.loadIfDeferred();
          }
          return;
        }
        // A new tab takes focus when Always focus new tabs is on, which is the
        // default; the tab the user was in gets it back, as preserveFocus does,
        // and so does the active document, which a note taking focus keeps.
        const previous = workspace.activeLeaf;
        const restoreActive = registry.keepActive();
        const created = workspace.getLeaf('tab');
        await created.openFile(file, { active: false });
        if (
          previous &&
          previous !== created &&
          workspace.activeLeaf === created
        ) {
          workspace.setActiveLeaf(previous, { focus: true });
          restoreActive();
        }
      },
    };
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

/** Long enough to read the notice a sandboxed window shows once per load. */
const SANDBOX_NOTICE_MS = 15_000;

const sandboxNotice = (sandbox: string) =>
  `ERD Editor: this Obsidian runs in a ${sandbox} sandbox, which coding agents cannot reach, so an agent edits the diagram files on disk instead. Turn off Coding agents in the plugin's settings to stop this notice.`;

const APPEARANCE_NAMES: Record<PluginSettings['appearance'], string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

/** The dropdown options of a color setting: each value, named with a capital. */
const colorOptions = (colors: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    colors.map(color => [color, color.charAt(0).toUpperCase() + color.slice(1)])
  );

/** The plugin's settings, drawn with display for the Obsidian versions before 1.13. */
class ErdEditorSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ErdEditorPlugin
  ) {
    super(app, plugin);
  }

  /** Redraws the tab while it is open, for a change made elsewhere: a theme builder or a sync. */
  refresh(): void {
    if (this.containerEl.isConnected) this.display();
  }

  display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;
    containerEl.empty();
    new Setting(containerEl)
      .setName('Appearance')
      .setDesc(
        "Auto follows Obsidian's light or dark theme and switches with it. The theme builder in the editor's toolbar changes these three settings too."
      )
      .addDropdown(dropdown =>
        dropdown
          .addOptions(APPEARANCE_NAMES)
          .setValue(settings.appearance)
          .onChange(
            value =>
              void this.plugin.setTheme({
                appearance: value as PluginSettings['appearance'],
              })
          )
      );
    new Setting(containerEl)
      .setName('Gray color')
      .setDesc('The neutral color of the canvas, the tables and the menus.')
      .addDropdown(dropdown =>
        dropdown
          .addOptions(colorOptions(GRAY_COLORS))
          .setValue(settings.grayColor)
          .onChange(
            value =>
              void this.plugin.setTheme({
                grayColor: value as PluginSettings['grayColor'],
              })
          )
      );
    new Setting(containerEl)
      .setName('Accent color')
      .setDesc('The color of selections and highlights.')
      .addDropdown(dropdown =>
        dropdown
          .addOptions(colorOptions(ACCENT_COLORS))
          .setValue(settings.accentColor)
          .onChange(
            value =>
              void this.plugin.setTheme({
                accentColor: value as PluginSettings['accentColor'],
              })
          )
      );
    new Setting(containerEl)
      .setName('Coding agents')
      .setDesc(
        this.plugin.hubSandbox
          ? `This Obsidian runs in a ${this.plugin.hubSandbox} sandbox, which coding agents (the ERD Editor MCP server) cannot reach: they edit the diagram files on disk instead. Turn this off to stop the notice at startup.`
          : 'Coding agents (the ERD Editor MCP server) can edit the diagrams open in this vault live, through a local socket and a lock file under ~/.erd-editor/ide.'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.agentHub)
          .onChange(value => void this.plugin.setAgentHub(value))
      );
  }
}
