import type { Messages } from '@/i18n/translate';

/** The app's own text in Slovak, key for key as English writes it. */
export const skSK = {
  'common.cancel': 'Zrušiť',
  'common.close': 'Zavrieť',
  'common.dismiss': 'Zavrieť',
  'common.tryAgain': 'Skúsiť znova',
  'common.reload': 'Znova načítať',
  'common.loading': 'Načítava sa…',
  'common.search': 'Hľadať',
  'common.rename': 'Premenovať',
  'common.importFiles': 'Importovať súbory',
  'common.signOut': 'Odhlásiť sa',
  'common.downloadMyChanges': 'Stiahnuť moje zmeny',
  'common.edited': 'Upravené {time}',
  'common.system': 'Systémový',
  'common.displayLanguage': 'Jazyk zobrazenia',
  'common.theme': 'Motív',
  'common.light': 'Svetlý',
  'common.dark': 'Tmavý',
  'common.host': 'Hostiteľ',
  'common.guest': 'Hosť',
  'common.you': '(vy)',
  'common.participants': 'Účastníci',
  'common.yourNickname': 'Vaša prezývka',
  'common.privacy': 'Ochrana súkromia',
  'common.terms': 'Podmienky',
  'common.editingGuide': 'Príručka úprav',
  'common.openSidebar': 'Otvoriť bočný panel',
  'common.closeSidebar': 'Zavrieť bočný panel',

  'time.justNow': 'práve teraz',
  'time.today': 'Dnes',
  'time.yesterday': 'Včera',
  'time.previous7Days': 'Posledných 7 dní',
  'time.previous30Days': 'Posledných 30 dní',

  'sidebar.schemas': 'Schémy',
  'sidebar.newSchema': 'Nová schéma',
  'sidebar.importAndExport': 'Import a export',
  'sidebar.exportBackup': 'Exportovať zálohu',
  'sidebar.searchSchemas': 'Hľadať schémy',
  'sidebar.newSchemaName': 'Názov novej schémy',
  'sidebar.schemaName': 'Názov schémy',
  'sidebar.schemaNamePlaceholder': 'názov schémy',
  'sidebar.duplicate': 'Duplikovať',
  'sidebar.moveToTrash': 'Presunúť do koša',
  'sidebar.actionsFor': 'Akcie pre {name}',
  'sidebar.noResults': 'Žiadne výsledky',

  'trash.button': 'Kôš ({count})',
  'trash.title': 'Kôš',
  'trash.description': {
    one: 'Schémy v koši sa natrvalo odstránia po {count} dni.',
    few: 'Schémy v koši sa natrvalo odstránia po {count} dňoch.',
    many: 'Schémy v koši sa natrvalo odstránia po {count} dňa.',
    other: 'Schémy v koši sa natrvalo odstránia po {count} dňoch.',
  },
  'trash.listLabel': 'Schémy v koši',
  'trash.deleted': 'Odstránené {time}',
  'trash.deletesToday': 'odstráni sa dnes',
  'trash.deletesTomorrow': 'odstráni sa zajtra',
  'trash.deletesIn': {
    one: 'odstráni sa o {count} deň',
    few: 'odstráni sa o {count} dni',
    many: 'odstráni sa o {count} dňa',
    other: 'odstráni sa o {count} dní',
  },
  'trash.restore': 'Obnoviť',
  'trash.deletePermanently': 'Odstrániť natrvalo',
  'trash.cannotBeUndone': 'Túto akciu nie je možné vrátiť späť.',
  'trash.delete': 'Odstrániť',
  'trash.empty': 'Kôš je prázdny.',
  'trash.emptyTrash': 'Vyprázdniť kôš',
  'trash.emptyConfirm': {
    one: 'Natrvalo odstrániť {count} schému? Túto akciu nie je možné vrátiť späť.',
    few: 'Natrvalo odstrániť {count} schémy? Túto akciu nie je možné vrátiť späť.',
    many: 'Natrvalo odstrániť {count} schémy? Túto akciu nie je možné vrátiť späť.',
    other:
      'Natrvalo odstrániť {count} schém? Túto akciu nie je možné vrátiť späť.',
  },

  'collaboration.for': 'Spolupráca na {name}',
  'collaboration.guestsConnected': {
    one: 'Pripojený {count} hosť',
    few: 'Pripojení {count} hostia',
    many: 'Pripojené {count} hosťa',
    other: 'Pripojených {count} hostí',
  },
  'collaboration.title': 'Spoločné úpravy',
  'collaboration.experiment': 'Experimentálne',
  'collaboration.description':
    'Účastníci sa pripájajú priamo cez WebRTC a vymieňajú si správy s koncovým šifrovaním.',
  'collaboration.nickname': 'Prezývka',
  'collaboration.link': 'Odkaz',
  'collaboration.noOneJoined': 'Zatiaľ sa nikto ďalší nepripojil.',
  'collaboration.startSession': 'Spustiť reláciu',
  'collaboration.stopSession': 'Ukončiť reláciu',

  'viewer.noSchemaOpen': 'Nie je otvorená žiadna schéma',
  'viewer.emptyHint':
    'Vyberte jednu na bočnom paneli alebo tu začnite novú. Súbory môžete tiež pustiť kdekoľvek a importovať ich.',
  'viewer.openSample': 'Otvoriť ukážku',
  'viewer.sampleName': 'ukážka kníhkupectva',

  'drop.title': 'Pustením importujete',
  'drop.formats':
    'Zálohy, dokumenty .erd, .vuerd a .json, SQL, DBML, AML a GraphQL',
  'drop.importing': 'Importujú sa súbory…',
  'drop.importingHint': 'Ďalšie pustite po dokončení tohto importu',

  'import.imported': {
    one: 'Importovaná {count} schéma',
    few: 'Importované {count} schémy',
    many: 'Importované {count} schémy',
    other: 'Importovaných {count} schém',
  },
  'import.skippedInvalidFiles': {
    one: 'Preskočený {count} neplatný súbor',
    few: 'Preskočené {count} neplatné súbory',
    many: 'Preskočené {count} neplatného súboru',
    other: 'Preskočených {count} neplatných súborov',
  },
  'import.skippedInvalidSchemas': {
    one: 'Preskočená {count} neplatná schéma',
    few: 'Preskočené {count} neplatné schémy',
    many: 'Preskočené {count} neplatnej schémy',
    other: 'Preskočených {count} neplatných schém',
  },
  'import.skippedOversized': {
    one: 'Preskočený {count} súbor väčší ako {size} MB',
    few: 'Preskočené {count} súbory väčšie ako {size} MB',
    many: 'Preskočené {count} súboru väčšieho ako {size} MB',
    other: 'Preskočených {count} súborov väčších ako {size} MB',
  },
  'import.nothing': 'Nič na import',
  'import.failed': 'Import zlyhal',
  'import.exportFailed': 'Export zlyhal',

  'update.available': 'K dispozícii je nová verzia ERD Editor.',
  'update.updatedElsewhere':
    'Aplikácia sa aktualizovala na inej karte — dokončíte ju opätovným načítaním.',

  'live.invalidToken': 'Neplatný token zdieľania.',
  'live.hostNotFound': 'Hostiteľ sa nenašiel.',
  'live.refresh': 'Obnoviť',
  'live.hostStopped': 'Hostiteľ ukončil reláciu.',
  'live.somethingWentWrong': 'Niečo sa pokazilo.',
  'live.lookingForHost': 'Hľadá sa hostiteľ...',
  'live.waitingForHost': 'Čaká sa na hostiteľa...',
  'live.session': 'Živá relácia',
  'live.inSession': {
    one: '{count} v relácii',
    few: '{count} v relácii',
    many: '{count} v relácii',
    other: '{count} v relácii',
  },
  'live.showParticipants': 'Zobraziť účastníkov',
  'live.hideParticipants': 'Skryť účastníkov',

  'gdrive.checkingSignIn': 'Kontroluje sa prihlásenie do Google…',
  'gdrive.anotherAccount': 'iný účet',
  'gdrive.offline.title': 'Ste offline',
  'gdrive.offline.description':
    'ERD Editor skontroluje vaše prihlásenie do Google, keď budete znova online.',
  'gdrive.scopeMissing.title': 'Prístup k Disku Google nebol udelený',
  'gdrive.scopeMissing.description':
    'ERD Editor potrebuje prístup k súborom, ktoré v ňom vytvoríte alebo otvoríte. Znova sa prihláste a povoľte prístup k Disku Google.',
  'gdrive.mismatch.title': 'Disk Google to poslal pre iný účet',
  'gdrive.mismatch.description':
    'Ste prihlásení ako {email}. Prepnite na účet, ktorým ho Disk Google otvoril, alebo pokračujte so súbormi tohto účtu.',
  'gdrive.mismatch.choose':
    'ERD Editor nemohol tento účet vopred vybrať, preto ho vyberte, keď sa Google opýta.',
  'gdrive.mismatch.switchAccount': 'Prepnúť účet',
  'gdrive.mismatch.showMyFiles': 'Zobraziť moje súbory',
  'gdrive.accountChanged.title': 'Prihlásené iným účtom',
  'gdrive.accountChanged.description':
    'Iná karta sa prihlásila do iného účtu Google, preto sa táto karta zastavila. Načítajte ju znova a pokračujte s týmto účtom.',
  'gdrive.unsaved.title': 'Vaše zmeny sa neuložili',
  'gdrive.unsaved.description':
    '{name} obsahuje zmeny od {email}, ktoré nie sú na Disku Google, a teraz je prihlásený {account}. Stiahnite si ich skôr, než budete pokračovať.',
  'gdrive.unsaved.descriptionUnnamed':
    'Otvorený súbor obsahuje zmeny od {email}, ktoré nie sú na Disku Google, a teraz je prihlásený {account}. Stiahnite si ich skôr, než budete pokračovať.',
  'gdrive.unsaved.continueWithout': 'Pokračovať bez nich',
  'gdrive.framed.title':
    'Otvorte editor Disku Google v ERD Editor na samostatnej karte',
  'gdrive.framed.description': 'Vo vnútri inej stránky nefunguje.',
  'gdrive.framed.link': 'Otvoriť na novej karte',
  'gdrive.notConfigured.title': 'Integrácia Disku Google nie je nastavená',
  'gdrive.notConfigured.description':
    'Táto zostava ERD Editor nemá klienta prihlásenia Google.',
  'gdrive.unsupportedOrigin.title': 'Disk Google tu nie je k dispozícii',
  'gdrive.unsupportedOrigin.description':
    'Prihlásenie Google funguje len na erd-editor.io a toto je ukážka.',

  'gdrive.signIn.title': 'Otvárajte súbory ERD na Disku Google',
  'gdrive.signIn.description':
    'ERD Editor otvára a ukladá len súbory, ktoré v ňom vytvoríte alebo otvoríte.',
  'gdrive.signIn.fallbackDescription':
    'Prihlasovací server ERD Editor je zaneprázdnený, preto vás Google prihlasuje vždy na hodinu.',
  'gdrive.signIn.signIn': 'Prihlásiť sa cez Google',
  'gdrive.signIn.continue': 'Pokračovať cez Google',
  'gdrive.signIn.waitingTitle': 'Čaká sa na prihlásenie do Google…',
  'gdrive.signIn.waitingDescription':
    'Dokončite prihlásenie v okne, ktoré otvoril Google.',
  'gdrive.signIn.popupBlocked':
    'Prehliadač zablokoval prihlasovacie okno. Povoľte pre tento web kontextové okná a skúste to znova.',
  'gdrive.signIn.failed':
    'Prihlásenie do Google sa nedokončilo. Skúste to znova.',
  'gdrive.signIn.gisBlocked':
    'Prihlásenie Google sa nepodarilo načítať. Skontrolujte, či nič neblokuje accounts.google.com, a znova načítajte stránku.',

  'gdrive.sidebar.label': 'Súbory na Disku',
  'gdrive.sidebar.newFile': 'Nový súbor',
  'gdrive.sidebar.import': 'Importovať',
  'gdrive.sidebar.searchFiles': 'Hľadať súbory',
  'gdrive.sidebar.newFileName': 'Názov nového súboru',
  'gdrive.sidebar.fileName': 'Názov súboru',
  'gdrive.sidebar.fileNamePlaceholder': 'názov súboru',
  'gdrive.sidebar.loadingFiles': 'Načítavajú sa súbory…',
  'gdrive.sidebar.loadFailed': 'Vaše súbory sa nepodarilo načítať.',

  'gdrive.viewer.noFileOpen': 'Nie je otvorený žiadny súbor',
  'gdrive.viewer.noFileOpenHint':
    'Vyberte súbor na bočnom paneli alebo začnite nový.',
  'gdrive.viewer.noFilesYet': 'Zatiaľ žiadne súbory',
  'gdrive.viewer.noFilesYetHint':
    'Vytvorte súbor alebo ho importujte. Zobrazia sa tu aj súbory, ktoré otvoríte v ERD Editor z Disku Google.',
  'gdrive.viewer.waitingForOpener':
    'Čaká sa na kartu, ktorá otvorila tento súbor…',
  'gdrive.viewer.notDocument': 'Tento súbor nie je dokument ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor otvára diagramy, ktoré sám uložil. Tento súbor ponechá bez zmeny a nikdy ho neprepíše.',
  'gdrive.viewer.googleNativeHint':
    'Dokumenty, Tabuľky a priečinky Google sa otvárajú na Disku Google.',
  'gdrive.viewer.trashed': 'Tento súbor je v koši',
  'gdrive.viewer.trashedHint':
    'Ak ho chcete otvoriť tu, obnovte ho na Disku Google.',
  'gdrive.viewer.tooLarge': 'Tento súbor je príliš veľký',
  'gdrive.viewer.tooLargeHint': 'ERD Editor otvára súbory do {size} MB.',
  'gdrive.viewer.notFound': 'Tento súbor nie je k dispozícii',
  'gdrive.viewer.notFoundHint':
    'Možno bol odstránený alebo ho tento účet Google nemôže otvoriť.',
  'gdrive.viewer.waitingToken': 'Čaká sa na Google',
  'gdrive.viewer.waitingTokenHint':
    'Tento súbor sa otvorí, keď sa vaša relácia Google obnoví.',
  'gdrive.viewer.failed': 'Tento súbor sa nepodarilo otvoriť',
  'gdrive.viewer.failedHint':
    'Disk Google neodpovedal. Skontrolujte pripojenie a skúste to znova.',
  'gdrive.viewer.savingBeforeLeave': 'Pred odchodom sa ukladá…',

  'gdrive.status.saved': 'Uložené na Disk Google',
  'gdrive.status.saving': 'Ukladá sa…',
  'gdrive.status.failed': 'Nepodarilo sa uložiť',
  'gdrive.status.conflict': 'Zmenené na Disku Google',
  'gdrive.status.unconfirmed': 'Posledné uloženie sa nepodarilo potvrdiť',
  'gdrive.status.paused': 'Pozastavené, kým sa Google znova nepripojí',
  'gdrive.status.deleted': 'Odstránené na Disku Google',
  'gdrive.status.readonly': 'Iba na čítanie',
  'gdrive.status.waitingLeader': 'Čaká sa na kartu, ktorá ukladá tento súbor',
  'gdrive.status.waitingSnapshot':
    'Čaká sa na kartu, ktorá otvorila tento súbor',
  'gdrive.status.scopeMissing': 'Žiadny prístup k Disku Google',

  'gdrive.banner.conflict':
    'Tento súbor sa na Disku Google zmenil, preto sa ukladanie zastavilo. Vaše zmeny sú stále tu.',
  'gdrive.banner.unconfirmed':
    'Posledné uloženie sa nepodarilo potvrdiť, preto sa ukladanie zastavilo. Vaše zmeny sú stále tu.',
  'gdrive.banner.deleted':
    'Tento súbor bol na Disku Google odstránený alebo presunutý do koša, preto sa ukladanie zastavilo.',
  'gdrive.banner.readonly':
    'Tento súbor už na Disku Google nemôžete upravovať, preto sa ukladanie zastavilo. Vaše zmeny sú stále tu.',
  'gdrive.banner.checkDrive': 'Skontrolovať Disk',
  'gdrive.banner.reloadFromDrive': 'Znova načítať z Disku',
  'gdrive.banner.leaderNotResponding':
    'Karta, ktorá ukladá tento súbor, nereaguje.',
  'gdrive.banner.openerNotResponding':
    'Karta, ktorá otvorila tento súbor, nereaguje.',
  'gdrive.banner.takeOver': 'Prevziať ukladanie',
  'gdrive.banner.openAndTakeOver': 'Otvoriť z Disku a prevziať',
  'gdrive.banner.popupBlocked':
    'Prehliadač zablokoval okno Google. Povoľte pre tento web kontextové okná a znova sa pripojte.',
  'gdrive.banner.reconnectFailed':
    'Google sa znova nepripojil. Skúste to znova.',
  'gdrive.banner.sessionEnded':
    'Vaša relácia Google skončila, preto je ukladanie pozastavené.',
  'gdrive.banner.sessionEndsSoon': 'Vaša relácia Google čoskoro skončí.',
  'gdrive.banner.reconnect': 'Znova pripojiť Google',

  'gdrive.leave.title': 'Vaše posledné zmeny nie sú uložené',
  'gdrive.leave.description':
    'ERD Editor ich nemohol uložiť na Disk Google. Stiahnite si ich a ponechajte si kópiu, alebo odíďte a prídete o ne.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor ich nemohol uložiť na Disk Google. Stiahnite si ich a ponechajte si kópiu, alebo sa odhláste a prídete o ne.',
  'gdrive.leave.stay': 'Zostať',
  'gdrive.leave.leaveAnyway': 'Aj tak odísť',
  'gdrive.leave.signOutAnyway': 'Aj tak sa odhlásiť',

  'gdrive.create.title': 'Nový súbor na Disku Google',
  'gdrive.create.inAppFolder': 'V priečinku ERD Editor',
  'gdrive.create.inFolderPending': 'V priečinku…',
  'gdrive.create.inHiddenFolder': 'V priečinku, ktorý ERD Editor nevidí',
  'gdrive.create.inFolder': 'V priečinku „{name}“',
  'gdrive.create.untitled': 'Bez názvu',
  'gdrive.create.savedAs': 'Uloží sa ako {name}',
  'gdrive.create.folderRefused':
    'ERD Editor nemôže v tomto priečinku vytvárať súbory. Vytvoriť ho v priečinku ERD Editor?',
  'gdrive.create.failed': 'Súbor sa nepodarilo vytvoriť. Skúste to znova.',
  'gdrive.create.createInAppFolder': 'Vytvoriť v priečinku ERD Editor',
  'gdrive.create.create': 'Vytvoriť',

  'gdrive.import.imported': {
    one: 'Na Disk Google bol importovaný {count} súbor',
    few: 'Na Disk Google boli importované {count} súbory',
    many: 'Na Disk Google bolo importovaného {count} súboru',
    other: 'Na Disk Google bolo importovaných {count} súborov',
  },
  'gdrive.import.skippedBackups': {
    one: 'Preskočená {count} záloha: zálohy zostávajú v lokálnej aplikácii',
    few: 'Preskočené {count} zálohy: zálohy zostávajú v lokálnej aplikácii',
    many: 'Preskočené {count} zálohy: zálohy zostávajú v lokálnej aplikácii',
    other: 'Preskočených {count} záloh: zálohy zostávajú v lokálnej aplikácii',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Zlyhalo {count} nahrávanie',
    few: 'Zlyhali {count} nahrávania',
    many: 'Zlyhalo {count} nahrávania',
    other: 'Zlyhalo {count} nahrávaní',
  },

  'gdrive.notice.unreadableState':
    'Disk Google poslal odkaz, ktorý ERD Editor nedokázal prečítať',
  'gdrive.notice.renameFailed': 'Súbor sa nepodarilo premenovať',
  'gdrive.notice.createFailed': 'Súbor sa nepodarilo vytvoriť',
  'gdrive.notice.checkFailed': 'Disk Google je nedostupný. Skúste to znova.',
  'gdrive.notice.reloadFailed':
    'Nepodarilo sa znova načítať z Disku Google. Skúste to znova.',
  'gdrive.notice.reloadTrashed':
    'Nedá sa znova načítať: súbor je v koši na Disku Google',
  'gdrive.notice.reloadTooLarge':
    'Nedá sa znova načítať: súbor na Disku Google má viac ako {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Nedá sa znova načítať: súbor na Disku Google už nie je dokument ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Tu ste odhlásení. Server ERD Editor to nepotvrdil, preto tento prehliadač dokončí odhlásenie pri ďalšom pripojení',
  'gdrive.notice.signOutNotRevoked':
    'Tu ste odhlásení, ale Google nepotvrdil odobratie prístupu ERD Editor, preto vaše ďalšie zariadenia môžu zostať prihlásené, kým ho neodoberiete na myaccount.google.com/permissions',
} satisfies Messages;
