import type { Messages } from '@/i18n/translate';

/** The app's own text in Polish, key for key as English writes it. */
export const plPL = {
  'common.cancel': 'Anuluj',
  'common.close': 'Zamknij',
  'common.dismiss': 'Zamknij',
  'common.tryAgain': 'Spróbuj ponownie',
  'common.reload': 'Załaduj ponownie',
  'common.loading': 'Ładowanie…',
  'common.search': 'Szukaj',
  'common.rename': 'Zmień nazwę',
  'common.importFiles': 'Importuj pliki',
  'common.signOut': 'Wyloguj się',
  'common.downloadMyChanges': 'Pobierz moje zmiany',
  'common.edited': 'Edytowano {time}',
  'common.system': 'Systemowy',
  'common.displayLanguage': 'Język wyświetlania',
  'common.theme': 'Motyw',
  'common.light': 'Jasny',
  'common.dark': 'Ciemny',
  'common.host': 'Gospodarz',
  'common.guest': 'Gość',
  'common.you': '(ty)',
  'common.participants': 'Uczestnicy',
  'common.yourNickname': 'Twój pseudonim',
  'common.privacy': 'Prywatność',
  'common.terms': 'Warunki',
  'common.editingGuide': 'Przewodnik po edycji',
  'common.openSidebar': 'Otwórz pasek boczny',
  'common.closeSidebar': 'Zamknij pasek boczny',

  'time.justNow': 'przed chwilą',
  'time.today': 'Dzisiaj',
  'time.yesterday': 'Wczoraj',
  'time.previous7Days': 'Ostatnie 7 dni',
  'time.previous30Days': 'Ostatnie 30 dni',

  'sidebar.schemas': 'Schematy',
  'sidebar.newSchema': 'Nowy schemat',
  'sidebar.importAndExport': 'Import i eksport',
  'sidebar.exportBackup': 'Eksportuj kopię zapasową',
  'sidebar.searchSchemas': 'Szukaj schematów',
  'sidebar.newSchemaName': 'Nazwa nowego schematu',
  'sidebar.schemaName': 'Nazwa schematu',
  'sidebar.schemaNamePlaceholder': 'nazwa schematu',
  'sidebar.duplicate': 'Duplikuj',
  'sidebar.moveToTrash': 'Przenieś do kosza',
  'sidebar.actionsFor': 'Działania dla {name}',
  'sidebar.noResults': 'Brak wyników',

  'trash.button': 'Kosz ({count})',
  'trash.title': 'Kosz',
  'trash.description': {
    one: 'Schematy w koszu są trwale usuwane po {count} dniu.',
    few: 'Schematy w koszu są trwale usuwane po {count} dniach.',
    many: 'Schematy w koszu są trwale usuwane po {count} dniach.',
    other: 'Schematy w koszu są trwale usuwane po {count} dnia.',
  },
  'trash.listLabel': 'Schematy w koszu',
  'trash.deleted': 'Usunięto {time}',
  'trash.deletesToday': 'usunięcie dzisiaj',
  'trash.deletesTomorrow': 'usunięcie jutro',
  'trash.deletesIn': {
    one: 'usunięcie za {count} dzień',
    few: 'usunięcie za {count} dni',
    many: 'usunięcie za {count} dni',
    other: 'usunięcie za {count} dnia',
  },
  'trash.restore': 'Przywróć',
  'trash.deletePermanently': 'Usuń trwale',
  'trash.cannotBeUndone': 'Tej operacji nie można cofnąć.',
  'trash.delete': 'Usuń',
  'trash.empty': 'Kosz jest pusty.',
  'trash.emptyTrash': 'Opróżnij kosz',
  'trash.emptyConfirm': {
    one: 'Trwale usunąć {count} schemat? Tej operacji nie można cofnąć.',
    few: 'Trwale usunąć {count} schematy? Tej operacji nie można cofnąć.',
    many: 'Trwale usunąć {count} schematów? Tej operacji nie można cofnąć.',
    other: 'Trwale usunąć {count} schematu? Tej operacji nie można cofnąć.',
  },

  'collaboration.for': 'Współpraca: {name}',
  'collaboration.guestsConnected': {
    one: 'Połączono {count} gościa',
    few: 'Połączono {count} gości',
    many: 'Połączono {count} gości',
    other: 'Połączono {count} gościa',
  },
  'collaboration.title': 'Wspólna edycja',
  'collaboration.experiment': 'Eksperymentalne',
  'collaboration.description':
    'Uczestnicy łączą się bezpośrednio przez WebRTC i wymieniają wiadomości z szyfrowaniem end-to-end.',
  'collaboration.nickname': 'Pseudonim',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Nikt inny jeszcze nie dołączył.',
  'collaboration.startSession': 'Rozpocznij sesję',
  'collaboration.stopSession': 'Zakończ sesję',

  'viewer.noSchemaOpen': 'Brak otwartego schematu',
  'viewer.emptyHint':
    'Wybierz schemat z paska bocznego lub utwórz nowy tutaj. Możesz też upuścić pliki w dowolnym miejscu, aby je zaimportować.',
  'viewer.openSample': 'Otwórz przykład',
  'viewer.sampleName': 'przykładowa księgarnia',

  'drop.title': 'Upuść, aby zaimportować',
  'drop.formats':
    'Kopie zapasowe, dokumenty .erd, .vuerd i .json, SQL, DBML, AML i GraphQL',
  'drop.importing': 'Importowanie plików…',
  'drop.importingHint': 'Upuść kolejne pliki po zakończeniu tego importu',

  'import.imported': {
    one: 'Zaimportowano {count} schemat',
    few: 'Zaimportowano {count} schematy',
    many: 'Zaimportowano {count} schematów',
    other: 'Zaimportowano {count} schematu',
  },
  'import.skippedInvalidFiles': {
    one: 'Pominięto {count} nieprawidłowy plik',
    few: 'Pominięto {count} nieprawidłowe pliki',
    many: 'Pominięto {count} nieprawidłowych plików',
    other: 'Pominięto {count} nieprawidłowego pliku',
  },
  'import.skippedInvalidSchemas': {
    one: 'Pominięto {count} nieprawidłowy schemat',
    few: 'Pominięto {count} nieprawidłowe schematy',
    many: 'Pominięto {count} nieprawidłowych schematów',
    other: 'Pominięto {count} nieprawidłowego schematu',
  },
  'import.skippedOversized': {
    one: 'Pominięto {count} plik większy niż {size} MB',
    few: 'Pominięto {count} pliki większe niż {size} MB',
    many: 'Pominięto {count} plików większych niż {size} MB',
    other: 'Pominięto {count} pliku większego niż {size} MB',
  },
  'import.nothing': 'Nie ma nic do zaimportowania',
  'import.failed': 'Import nie powiódł się',
  'import.exportFailed': 'Eksport nie powiódł się',

  'update.available': 'Dostępna jest nowa wersja ERD Editor.',
  'update.updatedElsewhere':
    'Aplikacja została zaktualizowana w innej karcie — załaduj ponownie, aby zakończyć.',

  'live.invalidToken': 'Nieprawidłowy link udostępniania.',
  'live.hostNotFound': 'Nie znaleziono gospodarza.',
  'live.refresh': 'Odśwież',
  'live.hostStopped': 'Gospodarz zakończył sesję.',
  'live.somethingWentWrong': 'Coś poszło nie tak.',
  'live.lookingForHost': 'Szukanie gospodarza...',
  'live.waitingForHost': 'Oczekiwanie na gospodarza...',
  'live.session': 'Sesja na żywo',
  'live.inSession': {
    one: '{count} osoba w sesji',
    few: '{count} osoby w sesji',
    many: '{count} osób w sesji',
    other: '{count} osoby w sesji',
  },
  'live.showParticipants': 'Pokaż uczestników',
  'live.hideParticipants': 'Ukryj uczestników',

  'gdrive.checkingSignIn': 'Sprawdzanie logowania Google…',
  'gdrive.anotherAccount': 'inne konto',
  'gdrive.offline.title': 'Jesteś offline',
  'gdrive.offline.description':
    'ERD Editor sprawdzi logowanie Google, gdy znów będziesz online.',
  'gdrive.scopeMissing.title': 'Nie przyznano dostępu do Dysku Google',
  'gdrive.scopeMissing.description':
    'ERD Editor potrzebuje dostępu do plików, które w nim tworzysz lub otwierasz. Zaloguj się ponownie i zezwól na dostęp do Dysku Google.',
  'gdrive.mismatch.title': 'Dysk Google wysłał to dla innego konta',
  'gdrive.mismatch.description':
    'Zalogowano jako {email}. Przełącz się na konto, na którym Dysk Google to otworzył, albo kontynuuj z plikami bieżącego konta.',
  'gdrive.mismatch.choose':
    'ERD Editor nie mógł wstępnie wybrać konta, którego użył Dysk Google, więc wybierz je, gdy Google o to poprosi.',
  'gdrive.mismatch.switchAccount': 'Przełącz konto',
  'gdrive.mismatch.showMyFiles': 'Pokaż moje pliki',
  'gdrive.accountChanged.title': 'Zalogowano na inne konto',
  'gdrive.accountChanged.description':
    'Inna karta zalogowała się na inne konto Google, więc ta karta została zatrzymana. Załaduj ją ponownie, aby kontynuować z tym kontem.',
  'gdrive.unsaved.title': 'Twoje zmiany nie zostały zapisane',
  'gdrive.unsaved.description':
    '{name} zawiera zmiany z konta {email}, których nie ma na Dysku Google, a teraz zalogowano się jako {account}. Pobierz je, zanim przejdziesz dalej.',
  'gdrive.unsaved.descriptionUnnamed':
    'Plik, który był otwarty, zawiera zmiany z konta {email}, których nie ma na Dysku Google, a teraz zalogowano się jako {account}. Pobierz je, zanim przejdziesz dalej.',
  'gdrive.unsaved.continueWithout': 'Kontynuuj bez nich',
  'gdrive.framed.title':
    'Otwórz edytor Dysku Google w ERD Editor w osobnej karcie',
  'gdrive.framed.description': 'Nie działa wewnątrz innej strony.',
  'gdrive.framed.link': 'Otwórz w nowej karcie',
  'gdrive.notConfigured.title':
    'Integracja z Dyskiem Google nie jest skonfigurowana',
  'gdrive.notConfigured.description':
    'Ta kompilacja ERD Editor nie ma klienta logowania Google.',
  'gdrive.unsupportedOrigin.title': 'Dysk Google nie jest tu dostępny',
  'gdrive.unsupportedOrigin.description':
    'Logowanie Google działa tylko na erd-editor.io, a to jest wersja podglądowa.',

  'gdrive.signIn.title': 'Otwieraj pliki ERD na Dysku Google',
  'gdrive.signIn.description':
    'ERD Editor otwiera i zapisuje tylko pliki, które w nim tworzysz lub otwierasz.',
  'gdrive.signIn.fallbackDescription':
    'Serwer logowania ERD Editor jest zajęty, więc Google loguje cię za każdym razem na godzinę.',
  'gdrive.signIn.signIn': 'Zaloguj się przez Google',
  'gdrive.signIn.continue': 'Kontynuuj przez Google',
  'gdrive.signIn.waitingTitle': 'Oczekiwanie na logowanie Google…',
  'gdrive.signIn.waitingDescription':
    'Dokończ logowanie w oknie otwartym przez Google.',
  'gdrive.signIn.popupBlocked':
    'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna dla tej witryny i spróbuj ponownie.',
  'gdrive.signIn.failed':
    'Logowanie Google nie zostało dokończone. Spróbuj ponownie.',
  'gdrive.signIn.gisBlocked':
    'Nie udało się załadować logowania Google. Sprawdź, czy nic nie blokuje accounts.google.com, a następnie załaduj stronę ponownie.',

  'gdrive.sidebar.label': 'Pliki na Dysku',
  'gdrive.sidebar.newFile': 'Nowy plik',
  'gdrive.sidebar.import': 'Importuj',
  'gdrive.sidebar.searchFiles': 'Szukaj plików',
  'gdrive.sidebar.newFileName': 'Nazwa nowego pliku',
  'gdrive.sidebar.fileName': 'Nazwa pliku',
  'gdrive.sidebar.fileNamePlaceholder': 'nazwa pliku',
  'gdrive.sidebar.loadingFiles': 'Ładowanie plików…',
  'gdrive.sidebar.loadFailed': 'Nie udało się załadować plików.',

  'gdrive.viewer.noFileOpen': 'Brak otwartego pliku',
  'gdrive.viewer.noFileOpenHint':
    'Wybierz plik z paska bocznego lub utwórz nowy.',
  'gdrive.viewer.noFilesYet': 'Nie ma jeszcze plików',
  'gdrive.viewer.noFilesYetHint':
    'Utwórz lub zaimportuj plik. Pliki otwierane w ERD Editor z Dysku Google też pojawiają się tutaj.',
  'gdrive.viewer.waitingForOpener':
    'Oczekiwanie na kartę, która otworzyła ten plik…',
  'gdrive.viewer.notDocument': 'Ten plik nie jest dokumentem ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor otwiera diagramy, które sam zapisał. Ten plik pozostaje bez zmian i nigdy nie zostanie nadpisany.',
  'gdrive.viewer.googleNativeHint':
    'Dokumenty, Arkusze i foldery Google otwierają się na Dysku Google.',
  'gdrive.viewer.trashed': 'Ten plik jest w koszu',
  'gdrive.viewer.trashedHint':
    'Przywróć go na Dysku Google, aby otworzyć go tutaj.',
  'gdrive.viewer.tooLarge': 'Ten plik jest za duży',
  'gdrive.viewer.tooLargeHint': 'ERD Editor otwiera pliki do {size} MB.',
  'gdrive.viewer.notFound': 'Ten plik jest niedostępny',
  'gdrive.viewer.notFoundHint':
    'Mógł zostać usunięty albo to konto Google nie może go otworzyć.',
  'gdrive.viewer.waitingToken': 'Oczekiwanie na Google',
  'gdrive.viewer.waitingTokenHint':
    'Ten plik otworzy się, gdy sesja Google zostanie przywrócona.',
  'gdrive.viewer.failed': 'Nie udało się otworzyć tego pliku',
  'gdrive.viewer.failedHint':
    'Dysk Google nie odpowiedział. Sprawdź połączenie i spróbuj ponownie.',
  'gdrive.viewer.savingBeforeLeave': 'Zapisywanie przed wyjściem…',

  'gdrive.status.saved': 'Zapisano na Dysku Google',
  'gdrive.status.saving': 'Zapisywanie…',
  'gdrive.status.failed': 'Nie udało się zapisać',
  'gdrive.status.conflict': 'Zmieniono na Dysku Google',
  'gdrive.status.unconfirmed': 'Nie udało się potwierdzić ostatniego zapisu',
  'gdrive.status.paused': 'Wstrzymano do ponownego połączenia z Google',
  'gdrive.status.deleted': 'Usunięto na Dysku Google',
  'gdrive.status.readonly': 'Tylko do odczytu',
  'gdrive.status.waitingLeader':
    'Oczekiwanie na kartę, która zapisuje ten plik',
  'gdrive.status.waitingSnapshot':
    'Oczekiwanie na kartę, która otworzyła ten plik',
  'gdrive.status.scopeMissing': 'Brak dostępu do Dysku Google',

  'gdrive.banner.conflict':
    'Ten plik zmienił się na Dysku Google, więc zapisywanie zostało zatrzymane. Twoje zmiany wciąż tu są.',
  'gdrive.banner.unconfirmed':
    'Nie udało się potwierdzić ostatniego zapisu, więc zapisywanie zostało zatrzymane. Twoje zmiany wciąż tu są.',
  'gdrive.banner.deleted':
    'Ten plik został usunięty lub przeniesiony do kosza na Dysku Google, więc zapisywanie zostało zatrzymane.',
  'gdrive.banner.readonly':
    'Nie możesz już edytować tego pliku na Dysku Google, więc zapisywanie zostało zatrzymane. Twoje zmiany wciąż tu są.',
  'gdrive.banner.checkDrive': 'Sprawdź Dysk',
  'gdrive.banner.reloadFromDrive': 'Załaduj ponownie z Dysku',
  'gdrive.banner.leaderNotResponding':
    'Karta, która zapisuje ten plik, nie odpowiada.',
  'gdrive.banner.openerNotResponding':
    'Karta, która otworzyła ten plik, nie odpowiada.',
  'gdrive.banner.takeOver': 'Przejmij zapisywanie',
  'gdrive.banner.openAndTakeOver': 'Otwórz z Dysku i przejmij',
  'gdrive.banner.popupBlocked':
    'Przeglądarka zablokowała okno Google. Zezwól na wyskakujące okna dla tej witryny, a następnie połącz ponownie.',
  'gdrive.banner.reconnectFailed':
    'Nie udało się ponownie połączyć z Google. Spróbuj ponownie.',
  'gdrive.banner.sessionEnded':
    'Sesja Google wygasła, więc zapisywanie jest wstrzymane.',
  'gdrive.banner.sessionEndsSoon': 'Sesja Google wkrótce wygaśnie.',
  'gdrive.banner.reconnect': 'Połącz ponownie z Google',

  'gdrive.leave.title': 'Ostatnie zmiany nie są zapisane',
  'gdrive.leave.description':
    'ERD Editor nie mógł ich zapisać na Dysku Google. Pobierz je, aby zachować kopię, albo wyjdź, a zostaną utracone.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor nie mógł ich zapisać na Dysku Google. Pobierz je, aby zachować kopię, albo wyloguj się, a zostaną utracone.',
  'gdrive.leave.stay': 'Zostań',
  'gdrive.leave.leaveAnyway': 'Wyjdź mimo to',
  'gdrive.leave.signOutAnyway': 'Wyloguj się mimo to',

  'gdrive.create.title': 'Nowy plik na Dysku Google',
  'gdrive.create.inAppFolder': 'W folderze ERD Editor',
  'gdrive.create.inFolderPending': 'W folderze…',
  'gdrive.create.inHiddenFolder': 'W folderze, którego ERD Editor nie widzi',
  'gdrive.create.inFolder': 'W folderze „{name}”',
  'gdrive.create.untitled': 'Bez tytułu',
  'gdrive.create.savedAs': 'Zostanie zapisany jako {name}',
  'gdrive.create.folderRefused':
    'ERD Editor nie może tworzyć plików w tym folderze. Utworzyć go w folderze ERD Editor?',
  'gdrive.create.failed': 'Nie udało się utworzyć pliku. Spróbuj ponownie.',
  'gdrive.create.createInAppFolder': 'Utwórz w folderze ERD Editor',
  'gdrive.create.create': 'Utwórz',

  'gdrive.import.imported': {
    one: 'Zaimportowano {count} plik na Dysk Google',
    few: 'Zaimportowano {count} pliki na Dysk Google',
    many: 'Zaimportowano {count} plików na Dysk Google',
    other: 'Zaimportowano {count} pliku na Dysk Google',
  },
  'gdrive.import.skippedBackups': {
    one: 'Pominięto {count} kopię zapasową: kopie zapasowe zostają w aplikacji lokalnej',
    few: 'Pominięto {count} kopie zapasowe: kopie zapasowe zostają w aplikacji lokalnej',
    many: 'Pominięto {count} kopii zapasowych: kopie zapasowe zostają w aplikacji lokalnej',
    other:
      'Pominięto {count} kopii zapasowej: kopie zapasowe zostają w aplikacji lokalnej',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Nie udało się przesłać {count} pliku',
    few: 'Nie udało się przesłać {count} plików',
    many: 'Nie udało się przesłać {count} plików',
    other: 'Nie udało się przesłać {count} pliku',
  },

  'gdrive.notice.unreadableState':
    'Dysk Google wysłał link, którego ERD Editor nie mógł odczytać',
  'gdrive.notice.renameFailed': 'Nie udało się zmienić nazwy pliku',
  'gdrive.notice.createFailed': 'Nie udało się utworzyć pliku',
  'gdrive.notice.checkFailed':
    'Nie udało się połączyć z Dyskiem Google. Spróbuj ponownie.',
  'gdrive.notice.reloadFailed':
    'Nie udało się załadować ponownie z Dysku Google. Spróbuj ponownie.',
  'gdrive.notice.reloadTrashed':
    'Nie można załadować ponownie: plik jest w koszu na Dysku Google',
  'gdrive.notice.reloadTooLarge':
    'Nie można załadować ponownie: plik na Dysku Google przekracza {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Nie można załadować ponownie: plik na Dysku Google nie jest już dokumentem ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Wylogowano tutaj. Serwer ERD Editor tego nie potwierdził, więc ta przeglądarka dokończy wylogowanie przy następnym połączeniu',
  'gdrive.notice.signOutNotRevoked':
    'Wylogowano tutaj, ale Google nie potwierdził usunięcia dostępu ERD Editor, więc inne urządzenia mogą pozostać zalogowane, dopóki nie usuniesz go na myaccount.google.com/permissions',
} satisfies Messages;
