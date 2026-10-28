import type { Messages } from '@/i18n/translate';

/** The app's own text in Japanese, key for key as English writes it. */
export const jaJP = {
  'common.cancel': 'キャンセル',
  'common.close': '閉じる',
  'common.dismiss': '閉じる',
  'common.tryAgain': '再試行',
  'common.reload': '再読み込み',
  'common.loading': '読み込み中…',
  'common.search': '検索',
  'common.rename': '名前を変更',
  'common.importFiles': 'ファイルをインポート',
  'common.signOut': 'ログアウト',
  'common.downloadMyChanges': '変更をダウンロード',
  'common.edited': '編集: {time}',
  'common.system': 'システム',
  'common.displayLanguage': '表示言語',
  'common.theme': 'テーマ',
  'common.light': 'ライト',
  'common.dark': 'ダーク',
  'common.host': 'ホスト',
  'common.guest': 'ゲスト',
  'common.you': '(自分)',
  'common.participants': '参加者',
  'common.yourNickname': '自分のニックネーム',
  'common.privacy': 'プライバシー',
  'common.terms': '利用規約',
  'common.editingGuide': '編集ガイド',
  'common.openSidebar': 'サイドバーを開く',
  'common.closeSidebar': 'サイドバーを閉じる',

  'time.justNow': 'たった今',
  'time.today': '今日',
  'time.yesterday': '昨日',
  'time.previous7Days': '過去 7 日間',
  'time.previous30Days': '過去 30 日間',

  'sidebar.schemas': 'スキーマ',
  'sidebar.newSchema': '新しいスキーマ',
  'sidebar.importAndExport': 'インポートとエクスポート',
  'sidebar.exportBackup': 'バックアップをエクスポート',
  'sidebar.searchSchemas': 'スキーマを検索',
  'sidebar.newSchemaName': '新しいスキーマの名前',
  'sidebar.schemaName': 'スキーマ名',
  'sidebar.schemaNamePlaceholder': 'スキーマ名',
  'sidebar.duplicate': '複製',
  'sidebar.moveToTrash': 'ゴミ箱に移動',
  'sidebar.actionsFor': '{name} の操作',
  'sidebar.noResults': '結果なし',

  'trash.button': 'ゴミ箱 ({count})',
  'trash.title': 'ゴミ箱',
  'trash.description': {
    other: 'ゴミ箱のスキーマは {count} 日後に完全に削除されます。',
  },
  'trash.listLabel': 'ゴミ箱内のスキーマ',
  'trash.deleted': '削除: {time}',
  'trash.deletesToday': '今日中に削除',
  'trash.deletesTomorrow': '明日削除',
  'trash.deletesIn': { other: '{count} 日後に削除' },
  'trash.restore': '復元',
  'trash.deletePermanently': '完全に削除',
  'trash.cannotBeUndone': 'この操作は元に戻せません。',
  'trash.delete': '削除',
  'trash.empty': 'ゴミ箱は空です。',
  'trash.emptyTrash': 'ゴミ箱を空にする',
  'trash.emptyConfirm': {
    other:
      '{count} 件のスキーマを完全に削除しますか？この操作は元に戻せません。',
  },

  'collaboration.for': '{name} の共同編集',
  'collaboration.guestsConnected': { other: 'ゲスト {count} 人が接続中' },
  'collaboration.title': '共同編集',
  'collaboration.experiment': '実験的',
  'collaboration.description':
    'ピア同士は WebRTC で直接つながり、エンドツーエンド暗号化でメッセージをやり取りします。',
  'collaboration.nickname': 'ニックネーム',
  'collaboration.link': 'リンク',
  'collaboration.noOneJoined': 'まだ誰も参加していません。',
  'collaboration.startSession': 'セッションを開始',
  'collaboration.stopSession': 'セッションを終了',

  'viewer.noSchemaOpen': '開いているスキーマはありません',
  'viewer.emptyHint':
    'サイドバーから選ぶか、ここで新しく始めてください。ファイルをどこにでもドロップしてインポートすることもできます。',
  'viewer.openSample': 'サンプルを開く',
  'viewer.sampleName': '書店サンプル',

  'drop.title': 'ドロップしてインポート',
  'drop.formats':
    'バックアップ、.erd・.vuerd・.json ドキュメント、SQL、DBML、AML、GraphQL',
  'drop.importing': 'ファイルをインポート中…',
  'drop.importingHint': 'このインポートが終わったら追加でドロップできます',

  'import.imported': { other: '{count} 件のスキーマをインポートしました' },
  'import.skippedInvalidFiles': {
    other: '無効なファイル {count} 件をスキップしました',
  },
  'import.skippedInvalidSchemas': {
    other: '無効なスキーマ {count} 件をスキップしました',
  },
  'import.skippedOversized': {
    other: '{size} MB を超えるファイル {count} 件をスキップしました',
  },
  'import.nothing': 'インポートするものがありません',
  'import.failed': 'インポートに失敗しました',
  'import.exportFailed': 'エクスポートに失敗しました',

  'update.available': 'ERD Editor の新しいバージョンがあります。',
  'update.updatedElsewhere':
    '別のタブでアプリが更新されました。再読み込みして完了してください。',

  'embed.title': '図を埋め込む',
  'embed.documentUrl': 'ドキュメントの URL',
  'embed.fetchUrl': '読み込み元',
  'embed.nameView': '名前の表示',
  'embed.nameAsSaved': '保存されたとおり',
  'embed.physicalNames': '物理名',
  'embed.logicalNames': '論理名',
  'embed.bothNames': '論理名と物理名',
  'embed.accentColor': 'アクセントカラー',
  'embed.grayColor': 'グレーカラー',
  'embed.minimap': 'ミニマップ',
  'embed.controls': 'コントロール',
  'embed.height': '高さ',
  'embed.preview': 'プレビュー',
  'embed.embedUrl': '埋め込み URL',
  'embed.embedCode': '埋め込みコード',
  'embed.copy': 'コピー',
  'embed.copied': 'コピーしました',

  'live.invalidToken': '共有リンクが無効です。',
  'live.hostNotFound': 'ホストが見つかりません。',
  'live.refresh': '再読み込み',
  'live.hostStopped': 'ホストがセッションを終了しました。',
  'live.somethingWentWrong': '問題が発生しました。',
  'live.lookingForHost': 'ホストを探しています…',
  'live.waitingForHost': 'ホストを待っています…',
  'live.session': 'ライブセッション',
  'live.inSession': { other: '{count} 人が参加中' },
  'live.showParticipants': '参加者を表示',
  'live.hideParticipants': '参加者を隠す',

  'gdrive.checkingSignIn': 'Google ログインを確認しています…',
  'gdrive.anotherAccount': '別のアカウント',
  'gdrive.offline.title': 'オフラインです',
  'gdrive.offline.description':
    'オンラインに戻ると ERD Editor が Google ログインを確認します。',
  'gdrive.scopeMissing.title':
    'Google ドライブへのアクセスが許可されませんでした',
  'gdrive.scopeMissing.description':
    'ERD Editor は、このアプリで作成または開いたファイルへのアクセスが必要です。もう一度ログインして Google ドライブへのアクセスを許可してください。',
  'gdrive.mismatch.title':
    'Google ドライブからのリクエストは別のアカウント宛てです',
  'gdrive.mismatch.description':
    '{email} でログインしています。Google ドライブが使用したアカウントに切り替えるか、このアカウントのファイルで続けてください。',
  'gdrive.mismatch.choose':
    'ERD Editor はそのアカウントを事前に選択できませんでした。Google でアカウントの選択を求められたら、そのアカウントを選んでください。',
  'gdrive.mismatch.switchAccount': 'アカウントを切り替え',
  'gdrive.mismatch.showMyFiles': '自分のファイルを表示',
  'gdrive.accountChanged.title': '別のアカウントでログインしました',
  'gdrive.accountChanged.description':
    '別のタブで異なる Google アカウントにログインしたため、このタブは停止しました。そのアカウントで続けるには再読み込みしてください。',
  'gdrive.unsaved.title': '変更が保存されていません',
  'gdrive.unsaved.description':
    '{name} には Google ドライブにない {email} の変更があり、現在は {account} でログインしています。続ける前にダウンロードしてください。',
  'gdrive.unsaved.descriptionUnnamed':
    '開いていたファイルには Google ドライブにない {email} の変更があり、現在は {account} でログインしています。続ける前にダウンロードしてください。',
  'gdrive.unsaved.continueWithout': '変更を破棄して続ける',
  'gdrive.framed.title':
    'ERD Editor の Google ドライブ エディタを別のタブで開いてください',
  'gdrive.framed.description': '他のページの中では動作しません。',
  'gdrive.framed.link': '新しいタブで開く',
  'gdrive.notConfigured.title': 'Google ドライブ連携が設定されていません',
  'gdrive.notConfigured.description':
    'この ERD Editor のビルドには Google ログインのクライアントがありません。',
  'gdrive.unsupportedOrigin.title': 'ここでは Google ドライブを使えません',
  'gdrive.unsupportedOrigin.description':
    'Google ログインは erd-editor.io でのみ動作します。このサイトはプレビュー版です。',

  'gdrive.signIn.title': 'Google ドライブの ERD ファイルを開く',
  'gdrive.signIn.description':
    'ERD Editor は、このアプリで作成または開いたファイルだけを開いて保存します。',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor のログインサーバーが混み合っているため、Google へのログインは 1 回につき 1 時間有効です。',
  'gdrive.signIn.signIn': 'Google でログイン',
  'gdrive.signIn.continue': 'Google で続行',
  'gdrive.signIn.waitingTitle': 'Google ログインを待っています…',
  'gdrive.signIn.waitingDescription':
    'Google が開いたウィンドウでログインを完了してください。',
  'gdrive.signIn.popupBlocked':
    'ブラウザがログインウィンドウをブロックしました。このサイトのポップアップを許可してから、もう一度お試しください。',
  'gdrive.signIn.failed':
    'Google ログインが完了しませんでした。もう一度お試しください。',
  'gdrive.signIn.gisBlocked':
    'Google ログインを読み込めませんでした。accounts.google.com がブロックされていないか確認してから、ページを再読み込みしてください。',

  'gdrive.sidebar.label': 'ドライブのファイル',
  'gdrive.sidebar.newFile': '新しいファイル',
  'gdrive.sidebar.import': 'インポート',
  'gdrive.sidebar.searchFiles': 'ファイルを検索',
  'gdrive.sidebar.newFileName': '新しいファイルの名前',
  'gdrive.sidebar.fileName': 'ファイル名',
  'gdrive.sidebar.fileNamePlaceholder': 'ファイル名',
  'gdrive.sidebar.loadingFiles': 'ファイルを読み込み中…',
  'gdrive.sidebar.loadFailed': 'ファイルを読み込めませんでした。',

  'gdrive.viewer.noFileOpen': '開いているファイルはありません',
  'gdrive.viewer.noFileOpenHint':
    'サイドバーからファイルを選ぶか、新しく始めてください。',
  'gdrive.viewer.noFilesYet': 'まだファイルがありません',
  'gdrive.viewer.noFilesYetHint':
    'ファイルを作成するかインポートしてください。Google ドライブから ERD Editor で開いたファイルもここに表示されます。',
  'gdrive.viewer.waitingForOpener': 'このファイルを開いたタブを待っています…',
  'gdrive.viewer.notDocument': 'ERD Editor のドキュメントではありません',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor は自身で保存した図だけを開きます。このファイルはそのままにし、上書きしません。',
  'gdrive.viewer.googleNativeHint':
    'Google ドキュメント、スプレッドシート、フォルダは Google ドライブで開きます。',
  'gdrive.viewer.trashed': 'このファイルはゴミ箱にあります',
  'gdrive.viewer.trashedHint':
    'ここで開くには Google ドライブで復元してください。',
  'gdrive.viewer.tooLarge': 'ファイルが大きすぎます',
  'gdrive.viewer.tooLargeHint':
    'ERD Editor が開けるのは {size} MB までのファイルです。',
  'gdrive.viewer.notFound': 'このファイルは利用できません',
  'gdrive.viewer.notFoundHint':
    '削除されたか、この Google アカウントでは開けない可能性があります。',
  'gdrive.viewer.waitingToken': 'Google を待っています',
  'gdrive.viewer.waitingTokenHint':
    'Google セッションが回復すると、このファイルが開きます。',
  'gdrive.viewer.failed': 'このファイルを開けませんでした',
  'gdrive.viewer.failedHint':
    'Google ドライブから応答がありませんでした。接続を確認して、もう一度お試しください。',
  'gdrive.viewer.savingBeforeLeave': '移動する前に保存しています…',

  'gdrive.status.saved': 'Google ドライブに保存済み',
  'gdrive.status.saving': '保存中…',
  'gdrive.status.failed': '保存できませんでした',
  'gdrive.status.conflict': 'Google ドライブで変更されました',
  'gdrive.status.unconfirmed': '最後の保存を確認できませんでした',
  'gdrive.status.paused': 'Google に再接続するまで一時停止中',
  'gdrive.status.deleted': 'Google ドライブで削除されました',
  'gdrive.status.readonly': '閲覧のみ',
  'gdrive.status.waitingLeader': 'このファイルを保存するタブを待っています',
  'gdrive.status.waitingSnapshot': 'このファイルを開いたタブを待っています',
  'gdrive.status.scopeMissing': 'Google ドライブへのアクセス権がありません',

  'gdrive.banner.conflict':
    'このファイルが Google ドライブで変更されたため、保存を停止しました。変更はここに残っています。',
  'gdrive.banner.unconfirmed':
    '最後の保存を確認できなかったため、保存を停止しました。変更はここに残っています。',
  'gdrive.banner.deleted':
    'このファイルが Google ドライブで削除またはゴミ箱に移動されたため、保存を停止しました。',
  'gdrive.banner.readonly':
    'Google ドライブでこのファイルを編集できなくなったため、保存を停止しました。変更はここに残っています。',
  'gdrive.banner.checkDrive': 'ドライブを確認',
  'gdrive.banner.reloadFromDrive': 'ドライブから再読み込み',
  'gdrive.banner.leaderNotResponding':
    'このファイルを保存するタブが応答していません。',
  'gdrive.banner.openerNotResponding':
    'このファイルを開いたタブが応答していません。',
  'gdrive.banner.takeOver': '保存を引き継ぐ',
  'gdrive.banner.openAndTakeOver': 'ドライブから開いて引き継ぐ',
  'gdrive.banner.popupBlocked':
    'ブラウザが Google のウィンドウをブロックしました。このサイトのポップアップを許可してから再接続してください。',
  'gdrive.banner.reconnectFailed':
    'Google に再接続できませんでした。もう一度お試しください。',
  'gdrive.banner.sessionEnded':
    'Google セッションが終了したため、保存を一時停止しています。',
  'gdrive.banner.sessionEndsSoon': 'Google セッションがまもなく終了します。',
  'gdrive.banner.reconnect': 'Google に再接続',

  'gdrive.leave.title': '最新の変更が保存されていません',
  'gdrive.leave.description':
    'ERD Editor は Google ドライブに保存できませんでした。ダウンロードしてコピーを残すか、移動して変更を破棄してください。',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor は Google ドライブに保存できませんでした。ダウンロードしてコピーを残すか、ログアウトして変更を破棄してください。',
  'gdrive.leave.stay': 'とどまる',
  'gdrive.leave.leaveAnyway': 'このまま移動',
  'gdrive.leave.signOutAnyway': 'このままログアウト',

  'gdrive.create.title': 'Google ドライブに新しいファイル',
  'gdrive.create.inAppFolder': '保存先: ERD Editor フォルダ',
  'gdrive.create.inFolderPending': '保存先: フォルダ…',
  'gdrive.create.inHiddenFolder': '保存先: ERD Editor から見えないフォルダ',
  'gdrive.create.inFolder': '保存先: フォルダ「{name}」',
  'gdrive.create.untitled': '無題',
  'gdrive.create.savedAs': '{name} として保存されます',
  'gdrive.create.folderRefused':
    'ERD Editor はこのフォルダにファイルを作成できません。代わりに ERD Editor フォルダに作成しますか？',
  'gdrive.create.failed':
    'ファイルを作成できませんでした。もう一度お試しください。',
  'gdrive.create.createInAppFolder': 'ERD Editor フォルダに作成',
  'gdrive.create.create': '作成',

  'gdrive.import.imported': {
    other: '{count} 件のファイルを Google ドライブにインポートしました',
  },
  'gdrive.import.skippedBackups': {
    other:
      'バックアップ {count} 件をスキップしました: バックアップはローカルアプリに残ります',
  },
  'gdrive.import.uploadsFailed': {
    other: '{count} 件のアップロードに失敗しました',
  },

  'gdrive.notice.unreadableState':
    'Google ドライブから送られたリンクを ERD Editor が読み取れませんでした',
  'gdrive.notice.renameFailed': 'ファイル名を変更できませんでした',
  'gdrive.notice.createFailed': 'ファイルを作成できませんでした',
  'gdrive.notice.checkFailed':
    'Google ドライブに接続できませんでした。もう一度お試しください。',
  'gdrive.notice.reloadFailed':
    'Google ドライブから再読み込みできませんでした。もう一度お試しください。',
  'gdrive.notice.reloadTrashed':
    '再読み込みできません: ファイルは Google ドライブのゴミ箱にあります',
  'gdrive.notice.reloadTooLarge':
    '再読み込みできません: Google ドライブのファイルが {size} MB を超えています',
  'gdrive.notice.reloadNotDocument':
    '再読み込みできません: Google ドライブのファイルはもう ERD Editor のドキュメントではありません',
  'gdrive.notice.signOutUnconfirmed':
    'ここではログアウトしました。ERD Editor のサーバーで確認できなかったため、このブラウザは次に接続したときにログアウトを完了します',
  'gdrive.notice.signOutNotRevoked':
    'ここではログアウトしましたが、Google で ERD Editor のアクセス権の削除を確認できませんでした。myaccount.google.com/permissions でアクセス権を削除するまで、他のデバイスではログインしたままになることがあります',
} satisfies Messages;
