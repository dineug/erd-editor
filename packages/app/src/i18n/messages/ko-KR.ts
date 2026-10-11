import type { Messages } from '@/i18n/translate';

/** The app's own text in Korean, key for key as English writes it. */
export const koKR = {
  'common.cancel': '취소',
  'common.close': '닫기',
  'common.dismiss': '닫기',
  'common.tryAgain': '다시 시도',
  'common.reload': '새로고침',
  'common.loading': '불러오는 중…',
  'common.search': '검색',
  'common.rename': '이름 바꾸기',
  'common.importFiles': '파일 가져오기',
  'common.signOut': '로그아웃',
  'common.downloadMyChanges': '내 변경 사항 다운로드',
  'common.edited': '{time} 편집함',
  'common.system': '시스템',
  'common.displayLanguage': '표시 언어',
  'common.theme': '테마',
  'common.light': '라이트',
  'common.dark': '다크',
  'common.host': '호스트',
  'common.guest': '게스트',
  'common.you': '(나)',
  'common.participants': '참가자',
  'common.yourNickname': '내 닉네임',
  'common.privacy': '개인정보처리방침',
  'common.terms': '이용약관',
  'common.editingGuide': '편집 가이드',
  'common.openSidebar': '사이드바 열기',
  'common.closeSidebar': '사이드바 닫기',

  'time.justNow': '방금',
  'time.today': '오늘',
  'time.yesterday': '어제',
  'time.previous7Days': '지난 7일',
  'time.previous30Days': '지난 30일',

  'sidebar.schemas': '스키마',
  'sidebar.newSchema': '새 스키마',
  'sidebar.importAndExport': '가져오기 및 내보내기',
  'sidebar.exportBackup': '백업 내보내기',
  'sidebar.searchSchemas': '스키마 검색',
  'sidebar.newSchemaName': '새 스키마 이름',
  'sidebar.schemaName': '스키마 이름',
  'sidebar.schemaNamePlaceholder': '스키마 이름',
  'sidebar.duplicate': '복제',
  'sidebar.moveToTrash': '휴지통으로 이동',
  'sidebar.actionsFor': '{name} 작업',
  'sidebar.noResults': '결과 없음',

  'trash.button': '휴지통 ({count})',
  'trash.title': '휴지통',
  'trash.description': {
    other: '휴지통의 스키마는 {count}일이 지나면 영구 삭제됩니다.',
  },
  'trash.listLabel': '휴지통의 스키마',
  'trash.deleted': '{time} 삭제함',
  'trash.deletesToday': '오늘 삭제됨',
  'trash.deletesTomorrow': '내일 삭제됨',
  'trash.deletesIn': { other: '{count}일 후 삭제됨' },
  'trash.restore': '복원',
  'trash.deletePermanently': '영구 삭제',
  'trash.cannotBeUndone': '되돌릴 수 없습니다.',
  'trash.delete': '삭제',
  'trash.empty': '휴지통이 비어 있습니다.',
  'trash.emptyTrash': '휴지통 비우기',
  'trash.emptyConfirm': {
    other: '스키마 {count}개를 영구 삭제할까요? 되돌릴 수 없습니다.',
  },

  'collaboration.for': '{name} 공동 편집',
  'collaboration.guestsConnected': { other: '게스트 {count}명 연결됨' },
  'collaboration.title': '공동 편집',
  'collaboration.experiment': '실험 기능',
  'collaboration.description':
    '참가자끼리 WebRTC로 직접 연결하고 종단 간 암호화로 메시지를 주고받습니다.',
  'collaboration.nickname': '닉네임',
  'collaboration.link': '링크',
  'collaboration.noOneJoined': '아직 아무도 참가하지 않았습니다.',
  'collaboration.startSession': '세션 시작',
  'collaboration.stopSession': '세션 종료',

  'viewer.noSchemaOpen': '열린 스키마 없음',
  'viewer.emptyHint':
    '사이드바에서 고르거나 여기서 새로 시작하세요. 파일을 아무 곳에나 끌어다 놓아 가져올 수도 있습니다.',
  'viewer.openSample': '샘플 열기',
  'viewer.sampleName': '서점 샘플',

  'drop.title': '놓아서 가져오기',
  'drop.formats': '백업, .erd·.vuerd·.json 문서, SQL, DBML, AML, GraphQL',
  'drop.importing': '파일 가져오는 중…',
  'drop.importingHint': '이 가져오기가 끝나면 더 놓을 수 있습니다',

  'import.imported': { other: '스키마 {count}개 가져옴' },
  'import.skippedInvalidFiles': { other: '잘못된 파일 {count}개 건너뜀' },
  'import.skippedInvalidSchemas': { other: '잘못된 스키마 {count}개 건너뜀' },
  'import.skippedOversized': {
    other: '{size} MB를 넘는 파일 {count}개 건너뜀',
  },
  'import.nothing': '가져올 항목 없음',
  'import.failed': '가져오기 실패',
  'import.exportFailed': '내보내기 실패',

  'update.available': 'ERD Editor 새 버전이 있습니다.',
  'update.updatedElsewhere':
    '다른 탭에서 앱이 업데이트되었습니다. 새로고침하면 마무리됩니다.',

  'live.invalidToken': '공유 토큰이 올바르지 않습니다.',
  'live.hostNotFound': '호스트를 찾을 수 없습니다.',
  'live.refresh': '새로고침',
  'live.hostStopped': '호스트가 세션을 종료했습니다.',
  'live.somethingWentWrong': '문제가 발생했습니다.',
  'live.lookingForHost': '호스트를 찾는 중...',
  'live.waitingForHost': '호스트를 기다리는 중...',
  'live.session': '라이브 세션',
  'live.inSession': { other: '세션에 {count}명' },
  'live.showParticipants': '참가자 보기',
  'live.hideParticipants': '참가자 숨기기',

  'gdrive.checkingSignIn': 'Google 로그인 확인 중…',
  'gdrive.anotherAccount': '다른 계정',
  'gdrive.offline.title': '오프라인 상태입니다',
  'gdrive.offline.description':
    '다시 온라인이 되면 ERD Editor가 Google 로그인을 확인합니다.',
  'gdrive.scopeMissing.title': 'Google 드라이브 접근이 허용되지 않았습니다',
  'gdrive.scopeMissing.description':
    'ERD Editor는 이 앱으로 만들거나 연 파일에 접근해야 합니다. 다시 로그인하고 Google 드라이브 접근을 허용하세요.',
  'gdrive.mismatch.title': 'Google 드라이브가 다른 계정용으로 보낸 파일입니다',
  'gdrive.mismatch.description':
    '지금 {email} 계정으로 로그인되어 있습니다. Google 드라이브가 이 파일을 연 계정으로 전환하거나, 이 계정의 파일로 계속하세요.',
  'gdrive.mismatch.choose':
    'ERD Editor가 그 계정을 미리 선택하지 못했으니 Google이 물으면 직접 고르세요.',
  'gdrive.mismatch.switchAccount': '계정 전환',
  'gdrive.mismatch.showMyFiles': '내 파일 보기',
  'gdrive.accountChanged.title': '다른 계정으로 로그인됨',
  'gdrive.accountChanged.description':
    '다른 탭에서 다른 Google 계정으로 로그인해서 이 탭은 멈췄습니다. 그 계정으로 계속하려면 새로고침하세요.',
  'gdrive.unsaved.title': '변경 사항이 저장되지 않았습니다',
  'gdrive.unsaved.description':
    '{name}에 Google 드라이브에 없는 {email}의 변경 사항이 있고, 지금은 {account} 계정으로 로그인되어 있습니다. 계속하기 전에 다운로드하세요.',
  'gdrive.unsaved.descriptionUnnamed':
    '열려 있던 파일에 Google 드라이브에 없는 {email}의 변경 사항이 있고, 지금은 {account} 계정으로 로그인되어 있습니다. 계속하기 전에 다운로드하세요.',
  'gdrive.unsaved.continueWithout': '버리고 계속하기',
  'gdrive.framed.title':
    'ERD Editor의 Google 드라이브 편집기를 별도 탭에서 여세요',
  'gdrive.framed.description': '다른 페이지 안에서는 실행되지 않습니다.',
  'gdrive.framed.link': '새 탭에서 열기',
  'gdrive.notConfigured.title': 'Google 드라이브 연동이 설정되지 않았습니다',
  'gdrive.notConfigured.description':
    '이 ERD Editor 빌드에는 Google 로그인 클라이언트가 없습니다.',
  'gdrive.unsupportedOrigin.title': '여기서는 Google 드라이브를 쓸 수 없습니다',
  'gdrive.unsupportedOrigin.description':
    'Google 로그인은 erd-editor.io에서만 동작하며, 여기는 미리보기입니다.',

  'gdrive.signIn.title': 'Google 드라이브의 ERD 파일 열기',
  'gdrive.signIn.description':
    'ERD Editor는 이 앱으로 만들거나 연 파일만 열고 저장합니다.',
  'gdrive.signIn.fallbackDescription':
    'ERD Editor 로그인 서버가 바빠서 Google이 한 번에 한 시간씩 로그인합니다.',
  'gdrive.signIn.signIn': 'Google 계정으로 로그인',
  'gdrive.signIn.continue': 'Google 계정으로 계속하기',
  'gdrive.signIn.waitingTitle': 'Google 로그인을 기다리는 중…',
  'gdrive.signIn.waitingDescription': 'Google이 연 창에서 로그인을 마치세요.',
  'gdrive.signIn.popupBlocked':
    '브라우저가 로그인 창을 막았습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.',
  'gdrive.signIn.failed': 'Google 로그인이 끝나지 않았습니다. 다시 시도하세요.',
  'gdrive.signIn.gisBlocked':
    'Google 로그인을 불러오지 못했습니다. accounts.google.com을 막는 것이 없는지 확인한 뒤 페이지를 새로고침하세요.',

  'gdrive.sidebar.label': '드라이브 파일',
  'gdrive.sidebar.newFile': '새 파일',
  'gdrive.sidebar.import': '가져오기',
  'gdrive.sidebar.searchFiles': '파일 검색',
  'gdrive.sidebar.newFileName': '새 파일 이름',
  'gdrive.sidebar.fileName': '파일 이름',
  'gdrive.sidebar.fileNamePlaceholder': '파일 이름',
  'gdrive.sidebar.loadingFiles': '파일 불러오는 중…',
  'gdrive.sidebar.loadFailed': '파일을 불러오지 못했습니다.',

  'gdrive.viewer.noFileOpen': '열린 파일 없음',
  'gdrive.viewer.noFileOpenHint':
    '사이드바에서 파일을 고르거나 새로 시작하세요.',
  'gdrive.viewer.noFilesYet': '아직 파일 없음',
  'gdrive.viewer.noFilesYetHint':
    '파일을 만들거나 가져오세요. Google 드라이브에서 ERD Editor로 연 파일도 여기에 나타납니다.',
  'gdrive.viewer.waitingForOpener': '이 파일을 연 탭을 기다리는 중…',
  'gdrive.viewer.notDocument': 'ERD Editor 문서가 아닙니다',
  'gdrive.viewer.notDocumentHint':
    'ERD Editor는 직접 저장한 다이어그램만 엽니다. 이 파일은 그대로 두고 덮어쓰지 않습니다.',
  'gdrive.viewer.googleNativeHint':
    'Google 문서, 스프레드시트, 폴더는 Google 드라이브에서 열립니다.',
  'gdrive.viewer.trashed': '휴지통에 있는 파일입니다',
  'gdrive.viewer.trashedHint': '여기서 열려면 Google 드라이브에서 복원하세요.',
  'gdrive.viewer.tooLarge': '파일이 너무 큽니다',
  'gdrive.viewer.tooLargeHint': 'ERD Editor는 {size} MB까지의 파일을 엽니다.',
  'gdrive.viewer.notFound': '이 파일을 열 수 없습니다',
  'gdrive.viewer.notFoundHint':
    '삭제되었거나 이 Google 계정으로는 열 수 없는 파일일 수 있습니다.',
  'gdrive.viewer.waitingToken': 'Google을 기다리는 중',
  'gdrive.viewer.waitingTokenHint':
    'Google 세션이 돌아오면 이 파일이 열립니다.',
  'gdrive.viewer.failed': '이 파일을 열지 못했습니다',
  'gdrive.viewer.failedHint':
    'Google 드라이브가 응답하지 않았습니다. 연결을 확인하고 다시 시도하세요.',
  'gdrive.viewer.savingBeforeLeave': '나가기 전에 저장하는 중…',

  'gdrive.status.saved': 'Google 드라이브에 저장됨',
  'gdrive.status.saving': '저장 중…',
  'gdrive.status.failed': '저장하지 못함',
  'gdrive.status.conflict': 'Google 드라이브에서 변경됨',
  'gdrive.status.unconfirmed': '마지막 저장을 확인하지 못함',
  'gdrive.status.paused': 'Google이 다시 연결될 때까지 일시 중지됨',
  'gdrive.status.deleted': 'Google 드라이브에서 삭제됨',
  'gdrive.status.readonly': '보기 전용',
  'gdrive.status.waitingLeader': '이 파일을 저장하는 탭을 기다리는 중',
  'gdrive.status.waitingSnapshot': '이 파일을 연 탭을 기다리는 중',
  'gdrive.status.scopeMissing': 'Google 드라이브 접근 권한 없음',

  'gdrive.banner.conflict':
    'Google 드라이브에서 이 파일이 바뀌어 저장을 멈췄습니다. 변경 사항은 그대로 있습니다.',
  'gdrive.banner.unconfirmed':
    '마지막 저장을 확인하지 못해 저장을 멈췄습니다. 변경 사항은 그대로 있습니다.',
  'gdrive.banner.deleted':
    'Google 드라이브에서 이 파일이 삭제되었거나 휴지통으로 옮겨져 저장을 멈췄습니다.',
  'gdrive.banner.readonly':
    '이제 Google 드라이브에서 이 파일을 편집할 수 없어 저장을 멈췄습니다. 변경 사항은 그대로 있습니다.',
  'gdrive.banner.checkDrive': '드라이브 확인',
  'gdrive.banner.reloadFromDrive': '드라이브에서 다시 불러오기',
  'gdrive.banner.leaderNotResponding':
    '이 파일을 저장하는 탭이 응답하지 않습니다.',
  'gdrive.banner.openerNotResponding': '이 파일을 연 탭이 응답하지 않습니다.',
  'gdrive.banner.takeOver': '저장 넘겨받기',
  'gdrive.banner.openAndTakeOver': '드라이브에서 열고 넘겨받기',
  'gdrive.banner.popupBlocked':
    '브라우저가 Google 창을 막았습니다. 이 사이트의 팝업을 허용한 뒤 다시 연결하세요.',
  'gdrive.banner.reconnectFailed':
    'Google에 다시 연결하지 못했습니다. 다시 시도하세요.',
  'gdrive.banner.sessionEnded':
    'Google 세션이 끝나 저장이 일시 중지되었습니다.',
  'gdrive.banner.sessionEndsSoon': 'Google 세션이 곧 끝납니다.',
  'gdrive.banner.reconnect': 'Google 다시 연결',

  'gdrive.leave.title': '최근 변경 사항이 저장되지 않았습니다',
  'gdrive.leave.description':
    'ERD Editor가 Google 드라이브에 저장하지 못했습니다. 다운로드해서 사본을 남기거나, 나가서 버리세요.',
  'gdrive.leave.descriptionSignOut':
    'ERD Editor가 Google 드라이브에 저장하지 못했습니다. 다운로드해서 사본을 남기거나, 로그아웃해서 버리세요.',
  'gdrive.leave.stay': '머무르기',
  'gdrive.leave.leaveAnyway': '그래도 나가기',
  'gdrive.leave.signOutAnyway': '그래도 로그아웃',

  'gdrive.create.title': 'Google 드라이브에 새 파일',
  'gdrive.create.inAppFolder': '위치: ERD Editor 폴더',
  'gdrive.create.inFolderPending': '위치: 폴더…',
  'gdrive.create.inHiddenFolder': '위치: ERD Editor가 볼 수 없는 폴더',
  'gdrive.create.inFolder': '위치: “{name}” 폴더',
  'gdrive.create.untitled': '제목 없음',
  'gdrive.create.savedAs': '{name}(으)로 저장됨',
  'gdrive.create.folderRefused':
    'ERD Editor가 이 폴더에는 파일을 만들 수 없습니다. 대신 ERD Editor 폴더에 만들까요?',
  'gdrive.create.failed': '파일을 만들지 못했습니다. 다시 시도하세요.',
  'gdrive.create.createInAppFolder': 'ERD Editor 폴더에 만들기',
  'gdrive.create.create': '만들기',

  'gdrive.import.imported': {
    other: 'Google 드라이브로 파일 {count}개 가져옴',
  },
  'gdrive.import.skippedBackups': {
    other: '백업 {count}개 건너뜀: 백업은 로컬 앱에만 둡니다',
  },
  'gdrive.import.uploadsFailed': { other: '업로드 {count}개 실패' },

  'gdrive.notice.unreadableState':
    'Google 드라이브가 보낸 링크를 ERD Editor가 읽지 못했습니다',
  'gdrive.notice.renameFailed': '파일 이름을 바꾸지 못했습니다',
  'gdrive.notice.createFailed': '파일을 만들지 못했습니다',
  'gdrive.notice.checkFailed':
    'Google 드라이브에 연결하지 못했습니다. 다시 시도하세요.',
  'gdrive.notice.reloadFailed':
    'Google 드라이브에서 다시 불러오지 못했습니다. 다시 시도하세요.',
  'gdrive.notice.reloadTrashed':
    '다시 불러오지 못함: 파일이 Google 드라이브 휴지통에 있습니다',
  'gdrive.notice.reloadTooLarge':
    '다시 불러오지 못함: Google 드라이브의 파일이 {size} MB를 넘습니다',
  'gdrive.notice.reloadNotDocument':
    '다시 불러오지 못함: Google 드라이브의 파일이 더 이상 ERD Editor 문서가 아닙니다',
  'gdrive.notice.signOutUnconfirmed':
    '여기서는 로그아웃했습니다. ERD Editor 서버가 확인하지 않아 이 브라우저는 다음에 연결될 때 로그아웃을 마칩니다',
  'gdrive.notice.signOutNotRevoked':
    '여기서는 로그아웃했지만 Google이 ERD Editor의 접근 권한 삭제를 확인하지 않았습니다. myaccount.google.com/permissions에서 삭제할 때까지 다른 기기는 로그인 상태로 남을 수 있습니다',
} satisfies Messages;
