// Side-effect stylesheet imports resolved by css-loader. `app` declares the same
// thing and `vscode-webview` gets it from `vite/client`; this package had neither,
// so `import './webview.css'` in `src/main.ts` was the one unresolved module in
// the repo.
declare module '*.css';

interface Window {
  cefQuery: (query: {
    request: string;
    onSuccess: (response: string) => void;
    onFailure: (errorCode: number, errorMessage: string) => void;
    context?: any;
    persistent: boolean;
    keepAlive?: boolean;
  }) => number;
  cefQueryCancel: (requestId: number) => void;
}
