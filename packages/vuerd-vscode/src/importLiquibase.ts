import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';
import parse from 'xml-parser';

const liquibaseRootFile = 'changelog.xml';

export interface LiquibaseFile {
  path: string;
  value: string;
}

/**
 * Loads all Liquibase changelog files from `changelog` directory
 * @param uri Uri of file next to `changelog` directory
 * @returns Contents of all files included in `changelog.xml` file in `changelog` directory
 */
export const loadLiquibaseFiles = (uri: string): LiquibaseFile[] => {
  const vuerdFolder = path.dirname(
    uri || window.activeTextEditor?.document.fileName || ''
  );

  const allFiles: LiquibaseFile[] = [];

  if (!vuerdFolder) {
    return allFiles;
  }

  fs.readdirSync(vuerdFolder).forEach(directory => {
    const changeLog = path.join(vuerdFolder, directory);

    // get root file from folder
    const rootFileName = fs
      .readdirSync(changeLog)
      .find(file => liquibaseRootFile === file);

    if (!rootFileName) return;

    const rootFileFullPath = path.join(changeLog, rootFileName);
    allFiles.push({
      path: rootFileName,
      value: fs.readFileSync(rootFileFullPath, 'utf8'),
    });

    allFiles.push(...loadNestedIncludes(rootFileFullPath, changeLog));
  });

  return allFiles;
};

/**
 * Recursively load all files inside of <include file="file_name"/>
 * @param uri File to check
 * @returns Liquibase files that were included
 */
export const loadNestedIncludes = (
  uri: string,
  rootUri: string
): LiquibaseFile[] => {
  const files: LiquibaseFile[] = [];

  const file = fs.readFileSync(uri, 'utf8');

  const parsedFile = parse(file).root;

  if (parsedFile.name !== 'databaseChangeLog') return [];

  const includes = parsedFile.children.filter(node => node.name === 'include');

  for (const include of includes) {
    var includePath = include.attributes.file;
    if (!includePath) continue;

    const includeFullPath = path.join(path.dirname(uri), includePath);

    try {
      files.push({
        path: path.relative(rootUri, includeFullPath).replace(/\\/g, '/'),
        value: fs.readFileSync(includeFullPath, 'utf8'),
      });
      files.push(...loadNestedIncludes(includeFullPath, rootUri));
    } catch (e) {
      window.showErrorMessage(`Cannot find ${includeFullPath}`);
    }
  }

  return files;
};
