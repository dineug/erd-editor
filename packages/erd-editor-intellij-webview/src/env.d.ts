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
