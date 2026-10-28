import type { Messages } from '@/i18n/translate';

/** The app's own text in Ukrainian, key for key as English writes it. */
export const ukUA = {
  'common.cancel': 'Скасувати',
  'common.close': 'Закрити',
  'common.dismiss': 'Закрити',
  'common.tryAgain': 'Повторити',
  'common.reload': 'Перезавантажити',
  'common.loading': 'Завантаження…',
  'common.search': 'Пошук',
  'common.rename': 'Перейменувати',
  'common.importFiles': 'Імпортувати файли',
  'common.signOut': 'Вийти',
  'common.downloadMyChanges': 'Завантажити мої зміни',
  'common.edited': 'Змінено {time}',
  'common.system': 'Системна',
  'common.displayLanguage': 'Мова інтерфейсу',
  'common.theme': 'Тема',
  'common.light': 'Світла',
  'common.dark': 'Темна',
  'common.host': 'Організатор',
  'common.guest': 'Гість',
  'common.you': '(ви)',
  'common.participants': 'Учасники',
  'common.yourNickname': 'Ваш псевдонім',
  'common.privacy': 'Конфіденційність',
  'common.terms': 'Умови',
  'common.editingGuide': 'Посібник із редагування',
  'common.openSidebar': 'Відкрити бічну панель',
  'common.closeSidebar': 'Закрити бічну панель',

  'time.justNow': 'щойно',
  'time.today': 'Сьогодні',
  'time.yesterday': 'Учора',
  'time.previous7Days': 'Останні 7 днів',
  'time.previous30Days': 'Останні 30 днів',

  'sidebar.schemas': 'Схеми',
  'sidebar.newSchema': 'Нова схема',
  'sidebar.importAndExport': 'Імпорт і експорт',
  'sidebar.exportBackup': 'Експортувати резервну копію',
  'sidebar.searchSchemas': 'Пошук схем',
  'sidebar.newSchemaName': 'Назва нової схеми',
  'sidebar.schemaName': 'Назва схеми',
  'sidebar.schemaNamePlaceholder': 'назва схеми',
  'sidebar.duplicate': 'Дублювати',
  'sidebar.moveToTrash': 'Перемістити в кошик',
  'sidebar.actionsFor': 'Дії для {name}',
  'sidebar.noResults': 'Нічого не знайдено',

  'trash.button': 'Кошик ({count})',
  'trash.title': 'Кошик',
  'trash.description': {
    one: 'Схеми в кошику остаточно видаляються через {count} день.',
    few: 'Схеми в кошику остаточно видаляються через {count} дні.',
    many: 'Схеми в кошику остаточно видаляються через {count} днів.',
    other: 'Схеми в кошику остаточно видаляються через {count} дня.',
  },
  'trash.listLabel': 'Схеми в кошику',
  'trash.deleted': 'Видалено {time}',
  'trash.deletesToday': 'видалення сьогодні',
  'trash.deletesTomorrow': 'видалення завтра',
  'trash.deletesIn': {
    one: 'видалення через {count} день',
    few: 'видалення через {count} дні',
    many: 'видалення через {count} днів',
    other: 'видалення через {count} дня',
  },
  'trash.restore': 'Відновити',
  'trash.deletePermanently': 'Видалити остаточно',
  'trash.cannotBeUndone': 'Цю дію не можна скасувати.',
  'trash.delete': 'Видалити',
  'trash.empty': 'Кошик порожній.',
  'trash.emptyTrash': 'Очистити кошик',
  'trash.emptyConfirm': {
    one: 'Остаточно видалити {count} схему? Цю дію не можна скасувати.',
    few: 'Остаточно видалити {count} схеми? Цю дію не можна скасувати.',
    many: 'Остаточно видалити {count} схем? Цю дію не можна скасувати.',
    other: 'Остаточно видалити {count} схеми? Цю дію не можна скасувати.',
  },

  'collaboration.for': 'Спільна робота: {name}',
  'collaboration.guestsConnected': {
    one: 'Підключився {count} гість',
    few: 'Підключилися {count} гості',
    many: 'Підключено {count} гостей',
    other: 'Підключено {count} гостя',
  },
  'collaboration.title': 'Спільне редагування',
  'collaboration.experiment': 'Експеримент',
  'collaboration.description':
    'Учасники під’єднуються напряму через WebRTC і обмінюються повідомленнями з наскрізним шифруванням.',
  'collaboration.nickname': 'Псевдонім',
  'collaboration.link': 'Посилання',
  'collaboration.noOneJoined': 'Поки що ніхто більше не приєднався.',
  'collaboration.startSession': 'Почати сеанс',
  'collaboration.stopSession': 'Завершити сеанс',

  'viewer.noSchemaOpen': 'Немає відкритої схеми',
  'viewer.emptyHint':
    'Виберіть схему на бічній панелі або створіть нову тут. Файли для імпорту також можна перетягнути будь-куди.',
  'viewer.openSample': 'Відкрити приклад',
  'viewer.sampleName': 'приклад книгарні',

  'drop.title': 'Відпустіть, щоб імпортувати',
  'drop.formats':
    'Резервні копії, документи .erd, .vuerd і .json, SQL, DBML, AML і GraphQL',
  'drop.importing': 'Імпорт файлів…',
  'drop.importingHint': 'Перетягніть ще, коли цей імпорт завершиться',

  'import.imported': {
    one: 'Імпортовано {count} схему',
    few: 'Імпортовано {count} схеми',
    many: 'Імпортовано {count} схем',
    other: 'Імпортовано {count} схеми',
  },
  'import.skippedInvalidFiles': {
    one: 'Пропущено {count} недійсний файл',
    few: 'Пропущено {count} недійсні файли',
    many: 'Пропущено {count} недійсних файлів',
    other: 'Пропущено {count} недійсного файлу',
  },
  'import.skippedInvalidSchemas': {
    one: 'Пропущено {count} недійсну схему',
    few: 'Пропущено {count} недійсні схеми',
    many: 'Пропущено {count} недійсних схем',
    other: 'Пропущено {count} недійсної схеми',
  },
  'import.skippedOversized': {
    one: 'Пропущено {count} файл понад {size} MB',
    few: 'Пропущено {count} файли понад {size} MB',
    many: 'Пропущено {count} файлів понад {size} MB',
    other: 'Пропущено {count} файлу понад {size} MB',
  },
  'import.nothing': 'Нічого імпортувати',
  'import.failed': 'Не вдалося імпортувати',
  'import.exportFailed': 'Не вдалося експортувати',

  'update.available': 'Доступна нова версія ERD Editor.',
  'update.updatedElsewhere':
    'Застосунок оновлено в іншій вкладці — перезавантажте, щоб завершити.',

  'embed.title': 'Вбудувати діаграму',
  'embed.documentUrl': 'URL документа',
  'embed.fetchUrl': 'Завантажується з',
  'embed.nameView': 'Відображення назв',
  'embed.nameAsSaved': 'Як збережено',
  'embed.physicalNames': 'Фізичні назви',
  'embed.logicalNames': 'Логічні назви',
  'embed.bothNames': 'Обидві назви',
  'embed.accentColor': 'Колір акценту',
  'embed.grayColor': 'Відтінок сірого',
  'embed.minimap': 'Мінікарта',
  'embed.controls': 'Елементи керування',
  'embed.height': 'Висота',
  'embed.preview': 'Попередній перегляд',
  'embed.embedUrl': 'URL для вбудовування',
  'embed.embedCode': 'Код для вбудовування',
  'embed.copy': 'Копіювати',
  'embed.copied': 'Скопійовано',

  'live.invalidToken': 'Недійсне посилання для спільного доступу.',
  'live.hostNotFound': 'Організатора не знайдено.',
  'live.refresh': 'Оновити',
  'live.hostStopped': 'Організатор завершив сеанс.',
  'live.somethingWentWrong': 'Щось пішло не так.',
  'live.lookingForHost': 'Пошук організатора...',
  'live.waitingForHost': 'Очікування організатора...',
  'live.session': 'Сеанс спільного редагування',
  'live.inSession': {
    one: 'У сеансі {count} учасник',
    few: 'У сеансі {count} учасники',
    many: 'У сеансі {count} учасників',
    other: 'У сеансі {count} учасника',
  },
  'live.showParticipants': 'Показати учасників',
  'live.hideParticipants': 'Сховати учасників',

  'gdrive.checkingSignIn': 'Перевірка входу в Google…',
  'gdrive.anotherAccount': 'інший обліковий запис',
  'gdrive.offline.title': 'Немає з’єднання з мережею',
  'gdrive.offline.description':
    'ERD Editor перевірить вхід у Google, щойно з’єднання відновиться.',
  'gdrive.scopeMissing.title': 'Доступ до Google Диска не надано',
  'gdrive.scopeMissing.description':
    'ERD Editor потребує доступу до файлів, які ви в ньому створюєте або відкриваєте. Увійдіть знову й дозвольте доступ до Google Диска.',
  'gdrive.mismatch.title':
    'Google Диск надіслав це для іншого облікового запису',
  'gdrive.mismatch.description':
    'Ви ввійшли як {email}. Перейдіть до облікового запису, у якому Google Диск відкрив файл, або продовжуйте з файлами цього облікового запису.',
  'gdrive.mismatch.choose':
    'ERD Editor не зміг заздалегідь вибрати цей обліковий запис, тож виберіть його, коли Google запитає.',
  'gdrive.mismatch.switchAccount': 'Змінити обліковий запис',
  'gdrive.mismatch.showMyFiles': 'Показати мої файли',
  'gdrive.accountChanged.title': 'Виконано вхід в інший обліковий запис',
  'gdrive.accountChanged.description':
    'В іншій вкладці виконано вхід в інший обліковий запис Google, тому цю вкладку зупинено. Перезавантажте її, щоб продовжити з тим обліковим записом.',
  'gdrive.unsaved.title': 'Ваші зміни не збережено',
  'gdrive.unsaved.description':
    'У файлі «{name}» є зміни від {email}, яких немає на Google Диску, а зараз вхід виконано як {account}. Завантажте їх, перш ніж продовжити.',
  'gdrive.unsaved.descriptionUnnamed':
    'У відкритому файлі є зміни від {email}, яких немає на Google Диску, а зараз вхід виконано як {account}. Завантажте їх, перш ніж продовжити.',
  'gdrive.unsaved.continueWithout': 'Продовжити без них',
  'gdrive.framed.title':
    'Відкрийте ERD Editor для Google Диска в окремій вкладці',
  'gdrive.framed.description': 'Він не працює всередині іншої сторінки.',
  'gdrive.framed.link': 'Відкрити в новій вкладці',
  'gdrive.notConfigured.title': 'Інтеграцію з Google Диском не налаштовано',
  'gdrive.notConfigured.description':
    'У цій збірці ERD Editor немає клієнта входу через Google.',
  'gdrive.unsupportedOrigin.title': 'Google Диск тут недоступний',
  'gdrive.unsupportedOrigin.description':
    'Вхід через Google працює лише на erd-editor.io, а це версія для попереднього перегляду.',

  'gdrive.signIn.title': 'Відкривайте файли ERD на Google Диску',
  'gdrive.signIn.description':
    'ERD Editor відкриває та зберігає лише файли, які ви в ньому створюєте або відкриваєте.',
  'gdrive.signIn.fallbackDescription':
    'Сервер входу ERD Editor перевантажений, тому Google щоразу виконує вхід лише на одну годину.',
  'gdrive.signIn.signIn': 'Увійти через Google',
  'gdrive.signIn.continue': 'Продовжити з Google',
  'gdrive.signIn.waitingTitle': 'Очікування входу в Google…',
  'gdrive.signIn.waitingDescription':
    'Завершіть вхід у вікні, яке відкрив Google.',
  'gdrive.signIn.popupBlocked':
    'Браузер заблокував вікно входу. Дозвольте спливаючі вікна для цього сайту й повторіть спробу.',
  'gdrive.signIn.failed': 'Вхід у Google не завершено. Повторіть спробу.',
  'gdrive.signIn.gisBlocked':
    'Не вдалося завантажити вхід через Google. Переконайтеся, що ніщо не блокує accounts.google.com, і перезавантажте сторінку.',

  'gdrive.sidebar.label': 'Файли Диска',
  'gdrive.sidebar.newFile': 'Новий файл',
  'gdrive.sidebar.import': 'Імпорт',
  'gdrive.sidebar.searchFiles': 'Пошук файлів',
  'gdrive.sidebar.newFileName': 'Назва нового файлу',
  'gdrive.sidebar.fileName': 'Назва файлу',
  'gdrive.sidebar.fileNamePlaceholder': 'назва файлу',
  'gdrive.sidebar.loadingFiles': 'Завантаження файлів…',
  'gdrive.sidebar.loadFailed': 'Не вдалося завантажити ваші файли.',

  'gdrive.viewer.noFileOpen': 'Немає відкритого файлу',
  'gdrive.viewer.noFileOpenHint':
    'Виберіть файл на бічній панелі або створіть новий.',
  'gdrive.viewer.noFilesYet': 'Файлів ще немає',
  'gdrive.viewer.noFilesYetHint':
    'Створіть або імпортуйте файл. Файли, які ви відкриваєте в ERD Editor з Google Диска, теж з’являться тут.',
  'gdrive.viewer.waitingForOpener':
    'Очікування вкладки, яка відкрила цей файл…',
  'gdrive.viewer.notDocument': 'Цей файл не є документом ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor відкриває діаграми, які зберіг сам. Цей файл залишається без змін і ніколи не перезаписується.',
  'gdrive.viewer.googleNativeHint':
    'Google Документи, Таблиці й папки відкриваються в Google Диску.',
  'gdrive.viewer.trashed': 'Цей файл у кошику',
  'gdrive.viewer.trashedHint':
    'Відновіть його в Google Диску, щоб відкрити тут.',
  'gdrive.viewer.tooLarge': 'Цей файл завеликий',
  'gdrive.viewer.tooLargeHint': 'ERD Editor відкриває файли до {size} MB.',
  'gdrive.viewer.notFound': 'Цей файл недоступний',
  'gdrive.viewer.notFoundHint':
    'Можливо, його видалено або цей обліковий запис Google не може його відкрити.',
  'gdrive.viewer.waitingToken': 'Очікування Google',
  'gdrive.viewer.waitingTokenHint':
    'Файл відкриється, коли сеанс Google відновиться.',
  'gdrive.viewer.failed': 'Не вдалося відкрити цей файл',
  'gdrive.viewer.failedHint':
    'Google Диск не відповів. Перевірте з’єднання й повторіть спробу.',
  'gdrive.viewer.savingBeforeLeave': 'Збереження перед виходом…',

  'gdrive.status.saved': 'Збережено на Google Диску',
  'gdrive.status.saving': 'Збереження…',
  'gdrive.status.failed': 'Не вдалося зберегти',
  'gdrive.status.conflict': 'Змінено на Google Диску',
  'gdrive.status.unconfirmed': 'Не вдалося підтвердити останнє збереження',
  'gdrive.status.paused': 'Призупинено до повторного підключення Google',
  'gdrive.status.deleted': 'Видалено на Google Диску',
  'gdrive.status.readonly': 'Лише перегляд',
  'gdrive.status.waitingLeader': 'Очікування вкладки, яка зберігає цей файл',
  'gdrive.status.waitingSnapshot': 'Очікування вкладки, яка відкрила цей файл',
  'gdrive.status.scopeMissing': 'Немає доступу до Google Диска',

  'gdrive.banner.conflict':
    'Цей файл змінився на Google Диску, тому збереження зупинено. Ваші зміни досі тут.',
  'gdrive.banner.unconfirmed':
    'Не вдалося підтвердити останнє збереження, тому збереження зупинено. Ваші зміни досі тут.',
  'gdrive.banner.deleted':
    'Цей файл видалено або переміщено в кошик на Google Диску, тому збереження зупинено.',
  'gdrive.banner.readonly':
    'Ви більше не можете редагувати цей файл на Google Диску, тому збереження зупинено. Ваші зміни досі тут.',
  'gdrive.banner.checkDrive': 'Перевірити Диск',
  'gdrive.banner.reloadFromDrive': 'Завантажити знову з Диска',
  'gdrive.banner.leaderNotResponding':
    'Вкладка, яка зберігає цей файл, не відповідає.',
  'gdrive.banner.openerNotResponding':
    'Вкладка, яка відкрила цей файл, не відповідає.',
  'gdrive.banner.takeOver': 'Перебрати збереження',
  'gdrive.banner.openAndTakeOver': 'Відкрити з Диска й перебрати збереження',
  'gdrive.banner.popupBlocked':
    'Браузер заблокував вікно Google. Дозвольте спливаючі вікна для цього сайту й підключіться знову.',
  'gdrive.banner.reconnectFailed':
    'Не вдалося знову підключитися до Google. Повторіть спробу.',
  'gdrive.banner.sessionEnded':
    'Сеанс Google завершився, тому збереження призупинено.',
  'gdrive.banner.sessionEndsSoon': 'Сеанс Google скоро завершиться.',
  'gdrive.banner.reconnect': 'Перепідключити Google',

  'gdrive.leave.title': 'Останні зміни не збережено',
  'gdrive.leave.description':
    'ERD Editor не зміг зберегти їх на Google Диску. Завантажте їх, щоб зберегти копію, або вийдіть, і їх буде втрачено.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor не зміг зберегти їх на Google Диску. Завантажте їх, щоб зберегти копію, або вийдіть з облікового запису, і їх буде втрачено.',
  'gdrive.leave.stay': 'Залишитися',
  'gdrive.leave.leaveAnyway': 'Усе одно вийти',
  'gdrive.leave.signOutAnyway': 'Усе одно вийти з облікового запису',

  'gdrive.create.title': 'Новий файл на Google Диску',
  'gdrive.create.inAppFolder': 'У папці ERD Editor',
  'gdrive.create.inFolderPending': 'У папці…',
  'gdrive.create.inHiddenFolder': 'У папці, яку ERD Editor не бачить',
  'gdrive.create.inFolder': 'У папці «{name}»',
  'gdrive.create.untitled': 'Без назви',
  'gdrive.create.savedAs': 'Буде збережено як {name}',
  'gdrive.create.folderRefused':
    'ERD Editor не може створювати файли в цій папці. Створити файл у папці ERD Editor?',
  'gdrive.create.failed': 'Не вдалося створити файл. Повторіть спробу.',
  'gdrive.create.createInAppFolder': 'Створити в папці ERD Editor',
  'gdrive.create.create': 'Створити',

  'gdrive.import.imported': {
    one: 'На Google Диск імпортовано {count} файл',
    few: 'На Google Диск імпортовано {count} файли',
    many: 'На Google Диск імпортовано {count} файлів',
    other: 'На Google Диск імпортовано {count} файлу',
  },
  'gdrive.import.skippedBackups': {
    one: 'Пропущено {count} резервну копію: резервні копії залишаються в локальному застосунку',
    few: 'Пропущено {count} резервні копії: резервні копії залишаються в локальному застосунку',
    many: 'Пропущено {count} резервних копій: резервні копії залишаються в локальному застосунку',
    other:
      'Пропущено {count} резервної копії: резервні копії залишаються в локальному застосунку',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Не вдалося вивантажити {count} файл',
    few: 'Не вдалося вивантажити {count} файли',
    many: 'Не вдалося вивантажити {count} файлів',
    other: 'Не вдалося вивантажити {count} файлу',
  },

  'gdrive.notice.unreadableState':
    'Google Диск надіслав посилання, яке ERD Editor не зміг прочитати',
  'gdrive.notice.renameFailed': 'Не вдалося перейменувати файл',
  'gdrive.notice.createFailed': 'Не вдалося створити файл',
  'gdrive.notice.checkFailed':
    'Не вдалося зв’язатися з Google Диском. Повторіть спробу.',
  'gdrive.notice.reloadFailed':
    'Не вдалося завантажити знову з Google Диска. Повторіть спробу.',
  'gdrive.notice.reloadTrashed':
    'Не вдалося завантажити знову: файл у кошику Google Диска',
  'gdrive.notice.reloadTooLarge':
    'Не вдалося завантажити знову: файл на Google Диску більший за {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Не вдалося завантажити знову: файл на Google Диску більше не є документом ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Ви вийшли тут. Сервер ERD Editor не підтвердив вихід, тому цей браузер завершить його під час наступного підключення',
  'gdrive.notice.signOutNotRevoked':
    'Ви вийшли тут, але Google не підтвердив відкликання доступу ERD Editor, тож на інших пристроях вхід може зберегтися, доки ви не відкличете доступ на myaccount.google.com/permissions',
} satisfies Messages;
