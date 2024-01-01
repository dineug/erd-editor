interface ImportMetaEnv {
  readonly MODE: 'production' | 'development';
  readonly WEBSOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
