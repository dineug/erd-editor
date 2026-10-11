import type { Messages } from '@/i18n/translate';

/** The app's own text in Dutch, key for key as English writes it. */
export const nlNL = {
  'common.cancel': 'Annuleren',
  'common.close': 'Sluiten',
  'common.dismiss': 'Sluiten',
  'common.tryAgain': 'Opnieuw proberen',
  'common.reload': 'Opnieuw laden',
  'common.loading': 'Laden…',
  'common.search': 'Zoeken',
  'common.rename': 'Naam wijzigen',
  'common.importFiles': 'Bestanden importeren',
  'common.signOut': 'Uitloggen',
  'common.downloadMyChanges': 'Mijn wijzigingen downloaden',
  'common.edited': 'Bewerkt {time}',
  'common.system': 'Systeem',
  'common.displayLanguage': 'Weergavetaal',
  'common.theme': 'Thema',
  'common.light': 'Licht',
  'common.dark': 'Donker',
  'common.host': 'Host',
  'common.guest': 'Gast',
  'common.you': '(jij)',
  'common.participants': 'Deelnemers',
  'common.yourNickname': 'Je bijnaam',
  'common.privacy': 'Privacy',
  'common.terms': 'Voorwaarden',
  'common.editingGuide': 'Bewerkingshandleiding',
  'common.openSidebar': 'Zijbalk openen',
  'common.closeSidebar': 'Zijbalk sluiten',

  'time.justNow': 'zojuist',
  'time.today': 'Vandaag',
  'time.yesterday': 'Gisteren',
  'time.previous7Days': 'Afgelopen 7 dagen',
  'time.previous30Days': 'Afgelopen 30 dagen',

  'sidebar.schemas': 'Schema’s',
  'sidebar.newSchema': 'Nieuw schema',
  'sidebar.importAndExport': 'Importeren en exporteren',
  'sidebar.exportBackup': 'Back-up exporteren',
  'sidebar.searchSchemas': 'Schema’s zoeken',
  'sidebar.newSchemaName': 'Naam van nieuw schema',
  'sidebar.schemaName': 'Schemanaam',
  'sidebar.schemaNamePlaceholder': 'schemanaam',
  'sidebar.duplicate': 'Dupliceren',
  'sidebar.moveToTrash': 'Naar prullenbak',
  'sidebar.actionsFor': 'Acties voor {name}',
  'sidebar.noResults': 'Geen resultaten',

  'trash.button': 'Prullenbak ({count})',
  'trash.title': 'Prullenbak',
  'trash.description': {
    one: 'Schema’s in de prullenbak worden na {count} dag definitief verwijderd.',
    other:
      'Schema’s in de prullenbak worden na {count} dagen definitief verwijderd.',
  },
  'trash.listLabel': 'Schema’s in de prullenbak',
  'trash.deleted': 'Verwijderd {time}',
  'trash.deletesToday': 'wordt vandaag verwijderd',
  'trash.deletesTomorrow': 'wordt morgen verwijderd',
  'trash.deletesIn': {
    one: 'wordt over {count} dag verwijderd',
    other: 'wordt over {count} dagen verwijderd',
  },
  'trash.restore': 'Herstellen',
  'trash.deletePermanently': 'Definitief verwijderen',
  'trash.cannotBeUndone': 'Dit kan niet ongedaan worden gemaakt.',
  'trash.delete': 'Verwijderen',
  'trash.empty': 'De prullenbak is leeg.',
  'trash.emptyTrash': 'Prullenbak legen',
  'trash.emptyConfirm': {
    one: '{count} schema definitief verwijderen? Dit kan niet ongedaan worden gemaakt.',
    other:
      '{count} schema’s definitief verwijderen? Dit kan niet ongedaan worden gemaakt.',
  },

  'collaboration.for': 'Samenwerking voor {name}',
  'collaboration.guestsConnected': {
    one: '{count} gast verbonden',
    other: '{count} gasten verbonden',
  },
  'collaboration.title': 'Samen bewerken',
  'collaboration.experiment': 'Experiment',
  'collaboration.description':
    'Deelnemers maken rechtstreeks verbinding via WebRTC en wisselen berichten uit met end-to-end-versleuteling.',
  'collaboration.nickname': 'Bijnaam',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Er heeft zich nog niemand anders aangesloten.',
  'collaboration.startSession': 'Sessie starten',
  'collaboration.stopSession': 'Sessie stoppen',

  'viewer.noSchemaOpen': 'Geen schema geopend',
  'viewer.emptyHint':
    'Kies er een in de zijbalk of begin er hier een. Je kunt ook overal bestanden neerzetten om ze te importeren.',
  'viewer.openSample': 'Voorbeeld openen',
  'viewer.sampleName': 'boekwinkelvoorbeeld',

  'drop.title': 'Neerzetten om te importeren',
  'drop.formats':
    'Back-ups, .erd-, .vuerd- en .json-documenten, SQL, DBML, AML en GraphQL',
  'drop.importing': 'Bestanden importeren…',
  'drop.importingHint': 'Zet meer neer zodra deze import klaar is',

  'import.imported': {
    one: '{count} schema geïmporteerd',
    other: '{count} schema’s geïmporteerd',
  },
  'import.skippedInvalidFiles': {
    one: '{count} ongeldig bestand overgeslagen',
    other: '{count} ongeldige bestanden overgeslagen',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} ongeldig schema overgeslagen',
    other: '{count} ongeldige schema’s overgeslagen',
  },
  'import.skippedOversized': {
    one: '{count} bestand groter dan {size} MB overgeslagen',
    other: '{count} bestanden groter dan {size} MB overgeslagen',
  },
  'import.nothing': 'Niets om te importeren',
  'import.failed': 'Importeren mislukt',
  'import.exportFailed': 'Exporteren mislukt',

  'update.available': 'Er is een nieuwe versie van ERD Editor beschikbaar.',
  'update.updatedElsewhere':
    'De app is in een ander tabblad bijgewerkt — laad opnieuw om af te ronden.',

  'live.invalidToken': 'Ongeldige deellink.',
  'live.hostNotFound': 'Host niet gevonden.',
  'live.refresh': 'Vernieuwen',
  'live.hostStopped': 'De host heeft de sessie gestopt.',
  'live.somethingWentWrong': 'Er is iets misgegaan.',
  'live.lookingForHost': 'Host zoeken...',
  'live.waitingForHost': 'Wachten op de host...',
  'live.session': 'Livesessie',
  'live.inSession': {
    one: '{count} in de sessie',
    other: '{count} in de sessie',
  },
  'live.showParticipants': 'Deelnemers tonen',
  'live.hideParticipants': 'Deelnemers verbergen',

  'gdrive.checkingSignIn': 'Controleren of je bij Google bent ingelogd…',
  'gdrive.anotherAccount': 'een ander account',
  'gdrive.offline.title': 'Je bent offline',
  'gdrive.offline.description':
    'Zodra je weer online bent, controleert ERD Editor of je bij Google bent ingelogd.',
  'gdrive.scopeMissing.title': 'Toegang tot Google Drive is niet verleend',
  'gdrive.scopeMissing.description':
    'ERD Editor heeft toegang nodig tot de bestanden die je ermee maakt of opent. Log opnieuw in en sta toegang tot Google Drive toe.',
  'gdrive.mismatch.title':
    'Google Drive heeft dit voor een ander account gestuurd',
  'gdrive.mismatch.description':
    'Je bent ingelogd als {email}. Schakel over naar het account waarmee Google Drive het opende, of ga verder met de bestanden van dit account.',
  'gdrive.mismatch.choose':
    'ERD Editor kon dat account niet vooraf selecteren, dus kies het wanneer Google erom vraagt.',
  'gdrive.mismatch.switchAccount': 'Account wisselen',
  'gdrive.mismatch.showMyFiles': 'Mijn bestanden tonen',
  'gdrive.accountChanged.title': 'Ingelogd met een ander account',
  'gdrive.accountChanged.description':
    'Een ander tabblad is ingelogd met een ander Google-account, dus dit tabblad is gestopt. Laad het opnieuw om met dat account verder te gaan.',
  'gdrive.unsaved.title': 'Je wijzigingen zijn niet opgeslagen',
  'gdrive.unsaved.description':
    '{name} heeft wijzigingen van {email} die niet in Google Drive staan, en nu is {account} ingelogd. Download ze voordat je verdergaat.',
  'gdrive.unsaved.descriptionUnnamed':
    'Het bestand dat je open had heeft wijzigingen van {email} die niet in Google Drive staan, en nu is {account} ingelogd. Download ze voordat je verdergaat.',
  'gdrive.unsaved.continueWithout': 'Doorgaan zonder de wijzigingen',
  'gdrive.framed.title':
    'Open de Google Drive-editor van ERD Editor in een eigen tabblad',
  'gdrive.framed.description': 'Hij werkt niet binnen een andere pagina.',
  'gdrive.framed.link': 'Openen in nieuw tabblad',
  'gdrive.notConfigured.title':
    'Google Drive-integratie is niet geconfigureerd',
  'gdrive.notConfigured.description':
    'Deze build van ERD Editor heeft geen Google-inlogclient.',
  'gdrive.unsupportedOrigin.title': 'Google Drive is hier niet beschikbaar',
  'gdrive.unsupportedOrigin.description':
    'Inloggen met Google werkt alleen op erd-editor.io, en dit is een voorbeeldversie.',

  'gdrive.signIn.title': 'Open je ERD-bestanden in Google Drive',
  'gdrive.signIn.description':
    'ERD Editor opent en bewaart alleen de bestanden die je ermee maakt of opent.',
  'gdrive.signIn.fallbackDescription':
    'De inlogserver van ERD Editor is druk, dus Google logt je telkens voor een uur in.',
  'gdrive.signIn.signIn': 'Inloggen met Google',
  'gdrive.signIn.continue': 'Doorgaan met Google',
  'gdrive.signIn.waitingTitle': 'Wachten tot je bij Google bent ingelogd…',
  'gdrive.signIn.waitingDescription':
    'Rond het inloggen af in het venster dat Google heeft geopend.',
  'gdrive.signIn.popupBlocked':
    'Je browser heeft het inlogvenster geblokkeerd. Sta pop-ups toe voor deze site en probeer het opnieuw.',
  'gdrive.signIn.failed':
    'Inloggen bij Google is niet afgerond. Probeer het opnieuw.',
  'gdrive.signIn.gisBlocked':
    'Inloggen met Google kon niet laden. Controleer of niets accounts.google.com blokkeert en laad de pagina opnieuw.',

  'gdrive.sidebar.label': 'Drive-bestanden',
  'gdrive.sidebar.newFile': 'Nieuw bestand',
  'gdrive.sidebar.import': 'Importeren',
  'gdrive.sidebar.searchFiles': 'Bestanden zoeken',
  'gdrive.sidebar.newFileName': 'Naam van nieuw bestand',
  'gdrive.sidebar.fileName': 'Bestandsnaam',
  'gdrive.sidebar.fileNamePlaceholder': 'bestandsnaam',
  'gdrive.sidebar.loadingFiles': 'Bestanden laden…',
  'gdrive.sidebar.loadFailed': 'Je bestanden konden niet worden geladen.',

  'gdrive.viewer.noFileOpen': 'Geen bestand geopend',
  'gdrive.viewer.noFileOpenHint':
    'Kies een bestand in de zijbalk of begin een nieuw bestand.',
  'gdrive.viewer.noFilesYet': 'Nog geen bestanden',
  'gdrive.viewer.noFilesYetHint':
    'Maak een bestand of importeer er een. Bestanden die je vanuit Google Drive met ERD Editor opent, verschijnen hier ook.',
  'gdrive.viewer.waitingForOpener':
    'Wachten op het tabblad dat dit bestand opende…',
  'gdrive.viewer.notDocument': 'Dit bestand is geen ERD Editor-document',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor opent diagrammen die het zelf heeft opgeslagen. Dit bestand blijft zoals het is en wordt nooit overschreven.',
  'gdrive.viewer.googleNativeHint':
    'Google Documenten, Spreadsheets en mappen openen in Google Drive.',
  'gdrive.viewer.trashed': 'Dit bestand staat in de prullenbak',
  'gdrive.viewer.trashedHint':
    'Herstel het in Google Drive om het hier te openen.',
  'gdrive.viewer.tooLarge': 'Dit bestand is te groot',
  'gdrive.viewer.tooLargeHint': 'ERD Editor opent bestanden tot {size} MB.',
  'gdrive.viewer.notFound': 'Dit bestand is niet beschikbaar',
  'gdrive.viewer.notFoundHint':
    'Het is mogelijk verwijderd, of dit Google-account kan het niet openen.',
  'gdrive.viewer.waitingToken': 'Wachten op Google',
  'gdrive.viewer.waitingTokenHint':
    'Dit bestand opent zodra je Google-sessie terug is.',
  'gdrive.viewer.failed': 'Dit bestand kon niet worden geopend',
  'gdrive.viewer.failedHint':
    'Google Drive gaf geen antwoord. Controleer de verbinding en probeer het opnieuw.',
  'gdrive.viewer.savingBeforeLeave': 'Opslaan voordat je weggaat…',

  'gdrive.status.saved': 'Opgeslagen in Google Drive',
  'gdrive.status.saving': 'Opslaan…',
  'gdrive.status.failed': 'Opslaan mislukt',
  'gdrive.status.conflict': 'Gewijzigd in Google Drive',
  'gdrive.status.unconfirmed': 'Laatste opslagactie kon niet worden bevestigd',
  'gdrive.status.paused': 'Gepauzeerd tot Google weer verbonden is',
  'gdrive.status.deleted': 'Verwijderd in Google Drive',
  'gdrive.status.readonly': 'Alleen bekijken',
  'gdrive.status.waitingLeader':
    'Wachten op het tabblad dat dit bestand opslaat',
  'gdrive.status.waitingSnapshot':
    'Wachten op het tabblad dat dit bestand opende',
  'gdrive.status.scopeMissing': 'Geen toegang tot Google Drive',

  'gdrive.banner.conflict':
    'Dit bestand is gewijzigd in Google Drive, dus het opslaan is gestopt. Je wijzigingen staan er nog.',
  'gdrive.banner.unconfirmed':
    'De laatste opslagactie kon niet worden bevestigd, dus het opslaan is gestopt. Je wijzigingen staan er nog.',
  'gdrive.banner.deleted':
    'Dit bestand is verwijderd of naar de prullenbak verplaatst in Google Drive, dus het opslaan is gestopt.',
  'gdrive.banner.readonly':
    'Je kunt dit bestand niet meer bewerken in Google Drive, dus het opslaan is gestopt. Je wijzigingen staan er nog.',
  'gdrive.banner.checkDrive': 'Drive controleren',
  'gdrive.banner.reloadFromDrive': 'Opnieuw laden uit Drive',
  'gdrive.banner.leaderNotResponding':
    'Het tabblad dat dit bestand opslaat reageert niet.',
  'gdrive.banner.openerNotResponding':
    'Het tabblad dat dit bestand opende reageert niet.',
  'gdrive.banner.takeOver': 'Opslaan overnemen',
  'gdrive.banner.openAndTakeOver': 'Openen uit Drive en overnemen',
  'gdrive.banner.popupBlocked':
    'Je browser heeft het Google-venster geblokkeerd. Sta pop-ups toe voor deze site en maak dan opnieuw verbinding.',
  'gdrive.banner.reconnectFailed':
    'Opnieuw verbinden met Google is mislukt. Probeer het opnieuw.',
  'gdrive.banner.sessionEnded':
    'Je Google-sessie is beëindigd, dus het opslaan is gepauzeerd.',
  'gdrive.banner.sessionEndsSoon': 'Je Google-sessie loopt binnenkort af.',
  'gdrive.banner.reconnect': 'Google opnieuw verbinden',

  'gdrive.leave.title': 'Je laatste wijzigingen zijn niet opgeslagen',
  'gdrive.leave.description':
    'ERD Editor kon ze niet in Google Drive opslaan. Download ze om een kopie te bewaren, of ga weg en raak ze kwijt.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor kon ze niet in Google Drive opslaan. Download ze om een kopie te bewaren, of log uit en raak ze kwijt.',
  'gdrive.leave.stay': 'Blijven',
  'gdrive.leave.leaveAnyway': 'Toch weggaan',
  'gdrive.leave.signOutAnyway': 'Toch uitloggen',

  'gdrive.create.title': 'Nieuw bestand in Google Drive',
  'gdrive.create.inAppFolder': 'In de map ERD Editor',
  'gdrive.create.inFolderPending': 'In een map…',
  'gdrive.create.inHiddenFolder': 'In een map die ERD Editor niet kan zien',
  'gdrive.create.inFolder': 'In de map ‘{name}’',
  'gdrive.create.untitled': 'Naamloos',
  'gdrive.create.savedAs': 'Wordt opgeslagen als {name}',
  'gdrive.create.folderRefused':
    'ERD Editor kan geen bestanden maken in deze map. In plaats daarvan in de map ERD Editor maken?',
  'gdrive.create.failed':
    'Het bestand kon niet worden gemaakt. Probeer het opnieuw.',
  'gdrive.create.createInAppFolder': 'Maken in de map ERD Editor',
  'gdrive.create.create': 'Maken',

  'gdrive.import.imported': {
    one: '{count} bestand geïmporteerd in Google Drive',
    other: '{count} bestanden geïmporteerd in Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} back-up overgeslagen: back-ups blijven in de lokale app',
    other: '{count} back-ups overgeslagen: back-ups blijven in de lokale app',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} upload mislukt',
    other: '{count} uploads mislukt',
  },

  'gdrive.notice.unreadableState':
    'Google Drive stuurde een link die ERD Editor niet kon lezen',
  'gdrive.notice.renameFailed':
    'De naam van het bestand kon niet worden gewijzigd',
  'gdrive.notice.createFailed': 'Het bestand kon niet worden gemaakt',
  'gdrive.notice.checkFailed':
    'Google Drive is niet bereikbaar. Probeer het opnieuw.',
  'gdrive.notice.reloadFailed':
    'Opnieuw laden uit Google Drive is mislukt. Probeer het opnieuw.',
  'gdrive.notice.reloadTrashed':
    'Opnieuw laden niet mogelijk: het bestand staat in de prullenbak van Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Opnieuw laden niet mogelijk: het bestand in Google Drive is groter dan {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Opnieuw laden niet mogelijk: het bestand in Google Drive is geen ERD Editor-document meer',
  'gdrive.notice.signOutUnconfirmed':
    'Hier uitgelogd. De server van ERD Editor heeft het niet bevestigd, dus deze browser rondt het uitloggen af bij de volgende verbinding',
  'gdrive.notice.signOutNotRevoked':
    'Hier uitgelogd, maar Google heeft niet bevestigd dat de toegang van ERD Editor is ingetrokken, dus je andere apparaten blijven mogelijk ingelogd tot je die intrekt op myaccount.google.com/permissions',
} satisfies Messages;
