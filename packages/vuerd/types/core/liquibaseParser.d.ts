export interface LiquibaseFile {
  path: string;
  value: string;
}

export interface LoadLiquibaseData {
  files: LiquibaseFile[];
  type: 'vscode' | 'web';
}
