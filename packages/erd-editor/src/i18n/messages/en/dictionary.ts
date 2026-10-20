/**
 * The Dictionary tab's own text: its four sheets and their column headers, the
 * bar above them, its status line, the six kinds of check and its toasts. The
 * file format a button or the empty sheet names enters as a placeholder.
 */
export const dictionary = {
  'dictionary.sheet.words': 'Words',
  'dictionary.sheet.terms': 'Terms',
  'dictionary.sheet.domains': 'Domains',
  'dictionary.sheet.checks': 'Checks',
  'dictionary.addRow': 'Add Row',
  'dictionary.deleteRows': 'Delete Rows',
  'dictionary.import': 'Import {format}',
  'dictionary.export': 'Export {format}',
  'dictionary.rowCount': {
    one: '{count} row',
    other: '{count} rows',
  },
  'dictionary.selectedCount': {
    one: '{count} selected',
    other: '{count} selected',
  },
  'dictionary.empty': 'Import a {format} file or add a row',
  'dictionary.field.word': 'Word',
  'dictionary.field.abbreviation': 'Abbreviation',
  'dictionary.field.englishName': 'English Name',
  'dictionary.field.description': 'Description',
  'dictionary.field.synonyms': 'Synonyms',
  'dictionary.field.forbiddenWords': 'Forbidden Words',
  'dictionary.field.term': 'Term',
  'dictionary.field.physicalName': 'Physical Name',
  'dictionary.field.domain': 'Domain',
  'dictionary.field.category': 'Category',
  'dictionary.field.dataType': 'Data Type',
  'dictionary.field.type': 'Type',
  'dictionary.field.target': 'Target',
  'dictionary.field.detail': 'Detail',
  'dictionary.check.duplicateName': 'Duplicate name',
  'dictionary.check.unknownDomain': 'Unknown domain',
  'dictionary.check.unregisteredWord': 'Unregistered word',
  'dictionary.check.forbiddenWord': 'Forbidden word',
  'dictionary.check.synonymWord': 'Synonym',
  'dictionary.check.physicalNameMismatch': 'Physical name mismatch',
  'dictionary.toast.imported':
    '{added} added · {updated} updated · {skipped} skipped',
  'dictionary.toast.unknownDomains': {
    one: '{count} unknown domain: {names}',
    other: '{count} unknown domains: {names}',
  },
  'dictionary.toast.unknownFormat':
    "Couldn't read this file as words, terms or domains",
  'dictionary.toast.duplicateNames': {
    one: 'Nothing saved: {count} row shares a name with another row ({names})',
    other:
      'Nothing saved: {count} rows share a name with another row ({names})',
  },
  'dictionary.toast.unknownDomainNames': {
    one: 'Nothing saved: {count} row names an unknown domain ({names})',
    other: 'Nothing saved: {count} rows name an unknown domain ({names})',
  },
  'dictionary.toast.rowRemoved': 'Nothing saved: the row was removed',
} as const;
