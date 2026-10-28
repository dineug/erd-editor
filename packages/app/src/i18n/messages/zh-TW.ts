import type { Messages } from '@/i18n/translate';

/** The app's own text in Traditional Chinese, key for key as English writes it. */
export const zhTW = {
  'common.cancel': '取消',
  'common.close': '關閉',
  'common.dismiss': '關閉',
  'common.tryAgain': '重試',
  'common.reload': '重新載入',
  'common.loading': '載入中…',
  'common.search': '搜尋',
  'common.rename': '重新命名',
  'common.importFiles': '匯入檔案',
  'common.signOut': '登出',
  'common.downloadMyChanges': '下載我的變更',
  'common.edited': '{time}編輯',
  'common.system': '系統',
  'common.displayLanguage': '顯示語言',
  'common.theme': '佈景主題',
  'common.light': '淺色',
  'common.dark': '深色',
  'common.host': '主持人',
  'common.guest': '訪客',
  'common.you': '（你）',
  'common.participants': '參與者',
  'common.yourNickname': '你的暱稱',
  'common.privacy': '隱私權',
  'common.terms': '條款',
  'common.editingGuide': '編輯指南',
  'common.openSidebar': '開啟側邊欄',
  'common.closeSidebar': '關閉側邊欄',

  'time.justNow': '剛剛',
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.previous7Days': '過去 7 天',
  'time.previous30Days': '過去 30 天',

  'sidebar.schemas': '結構描述',
  'sidebar.newSchema': '新增結構描述',
  'sidebar.importAndExport': '匯入和匯出',
  'sidebar.exportBackup': '匯出備份',
  'sidebar.searchSchemas': '搜尋結構描述',
  'sidebar.newSchemaName': '新結構描述名稱',
  'sidebar.schemaName': '結構描述名稱',
  'sidebar.schemaNamePlaceholder': '結構描述名稱',
  'sidebar.duplicate': '建立副本',
  'sidebar.moveToTrash': '移至垃圾桶',
  'sidebar.actionsFor': '{name} 的動作',
  'sidebar.noResults': '沒有結果',

  'trash.button': '垃圾桶 ({count})',
  'trash.title': '垃圾桶',
  'trash.description': {
    other: '垃圾桶中的結構描述會在 {count} 天後永久刪除。',
  },
  'trash.listLabel': '垃圾桶中的結構描述',
  'trash.deleted': '{time}刪除',
  'trash.deletesToday': '將於今天刪除',
  'trash.deletesTomorrow': '明天刪除',
  'trash.deletesIn': { other: '{count} 天後刪除' },
  'trash.restore': '還原',
  'trash.deletePermanently': '永久刪除',
  'trash.cannotBeUndone': '這個動作無法復原。',
  'trash.delete': '刪除',
  'trash.empty': '垃圾桶是空的。',
  'trash.emptyTrash': '清空垃圾桶',
  'trash.emptyConfirm': {
    other: '要永久刪除 {count} 個結構描述嗎？這個動作無法復原。',
  },

  'collaboration.for': '{name} 的協作',
  'collaboration.guestsConnected': { other: '已連線 {count} 位訪客' },
  'collaboration.title': '協作編輯',
  'collaboration.experiment': '實驗性',
  'collaboration.description':
    '參與者透過 WebRTC 直接連線，並使用端對端加密交換訊息。',
  'collaboration.nickname': '暱稱',
  'collaboration.link': '連結',
  'collaboration.noOneJoined': '還沒有其他人加入。',
  'collaboration.startSession': '開始工作階段',
  'collaboration.stopSession': '結束工作階段',

  'viewer.noSchemaOpen': '沒有開啟的結構描述',
  'viewer.emptyHint':
    '從側邊欄選擇一個，或在這裡新增。你也可以將檔案拖放到任何地方來匯入。',
  'viewer.openSample': '開啟範例',
  'viewer.sampleName': '書店範例',

  'drop.title': '拖放以匯入',
  'drop.formats': '備份、.erd、.vuerd 和 .json 文件、SQL、DBML、AML 和 GraphQL',
  'drop.importing': '正在匯入檔案…',
  'drop.importingHint': '這次匯入完成後即可繼續拖放',

  'import.imported': { other: '已匯入 {count} 個結構描述' },
  'import.skippedInvalidFiles': { other: '已略過 {count} 個無效檔案' },
  'import.skippedInvalidSchemas': { other: '已略過 {count} 個無效結構描述' },
  'import.skippedOversized': {
    other: '已略過 {count} 個超過 {size} MB 的檔案',
  },
  'import.nothing': '沒有可匯入的內容',
  'import.failed': '匯入失敗',
  'import.exportFailed': '匯出失敗',

  'update.available': 'ERD Editor 有新版本可用。',
  'update.updatedElsewhere': '應用程式已在另一個分頁中更新，請重新載入以完成。',

  'embed.title': '嵌入圖表',
  'embed.documentUrl': '文件 URL',
  'embed.fetchUrl': '載入位址',
  'embed.nameView': '名稱顯示',
  'embed.nameAsSaved': '依儲存的設定',
  'embed.physicalNames': '物理名稱',
  'embed.logicalNames': '邏輯名稱',
  'embed.bothNames': '邏輯與物理名稱',
  'embed.accentColor': '強調色',
  'embed.grayColor': '灰色調',
  'embed.minimap': '小地圖',
  'embed.controls': '控制項',
  'embed.height': '高度',
  'embed.preview': '預覽',
  'embed.embedUrl': '嵌入 URL',
  'embed.embedCode': '嵌入程式碼',
  'embed.copy': '複製',
  'embed.copied': '已複製',

  'live.invalidToken': '共用連結無效。',
  'live.hostNotFound': '找不到主持人。',
  'live.refresh': '重新整理',
  'live.hostStopped': '主持人已結束工作階段。',
  'live.somethingWentWrong': '發生錯誤。',
  'live.lookingForHost': '正在尋找主持人…',
  'live.waitingForHost': '正在等待主持人…',
  'live.session': '即時工作階段',
  'live.inSession': { other: '工作階段中有 {count} 人' },
  'live.showParticipants': '顯示參與者',
  'live.hideParticipants': '隱藏參與者',

  'gdrive.checkingSignIn': '正在檢查 Google 登入狀態…',
  'gdrive.anotherAccount': '其他帳戶',
  'gdrive.offline.title': '你目前離線',
  'gdrive.offline.description':
    '恢復連線後，ERD Editor 會檢查你的 Google 登入狀態。',
  'gdrive.scopeMissing.title': '未授予 Google 雲端硬碟存取權',
  'gdrive.scopeMissing.description':
    'ERD Editor 需要存取你以它建立或開啟的檔案。請重新登入並允許存取 Google 雲端硬碟。',
  'gdrive.mismatch.title': 'Google 雲端硬碟傳來的要求屬於其他帳戶',
  'gdrive.mismatch.description':
    '你目前以 {email} 登入。請切換到 Google 雲端硬碟所用的帳戶，或繼續使用這個帳戶的檔案。',
  'gdrive.mismatch.choose':
    'ERD Editor 無法預先選取該帳戶，請在 Google 詢問時選擇它。',
  'gdrive.mismatch.switchAccount': '切換帳戶',
  'gdrive.mismatch.showMyFiles': '顯示我的檔案',
  'gdrive.accountChanged.title': '已用其他帳戶登入',
  'gdrive.accountChanged.description':
    '另一個分頁登入了其他 Google 帳戶，因此這個分頁已停止。重新載入即可用該帳戶繼續。',
  'gdrive.unsaved.title': '你的變更尚未儲存',
  'gdrive.unsaved.description':
    '{name} 有 {email} 所做、但 Google 雲端硬碟中沒有的變更，而現在登入的是 {account}。請先下載這些變更再繼續。',
  'gdrive.unsaved.descriptionUnnamed':
    '你開啟的檔案有 {email} 所做、但 Google 雲端硬碟中沒有的變更，而現在登入的是 {account}。請先下載這些變更再繼續。',
  'gdrive.unsaved.continueWithout': '捨棄變更並繼續',
  'gdrive.framed.title':
    '請在獨立分頁中開啟 ERD Editor 的 Google 雲端硬碟編輯器',
  'gdrive.framed.description': '它無法在其他網頁中執行。',
  'gdrive.framed.link': '在新分頁中開啟',
  'gdrive.notConfigured.title': '尚未設定 Google 雲端硬碟整合',
  'gdrive.notConfigured.description':
    '這個 ERD Editor 版本沒有 Google 登入用戶端。',
  'gdrive.unsupportedOrigin.title': '這裡無法使用 Google 雲端硬碟',
  'gdrive.unsupportedOrigin.description':
    'Google 登入只能在 erd-editor.io 上使用，而這裡是預覽版。',

  'gdrive.signIn.title': '開啟你在 Google 雲端硬碟中的 ERD 檔案',
  'gdrive.signIn.description':
    'ERD Editor 只會開啟和儲存你以它建立或開啟的檔案。',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor 的登入伺服器忙碌中，因此 Google 每次只會讓你保持登入一小時。',
  'gdrive.signIn.signIn': '使用 Google 帳戶登入',
  'gdrive.signIn.continue': '使用 Google 帳戶繼續',
  'gdrive.signIn.waitingTitle': '正在等待 Google 登入…',
  'gdrive.signIn.waitingDescription': '請在 Google 開啟的視窗中完成登入。',
  'gdrive.signIn.popupBlocked':
    '瀏覽器封鎖了登入視窗。請允許這個網站的彈出式視窗，然後再試一次。',
  'gdrive.signIn.failed': 'Google 登入未完成。請再試一次。',
  'gdrive.signIn.gisBlocked':
    '無法載入 Google 登入。請確認沒有封鎖 accounts.google.com，然後重新載入頁面。',

  'gdrive.sidebar.label': '雲端硬碟檔案',
  'gdrive.sidebar.newFile': '新增檔案',
  'gdrive.sidebar.import': '匯入',
  'gdrive.sidebar.searchFiles': '搜尋檔案',
  'gdrive.sidebar.newFileName': '新檔案名稱',
  'gdrive.sidebar.fileName': '檔案名稱',
  'gdrive.sidebar.fileNamePlaceholder': '檔案名稱',
  'gdrive.sidebar.loadingFiles': '正在載入檔案…',
  'gdrive.sidebar.loadFailed': '無法載入你的檔案。',

  'gdrive.viewer.noFileOpen': '沒有開啟的檔案',
  'gdrive.viewer.noFileOpenHint': '從側邊欄選擇一個檔案，或新增一個。',
  'gdrive.viewer.noFilesYet': '還沒有檔案',
  'gdrive.viewer.noFilesYetHint':
    '新增或匯入一個檔案。你從 Google 雲端硬碟以 ERD Editor 開啟的檔案也會顯示在這裡。',
  'gdrive.viewer.waitingForOpener': '正在等待開啟這個檔案的分頁…',
  'gdrive.viewer.notDocument': '這個檔案不是 ERD Editor 文件',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor 只會開啟它自己儲存的圖表。它會保留這個檔案原樣，絕不會覆寫。',
  'gdrive.viewer.googleNativeHint':
    'Google 文件、試算表和資料夾會在 Google 雲端硬碟中開啟。',
  'gdrive.viewer.trashed': '這個檔案在垃圾桶中',
  'gdrive.viewer.trashedHint': '請在 Google 雲端硬碟中還原，才能在這裡開啟。',
  'gdrive.viewer.tooLarge': '這個檔案太大',
  'gdrive.viewer.tooLargeHint': 'ERD Editor 可開啟最大 {size} MB 的檔案。',
  'gdrive.viewer.notFound': '無法存取這個檔案',
  'gdrive.viewer.notFoundHint':
    '它可能已被刪除，或這個 Google 帳戶無法開啟它。',
  'gdrive.viewer.waitingToken': '正在等待 Google',
  'gdrive.viewer.waitingTokenHint':
    '你的 Google 工作階段恢復後，這個檔案就會開啟。',
  'gdrive.viewer.failed': '無法開啟這個檔案',
  'gdrive.viewer.failedHint':
    'Google 雲端硬碟沒有回應。請檢查連線，然後再試一次。',
  'gdrive.viewer.savingBeforeLeave': '離開前正在儲存…',

  'gdrive.status.saved': '已儲存到 Google 雲端硬碟',
  'gdrive.status.saving': '正在儲存…',
  'gdrive.status.failed': '無法儲存',
  'gdrive.status.conflict': '已在 Google 雲端硬碟中變更',
  'gdrive.status.unconfirmed': '無法確認上次儲存',
  'gdrive.status.paused': '已暫停，等待 Google 重新連線',
  'gdrive.status.deleted': '已在 Google 雲端硬碟中刪除',
  'gdrive.status.readonly': '僅供檢視',
  'gdrive.status.waitingLeader': '正在等待儲存這個檔案的分頁',
  'gdrive.status.waitingSnapshot': '正在等待開啟這個檔案的分頁',
  'gdrive.status.scopeMissing': '沒有 Google 雲端硬碟存取權',

  'gdrive.banner.conflict':
    '這個檔案已在 Google 雲端硬碟中變更，因此已停止儲存。你的變更仍在這裡。',
  'gdrive.banner.unconfirmed':
    '無法確認上次儲存，因此已停止儲存。你的變更仍在這裡。',
  'gdrive.banner.deleted':
    '這個檔案已在 Google 雲端硬碟中刪除或移至垃圾桶，因此已停止儲存。',
  'gdrive.banner.readonly':
    '你已無法在 Google 雲端硬碟中編輯這個檔案，因此已停止儲存。你的變更仍在這裡。',
  'gdrive.banner.checkDrive': '檢查雲端硬碟',
  'gdrive.banner.reloadFromDrive': '從雲端硬碟重新載入',
  'gdrive.banner.leaderNotResponding': '儲存這個檔案的分頁沒有回應。',
  'gdrive.banner.openerNotResponding': '開啟這個檔案的分頁沒有回應。',
  'gdrive.banner.takeOver': '接手儲存',
  'gdrive.banner.openAndTakeOver': '從雲端硬碟開啟並接手',
  'gdrive.banner.popupBlocked':
    '瀏覽器封鎖了 Google 視窗。請允許這個網站的彈出式視窗，然後重新連線。',
  'gdrive.banner.reconnectFailed': 'Google 未能重新連線。請再試一次。',
  'gdrive.banner.sessionEnded': '你的 Google 工作階段已結束，因此已暫停儲存。',
  'gdrive.banner.sessionEndsSoon': '你的 Google 工作階段即將結束。',
  'gdrive.banner.reconnect': '重新連線 Google',

  'gdrive.leave.title': '你最近的變更尚未儲存',
  'gdrive.leave.description':
    'ERD Editor 無法將變更儲存到 Google 雲端硬碟。請下載以保留副本，或離開並捨棄變更。',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor 無法將變更儲存到 Google 雲端硬碟。請下載以保留副本，或登出並捨棄變更。',
  'gdrive.leave.stay': '留下',
  'gdrive.leave.leaveAnyway': '仍要離開',
  'gdrive.leave.signOutAnyway': '仍要登出',

  'gdrive.create.title': '在 Google 雲端硬碟中新增檔案',
  'gdrive.create.inAppFolder': '位置：ERD Editor 資料夾',
  'gdrive.create.inFolderPending': '位置：資料夾…',
  'gdrive.create.inHiddenFolder': '位置：ERD Editor 無法查看的資料夾',
  'gdrive.create.inFolder': '位置：資料夾「{name}」',
  'gdrive.create.untitled': '未命名',
  'gdrive.create.savedAs': '將儲存為 {name}',
  'gdrive.create.folderRefused':
    'ERD Editor 無法在這個資料夾中建立檔案。要改在 ERD Editor 資料夾中建立嗎？',
  'gdrive.create.failed': '無法建立檔案。請再試一次。',
  'gdrive.create.createInAppFolder': '在 ERD Editor 資料夾中建立',
  'gdrive.create.create': '建立',

  'gdrive.import.imported': {
    other: '已將 {count} 個檔案匯入 Google 雲端硬碟',
  },
  'gdrive.import.skippedBackups': {
    other: '已略過 {count} 個備份：備份只能匯入本機應用程式',
  },
  'gdrive.import.uploadsFailed': { other: '{count} 個檔案上傳失敗' },

  'gdrive.notice.unreadableState':
    'ERD Editor 無法讀取 Google 雲端硬碟傳送的連結',
  'gdrive.notice.renameFailed': '無法重新命名檔案',
  'gdrive.notice.createFailed': '無法建立檔案',
  'gdrive.notice.checkFailed': '無法連線至 Google 雲端硬碟。請再試一次。',
  'gdrive.notice.reloadFailed': '無法從 Google 雲端硬碟重新載入。請再試一次。',
  'gdrive.notice.reloadTrashed':
    '無法重新載入：檔案在 Google 雲端硬碟的垃圾桶中',
  'gdrive.notice.reloadTooLarge':
    '無法重新載入：Google 雲端硬碟中的檔案超過 {size} MB',
  'gdrive.notice.reloadNotDocument':
    '無法重新載入：Google 雲端硬碟中的檔案已不再是 ERD Editor 文件',
  'gdrive.notice.signOutUnconfirmed':
    '已在這裡登出。ERD Editor 的伺服器未確認，因此這個瀏覽器會在下次連線時完成登出',
  'gdrive.notice.signOutNotRevoked':
    '已在這裡登出，但 Google 未確認已移除 ERD Editor 的存取權，因此在你於 myaccount.google.com/permissions 移除之前，其他裝置可能仍保持登入',
} satisfies Messages;
