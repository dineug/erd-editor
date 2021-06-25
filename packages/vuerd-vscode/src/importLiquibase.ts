import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';

const liquibaseDirectory = 'changelog';
const regexXML = new RegExp(`\.(xml)$`, 'i');

/**
 * Loads all Liquibase changelog files from `changelog` directory
 * @returns Contents of all `*.xml` files in `changelog` directory
 */
export const loadLiquibaseFiles = (): string[] => {
  const openedFile = path.dirname(
    window.activeTextEditor?.document.fileName || ''
  );

  const allFiles: string[] = [];

  if (!openedFile) {
    return allFiles;
  }

  var foundChangelog = false;
  fs.readdirSync(openedFile).forEach(directory => {
    if (directory === liquibaseDirectory) {
      foundChangelog = true;
      const changeLog = path.join(openedFile, directory);

      allFiles.push(
        ...fs
          .readdirSync(changeLog)
          .filter(fileName => regexXML.test(fileName))
          .map(fileName => {
            const file = path.join(changeLog, fileName);
            return fs.readFileSync(file, 'utf8');
          })
      );
    }
  });

  if (foundChangelog) {
    window.showInformationMessage('Succesfully found all files');
  } else {
    window.showErrorMessage("Cannot find 'changelog' folder");
  }

  return allFiles;
};
