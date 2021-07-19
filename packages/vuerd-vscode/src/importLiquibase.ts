import * as fs from 'fs';
import * as path from 'path';
import { Uri, window } from 'vscode';

const liquibaseDirectory = 'changelog';
const regexXML = new RegExp(`\.(xml)$`, 'i');

/**
 * Loads all Liquibase changelog files from `changelog` directory
 * @param uri Uri of file next to `changelog` directory
 * @returns Contents of all `*.xml` files in `changelog` directory
 */
export const loadLiquibaseFiles = (uri: string): string[] => {
  const vuerdFolder = path.dirname(
    uri || window.activeTextEditor?.document.fileName || ''
  );

  const allFiles: string[] = [];

  if (!vuerdFolder) {
    return allFiles;
  }

  var foundChangelog = false;
  fs.readdirSync(vuerdFolder).forEach(directory => {
    if (directory === liquibaseDirectory) {
      foundChangelog = true;
      const changeLog = path.join(vuerdFolder, directory);

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
