import type { Messages } from '@/i18n/translate';

/** The app's own text in Slovenian, key for key as English writes it. */
export const slSI = {
  'common.cancel': 'Prekliči',
  'common.close': 'Zapri',
  'common.dismiss': 'Zapri',
  'common.tryAgain': 'Poskusi znova',
  'common.reload': 'Znova naloži',
  'common.loading': 'Nalaganje …',
  'common.search': 'Iskanje',
  'common.rename': 'Preimenuj',
  'common.importFiles': 'Uvozi datoteke',
  'common.signOut': 'Odjava',
  'common.downloadMyChanges': 'Prenesi moje spremembe',
  'common.edited': 'Urejeno {time}',
  'common.system': 'Sistemsko',
  'common.displayLanguage': 'Jezik prikaza',
  'common.theme': 'Tema',
  'common.light': 'Svetlo',
  'common.dark': 'Temno',
  'common.host': 'Gostitelj',
  'common.guest': 'Gost',
  'common.you': '(vi)',
  'common.participants': 'Udeleženci',
  'common.yourNickname': 'Vaš vzdevek',
  'common.privacy': 'Zasebnost',
  'common.terms': 'Pogoji',
  'common.editingGuide': 'Vodnik za urejanje',
  'common.openSidebar': 'Odpri stransko vrstico',
  'common.closeSidebar': 'Zapri stransko vrstico',

  'time.justNow': 'pravkar',
  'time.today': 'Danes',
  'time.yesterday': 'Včeraj',
  'time.previous7Days': 'Zadnjih 7 dni',
  'time.previous30Days': 'Zadnjih 30 dni',

  'sidebar.schemas': 'Sheme',
  'sidebar.newSchema': 'Nova shema',
  'sidebar.importAndExport': 'Uvoz in izvoz',
  'sidebar.exportBackup': 'Izvozi varnostno kopijo',
  'sidebar.searchSchemas': 'Iskanje shem',
  'sidebar.newSchemaName': 'Ime nove sheme',
  'sidebar.schemaName': 'Ime sheme',
  'sidebar.schemaNamePlaceholder': 'ime sheme',
  'sidebar.duplicate': 'Podvoji',
  'sidebar.moveToTrash': 'Premakni v koš',
  'sidebar.actionsFor': 'Dejanja za {name}',
  'sidebar.noResults': 'Ni rezultatov',

  'trash.button': 'Koš ({count})',
  'trash.title': 'Koš',
  'trash.description': {
    one: 'Sheme v košu so trajno izbrisane po {count} dnevu.',
    two: 'Sheme v košu so trajno izbrisane po {count} dneh.',
    few: 'Sheme v košu so trajno izbrisane po {count} dneh.',
    other: 'Sheme v košu so trajno izbrisane po {count} dneh.',
  },
  'trash.listLabel': 'Sheme v košu',
  'trash.deleted': 'Izbrisano {time}',
  'trash.deletesToday': 'izbris danes',
  'trash.deletesTomorrow': 'izbris jutri',
  'trash.deletesIn': {
    one: 'izbris čez {count} dan',
    two: 'izbris čez {count} dneva',
    few: 'izbris čez {count} dni',
    other: 'izbris čez {count} dni',
  },
  'trash.restore': 'Obnovi',
  'trash.deletePermanently': 'Trajno izbriši',
  'trash.cannotBeUndone': 'Tega ni mogoče razveljaviti.',
  'trash.delete': 'Izbriši',
  'trash.empty': 'Koš je prazen.',
  'trash.emptyTrash': 'Izprazni koš',
  'trash.emptyConfirm': {
    one: 'Trajno izbrišem {count} shemo? Tega ni mogoče razveljaviti.',
    two: 'Trajno izbrišem {count} shemi? Tega ni mogoče razveljaviti.',
    few: 'Trajno izbrišem {count} sheme? Tega ni mogoče razveljaviti.',
    other: 'Trajno izbrišem {count} shem? Tega ni mogoče razveljaviti.',
  },

  'collaboration.for': 'Sodelovanje za {name}',
  'collaboration.guestsConnected': {
    one: 'Povezan je {count} gost',
    two: 'Povezana sta {count} gosta',
    few: 'Povezani so {count} gostje',
    other: 'Povezanih je {count} gostov',
  },
  'collaboration.title': 'Skupno urejanje',
  'collaboration.experiment': 'Preizkusno',
  'collaboration.description':
    'Udeleženci se povežejo neposredno prek WebRTC in si izmenjujejo sporočila s šifriranjem od konca do konca.',
  'collaboration.nickname': 'Vzdevek',
  'collaboration.link': 'Povezava',
  'collaboration.noOneJoined': 'Nihče drug se še ni pridružil.',
  'collaboration.startSession': 'Začni sejo',
  'collaboration.stopSession': 'Ustavi sejo',

  'viewer.noSchemaOpen': 'Nobena shema ni odprta',
  'viewer.emptyHint':
    'Izberite shemo v stranski vrstici ali tukaj začnite novo. Datoteke lahko za uvoz spustite tudi kamor koli.',
  'viewer.openSample': 'Odpri primer',
  'viewer.sampleName': 'primer knjigarne',

  'drop.title': 'Spustite za uvoz',
  'drop.formats':
    'Varnostne kopije, dokumenti .erd, .vuerd in .json, SQL, DBML, AML in GraphQL',
  'drop.importing': 'Uvažanje datotek …',
  'drop.importingHint': 'Več jih spustite, ko se ta uvoz konča',

  'import.imported': {
    one: 'Uvožena je {count} shema',
    two: 'Uvoženi sta {count} shemi',
    few: 'Uvožene so {count} sheme',
    other: 'Uvoženih je {count} shem',
  },
  'import.skippedInvalidFiles': {
    one: 'Preskočena je {count} neveljavna datoteka',
    two: 'Preskočeni sta {count} neveljavni datoteki',
    few: 'Preskočene so {count} neveljavne datoteke',
    other: 'Preskočenih je {count} neveljavnih datotek',
  },
  'import.skippedInvalidSchemas': {
    one: 'Preskočena je {count} neveljavna shema',
    two: 'Preskočeni sta {count} neveljavni shemi',
    few: 'Preskočene so {count} neveljavne sheme',
    other: 'Preskočenih je {count} neveljavnih shem',
  },
  'import.skippedOversized': {
    one: 'Preskočena je {count} datoteka, večja od {size} MB',
    two: 'Preskočeni sta {count} datoteki, večji od {size} MB',
    few: 'Preskočene so {count} datoteke, večje od {size} MB',
    other: 'Preskočenih je {count} datotek, večjih od {size} MB',
  },
  'import.nothing': 'Ničesar ni za uvoz',
  'import.failed': 'Uvoz ni uspel',
  'import.exportFailed': 'Izvoz ni uspel',

  'update.available': 'Na voljo je nova različica programa ERD Editor.',
  'update.updatedElsewhere':
    'Aplikacija je bila posodobljena v drugem zavihku – znova naložite za dokončanje.',

  'embed.title': 'Vdelaj diagram',
  'embed.documentUrl': 'URL dokumenta',
  'embed.fetchUrl': 'Naloži se iz',
  'embed.nameView': 'Prikaz imen',
  'embed.nameAsSaved': 'Kot je shranjeno',
  'embed.physicalNames': 'Fizična imena',
  'embed.logicalNames': 'Logična imena',
  'embed.bothNames': 'Obe imeni',
  'embed.accentColor': 'Barva poudarka',
  'embed.grayColor': 'Sivi toni',
  'embed.minimap': 'Mini zemljevid',
  'embed.controls': 'Kontrolniki',
  'embed.height': 'Višina',
  'embed.preview': 'Predogled',
  'embed.embedUrl': 'URL za vdelavo',
  'embed.embedCode': 'Koda za vdelavo',
  'embed.copy': 'Kopiraj',
  'embed.copied': 'Kopirano',

  'live.invalidToken': 'Neveljavna povezava za skupno rabo.',
  'live.hostNotFound': 'Gostitelja ni mogoče najti.',
  'live.refresh': 'Osveži',
  'live.hostStopped': 'Gostitelj je ustavil sejo.',
  'live.somethingWentWrong': 'Prišlo je do napake.',
  'live.lookingForHost': 'Iskanje gostitelja …',
  'live.waitingForHost': 'Čakanje na gostitelja …',
  'live.session': 'Seja v živo',
  'live.inSession': {
    one: '{count} v seji',
    two: '{count} v seji',
    few: '{count} v seji',
    other: '{count} v seji',
  },
  'live.showParticipants': 'Pokaži udeležence',
  'live.hideParticipants': 'Skrij udeležence',

  'gdrive.checkingSignIn': 'Preverjanje prijave v Google …',
  'gdrive.anotherAccount': 'drug račun',
  'gdrive.offline.title': 'Niste povezani',
  'gdrive.offline.description':
    'ERD Editor bo preveril vašo prijavo v Google, ko boste spet povezani.',
  'gdrive.scopeMissing.title': 'Dostop do storitve Google Drive ni bil odobren',
  'gdrive.scopeMissing.description':
    'ERD Editor potrebuje dostop do datotek, ki jih z njim ustvarite ali odprete. Znova se prijavite in dovolite dostop do storitve Google Drive.',
  'gdrive.mismatch.title': 'Google Drive je to poslal za drug račun',
  'gdrive.mismatch.description':
    'Prijavljeni ste kot {email}. Preklopite na račun, s katerim je Google Drive to odprl, ali nadaljujte z datotekami tega računa.',
  'gdrive.mismatch.choose':
    'ERD Editor tega računa ni mogel vnaprej izbrati, zato ga izberite, ko vas Google vpraša.',
  'gdrive.mismatch.switchAccount': 'Preklopi račun',
  'gdrive.mismatch.showMyFiles': 'Pokaži moje datoteke',
  'gdrive.accountChanged.title': 'Prijavljeni z drugim računom',
  'gdrive.accountChanged.description':
    'Drug zavihek se je prijavil v drug Google Račun, zato se je ta zavihek ustavil. Znova ga naložite, da nadaljujete s tem računom.',
  'gdrive.unsaved.title': 'Vaše spremembe niso bile shranjene',
  'gdrive.unsaved.description':
    '{name} vsebuje spremembe računa {email}, ki jih ni v storitvi Google Drive, zdaj pa je prijavljen {account}. Prenesite jih, preden nadaljujete.',
  'gdrive.unsaved.descriptionUnnamed':
    'Odprta datoteka vsebuje spremembe računa {email}, ki jih ni v storitvi Google Drive, zdaj pa je prijavljen {account}. Prenesite jih, preden nadaljujete.',
  'gdrive.unsaved.continueWithout': 'Nadaljuj brez njih',
  'gdrive.framed.title':
    'Urejevalnik Google Drive v programu ERD Editor odprite v ločenem zavihku',
  'gdrive.framed.description': 'Znotraj druge strani ne deluje.',
  'gdrive.framed.link': 'Odpri v novem zavihku',
  'gdrive.notConfigured.title': 'Integracija z Google Drive ni nastavljena',
  'gdrive.notConfigured.description':
    'Ta različica programa ERD Editor nima odjemalca za prijavo z Google.',
  'gdrive.unsupportedOrigin.title': 'Google Drive tukaj ni na voljo',
  'gdrive.unsupportedOrigin.description':
    'Prijava z Google deluje samo na erd-editor.io, to pa je predogled.',

  'gdrive.signIn.title': 'Odprite svoje datoteke ERD iz storitve Google Drive',
  'gdrive.signIn.description':
    'ERD Editor odpira in shranjuje samo datoteke, ki jih z njim ustvarite ali odprete.',
  'gdrive.signIn.fallbackDescription':
    'Prijavni strežnik programa ERD Editor je zaseden, zato vas Google vsakič prijavi za eno uro.',
  'gdrive.signIn.signIn': 'Prijava z Google',
  'gdrive.signIn.continue': 'Nadaljuj z Google',
  'gdrive.signIn.waitingTitle': 'Čakanje na prijavo v Google …',
  'gdrive.signIn.waitingDescription':
    'Dokončajte prijavo v oknu, ki ga je odprl Google.',
  'gdrive.signIn.popupBlocked':
    'Brskalnik je blokiral okno za prijavo. Dovolite pojavna okna za to spletno mesto in poskusite znova.',
  'gdrive.signIn.failed':
    'Prijava v Google ni bila dokončana. Poskusite znova.',
  'gdrive.signIn.gisBlocked':
    'Prijave z Google ni bilo mogoče naložiti. Preverite, da nič ne blokira accounts.google.com, nato znova naložite stran.',

  'gdrive.sidebar.label': 'Datoteke v Drive',
  'gdrive.sidebar.newFile': 'Nova datoteka',
  'gdrive.sidebar.import': 'Uvoz',
  'gdrive.sidebar.searchFiles': 'Iskanje datotek',
  'gdrive.sidebar.newFileName': 'Ime nove datoteke',
  'gdrive.sidebar.fileName': 'Ime datoteke',
  'gdrive.sidebar.fileNamePlaceholder': 'ime datoteke',
  'gdrive.sidebar.loadingFiles': 'Nalaganje datotek …',
  'gdrive.sidebar.loadFailed': 'Vaših datotek ni bilo mogoče naložiti.',

  'gdrive.viewer.noFileOpen': 'Nobena datoteka ni odprta',
  'gdrive.viewer.noFileOpenHint':
    'Izberite datoteko v stranski vrstici ali začnite novo.',
  'gdrive.viewer.noFilesYet': 'Še ni datotek',
  'gdrive.viewer.noFilesYetHint':
    'Ustvarite datoteko ali jo uvozite. Tukaj so prikazane tudi datoteke, ki jih iz storitve Google Drive odprete s programom ERD Editor.',
  'gdrive.viewer.waitingForOpener':
    'Čakanje na zavihek, ki je odprl to datoteko …',
  'gdrive.viewer.notDocument': 'Ta datoteka ni dokument ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor odpira diagrame, ki jih je shranil sam. To datoteko pusti takšno, kot je, in je nikoli ne prepiše.',
  'gdrive.viewer.googleNativeHint':
    'Google Dokumenti, Preglednice in mape se odprejo v storitvi Google Drive.',
  'gdrive.viewer.trashed': 'Ta datoteka je v smetnjaku',
  'gdrive.viewer.trashedHint':
    'Obnovite jo v storitvi Google Drive, da jo odprete tukaj.',
  'gdrive.viewer.tooLarge': 'Ta datoteka je prevelika',
  'gdrive.viewer.tooLargeHint': 'ERD Editor odpira datoteke do {size} MB.',
  'gdrive.viewer.notFound': 'Ta datoteka ni na voljo',
  'gdrive.viewer.notFoundHint':
    'Morda je bila izbrisana ali pa je ta Google Račun ne more odpreti.',
  'gdrive.viewer.waitingToken': 'Čakanje na Google',
  'gdrive.viewer.waitingTokenHint':
    'Datoteka se bo odprla, ko bo vaša seja Google spet na voljo.',
  'gdrive.viewer.failed': 'Te datoteke ni bilo mogoče odpreti',
  'gdrive.viewer.failedHint':
    'Google Drive se ni odzval. Preverite povezavo in poskusite znova.',
  'gdrive.viewer.savingBeforeLeave': 'Shranjevanje pred odhodom …',

  'gdrive.status.saved': 'Shranjeno v Google Drive',
  'gdrive.status.saving': 'Shranjevanje …',
  'gdrive.status.failed': 'Shranjevanje ni uspelo',
  'gdrive.status.conflict': 'Spremenjeno v storitvi Google Drive',
  'gdrive.status.unconfirmed': 'Zadnjega shranjevanja ni bilo mogoče potrditi',
  'gdrive.status.paused':
    'Začasno ustavljeno, dokler se Google ne poveže znova',
  'gdrive.status.deleted': 'Izbrisano v storitvi Google Drive',
  'gdrive.status.readonly': 'Samo ogled',
  'gdrive.status.waitingLeader': 'Čakanje na zavihek, ki shranjuje to datoteko',
  'gdrive.status.waitingSnapshot':
    'Čakanje na zavihek, ki je odprl to datoteko',
  'gdrive.status.scopeMissing': 'Ni dostopa do storitve Google Drive',

  'gdrive.banner.conflict':
    'Ta datoteka se je spremenila v storitvi Google Drive, zato se je shranjevanje ustavilo. Vaše spremembe so še vedno tukaj.',
  'gdrive.banner.unconfirmed':
    'Zadnjega shranjevanja ni bilo mogoče potrditi, zato se je shranjevanje ustavilo. Vaše spremembe so še vedno tukaj.',
  'gdrive.banner.deleted':
    'Ta datoteka je bila v storitvi Google Drive izbrisana ali premaknjena v smetnjak, zato se je shranjevanje ustavilo.',
  'gdrive.banner.readonly':
    'Te datoteke v storitvi Google Drive ne morete več urejati, zato se je shranjevanje ustavilo. Vaše spremembe so še vedno tukaj.',
  'gdrive.banner.checkDrive': 'Preveri Drive',
  'gdrive.banner.reloadFromDrive': 'Znova naloži iz Drive',
  'gdrive.banner.leaderNotResponding':
    'Zavihek, ki shranjuje to datoteko, se ne odziva.',
  'gdrive.banner.openerNotResponding':
    'Zavihek, ki je odprl to datoteko, se ne odziva.',
  'gdrive.banner.takeOver': 'Prevzemi shranjevanje',
  'gdrive.banner.openAndTakeOver': 'Odpri iz Drive in prevzemi',
  'gdrive.banner.popupBlocked':
    'Brskalnik je blokiral okno Google. Dovolite pojavna okna za to spletno mesto in se znova povežite.',
  'gdrive.banner.reconnectFailed':
    'Google se ni znova povezal. Poskusite znova.',
  'gdrive.banner.sessionEnded':
    'Vaša seja Google se je končala, zato je shranjevanje začasno ustavljeno.',
  'gdrive.banner.sessionEndsSoon': 'Vaša seja Google se bo kmalu končala.',
  'gdrive.banner.reconnect': 'Znova poveži Google',

  'gdrive.leave.title': 'Vaše zadnje spremembe niso shranjene',
  'gdrive.leave.description':
    'ERD Editor jih ni mogel shraniti v Google Drive. Prenesite jih, da obdržite kopijo, ali pa odidite in jih izgubite.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor jih ni mogel shraniti v Google Drive. Prenesite jih, da obdržite kopijo, ali pa se odjavite in jih izgubite.',
  'gdrive.leave.stay': 'Ostani',
  'gdrive.leave.leaveAnyway': 'Vseeno odidi',
  'gdrive.leave.signOutAnyway': 'Vseeno se odjavi',

  'gdrive.create.title': 'Nova datoteka v Google Drive',
  'gdrive.create.inAppFolder': 'V mapi ERD Editor',
  'gdrive.create.inFolderPending': 'V mapi …',
  'gdrive.create.inHiddenFolder': 'V mapi, ki je ERD Editor ne vidi',
  'gdrive.create.inFolder': 'V mapi »{name}«',
  'gdrive.create.untitled': 'Brez naslova',
  'gdrive.create.savedAs': 'Shranjeno bo kot {name}',
  'gdrive.create.folderRefused':
    'ERD Editor v tej mapi ne more ustvarjati datotek. Jo želite ustvariti v mapi ERD Editor?',
  'gdrive.create.failed': 'Datoteke ni bilo mogoče ustvariti. Poskusite znova.',
  'gdrive.create.createInAppFolder': 'Ustvari v mapi ERD Editor',
  'gdrive.create.create': 'Ustvari',

  'gdrive.import.imported': {
    one: 'V Google Drive je uvožena {count} datoteka',
    two: 'V Google Drive sta uvoženi {count} datoteki',
    few: 'V Google Drive so uvožene {count} datoteke',
    other: 'V Google Drive je uvoženih {count} datotek',
  },
  'gdrive.import.skippedBackups': {
    one: 'Preskočena je {count} varnostna kopija: varnostne kopije ostanejo v lokalni aplikaciji',
    two: 'Preskočeni sta {count} varnostni kopiji: varnostne kopije ostanejo v lokalni aplikaciji',
    few: 'Preskočene so {count} varnostne kopije: varnostne kopije ostanejo v lokalni aplikaciji',
    other:
      'Preskočenih je {count} varnostnih kopij: varnostne kopije ostanejo v lokalni aplikaciji',
  },
  'gdrive.import.uploadsFailed': {
    one: '{count} nalaganje ni uspelo',
    two: '{count} nalaganji nista uspeli',
    few: '{count} nalaganja niso uspela',
    other: '{count} nalaganj ni uspelo',
  },

  'gdrive.notice.unreadableState':
    'Google Drive je poslal povezavo, ki je ERD Editor ni mogel prebrati',
  'gdrive.notice.renameFailed': 'Datoteke ni bilo mogoče preimenovati',
  'gdrive.notice.createFailed': 'Datoteke ni bilo mogoče ustvariti',
  'gdrive.notice.checkFailed':
    'Povezava z Google Drive ni uspela. Poskusite znova.',
  'gdrive.notice.reloadFailed':
    'Vnovično nalaganje iz Google Drive ni uspelo. Poskusite znova.',
  'gdrive.notice.reloadTrashed':
    'Vnovično nalaganje ni mogoče: datoteka je v smetnjaku storitve Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Vnovično nalaganje ni mogoče: datoteka v Google Drive je večja od {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Vnovično nalaganje ni mogoče: datoteka v Google Drive ni več dokument ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Tukaj ste odjavljeni. Strežnik programa ERD Editor tega ni potrdil, zato bo ta brskalnik odjavo dokončal ob naslednji povezavi',
  'gdrive.notice.signOutNotRevoked':
    'Tukaj ste odjavljeni, vendar Google ni potrdil odstranitve dostopa programa ERD Editor, zato lahko vaše druge naprave ostanejo prijavljene, dokler ga ne odstranite na myaccount.google.com/permissions',
} satisfies Messages;
