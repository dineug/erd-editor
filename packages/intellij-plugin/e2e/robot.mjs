// Drives the IDE through the robot-server plugin runIdeSmoke installs beside
// ours: a Rhino script posted to /js/execute runs for its effect, one posted
// to /js/retrieveAny hands back its value, which scripts here make a string.
import { setTimeout as sleep } from 'node:timers/promises';

export const PLUGIN_ID = 'com.github.dineug.erdeditorintellijplugin';
const SETTINGS_CLASS = `${PLUGIN_ID}.settings.AgentHubSettings`;
const CALL_TIMEOUT_MS = 60_000;

/**
 * A script expression for one of our plugin's classes. The robot's script
 * engine resolves only the robot plugin's own classes and the platform's.
 */
export function pluginClass(name) {
  return (
    'com.intellij.ide.plugins.PluginManagerCore.getPlugin(' +
    `com.intellij.openapi.extensions.PluginId.getId(${JSON.stringify(PLUGIN_ID)}))` +
    `.getPluginClassLoader().loadClass(${JSON.stringify(name)})`
  );
}

/** Reads the one string a retrieveAny answer carries, Java serialization of a String. */
export function decodeSerializedString(bytes) {
  const data = Uint8Array.from(bytes, byte => byte & 0xff);
  if (data[0] !== 0xac || data[1] !== 0xed) {
    throw new Error('the robot answered something other than a Java stream');
  }
  const view = new DataView(data.buffer);
  const tag = data[4];
  if (tag === 0x70) return null;
  let start;
  let length;
  if (tag === 0x74) {
    length = view.getUint16(5);
    start = 7;
  } else if (tag === 0x7c) {
    length = Number(view.getBigUint64(5));
    start = 13;
  } else {
    throw new Error(`the robot answered a ${tag.toString(16)} record, not a string`);
  }
  return decodeModifiedUtf8(data.subarray(start, start + length));
}

/** Java's modified UTF-8: at most three bytes a UTF-16 unit, NUL as two. */
function decodeModifiedUtf8(bytes) {
  const units = [];
  for (let i = 0; i < bytes.length; ) {
    const a = bytes[i];
    if (a < 0x80) {
      units.push(a);
      i += 1;
    } else if ((a & 0xe0) === 0xc0) {
      units.push(((a & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else {
      units.push(
        ((a & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    }
  }
  let text = '';
  for (let i = 0; i < units.length; i += 8192) {
    text += String.fromCharCode(...units.slice(i, i + 8192));
  }
  return text;
}

// What every script may call. onEdt runs fn on the EDT the way the IDE's own EDT code runs,
// write-safe at NON_MODAL, so a script that uses it runs off the EDT (runInEdt false), and
// its VFS lookups stay out of fn, since the IDE reports one on the EDT as a slow operation.
const PRELUDE = `
var Application = com.intellij.openapi.application.ApplicationManager.getApplication();
var FileEditorManager = com.intellij.openapi.fileEditor.FileEditorManager;
function onEdt(fn) {
  var box = {};
  Application.invokeAndWait(new java.lang.Runnable({ run: function () { box.value = fn(); } }),
    com.intellij.openapi.application.ModalityState.nonModal());
  return box.value;
}
function inWriteAction(fn) {
  return onEdt(function () {
    var box = {};
    Application.runWriteAction(new java.lang.Runnable({ run: function () { box.value = fn(); } }));
    return box.value;
  });
}
function projects() { return com.intellij.openapi.project.ProjectManager.getInstance().getOpenProjects(); }
function realOf(path) { try { return String(new java.io.File(path).getCanonicalPath()); } catch (e) { return null; } }
function projectAt(real) {
  var all = projects();
  for (var i = 0; i < all.length; i++) if (realOf(all[i].getBasePath()) === real) return all[i];
  return null;
}
function fileAt(path) { return com.intellij.openapi.vfs.LocalFileSystem.getInstance().refreshAndFindFileByPath(path); }
function openAt(real) {
  var out = [];
  var all = projects();
  for (var i = 0; i < all.length; i++) {
    var files = FileEditorManager.getInstance(all[i]).getOpenFiles();
    for (var j = 0; j < files.length; j++) {
      if (files[j].isInLocalFileSystem() && realOf(files[j].getPath()) === real) out.push({ project: all[i], file: files[j] });
    }
  }
  return out;
}
function plugin() {
  return com.intellij.ide.plugins.PluginManagerCore.findPlugin(com.intellij.openapi.extensions.PluginId.getId(${JSON.stringify(PLUGIN_ID)}));
}
function editorWindowsOf(project, file) {
  var windows = com.intellij.openapi.fileEditor.ex.FileEditorManagerEx.getInstanceEx(project).getWindows();
  var out = [];
  for (var i = 0; i < windows.length; i++) {
    var files = windows[i].getFiles();
    for (var j = 0; j < files.length; j++) if (files[j].equals(file)) out.push(windows[i]);
  }
  return out;
}
`;

/**
 * The robot of the IDE on port. retrieve runs a script as a function body and
 * answers what it returns, through JSON: return JavaScript values, not Java ones.
 */
export function connectRobot(port) {
  const base = `http://127.0.0.1:${port}`;

  // A script the EDT cannot run, behind a dialog, would hold the call forever.
  async function post(path, script, runInEdt) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ script, runInEdt }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    const body = await response.json();
    if (body.status !== 'SUCCESS') {
      throw new Error(`robot ${path}: ${body.message ?? response.status}`);
    }
    return body;
  }

  const robot = {
    base,
    /** True once the robot's HTTP server answers. */
    async ready() {
      try {
        return (await fetch(`${base}/hello`)).ok;
      } catch {
        return false;
      }
    },
    async waitReady(timeout) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await robot.ready()) return true;
        await sleep(500);
      }
      return false;
    },
    /** Runs script for its effect, on the EDT unless runInEdt is false. */
    async execute(script, runInEdt = true) {
      await post('/js/execute', PRELUDE + script, runInEdt);
    },
    /** Runs script as a function body and answers what it returns. */
    async retrieve(script, runInEdt = true) {
      const wrapped =
        `${PRELUDE}var __value = (function () {\n${script}\n})();\n` +
        'new java.lang.String(JSON.stringify(__value === undefined ? null : __value));';
      const body = await post('/js/retrieveAny', wrapped, runInEdt);
      const text = decodeSerializedString(body.bytes ?? []);
      return text === null ? null : JSON.parse(text);
    },
    /** Off the EDT, so the VFS lookups in script never run there. */
    run(script) {
      return robot.retrieve(script, false);
    },

    /** Closes every editor tab of every open project. */
    closeAllEditors() {
      return robot.run(`
        return onEdt(function () {
          var all = projects();
          for (var i = 0; i < all.length; i++) {
            com.intellij.openapi.fileEditor.ex.FileEditorManagerEx.getInstanceEx(all[i]).closeAllFiles();
          }
          return all.length;
        });`);
    },
    /** Closes every tab showing the file at real, and answers how many projects had one. */
    closeFile(real) {
      return robot.run(`
        return onEdt(function () {
          var open = openAt(${JSON.stringify(real)});
          for (var i = 0; i < open.length; i++) FileEditorManager.getInstance(open[i].project).closeFile(open[i].file);
          return open.length;
        });`);
    },
    /** Opens each file in the project at projectReal, in order, without focusing it. */
    openFiles(projectReal, paths) {
      return robot.run(`
        var project = projectAt(${JSON.stringify(projectReal)});
        var files = ${JSON.stringify(paths)}.map(function (path) { return fileAt(path); });
        return onEdt(function () {
          for (var i = 0; i < files.length; i++) FileEditorManager.getInstance(project).openFile(files[i], false);
          return files.length;
        });`);
    },
    /** The editors each open project shows the file at real in, by class name. */
    editorsOf(real) {
      return robot.run(`
        return onEdt(function () {
          var open = openAt(${JSON.stringify(real)});
          var names = [];
          for (var i = 0; i < open.length; i++) {
            var editors = FileEditorManager.getInstance(open[i].project).getAllEditors(open[i].file);
            for (var j = 0; j < editors.length; j++) names.push(String(editors[j].getClass().getName()));
          }
          return names;
        });`);
    },
    /** The Coding agents setting, turned on or off as its checkbox does. */
    setCodingAgents(on) {
      return robot.run(`
        var cls = ${pluginClass(SETTINGS_CLASS)};
        var settings = Application.getService(cls);
        return onEdt(function () { settings.setCodingAgents(${Boolean(on)}); return Boolean(settings.getCodingAgents()); });`);
    },
    /** Opens the folder as a project in a window of its own. */
    openProject(path) {
      return robot.run(`
        var project = onEdt(function () { return com.intellij.ide.impl.ProjectUtil.openOrImport(${JSON.stringify(path)}, null, true); });
        return project == null ? null : String(project.getBasePath());`);
    },
    closeProject(real) {
      return robot.run(`
        var project = projectAt(${JSON.stringify(real)});
        if (project == null) return false;
        return onEdt(function () { return Boolean(com.intellij.openapi.project.ProjectManager.getInstance().closeAndDispose(project)); });`);
    },
    /** Shows a modal message later on the EDT, so this call returns while it stays up. */
    showModal(title, message) {
      return robot.execute(
        `Application.invokeLater(new java.lang.Runnable({ run: function () {
          com.intellij.openapi.ui.Messages.showInfoMessage(${JSON.stringify(message)}, ${JSON.stringify(title)});
        } }));`,
        false
      );
    },
    /** Whether a dialog titled title shows; on the EDT as is, which a modal dialog still serves. */
    hasDialog(title) {
      return robot.retrieve(`
        var windows = java.awt.Window.getWindows();
        for (var i = 0; i < windows.length; i++) {
          var w = windows[i];
          if (w.isShowing() && w instanceof java.awt.Dialog && String(w.getTitle()) === ${JSON.stringify(title)}) return true;
        }
        return false;`);
    },
    closeDialog(title) {
      return robot.retrieve(`
        var windows = java.awt.Window.getWindows();
        for (var i = 0; i < windows.length; i++) {
          var w = windows[i];
          if (!w.isShowing() || !(w instanceof java.awt.Dialog) || String(w.getTitle()) !== ${JSON.stringify(title)}) continue;
          if (w instanceof com.intellij.openapi.ui.DialogWrapperDialog) w.getDialogWrapper().close(0);
          else w.dispose();
          return true;
        }
        return false;`);
    },
    /** Renames the file or folder at path in a write action, as the Rename refactoring does. */
    rename(path, name) {
      return robot.run(`
        var file = fileAt(${JSON.stringify(path)});
        if (file == null) return null;
        inWriteAction(function () { file.rename(null, ${JSON.stringify(name)}); });
        return String(file.getPath());`);
    },
    /** Refreshes the file at path from disk, as a focus return does, and answers its writability. */
    refresh(path) {
      return robot.run(`
        var file = fileAt(${JSON.stringify(path)});
        file.refresh(false, false);
        return Boolean(file.isWritable());`);
    },
    /** Splits the editor window that shows the file at real, the new half showing it too. */
    split(real) {
      return robot.run(`
        return onEdt(function () {
          var open = openAt(${JSON.stringify(real)});
          if (!open.length) return false;
          var windows = editorWindowsOf(open[0].project, open[0].file);
          if (!windows.length) return false;
          // The four-argument split is the one 2025.2 and 2026.1 both have: orientation, forceSplit, file, focusNew.
          return windows[0].split(javax.swing.SwingConstants.VERTICAL, true, open[0].file, false) != null;
        });`);
    },
    /** Closes the file in the first editor window that shows it, leaving the others. */
    closeInFirstWindow(real) {
      return robot.run(`
        return onEdt(function () {
          var open = openAt(${JSON.stringify(real)});
          if (!open.length) return false;
          var windows = editorWindowsOf(open[0].project, open[0].file);
          if (!windows.length) return false;
          windows[0].closeFile(open[0].file, true);
          return true;
        });`);
    },
    /** The names of the live threads that start with prefix. */
    threads(prefix) {
      return robot.run(`
        var names = [];
        var threads = java.lang.Thread.getAllStackTraces().keySet().iterator();
        while (threads.hasNext()) {
          var name = String(threads.next().getName());
          if (name.indexOf(${JSON.stringify(prefix)}) === 0) names.push(name);
        }
        return names;`);
    },
    /**
     * Disables our plugin as its Settings | Plugins checkbox does and answers the boolean of the
     * DynamicPlugins.unloadPlugins call that makes: true when it unloaded without a restart. The
     * disable persists until enablePlugin; a weak reference keeps the class loader in sight.
     */
    disablePlugin() {
      // Not DynamicPlugins.INSTANCE.unloadPlugin(descriptor): it skips the unload-safety check
      // unloadPlugins makes, and a plugin it unloaded did not load again in the same process.
      return robot.run(`
        var descriptor = plugin();
        global.put('erdSmokeLoader', new java.lang.ref.WeakReference(descriptor.getPluginClassLoader()));
        return onEdt(function () {
          return Boolean(com.intellij.ide.plugins.PluginEnabler.getInstance().disable(java.util.List.of(descriptor)));
        });`);
    },
    /**
     * Whether the class loader disablePlugin let go of is collected after a GC. The robot runs
     * each script in a fresh Rhino scope, so no earlier step's script still holds a plugin class.
     */
    loaderCollected() {
      return robot.run(`
        java.lang.System.gc();
        var ref = global.get('erdSmokeLoader');
        return ref != null && ref.get() == null;`);
    },
    /** Clears the disable disablePlugin persisted and loads the plugin again if it was unloaded. */
    enablePlugin() {
      return robot.run(`
        var descriptor = plugin();
        return onEdt(function () {
          return Boolean(com.intellij.ide.plugins.PluginEnabler.getInstance().enable(java.util.List.of(descriptor)));
        });`);
    },
    /** Quits without a confirmation, in any modality, for a quit a dialog held up. */
    exit() {
      return robot.execute(
        `Application.invokeLater(new java.lang.Runnable({ run: function () { Application.exit(true, true, false); } }),
          com.intellij.openapi.application.ModalityState.any());`,
        false
      );
    },
  };
  return robot;
}
