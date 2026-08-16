/**
 * The one browser floor this repo actually commits to.
 *
 * It exists because the repo had three different answers and no way to tell
 * which was true. `app` compiled its own source with swc against browserslist
 * `defaults` (safari 15.6); the nine libraries declared nothing and so inherited
 * Vite's default, which is safari 16.4; and what the bundles *actually* emitted
 * was neither — the highest syntax measured across them was private class
 * fields, which Safari has had since 14.1. No test covered the question, so the
 * number below is the one the code was already living at, made explicit.
 *
 * Every published library uses it. They are consumed by the web app, the VSCode
 * webview, the IntelliJ webview and by third parties through npm, so their floor
 * is the floor of everything downstream — raising it here narrows all four at
 * once, which is the point of having it in a single file.
 *
 * The two webviews deliberately do not import this. They run in embedded
 * Chromium the host ships (Electron for VSCode, JCEF for IntelliJ), so their own
 * sources have a much higher floor than the public web does; what they consume
 * from the libraries is already capped by this value regardless.
 *
 * `vscode-extension` is not a browser target at all — it pins `node20`, derived
 * from its `engines.vscode`.
 */
export const BROWSER_TARGET = ['chrome87', 'edge88', 'firefox78', 'safari14.1'];
