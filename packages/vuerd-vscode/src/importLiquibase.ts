import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';

const liquibaseDirectory = 'changelog';
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

  var foundChangelog = false;
  fs.readdirSync(vuerdFolder).forEach(directory => {
    if (directory === liquibaseDirectory) {
      foundChangelog = true;
      const changeLog = path.join(vuerdFolder, directory);

      // get root file from folder
      const rootFileName = fs
        .readdirSync(changeLog)
        .find(file => liquibaseRootFile === file);

      if (!rootFileName) return;

      foundChangelog = true;

      const rootFileFullPath = path.join(changeLog, rootFileName);
      allFiles.push({
        path: rootFileName,
        value: fs.readFileSync(rootFileFullPath, 'utf8'),
      });
    }
  });

  if (foundChangelog) {
    window.showInformationMessage('Succesfully found all files');
  } else {
    window.showErrorMessage(
      "Cannot find 'changelog.xml' inside 'changelog' folder"
    );
  }

  return allFiles;
};
