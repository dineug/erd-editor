import type { Messages } from '@/i18n/translate';

/** The app's own text in German, key for key as English writes it. */
export const deDE = {
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.dismiss': 'Schließen',
  'common.tryAgain': 'Erneut versuchen',
  'common.reload': 'Neu laden',
  'common.loading': 'Wird geladen…',
  'common.search': 'Suche',
  'common.rename': 'Umbenennen',
  'common.importFiles': 'Dateien importieren',
  'common.signOut': 'Abmelden',
  'common.downloadMyChanges': 'Meine Änderungen herunterladen',
  'common.edited': 'Bearbeitet {time}',
  'common.system': 'System',
  'common.displayLanguage': 'Anzeigesprache',
  'common.theme': 'Design',
  'common.light': 'Hell',
  'common.dark': 'Dunkel',
  'common.host': 'Host',
  'common.guest': 'Gast',
  'common.you': '(Sie)',
  'common.participants': 'Teilnehmende',
  'common.yourNickname': 'Ihr Spitzname',
  'common.privacy': 'Datenschutz',
  'common.terms': 'Nutzungsbedingungen',
  'common.editingGuide': 'Bearbeitungsanleitung',
  'common.openSidebar': 'Seitenleiste öffnen',
  'common.closeSidebar': 'Seitenleiste schließen',

  'time.justNow': 'gerade eben',
  'time.today': 'Heute',
  'time.yesterday': 'Gestern',
  'time.previous7Days': 'Letzte 7 Tage',
  'time.previous30Days': 'Letzte 30 Tage',

  'sidebar.schemas': 'Schemas',
  'sidebar.newSchema': 'Neues Schema',
  'sidebar.importAndExport': 'Import und Export',
  'sidebar.exportBackup': 'Sicherung exportieren',
  'sidebar.searchSchemas': 'Schemas durchsuchen',
  'sidebar.newSchemaName': 'Name des neuen Schemas',
  'sidebar.schemaName': 'Schemaname',
  'sidebar.schemaNamePlaceholder': 'Schemaname',
  'sidebar.duplicate': 'Duplizieren',
  'sidebar.moveToTrash': 'In den Papierkorb',
  'sidebar.actionsFor': 'Aktionen für {name}',
  'sidebar.noResults': 'Keine Ergebnisse',

  'trash.button': 'Papierkorb ({count})',
  'trash.title': 'Papierkorb',
  'trash.description': {
    one: 'Schemas im Papierkorb werden nach {count} Tag endgültig gelöscht.',
    other:
      'Schemas im Papierkorb werden nach {count} Tagen endgültig gelöscht.',
  },
  'trash.listLabel': 'Schemas im Papierkorb',
  'trash.deleted': 'Gelöscht {time}',
  'trash.deletesToday': 'wird heute gelöscht',
  'trash.deletesTomorrow': 'wird morgen gelöscht',
  'trash.deletesIn': {
    one: 'wird in {count} Tag gelöscht',
    other: 'wird in {count} Tagen gelöscht',
  },
  'trash.restore': 'Wiederherstellen',
  'trash.deletePermanently': 'Endgültig löschen',
  'trash.cannotBeUndone': 'Dies kann nicht rückgängig gemacht werden.',
  'trash.delete': 'Löschen',
  'trash.empty': 'Der Papierkorb ist leer.',
  'trash.emptyTrash': 'Papierkorb leeren',
  'trash.emptyConfirm': {
    one: '{count} Schema endgültig löschen? Dies kann nicht rückgängig gemacht werden.',
    other:
      '{count} Schemas endgültig löschen? Dies kann nicht rückgängig gemacht werden.',
  },

  'collaboration.for': 'Zusammenarbeit für {name}',
  'collaboration.guestsConnected': {
    one: '{count} Gast verbunden',
    other: '{count} Gäste verbunden',
  },
  'collaboration.title': 'Gemeinsames Bearbeiten',
  'collaboration.experiment': 'Experimentell',
  'collaboration.description':
    'Teilnehmende verbinden sich direkt über WebRTC und tauschen Nachrichten mit Ende-zu-Ende-Verschlüsselung aus.',
  'collaboration.nickname': 'Spitzname',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Noch ist niemand sonst beigetreten.',
  'collaboration.startSession': 'Sitzung starten',
  'collaboration.stopSession': 'Sitzung beenden',

  'viewer.noSchemaOpen': 'Kein Schema geöffnet',
  'viewer.emptyHint':
    'Wählen Sie eines in der Seitenleiste aus oder erstellen Sie hier ein neues. Sie können Dateien auch an beliebiger Stelle ablegen, um sie zu importieren.',
  'viewer.openSample': 'Beispiel öffnen',
  'viewer.sampleName': 'Beispiel-Buchhandlung',

  'drop.title': 'Zum Importieren ablegen',
  'drop.formats':
    'Sicherungen, .erd-, .vuerd- und .json-Dokumente, SQL, DBML, AML und GraphQL',
  'drop.importing': 'Dateien werden importiert…',
  'drop.importingHint': 'Weitere Dateien nach Abschluss dieses Imports ablegen',

  'import.imported': {
    one: '{count} Schema importiert',
    other: '{count} Schemas importiert',
  },
  'import.skippedInvalidFiles': {
    one: '{count} ungültige Datei übersprungen',
    other: '{count} ungültige Dateien übersprungen',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} ungültiges Schema übersprungen',
    other: '{count} ungültige Schemas übersprungen',
  },
  'import.skippedOversized': {
    one: '{count} Datei über {size} MB übersprungen',
    other: '{count} Dateien über {size} MB übersprungen',
  },
  'import.nothing': 'Nichts zu importieren',
  'import.failed': 'Import fehlgeschlagen',
  'import.exportFailed': 'Export fehlgeschlagen',

  'update.available': 'Eine neue Version von ERD Editor ist verfügbar.',
  'update.updatedElsewhere':
    'Die App wurde in einem anderen Tab aktualisiert – zum Abschließen neu laden.',

  'embed.title': 'Diagramm einbetten',
  'embed.documentUrl': 'Dokument-URL',
  'embed.fetchUrl': 'Lädt von',
  'embed.nameView': 'Namensansicht',
  'embed.nameAsSaved': 'Wie gespeichert',
  'embed.physicalNames': 'Physische Namen',
  'embed.logicalNames': 'Logische Namen',
  'embed.bothNames': 'Beide Namen',
  'embed.accentColor': 'Akzentfarbe',
  'embed.grayColor': 'Grauton',
  'embed.minimap': 'Minikarte',
  'embed.controls': 'Steuerelemente',
  'embed.height': 'Höhe',
  'embed.preview': 'Vorschau',
  'embed.embedUrl': 'Einbettungs-URL',
  'embed.embedCode': 'Einbettungscode',
  'embed.copy': 'Kopieren',
  'embed.copied': 'Kopiert',

  'live.invalidToken': 'Ungültiger Freigabelink.',
  'live.hostNotFound': 'Host nicht gefunden.',
  'live.refresh': 'Aktualisieren',
  'live.hostStopped': 'Der Host hat die Sitzung beendet.',
  'live.somethingWentWrong': 'Etwas ist schiefgelaufen.',
  'live.lookingForHost': 'Host wird gesucht...',
  'live.waitingForHost': 'Warten auf den Host...',
  'live.session': 'Live-Sitzung',
  'live.inSession': {
    one: '{count} in der Sitzung',
    other: '{count} in der Sitzung',
  },
  'live.showParticipants': 'Teilnehmende anzeigen',
  'live.hideParticipants': 'Teilnehmende ausblenden',

  'gdrive.checkingSignIn': 'Ihre Google-Anmeldung wird geprüft…',
  'gdrive.anotherAccount': 'ein anderes Konto',
  'gdrive.offline.title': 'Sie sind offline',
  'gdrive.offline.description':
    'ERD Editor prüft Ihre Google-Anmeldung, sobald Sie wieder online sind.',
  'gdrive.scopeMissing.title': 'Zugriff auf Google Drive wurde nicht gewährt',
  'gdrive.scopeMissing.description':
    'ERD Editor benötigt Zugriff auf die Dateien, die Sie damit erstellen oder öffnen. Melden Sie sich erneut an und erlauben Sie den Zugriff auf Google Drive.',
  'gdrive.mismatch.title':
    'Google Drive hat dies für ein anderes Konto gesendet',
  'gdrive.mismatch.description':
    'Sie sind als {email} angemeldet. Wechseln Sie zu dem Konto, mit dem Google Drive die Datei geöffnet hat, oder fahren Sie mit den Dateien dieses Kontos fort.',
  'gdrive.mismatch.choose':
    'ERD Editor konnte das andere Konto nicht vorauswählen. Wählen Sie es daher aus, wenn Google danach fragt.',
  'gdrive.mismatch.switchAccount': 'Konto wechseln',
  'gdrive.mismatch.showMyFiles': 'Meine Dateien anzeigen',
  'gdrive.accountChanged.title': 'Mit einem anderen Konto angemeldet',
  'gdrive.accountChanged.description':
    'Ein anderer Tab hat sich bei einem anderen Google-Konto angemeldet, daher wurde dieser Tab angehalten. Laden Sie ihn neu, um mit dem neuen Konto fortzufahren.',
  'gdrive.unsaved.title': 'Ihre Änderungen wurden nicht gespeichert',
  'gdrive.unsaved.description':
    '{name} enthält Änderungen von {email}, die nicht in Google Drive sind, und jetzt ist {account} angemeldet. Laden Sie sie herunter, bevor Sie fortfahren.',
  'gdrive.unsaved.descriptionUnnamed':
    'Die geöffnete Datei enthält Änderungen von {email}, die nicht in Google Drive sind, und jetzt ist {account} angemeldet. Laden Sie sie herunter, bevor Sie fortfahren.',
  'gdrive.unsaved.continueWithout': 'Ohne sie fortfahren',
  'gdrive.framed.title':
    'Öffnen Sie den Google-Drive-Editor von ERD Editor in einem eigenen Tab',
  'gdrive.framed.description': 'Er läuft nicht innerhalb einer anderen Seite.',
  'gdrive.framed.link': 'In neuem Tab öffnen',
  'gdrive.notConfigured.title':
    'Google-Drive-Integration ist nicht eingerichtet',
  'gdrive.notConfigured.description':
    'Dieser Build von ERD Editor hat keinen Google-Anmeldeclient.',
  'gdrive.unsupportedOrigin.title': 'Google Drive ist hier nicht verfügbar',
  'gdrive.unsupportedOrigin.description':
    'Die Google-Anmeldung funktioniert nur auf erd-editor.io, und dies ist eine Vorschau.',

  'gdrive.signIn.title': 'Ihre ERD-Dateien aus Google Drive öffnen',
  'gdrive.signIn.description':
    'ERD Editor öffnet und speichert nur die Dateien, die Sie damit erstellen oder öffnen.',
  'gdrive.signIn.fallbackDescription':
    'Der Anmeldeserver von ERD Editor ist ausgelastet, daher meldet Google Sie jeweils für eine Stunde an.',
  'gdrive.signIn.signIn': 'Über Google anmelden',
  'gdrive.signIn.continue': 'Weiter mit Google',
  'gdrive.signIn.waitingTitle': 'Warten auf die Google-Anmeldung…',
  'gdrive.signIn.waitingDescription':
    'Schließen Sie die Anmeldung in dem Fenster ab, das Google geöffnet hat.',
  'gdrive.signIn.popupBlocked':
    'Ihr Browser hat das Anmeldefenster blockiert. Erlauben Sie Pop-ups für diese Website und versuchen Sie es erneut.',
  'gdrive.signIn.failed':
    'Die Google-Anmeldung wurde nicht abgeschlossen. Versuchen Sie es erneut.',
  'gdrive.signIn.gisBlocked':
    'Die Google-Anmeldung konnte nicht geladen werden. Stellen Sie sicher, dass nichts accounts.google.com blockiert, und laden Sie die Seite neu.',

  'gdrive.sidebar.label': 'Drive-Dateien',
  'gdrive.sidebar.newFile': 'Neue Datei',
  'gdrive.sidebar.import': 'Importieren',
  'gdrive.sidebar.searchFiles': 'Dateien durchsuchen',
  'gdrive.sidebar.newFileName': 'Name der neuen Datei',
  'gdrive.sidebar.fileName': 'Dateiname',
  'gdrive.sidebar.fileNamePlaceholder': 'Dateiname',
  'gdrive.sidebar.loadingFiles': 'Dateien werden geladen…',
  'gdrive.sidebar.loadFailed': 'Ihre Dateien konnten nicht geladen werden.',

  'gdrive.viewer.noFileOpen': 'Keine Datei geöffnet',
  'gdrive.viewer.noFileOpenHint':
    'Wählen Sie eine Datei in der Seitenleiste aus oder erstellen Sie eine neue.',
  'gdrive.viewer.noFilesYet': 'Noch keine Dateien',
  'gdrive.viewer.noFilesYetHint':
    'Erstellen Sie eine Datei oder importieren Sie eine. Dateien, die Sie aus Google Drive mit ERD Editor öffnen, erscheinen ebenfalls hier.',
  'gdrive.viewer.waitingForOpener':
    'Warten auf den Tab, der diese Datei geöffnet hat…',
  'gdrive.viewer.notDocument': 'Diese Datei ist kein ERD Editor-Dokument',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor öffnet Diagramme, die es selbst gespeichert hat. Diese Datei bleibt unverändert und wird nie überschrieben.',
  'gdrive.viewer.googleNativeHint':
    'Google Docs, Tabellen und Ordner werden in Google Drive geöffnet.',
  'gdrive.viewer.trashed': 'Diese Datei ist im Papierkorb',
  'gdrive.viewer.trashedHint':
    'Stellen Sie sie in Google Drive wieder her, um sie hier zu öffnen.',
  'gdrive.viewer.tooLarge': 'Diese Datei ist zu groß',
  'gdrive.viewer.tooLargeHint': 'ERD Editor öffnet Dateien bis {size} MB.',
  'gdrive.viewer.notFound': 'Diese Datei ist nicht verfügbar',
  'gdrive.viewer.notFoundHint':
    'Die Datei wurde möglicherweise gelöscht, oder dieses Google-Konto kann sie nicht öffnen.',
  'gdrive.viewer.waitingToken': 'Warten auf Google',
  'gdrive.viewer.waitingTokenHint':
    'Diese Datei wird geöffnet, sobald Ihre Google-Sitzung wiederhergestellt ist.',
  'gdrive.viewer.failed': 'Diese Datei konnte nicht geöffnet werden',
  'gdrive.viewer.failedHint':
    'Google Drive hat nicht geantwortet. Prüfen Sie die Verbindung und versuchen Sie es erneut.',
  'gdrive.viewer.savingBeforeLeave': 'Wird vor dem Verlassen gespeichert…',

  'gdrive.status.saved': 'In Google Drive gespeichert',
  'gdrive.status.saving': 'Wird gespeichert…',
  'gdrive.status.failed': 'Speichern fehlgeschlagen',
  'gdrive.status.conflict': 'In Google Drive geändert',
  'gdrive.status.unconfirmed':
    'Letztes Speichern konnte nicht bestätigt werden',
  'gdrive.status.paused': 'Pausiert, bis Google wieder verbunden ist',
  'gdrive.status.deleted': 'In Google Drive gelöscht',
  'gdrive.status.readonly': 'Nur ansehen',
  'gdrive.status.waitingLeader':
    'Warten auf den Tab, der diese Datei speichert',
  'gdrive.status.waitingSnapshot':
    'Warten auf den Tab, der diese Datei geöffnet hat',
  'gdrive.status.scopeMissing': 'Kein Zugriff auf Google Drive',

  'gdrive.banner.conflict':
    'Diese Datei wurde in Google Drive geändert, daher wurde das Speichern gestoppt. Ihre Änderungen sind noch da.',
  'gdrive.banner.unconfirmed':
    'Das letzte Speichern konnte nicht bestätigt werden, daher wurde das Speichern gestoppt. Ihre Änderungen sind noch da.',
  'gdrive.banner.deleted':
    'Diese Datei wurde in Google Drive gelöscht oder in den Papierkorb verschoben, daher wurde das Speichern gestoppt.',
  'gdrive.banner.readonly':
    'Sie können diese Datei in Google Drive nicht mehr bearbeiten, daher wurde das Speichern gestoppt. Ihre Änderungen sind noch da.',
  'gdrive.banner.checkDrive': 'Drive prüfen',
  'gdrive.banner.reloadFromDrive': 'Aus Drive neu laden',
  'gdrive.banner.leaderNotResponding':
    'Der Tab, der diese Datei speichert, reagiert nicht.',
  'gdrive.banner.openerNotResponding':
    'Der Tab, der diese Datei geöffnet hat, reagiert nicht.',
  'gdrive.banner.takeOver': 'Speichern übernehmen',
  'gdrive.banner.openAndTakeOver': 'Aus Drive öffnen und übernehmen',
  'gdrive.banner.popupBlocked':
    'Ihr Browser hat das Google-Fenster blockiert. Erlauben Sie Pop-ups für diese Website und verbinden Sie sich dann erneut.',
  'gdrive.banner.reconnectFailed':
    'Die Verbindung zu Google konnte nicht wiederhergestellt werden. Versuchen Sie es erneut.',
  'gdrive.banner.sessionEnded':
    'Ihre Google-Sitzung ist abgelaufen, daher ist das Speichern pausiert.',
  'gdrive.banner.sessionEndsSoon': 'Ihre Google-Sitzung läuft bald ab.',
  'gdrive.banner.reconnect': 'Google neu verbinden',

  'gdrive.leave.title': 'Ihre letzten Änderungen sind nicht gespeichert',
  'gdrive.leave.description':
    'ERD Editor konnte sie nicht in Google Drive speichern. Laden Sie sie herunter, um eine Kopie zu behalten, oder verlassen Sie die Datei und verwerfen Sie sie.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor konnte sie nicht in Google Drive speichern. Laden Sie sie herunter, um eine Kopie zu behalten, oder melden Sie sich ab und verwerfen Sie sie.',
  'gdrive.leave.stay': 'Bleiben',
  'gdrive.leave.leaveAnyway': 'Trotzdem verlassen',
  'gdrive.leave.signOutAnyway': 'Trotzdem abmelden',

  'gdrive.create.title': 'Neue Datei in Google Drive',
  'gdrive.create.inAppFolder': 'Im Ordner ERD Editor',
  'gdrive.create.inFolderPending': 'In einem Ordner…',
  'gdrive.create.inHiddenFolder':
    'In einem Ordner, den ERD Editor nicht sehen kann',
  'gdrive.create.inFolder': 'Im Ordner „{name}“',
  'gdrive.create.untitled': 'Unbenannt',
  'gdrive.create.savedAs': 'Wird als {name} gespeichert',
  'gdrive.create.folderRefused':
    'ERD Editor kann in diesem Ordner keine Dateien erstellen. Stattdessen im Ordner ERD Editor erstellen?',
  'gdrive.create.failed':
    'Die Datei konnte nicht erstellt werden. Versuchen Sie es erneut.',
  'gdrive.create.createInAppFolder': 'Im Ordner ERD Editor erstellen',
  'gdrive.create.create': 'Erstellen',

  'gdrive.import.imported': {
    one: '{count} Datei in Google Drive importiert',
    other: '{count} Dateien in Google Drive importiert',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} Sicherung übersprungen: Sicherungen bleiben in der lokalen App',
    other:
      '{count} Sicherungen übersprungen: Sicherungen bleiben in der lokalen App',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} Upload fehlgeschlagen',
    other: '{count} Uploads fehlgeschlagen',
  },

  'gdrive.notice.unreadableState':
    'Google Drive hat einen Link gesendet, den ERD Editor nicht lesen konnte',
  'gdrive.notice.renameFailed': 'Die Datei konnte nicht umbenannt werden',
  'gdrive.notice.createFailed': 'Die Datei konnte nicht erstellt werden',
  'gdrive.notice.checkFailed':
    'Google Drive ist nicht erreichbar. Versuchen Sie es erneut.',
  'gdrive.notice.reloadFailed':
    'Neuladen aus Google Drive fehlgeschlagen. Versuchen Sie es erneut.',
  'gdrive.notice.reloadTrashed':
    'Neuladen nicht möglich: Die Datei ist in Google Drive im Papierkorb',
  'gdrive.notice.reloadTooLarge':
    'Neuladen nicht möglich: Die Datei in Google Drive ist größer als {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Neuladen nicht möglich: Die Datei in Google Drive ist kein ERD Editor-Dokument mehr',
  'gdrive.notice.signOutUnconfirmed':
    'Hier abgemeldet. Der Server von ERD Editor hat es nicht bestätigt, daher schließt dieser Browser die Abmeldung bei der nächsten Verbindung ab',
  'gdrive.notice.signOutNotRevoked':
    'Hier abgemeldet, aber Google hat nicht bestätigt, dass der Zugriff von ERD Editor entfernt wurde. Ihre anderen Geräte bleiben möglicherweise angemeldet, bis Sie ihn unter myaccount.google.com/permissions entfernen',
} satisfies Messages;
