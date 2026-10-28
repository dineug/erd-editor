import type { Messages } from '@/i18n/translate';

/** The app's own text in Russian, key for key as English writes it. */
export const ruRU = {
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.dismiss': 'Закрыть',
  'common.tryAgain': 'Повторить',
  'common.reload': 'Перезагрузить',
  'common.loading': 'Загрузка…',
  'common.search': 'Поиск',
  'common.rename': 'Переименовать',
  'common.importFiles': 'Импортировать файлы',
  'common.signOut': 'Выйти',
  'common.downloadMyChanges': 'Скачать мои изменения',
  'common.edited': 'Изменено {time}',
  'common.system': 'Как в системе',
  'common.displayLanguage': 'Язык интерфейса',
  'common.theme': 'Тема',
  'common.light': 'Светлая',
  'common.dark': 'Темная',
  'common.host': 'Организатор',
  'common.guest': 'Гость',
  'common.you': '(вы)',
  'common.participants': 'Участники',
  'common.yourNickname': 'Ваш псевдоним',
  'common.privacy': 'Конфиденциальность',
  'common.terms': 'Условия',
  'common.editingGuide': 'Руководство по редактированию',
  'common.openSidebar': 'Открыть боковую панель',
  'common.closeSidebar': 'Закрыть боковую панель',

  'time.justNow': 'только что',
  'time.today': 'Сегодня',
  'time.yesterday': 'Вчера',
  'time.previous7Days': 'Последние 7 дней',
  'time.previous30Days': 'Последние 30 дней',

  'sidebar.schemas': 'Схемы',
  'sidebar.newSchema': 'Новая схема',
  'sidebar.importAndExport': 'Импорт и экспорт',
  'sidebar.exportBackup': 'Экспортировать резервную копию',
  'sidebar.searchSchemas': 'Поиск схем',
  'sidebar.newSchemaName': 'Название новой схемы',
  'sidebar.schemaName': 'Название схемы',
  'sidebar.schemaNamePlaceholder': 'название схемы',
  'sidebar.duplicate': 'Дублировать',
  'sidebar.moveToTrash': 'Переместить в корзину',
  'sidebar.actionsFor': 'Действия для {name}',
  'sidebar.noResults': 'Ничего не найдено',

  'trash.button': 'Корзина ({count})',
  'trash.title': 'Корзина',
  'trash.description': {
    one: 'Схемы в корзине удаляются навсегда через {count} день.',
    few: 'Схемы в корзине удаляются навсегда через {count} дня.',
    many: 'Схемы в корзине удаляются навсегда через {count} дней.',
    other: 'Схемы в корзине удаляются навсегда через {count} дня.',
  },
  'trash.listLabel': 'Схемы в корзине',
  'trash.deleted': 'Удалено {time}',
  'trash.deletesToday': 'удаление сегодня',
  'trash.deletesTomorrow': 'удаление завтра',
  'trash.deletesIn': {
    one: 'удаление через {count} день',
    few: 'удаление через {count} дня',
    many: 'удаление через {count} дней',
    other: 'удаление через {count} дня',
  },
  'trash.restore': 'Восстановить',
  'trash.deletePermanently': 'Удалить навсегда',
  'trash.cannotBeUndone': 'Это действие нельзя отменить.',
  'trash.delete': 'Удалить',
  'trash.empty': 'Корзина пуста.',
  'trash.emptyTrash': 'Очистить корзину',
  'trash.emptyConfirm': {
    one: 'Удалить {count} схему навсегда? Это действие нельзя отменить.',
    few: 'Удалить {count} схемы навсегда? Это действие нельзя отменить.',
    many: 'Удалить {count} схем навсегда? Это действие нельзя отменить.',
    other: 'Удалить {count} схемы навсегда? Это действие нельзя отменить.',
  },

  'collaboration.for': 'Совместная работа: {name}',
  'collaboration.guestsConnected': {
    one: 'Подключен {count} гость',
    few: 'Подключено {count} гостя',
    many: 'Подключено {count} гостей',
    other: 'Подключено {count} гостя',
  },
  'collaboration.title': 'Совместное редактирование',
  'collaboration.experiment': 'Эксперимент',
  'collaboration.description':
    'Участники подключаются напрямую через WebRTC и обмениваются сообщениями со сквозным шифрованием.',
  'collaboration.nickname': 'Псевдоним',
  'collaboration.link': 'Ссылка',
  'collaboration.noOneJoined': 'Пока никто больше не присоединился.',
  'collaboration.startSession': 'Начать сеанс',
  'collaboration.stopSession': 'Завершить сеанс',

  'viewer.noSchemaOpen': 'Нет открытой схемы',
  'viewer.emptyHint':
    'Выберите схему на боковой панели или создайте новую здесь. Файлы для импорта можно также перетащить в любое место.',
  'viewer.openSample': 'Открыть пример',
  'viewer.sampleName': 'пример книжного магазина',

  'drop.title': 'Отпустите для импорта',
  'drop.formats':
    'Резервные копии, документы .erd, .vuerd и .json, SQL, DBML, AML и GraphQL',
  'drop.importing': 'Импорт файлов…',
  'drop.importingHint': 'Перетащите еще, когда этот импорт завершится',

  'import.imported': {
    one: 'Импортирована {count} схема',
    few: 'Импортировано {count} схемы',
    many: 'Импортировано {count} схем',
    other: 'Импортировано {count} схемы',
  },
  'import.skippedInvalidFiles': {
    one: 'Пропущен {count} недопустимый файл',
    few: 'Пропущено {count} недопустимых файла',
    many: 'Пропущено {count} недопустимых файлов',
    other: 'Пропущено {count} недопустимого файла',
  },
  'import.skippedInvalidSchemas': {
    one: 'Пропущена {count} недопустимая схема',
    few: 'Пропущено {count} недопустимые схемы',
    many: 'Пропущено {count} недопустимых схем',
    other: 'Пропущено {count} недопустимой схемы',
  },
  'import.skippedOversized': {
    one: 'Пропущен {count} файл больше {size} MB',
    few: 'Пропущено {count} файла больше {size} MB',
    many: 'Пропущено {count} файлов больше {size} MB',
    other: 'Пропущено {count} файла больше {size} MB',
  },
  'import.nothing': 'Нечего импортировать',
  'import.failed': 'Не удалось импортировать',
  'import.exportFailed': 'Не удалось экспортировать',

  'update.available': 'Доступна новая версия ERD Editor.',
  'update.updatedElsewhere':
    'Приложение обновлено в другой вкладке — перезагрузите, чтобы завершить.',

  'embed.title': 'Встроить диаграмму',
  'embed.documentUrl': 'URL документа',
  'embed.fetchUrl': 'Загружается из',
  'embed.nameView': 'Отображение имен',
  'embed.nameAsSaved': 'Как сохранено',
  'embed.physicalNames': 'Физические имена',
  'embed.logicalNames': 'Логические имена',
  'embed.bothNames': 'Оба имени',
  'embed.accentColor': 'Цвет акцента',
  'embed.grayColor': 'Оттенок серого',
  'embed.minimap': 'Мини-карта',
  'embed.controls': 'Элементы управления',
  'embed.height': 'Высота',
  'embed.preview': 'Предварительный просмотр',
  'embed.embedUrl': 'URL для встраивания',
  'embed.embedCode': 'Код для встраивания',
  'embed.copy': 'Копировать',
  'embed.copied': 'Скопировано',

  'live.invalidToken': 'Недействительная ссылка для совместной работы.',
  'live.hostNotFound': 'Организатор не найден.',
  'live.refresh': 'Обновить',
  'live.hostStopped': 'Организатор завершил сеанс.',
  'live.somethingWentWrong': 'Что-то пошло не так.',
  'live.lookingForHost': 'Поиск организатора...',
  'live.waitingForHost': 'Ожидание организатора...',
  'live.session': 'Сеанс в реальном времени',
  'live.inSession': {
    one: 'В сеансе {count} участник',
    few: 'В сеансе {count} участника',
    many: 'В сеансе {count} участников',
    other: 'В сеансе {count} участника',
  },
  'live.showParticipants': 'Показать участников',
  'live.hideParticipants': 'Скрыть участников',

  'gdrive.checkingSignIn': 'Проверка входа в Google…',
  'gdrive.anotherAccount': 'другой аккаунт',
  'gdrive.offline.title': 'Нет подключения к сети',
  'gdrive.offline.description':
    'ERD Editor проверит вход в Google, когда подключение восстановится.',
  'gdrive.scopeMissing.title': 'Доступ к Google Диску не предоставлен',
  'gdrive.scopeMissing.description':
    'ERD Editor нужен доступ к файлам, которые вы в нем создаете или открываете. Войдите снова и разрешите доступ к Google Диску.',
  'gdrive.mismatch.title':
    'Этот запрос Google Диска предназначен для другого аккаунта',
  'gdrive.mismatch.description':
    'Вы вошли как {email}. Переключитесь на аккаунт, в котором Google Диск открыл файл, или продолжите работу с файлами этого аккаунта.',
  'gdrive.mismatch.choose':
    'ERD Editor не смог заранее выбрать этот аккаунт, поэтому выберите его, когда Google спросит.',
  'gdrive.mismatch.switchAccount': 'Сменить аккаунт',
  'gdrive.mismatch.showMyFiles': 'Показать мои файлы',
  'gdrive.accountChanged.title': 'Выполнен вход в другой аккаунт',
  'gdrive.accountChanged.description':
    'В другой вкладке выполнен вход в другой аккаунт Google, поэтому работа в этой вкладке остановлена. Перезагрузите вкладку, чтобы продолжить с этим аккаунтом.',
  'gdrive.unsaved.title': 'Ваши изменения не сохранены',
  'gdrive.unsaved.description':
    'В файле «{name}» есть изменения от {email}, которых нет на Google Диске, а сейчас вход выполнен как {account}. Скачайте их, прежде чем продолжить.',
  'gdrive.unsaved.descriptionUnnamed':
    'В открытом файле есть изменения от {email}, которых нет на Google Диске, а сейчас вход выполнен как {account}. Скачайте их, прежде чем продолжить.',
  'gdrive.unsaved.continueWithout': 'Продолжить без них',
  'gdrive.framed.title':
    'Откройте редактор Google Диска в ERD Editor в отдельной вкладке',
  'gdrive.framed.description': 'Он не работает внутри другой страницы.',
  'gdrive.framed.link': 'Открыть в новой вкладке',
  'gdrive.notConfigured.title': 'Интеграция с Google Диском не настроена',
  'gdrive.notConfigured.description':
    'В этой сборке ERD Editor нет клиента входа через Google.',
  'gdrive.unsupportedOrigin.title': 'Google Диск здесь недоступен',
  'gdrive.unsupportedOrigin.description':
    'Вход через Google работает только на erd-editor.io, а это предварительная версия.',

  'gdrive.signIn.title': 'Открывайте файлы ERD на Google Диске',
  'gdrive.signIn.description':
    'ERD Editor открывает и сохраняет только файлы, которые вы в нем создаете или открываете.',
  'gdrive.signIn.fallbackDescription':
    'Сервер входа ERD Editor перегружен, поэтому Google выполняет вход на один час.',
  'gdrive.signIn.signIn': 'Войти через Google',
  'gdrive.signIn.continue': 'Продолжить через Google',
  'gdrive.signIn.waitingTitle': 'Ожидание входа в Google…',
  'gdrive.signIn.waitingDescription':
    'Завершите вход в окне, которое открыл Google.',
  'gdrive.signIn.popupBlocked':
    'Браузер заблокировал окно входа. Разрешите всплывающие окна для этого сайта и повторите попытку.',
  'gdrive.signIn.failed': 'Вход в Google не завершен. Повторите попытку.',
  'gdrive.signIn.gisBlocked':
    'Не удалось загрузить вход через Google. Убедитесь, что ничто не блокирует accounts.google.com, и перезагрузите страницу.',

  'gdrive.sidebar.label': 'Файлы Диска',
  'gdrive.sidebar.newFile': 'Новый файл',
  'gdrive.sidebar.import': 'Импорт',
  'gdrive.sidebar.searchFiles': 'Поиск файлов',
  'gdrive.sidebar.newFileName': 'Название нового файла',
  'gdrive.sidebar.fileName': 'Название файла',
  'gdrive.sidebar.fileNamePlaceholder': 'название файла',
  'gdrive.sidebar.loadingFiles': 'Загрузка файлов…',
  'gdrive.sidebar.loadFailed': 'Не удалось загрузить ваши файлы.',

  'gdrive.viewer.noFileOpen': 'Нет открытого файла',
  'gdrive.viewer.noFileOpenHint':
    'Выберите файл на боковой панели или создайте новый.',
  'gdrive.viewer.noFilesYet': 'Файлов пока нет',
  'gdrive.viewer.noFilesYetHint':
    'Создайте или импортируйте файл. Файлы, которые вы открываете в ERD Editor с Google Диска, тоже появятся здесь.',
  'gdrive.viewer.waitingForOpener': 'Ожидание вкладки, открывшей этот файл…',
  'gdrive.viewer.notDocument': 'Этот файл не является документом ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor открывает диаграммы, которые сохранил сам. Этот файл остается без изменений и никогда не перезаписывается.',
  'gdrive.viewer.googleNativeHint':
    'Google Документы, Таблицы и папки открываются на Google Диске.',
  'gdrive.viewer.trashed': 'Этот файл в корзине',
  'gdrive.viewer.trashedHint':
    'Восстановите его на Google Диске, чтобы открыть здесь.',
  'gdrive.viewer.tooLarge': 'Этот файл слишком большой',
  'gdrive.viewer.tooLargeHint': 'ERD Editor открывает файлы до {size} MB.',
  'gdrive.viewer.notFound': 'Этот файл недоступен',
  'gdrive.viewer.notFoundHint':
    'Возможно, он удален или этот аккаунт Google не может его открыть.',
  'gdrive.viewer.waitingToken': 'Ожидание Google',
  'gdrive.viewer.waitingTokenHint':
    'Файл откроется, когда сеанс Google восстановится.',
  'gdrive.viewer.failed': 'Не удалось открыть этот файл',
  'gdrive.viewer.failedHint':
    'Google Диск не ответил. Проверьте подключение и повторите попытку.',
  'gdrive.viewer.savingBeforeLeave': 'Сохранение перед закрытием файла…',

  'gdrive.status.saved': 'Сохранено на Google Диске',
  'gdrive.status.saving': 'Сохранение…',
  'gdrive.status.failed': 'Не удалось сохранить',
  'gdrive.status.conflict': 'Изменено на Google Диске',
  'gdrive.status.unconfirmed': 'Не удалось подтвердить последнее сохранение',
  'gdrive.status.paused': 'Приостановлено до переподключения Google',
  'gdrive.status.deleted': 'Удалено на Google Диске',
  'gdrive.status.readonly': 'Только просмотр',
  'gdrive.status.waitingLeader': 'Ожидание вкладки, сохраняющей этот файл',
  'gdrive.status.waitingSnapshot': 'Ожидание вкладки, открывшей этот файл',
  'gdrive.status.scopeMissing': 'Нет доступа к Google Диску',

  'gdrive.banner.conflict':
    'Этот файл изменился на Google Диске, поэтому сохранение остановлено. Ваши изменения по-прежнему здесь.',
  'gdrive.banner.unconfirmed':
    'Не удалось подтвердить последнее сохранение, поэтому сохранение остановлено. Ваши изменения по-прежнему здесь.',
  'gdrive.banner.deleted':
    'Этот файл удален или перемещен в корзину на Google Диске, поэтому сохранение остановлено.',
  'gdrive.banner.readonly':
    'Вы больше не можете редактировать этот файл на Google Диске, поэтому сохранение остановлено. Ваши изменения по-прежнему здесь.',
  'gdrive.banner.checkDrive': 'Проверить Диск',
  'gdrive.banner.reloadFromDrive': 'Загрузить заново с Диска',
  'gdrive.banner.leaderNotResponding':
    'Вкладка, сохраняющая этот файл, не отвечает.',
  'gdrive.banner.openerNotResponding':
    'Вкладка, открывшая этот файл, не отвечает.',
  'gdrive.banner.takeOver': 'Взять сохранение на себя',
  'gdrive.banner.openAndTakeOver': 'Открыть с Диска и взять на себя',
  'gdrive.banner.popupBlocked':
    'Браузер заблокировал окно Google. Разрешите всплывающие окна для этого сайта и подключитесь снова.',
  'gdrive.banner.reconnectFailed':
    'Не удалось снова подключиться к Google. Повторите попытку.',
  'gdrive.banner.sessionEnded':
    'Сеанс Google завершился, поэтому сохранение приостановлено.',
  'gdrive.banner.sessionEndsSoon': 'Сеанс Google скоро завершится.',
  'gdrive.banner.reconnect': 'Переподключить Google',

  'gdrive.leave.title': 'Последние изменения не сохранены',
  'gdrive.leave.description':
    'ERD Editor не смог сохранить их на Google Диске. Скачайте их, чтобы сохранить копию. Если уйти без этого, они будут потеряны.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor не смог сохранить их на Google Диске. Скачайте их, чтобы сохранить копию. Если выйти без этого, они будут потеряны.',
  'gdrive.leave.stay': 'Остаться',
  'gdrive.leave.leaveAnyway': 'Все равно уйти',
  'gdrive.leave.signOutAnyway': 'Все равно выйти',

  'gdrive.create.title': 'Новый файл на Google Диске',
  'gdrive.create.inAppFolder': 'В папке ERD Editor',
  'gdrive.create.inFolderPending': 'В папке…',
  'gdrive.create.inHiddenFolder': 'В папке, которую ERD Editor не видит',
  'gdrive.create.inFolder': 'В папке «{name}»',
  'gdrive.create.untitled': 'Без названия',
  'gdrive.create.savedAs': 'Будет сохранен как {name}',
  'gdrive.create.folderRefused':
    'ERD Editor не может создавать файлы в этой папке. Создать файл в папке ERD Editor?',
  'gdrive.create.failed': 'Не удалось создать файл. Повторите попытку.',
  'gdrive.create.createInAppFolder': 'Создать в папке ERD Editor',
  'gdrive.create.create': 'Создать',

  'gdrive.import.imported': {
    one: 'На Google Диск импортирован {count} файл',
    few: 'На Google Диск импортировано {count} файла',
    many: 'На Google Диск импортировано {count} файлов',
    other: 'На Google Диск импортировано {count} файла',
  },
  'gdrive.import.skippedBackups': {
    one: 'Пропущена {count} резервная копия: резервные копии остаются в локальном приложении',
    few: 'Пропущено {count} резервные копии: резервные копии остаются в локальном приложении',
    many: 'Пропущено {count} резервных копий: резервные копии остаются в локальном приложении',
    other:
      'Пропущено {count} резервной копии: резервные копии остаются в локальном приложении',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Не удалось загрузить {count} файл',
    few: 'Не удалось загрузить {count} файла',
    many: 'Не удалось загрузить {count} файлов',
    other: 'Не удалось загрузить {count} файла',
  },

  'gdrive.notice.unreadableState':
    'Google Диск отправил ссылку, которую ERD Editor не смог прочитать',
  'gdrive.notice.renameFailed': 'Не удалось переименовать файл',
  'gdrive.notice.createFailed': 'Не удалось создать файл',
  'gdrive.notice.checkFailed':
    'Не удалось связаться с Google Диском. Повторите попытку.',
  'gdrive.notice.reloadFailed':
    'Не удалось загрузить заново с Google Диска. Повторите попытку.',
  'gdrive.notice.reloadTrashed':
    'Не удалось загрузить заново: файл в корзине Google Диска',
  'gdrive.notice.reloadTooLarge':
    'Не удалось загрузить заново: файл на Google Диске больше {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Не удалось загрузить заново: файл на Google Диске больше не является документом ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Вы вышли из аккаунта. Сервер ERD Editor не подтвердил выход, поэтому этот браузер завершит его при следующем подключении',
  'gdrive.notice.signOutNotRevoked':
    'Вы вышли из аккаунта на этом устройстве, но Google не подтвердил отзыв доступа ERD Editor, поэтому на других устройствах вход может сохраниться, пока вы не отзовете доступ на myaccount.google.com/permissions',
} satisfies Messages;
