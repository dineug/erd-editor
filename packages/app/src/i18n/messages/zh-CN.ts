import type { Messages } from '@/i18n/translate';

/** The app's own text in Simplified Chinese, key for key as English writes it. */
export const zhCN = {
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.dismiss': '关闭',
  'common.tryAgain': '重试',
  'common.reload': '重新加载',
  'common.loading': '正在加载…',
  'common.search': '搜索',
  'common.rename': '重命名',
  'common.importFiles': '导入文件',
  'common.signOut': '退出登录',
  'common.downloadMyChanges': '下载我的更改',
  'common.edited': '编辑于{time}',
  'common.system': '跟随系统',
  'common.displayLanguage': '显示语言',
  'common.theme': '主题',
  'common.light': '浅色',
  'common.dark': '深色',
  'common.host': '主持人',
  'common.guest': '访客',
  'common.you': '（你）',
  'common.participants': '参与者',
  'common.yourNickname': '你的昵称',
  'common.privacy': '隐私',
  'common.terms': '条款',
  'common.editingGuide': '编辑指南',
  'common.openSidebar': '打开侧边栏',
  'common.closeSidebar': '关闭侧边栏',

  'time.justNow': '刚刚',
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.previous7Days': '过去 7 天',
  'time.previous30Days': '过去 30 天',

  'sidebar.schemas': '模式',
  'sidebar.newSchema': '新建模式',
  'sidebar.importAndExport': '导入和导出',
  'sidebar.exportBackup': '导出备份',
  'sidebar.searchSchemas': '搜索模式',
  'sidebar.newSchemaName': '新模式名称',
  'sidebar.schemaName': '模式名称',
  'sidebar.schemaNamePlaceholder': '模式名称',
  'sidebar.duplicate': '创建副本',
  'sidebar.moveToTrash': '移到回收站',
  'sidebar.actionsFor': '{name} 的操作',
  'sidebar.noResults': '无结果',

  'trash.button': '回收站 ({count})',
  'trash.title': '回收站',
  'trash.description': { other: '回收站中的模式将在 {count} 天后永久删除。' },
  'trash.listLabel': '回收站中的模式',
  'trash.deleted': '删除于{time}',
  'trash.deletesToday': '今天删除',
  'trash.deletesTomorrow': '明天删除',
  'trash.deletesIn': { other: '{count} 天后删除' },
  'trash.restore': '恢复',
  'trash.deletePermanently': '永久删除',
  'trash.cannotBeUndone': '此操作无法撤消。',
  'trash.delete': '删除',
  'trash.empty': '回收站是空的。',
  'trash.emptyTrash': '清空回收站',
  'trash.emptyConfirm': { other: '永久删除 {count} 个模式？此操作无法撤消。' },

  'collaboration.for': '{name} 的协作',
  'collaboration.guestsConnected': { other: '已连接 {count} 位访客' },
  'collaboration.title': '协作编辑',
  'collaboration.experiment': '实验性',
  'collaboration.description':
    '参与者通过 WebRTC 直接连接，并使用端到端加密交换消息。',
  'collaboration.nickname': '昵称',
  'collaboration.link': '链接',
  'collaboration.noOneJoined': '还没有其他人加入。',
  'collaboration.startSession': '开始会话',
  'collaboration.stopSession': '结束会话',

  'viewer.noSchemaOpen': '没有打开的模式',
  'viewer.emptyHint':
    '从侧边栏选择一个，或在这里新建。也可以将文件拖放到任意位置来导入。',
  'viewer.openSample': '打开示例',
  'viewer.sampleName': '书店示例',

  'drop.title': '拖放以导入',
  'drop.formats': '备份、.erd、.vuerd 和 .json 文档、SQL、DBML、AML 和 GraphQL',
  'drop.importing': '正在导入文件…',
  'drop.importingHint': '本次导入完成后可以继续拖放',

  'import.imported': { other: '已导入 {count} 个模式' },
  'import.skippedInvalidFiles': { other: '已跳过 {count} 个无效文件' },
  'import.skippedInvalidSchemas': { other: '已跳过 {count} 个无效模式' },
  'import.skippedOversized': {
    other: '已跳过 {count} 个超过 {size} MB 的文件',
  },
  'import.nothing': '没有可导入的内容',
  'import.failed': '导入失败',
  'import.exportFailed': '导出失败',

  'update.available': 'ERD Editor 有新版本可用。',
  'update.updatedElsewhere': '应用已在另一个标签页中更新，请重新加载以完成。',

  'live.invalidToken': '共享令牌无效。',
  'live.hostNotFound': '找不到主持人。',
  'live.refresh': '刷新',
  'live.hostStopped': '主持人已结束会话。',
  'live.somethingWentWrong': '出了点问题。',
  'live.lookingForHost': '正在寻找主持人...',
  'live.waitingForHost': '正在等待主持人...',
  'live.session': '实时会话',
  'live.inSession': { other: '会话中有 {count} 人' },
  'live.showParticipants': '显示参与者',
  'live.hideParticipants': '隐藏参与者',

  'gdrive.checkingSignIn': '正在检查你的 Google 登录…',
  'gdrive.anotherAccount': '另一个账号',
  'gdrive.offline.title': '你已离线',
  'gdrive.offline.description':
    '恢复联网后，ERD Editor 会检查你的 Google 登录。',
  'gdrive.scopeMissing.title': '未授予 Google 云端硬盘访问权限',
  'gdrive.scopeMissing.description':
    'ERD Editor 需要访问你用它创建或打开的文件。请重新登录并允许访问 Google 云端硬盘。',
  'gdrive.mismatch.title': 'Google 云端硬盘为另一个账号发送了此文件',
  'gdrive.mismatch.description':
    '你当前以 {email} 登录。请切换到 Google 云端硬盘用来打开它的账号，或继续使用此账号的文件。',
  'gdrive.mismatch.choose':
    'ERD Editor 无法预先选择该账号，请在 Google 询问时选择它。',
  'gdrive.mismatch.switchAccount': '切换账号',
  'gdrive.mismatch.showMyFiles': '显示我的文件',
  'gdrive.accountChanged.title': '已用另一个账号登录',
  'gdrive.accountChanged.description':
    '另一个标签页登录了其他 Google 账号，因此此标签页已停止。重新加载即可用该账号继续。',
  'gdrive.unsaved.title': '你的更改未保存',
  'gdrive.unsaved.description':
    '{name} 中有 {email} 所做、Google 云端硬盘中没有的更改，而现在登录的是 {account}。请先下载这些更改再继续。',
  'gdrive.unsaved.descriptionUnnamed':
    '你打开的文件中有 {email} 所做、Google 云端硬盘中没有的更改，而现在登录的是 {account}。请先下载这些更改再继续。',
  'gdrive.unsaved.continueWithout': '放弃更改并继续',
  'gdrive.framed.title':
    '请在单独的标签页中打开 ERD Editor 的 Google 云端硬盘编辑器',
  'gdrive.framed.description': '它不能在其他页面中运行。',
  'gdrive.framed.link': '在新标签页中打开',
  'gdrive.notConfigured.title': '未配置 Google 云端硬盘集成',
  'gdrive.notConfigured.description':
    '此 ERD Editor 版本没有 Google 登录客户端。',
  'gdrive.unsupportedOrigin.title': '此处无法使用 Google 云端硬盘',
  'gdrive.unsupportedOrigin.description':
    'Google 登录仅在 erd-editor.io 上可用，而这里是预览版。',

  'gdrive.signIn.title': '在 Google 云端硬盘中打开你的 ERD 文件',
  'gdrive.signIn.description':
    'ERD Editor 只打开和保存你用它创建或打开的文件。',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor 的登录服务器繁忙，因此 Google 每次只为你保持一小时的登录。',
  'gdrive.signIn.signIn': '使用 Google 账号登录',
  'gdrive.signIn.continue': '使用 Google 账号继续',
  'gdrive.signIn.waitingTitle': '正在等待 Google 登录…',
  'gdrive.signIn.waitingDescription': '请在 Google 打开的窗口中完成登录。',
  'gdrive.signIn.popupBlocked':
    '浏览器阻止了登录窗口。请允许此网站的弹出式窗口，然后重试。',
  'gdrive.signIn.failed': 'Google 登录未完成。请重试。',
  'gdrive.signIn.gisBlocked':
    '无法加载 Google 登录。请确认没有拦截 accounts.google.com，然后重新加载页面。',

  'gdrive.sidebar.label': '云端硬盘文件',
  'gdrive.sidebar.newFile': '新建文件',
  'gdrive.sidebar.import': '导入',
  'gdrive.sidebar.searchFiles': '搜索文件',
  'gdrive.sidebar.newFileName': '新文件名称',
  'gdrive.sidebar.fileName': '文件名',
  'gdrive.sidebar.fileNamePlaceholder': '文件名',
  'gdrive.sidebar.loadingFiles': '正在加载文件…',
  'gdrive.sidebar.loadFailed': '无法加载你的文件。',

  'gdrive.viewer.noFileOpen': '没有打开的文件',
  'gdrive.viewer.noFileOpenHint': '从侧边栏选择一个文件，或新建一个。',
  'gdrive.viewer.noFilesYet': '还没有文件',
  'gdrive.viewer.noFilesYetHint':
    '新建或导入一个文件。你从 Google 云端硬盘用 ERD Editor 打开的文件也会显示在这里。',
  'gdrive.viewer.waitingForOpener': '正在等待打开此文件的标签页…',
  'gdrive.viewer.notDocument': '此文件不是 ERD Editor 文档',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor 只打开它自己保存的图表。它会保持此文件原样，绝不会覆盖它。',
  'gdrive.viewer.googleNativeHint':
    'Google 文档、表格和文件夹会在 Google 云端硬盘中打开。',
  'gdrive.viewer.trashed': '此文件在回收站中',
  'gdrive.viewer.trashedHint': '请在 Google 云端硬盘中恢复它，以便在这里打开。',
  'gdrive.viewer.tooLarge': '此文件太大',
  'gdrive.viewer.tooLargeHint': 'ERD Editor 可打开最大 {size} MB 的文件。',
  'gdrive.viewer.notFound': '此文件不可用',
  'gdrive.viewer.notFoundHint':
    '它可能已被删除，或者此 Google 账号无法打开它。',
  'gdrive.viewer.waitingToken': '正在等待 Google',
  'gdrive.viewer.waitingTokenHint': '你的 Google 会话恢复后，此文件就会打开。',
  'gdrive.viewer.failed': '无法打开此文件',
  'gdrive.viewer.failedHint':
    'Google 云端硬盘没有响应。请检查网络连接，然后重试。',
  'gdrive.viewer.savingBeforeLeave': '正在离开前保存…',

  'gdrive.status.saved': '已保存到 Google 云端硬盘',
  'gdrive.status.saving': '正在保存…',
  'gdrive.status.failed': '无法保存',
  'gdrive.status.conflict': '已在 Google 云端硬盘中更改',
  'gdrive.status.unconfirmed': '无法确认上次保存',
  'gdrive.status.paused': '已暂停，等待 Google 重新连接',
  'gdrive.status.deleted': '已在 Google 云端硬盘中删除',
  'gdrive.status.readonly': '仅查看',
  'gdrive.status.waitingLeader': '正在等待保存此文件的标签页',
  'gdrive.status.waitingSnapshot': '正在等待打开此文件的标签页',
  'gdrive.status.scopeMissing': '没有 Google 云端硬盘访问权限',

  'gdrive.banner.conflict':
    '此文件已在 Google 云端硬盘中更改，因此已停止保存。你的更改仍在这里。',
  'gdrive.banner.unconfirmed':
    '无法确认上次保存，因此已停止保存。你的更改仍在这里。',
  'gdrive.banner.deleted':
    '此文件已在 Google 云端硬盘中删除或移到回收站，因此已停止保存。',
  'gdrive.banner.readonly':
    '你已无法在 Google 云端硬盘中编辑此文件，因此已停止保存。你的更改仍在这里。',
  'gdrive.banner.checkDrive': '检查云端硬盘',
  'gdrive.banner.reloadFromDrive': '从云端硬盘重新加载',
  'gdrive.banner.leaderNotResponding': '保存此文件的标签页没有响应。',
  'gdrive.banner.openerNotResponding': '打开此文件的标签页没有响应。',
  'gdrive.banner.takeOver': '接管保存',
  'gdrive.banner.openAndTakeOver': '从云端硬盘打开并接管',
  'gdrive.banner.popupBlocked':
    '浏览器阻止了 Google 窗口。请允许此网站的弹出式窗口，然后重新连接。',
  'gdrive.banner.reconnectFailed': 'Google 未能重新连接。请重试。',
  'gdrive.banner.sessionEnded': '你的 Google 会话已结束，保存已暂停。',
  'gdrive.banner.sessionEndsSoon': '你的 Google 会话即将结束。',
  'gdrive.banner.reconnect': '重新连接 Google',

  'gdrive.leave.title': '你最近的更改未保存',
  'gdrive.leave.description':
    'ERD Editor 无法将它们保存到 Google 云端硬盘。请下载以保留副本，或者离开并放弃这些更改。',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor 无法将它们保存到 Google 云端硬盘。请下载以保留副本，或者退出登录并放弃这些更改。',
  'gdrive.leave.stay': '留下',
  'gdrive.leave.leaveAnyway': '仍然离开',
  'gdrive.leave.signOutAnyway': '仍然退出登录',

  'gdrive.create.title': '在 Google 云端硬盘中新建文件',
  'gdrive.create.inAppFolder': '位置：ERD Editor 文件夹',
  'gdrive.create.inFolderPending': '位置：文件夹…',
  'gdrive.create.inHiddenFolder': '位置：ERD Editor 无法查看的文件夹',
  'gdrive.create.inFolder': '位置：文件夹“{name}”',
  'gdrive.create.untitled': '无标题',
  'gdrive.create.savedAs': '另存为 {name}',
  'gdrive.create.folderRefused':
    'ERD Editor 无法在此文件夹中创建文件。改为在 ERD Editor 文件夹中创建吗？',
  'gdrive.create.failed': '无法创建文件。请重试。',
  'gdrive.create.createInAppFolder': '在 ERD Editor 文件夹中创建',
  'gdrive.create.create': '创建',

  'gdrive.import.imported': {
    other: '已将 {count} 个文件导入 Google 云端硬盘',
  },
  'gdrive.import.skippedBackups': {
    other: '已跳过 {count} 个备份：备份只保留在本地应用中',
  },
  'gdrive.import.uploadsFailed': { other: '{count} 个上传失败' },

  'gdrive.notice.unreadableState':
    'ERD Editor 无法读取 Google 云端硬盘发送的链接',
  'gdrive.notice.renameFailed': '无法重命名文件',
  'gdrive.notice.createFailed': '无法创建文件',
  'gdrive.notice.checkFailed': '无法连接 Google 云端硬盘。请重试。',
  'gdrive.notice.reloadFailed': '无法从 Google 云端硬盘重新加载。请重试。',
  'gdrive.notice.reloadTrashed':
    '无法重新加载：该文件在 Google 云端硬盘的回收站中',
  'gdrive.notice.reloadTooLarge':
    '无法重新加载：Google 云端硬盘中的文件超过 {size} MB',
  'gdrive.notice.reloadNotDocument':
    '无法重新加载：Google 云端硬盘中的文件已不再是 ERD Editor 文档',
  'gdrive.notice.signOutUnconfirmed':
    '已在此处退出登录。ERD Editor 的服务器未确认，因此此浏览器会在下次联网时完成退出',
  'gdrive.notice.signOutNotRevoked':
    '已在此处退出登录，但 Google 未确认已移除 ERD Editor 的访问权限，因此在你于 myaccount.google.com/permissions 移除之前，你的其他设备可能仍保持登录',
} satisfies Messages;
