// Side-effect stylesheet imports. app declares the same thing and
// vscode-webview gets it from vite/client; this package had neither, so its
// stylesheet import was the one unresolved module in the repo.
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
