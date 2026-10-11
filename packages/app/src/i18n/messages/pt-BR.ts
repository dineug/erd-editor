import type { Messages } from '@/i18n/translate';

/** The app's own text in Brazilian Portuguese, key for key as English writes it. */
export const ptBR = {
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.dismiss': 'Fechar',
  'common.tryAgain': 'Tentar novamente',
  'common.reload': 'Recarregar',
  'common.loading': 'Carregando…',
  'common.search': 'Pesquisar',
  'common.rename': 'Renomear',
  'common.importFiles': 'Importar arquivos',
  'common.signOut': 'Sair',
  'common.downloadMyChanges': 'Baixar minhas alterações',
  'common.edited': 'Editado {time}',
  'common.system': 'Sistema',
  'common.displayLanguage': 'Idioma de exibição',
  'common.theme': 'Tema',
  'common.light': 'Claro',
  'common.dark': 'Escuro',
  'common.host': 'Anfitrião',
  'common.guest': 'Convidado',
  'common.you': '(você)',
  'common.participants': 'Participantes',
  'common.yourNickname': 'Seu apelido',
  'common.privacy': 'Privacidade',
  'common.terms': 'Termos',
  'common.editingGuide': 'Guia de edição',
  'common.openSidebar': 'Abrir barra lateral',
  'common.closeSidebar': 'Fechar barra lateral',

  'time.justNow': 'agora mesmo',
  'time.today': 'Hoje',
  'time.yesterday': 'Ontem',
  'time.previous7Days': 'Últimos 7 dias',
  'time.previous30Days': 'Últimos 30 dias',

  'sidebar.schemas': 'Esquemas',
  'sidebar.newSchema': 'Novo esquema',
  'sidebar.importAndExport': 'Importar e exportar',
  'sidebar.exportBackup': 'Exportar backup',
  'sidebar.searchSchemas': 'Pesquisar esquemas',
  'sidebar.newSchemaName': 'Nome do novo esquema',
  'sidebar.schemaName': 'Nome do esquema',
  'sidebar.schemaNamePlaceholder': 'nome do esquema',
  'sidebar.duplicate': 'Duplicar',
  'sidebar.moveToTrash': 'Mover para a lixeira',
  'sidebar.actionsFor': 'Ações de {name}',
  'sidebar.noResults': 'Nenhum resultado',

  'trash.button': 'Lixeira ({count})',
  'trash.title': 'Lixeira',
  'trash.description': {
    one: 'Os esquemas na lixeira são excluídos permanentemente após {count} dia.',
    many: 'Os esquemas na lixeira são excluídos permanentemente após {count} de dias.',
    other:
      'Os esquemas na lixeira são excluídos permanentemente após {count} dias.',
  },
  'trash.listLabel': 'Esquemas na lixeira',
  'trash.deleted': 'Excluído {time}',
  'trash.deletesToday': 'será excluído hoje',
  'trash.deletesTomorrow': 'será excluído amanhã',
  'trash.deletesIn': {
    one: 'será excluído em {count} dia',
    many: 'será excluído em {count} de dias',
    other: 'será excluído em {count} dias',
  },
  'trash.restore': 'Restaurar',
  'trash.deletePermanently': 'Excluir permanentemente',
  'trash.cannotBeUndone': 'Esta ação não pode ser desfeita.',
  'trash.delete': 'Excluir',
  'trash.empty': 'A lixeira está vazia.',
  'trash.emptyTrash': 'Esvaziar lixeira',
  'trash.emptyConfirm': {
    one: 'Excluir permanentemente {count} esquema? Esta ação não pode ser desfeita.',
    many: 'Excluir permanentemente {count} de esquemas? Esta ação não pode ser desfeita.',
    other:
      'Excluir permanentemente {count} esquemas? Esta ação não pode ser desfeita.',
  },

  'collaboration.for': 'Colaboração em {name}',
  'collaboration.guestsConnected': {
    one: '{count} convidado conectado',
    many: '{count} de convidados conectados',
    other: '{count} convidados conectados',
  },
  'collaboration.title': 'Edição colaborativa',
  'collaboration.experiment': 'Experimental',
  'collaboration.description':
    'Os participantes se conectam diretamente via WebRTC e trocam mensagens com criptografia de ponta a ponta.',
  'collaboration.nickname': 'Apelido',
  'collaboration.link': 'Link',
  'collaboration.noOneJoined': 'Ninguém mais entrou ainda.',
  'collaboration.startSession': 'Iniciar sessão colaborativa',
  'collaboration.stopSession': 'Encerrar sessão',

  'viewer.noSchemaOpen': 'Nenhum esquema aberto',
  'viewer.emptyHint':
    'Escolha um na barra lateral ou comece um aqui. Você também pode soltar arquivos em qualquer lugar para importá-los.',
  'viewer.openSample': 'Abrir exemplo',
  'viewer.sampleName': 'exemplo de livraria',

  'drop.title': 'Solte para importar',
  'drop.formats':
    'Backups, documentos .erd, .vuerd e .json, SQL, DBML, AML e GraphQL',
  'drop.importing': 'Importando arquivos…',
  'drop.importingHint': 'Solte mais arquivos quando esta importação terminar',

  'import.imported': {
    one: '{count} esquema importado',
    many: '{count} de esquemas importados',
    other: '{count} esquemas importados',
  },
  'import.skippedInvalidFiles': {
    one: '{count} arquivo inválido ignorado',
    many: '{count} de arquivos inválidos ignorados',
    other: '{count} arquivos inválidos ignorados',
  },
  'import.skippedInvalidSchemas': {
    one: '{count} esquema inválido ignorado',
    many: '{count} de esquemas inválidos ignorados',
    other: '{count} esquemas inválidos ignorados',
  },
  'import.skippedOversized': {
    one: '{count} arquivo com mais de {size} MB ignorado',
    many: '{count} de arquivos com mais de {size} MB ignorados',
    other: '{count} arquivos com mais de {size} MB ignorados',
  },
  'import.nothing': 'Nada para importar',
  'import.failed': 'Falha na importação',
  'import.exportFailed': 'Falha na exportação',

  'update.available': 'Uma nova versão do ERD Editor está disponível.',
  'update.updatedElsewhere':
    'O app foi atualizado em outra guia — recarregue para concluir.',

  'live.invalidToken': 'Link de compartilhamento inválido.',
  'live.hostNotFound': 'Anfitrião não encontrado.',
  'live.refresh': 'Atualizar',
  'live.hostStopped': 'O anfitrião encerrou a sessão.',
  'live.somethingWentWrong': 'Algo deu errado.',
  'live.lookingForHost': 'Procurando um anfitrião...',
  'live.waitingForHost': 'Aguardando o anfitrião voltar...',
  'live.session': 'Sessão ao vivo',
  'live.inSession': {
    one: '{count} na sessão',
    many: '{count} na sessão',
    other: '{count} na sessão',
  },
  'live.showParticipants': 'Mostrar participantes',
  'live.hideParticipants': 'Ocultar participantes',

  'gdrive.checkingSignIn': 'Verificando seu login do Google…',
  'gdrive.anotherAccount': 'outra conta',
  'gdrive.offline.title': 'Você está off-line',
  'gdrive.offline.description':
    'O ERD Editor verifica seu login do Google quando você voltar a ficar on-line.',
  'gdrive.scopeMissing.title': 'O acesso ao Google Drive não foi concedido',
  'gdrive.scopeMissing.description':
    'O ERD Editor precisa de acesso aos arquivos que você cria ou abre com ele. Faça login novamente e permita o acesso ao Google Drive.',
  'gdrive.mismatch.title': 'O Google Drive enviou isto para outra conta',
  'gdrive.mismatch.description':
    'Você está conectado como {email}. Mude para a conta que o Google Drive usou para abri-lo ou continue com os arquivos desta conta.',
  'gdrive.mismatch.choose':
    'O ERD Editor não conseguiu pré-selecionar essa conta, então escolha-a quando o Google perguntar.',
  'gdrive.mismatch.switchAccount': 'Trocar de conta',
  'gdrive.mismatch.showMyFiles': 'Mostrar meus arquivos',
  'gdrive.accountChanged.title': 'Conectado com outra conta',
  'gdrive.accountChanged.description':
    'Outra guia fez login em outra Conta do Google, então esta guia parou. Recarregue-a para continuar com essa conta.',
  'gdrive.unsaved.title': 'Suas alterações não foram salvas',
  'gdrive.unsaved.description':
    '{name} tem alterações de {email} que não estão no Google Drive, e agora você está conectado com {account}. Baixe-as antes de continuar.',
  'gdrive.unsaved.descriptionUnnamed':
    'O arquivo que você tinha aberto tem alterações de {email} que não estão no Google Drive, e agora você está conectado com {account}. Baixe-as antes de continuar.',
  'gdrive.unsaved.continueWithout': 'Continuar sem elas',
  'gdrive.framed.title':
    'Abra o editor do Google Drive do ERD Editor em uma guia própria',
  'gdrive.framed.description': 'Ele não funciona dentro de outra página.',
  'gdrive.framed.link': 'Abrir em uma nova guia',
  'gdrive.notConfigured.title':
    'A integração com o Google Drive não está configurada',
  'gdrive.notConfigured.description':
    'Esta versão do ERD Editor não tem um cliente de login do Google.',
  'gdrive.unsupportedOrigin.title': 'O Google Drive não está disponível aqui',
  'gdrive.unsupportedOrigin.description':
    'O login do Google só funciona em erd-editor.io, e esta é uma prévia.',

  'gdrive.signIn.title': 'Abra seus arquivos ERD do Google Drive',
  'gdrive.signIn.description':
    'O ERD Editor abre e salva apenas os arquivos que você cria ou abre com ele.',
  'gdrive.signIn.fallbackDescription':
    'O servidor de login do ERD Editor está ocupado, então o Google mantém você conectado por uma hora de cada vez.',
  'gdrive.signIn.signIn': 'Fazer login com o Google',
  'gdrive.signIn.continue': 'Continuar com o Google',
  'gdrive.signIn.waitingTitle': 'Aguardando o login do Google…',
  'gdrive.signIn.waitingDescription':
    'Conclua o login na janela que o Google abriu.',
  'gdrive.signIn.popupBlocked':
    'Seu navegador bloqueou a janela de login. Permita pop-ups para este site e tente novamente.',
  'gdrive.signIn.failed':
    'O login do Google não foi concluído. Tente novamente.',
  'gdrive.signIn.gisBlocked':
    'Não foi possível carregar o login do Google. Verifique se nada está bloqueando accounts.google.com e recarregue a página.',

  'gdrive.sidebar.label': 'Arquivos do Drive',
  'gdrive.sidebar.newFile': 'Novo arquivo',
  'gdrive.sidebar.import': 'Importar',
  'gdrive.sidebar.searchFiles': 'Pesquisar arquivos',
  'gdrive.sidebar.newFileName': 'Nome do novo arquivo',
  'gdrive.sidebar.fileName': 'Nome do arquivo',
  'gdrive.sidebar.fileNamePlaceholder': 'nome do arquivo',
  'gdrive.sidebar.loadingFiles': 'Carregando arquivos…',
  'gdrive.sidebar.loadFailed': 'Não foi possível carregar seus arquivos.',

  'gdrive.viewer.noFileOpen': 'Nenhum arquivo aberto',
  'gdrive.viewer.noFileOpenHint':
    'Escolha um arquivo na barra lateral ou comece um novo.',
  'gdrive.viewer.noFilesYet': 'Ainda não há arquivos',
  'gdrive.viewer.noFilesYetHint':
    'Crie um arquivo ou importe um. Os arquivos que você abre com o ERD Editor pelo Google Drive também aparecem aqui.',
  'gdrive.viewer.waitingForOpener': 'Aguardando a guia que abriu este arquivo…',
  'gdrive.viewer.notDocument': 'Este arquivo não é um documento do ERD Editor',
  'gdrive.viewer.notDocumentHint':
    'O ERD Editor abre diagramas que ele mesmo salvou. Ele deixa este arquivo como está e nunca o substitui.',
  'gdrive.viewer.googleNativeHint':
    'Documentos Google, Planilhas Google e pastas abrem no Google Drive.',
  'gdrive.viewer.trashed': 'Este arquivo está na lixeira',
  'gdrive.viewer.trashedHint': 'Restaure-o no Google Drive para abri-lo aqui.',
  'gdrive.viewer.tooLarge': 'Este arquivo é muito grande',
  'gdrive.viewer.tooLargeHint': 'O ERD Editor abre arquivos de até {size} MB.',
  'gdrive.viewer.notFound': 'Este arquivo não está disponível',
  'gdrive.viewer.notFoundHint':
    'Ele pode ter sido excluído, ou esta Conta do Google não consegue abri-lo.',
  'gdrive.viewer.waitingToken': 'Aguardando o Google',
  'gdrive.viewer.waitingTokenHint':
    'Este arquivo será aberto quando sua sessão do Google voltar.',
  'gdrive.viewer.failed': 'Não foi possível abrir este arquivo',
  'gdrive.viewer.failedHint':
    'O Google Drive não respondeu. Verifique a conexão e tente novamente.',
  'gdrive.viewer.savingBeforeLeave': 'Salvando antes de sair…',

  'gdrive.status.saved': 'Salvo no Google Drive',
  'gdrive.status.saving': 'Salvando…',
  'gdrive.status.failed': 'Não foi possível salvar',
  'gdrive.status.conflict': 'Alterado no Google Drive',
  'gdrive.status.unconfirmed': 'Não foi possível confirmar o último salvamento',
  'gdrive.status.paused': 'Pausado até o Google se reconectar',
  'gdrive.status.deleted': 'Excluído no Google Drive',
  'gdrive.status.readonly': 'Somente visualização',
  'gdrive.status.waitingLeader': 'Aguardando a guia que salva este arquivo',
  'gdrive.status.waitingSnapshot': 'Aguardando a guia que abriu este arquivo',
  'gdrive.status.scopeMissing': 'Sem acesso ao Google Drive',

  'gdrive.banner.conflict':
    'Este arquivo mudou no Google Drive, então o salvamento parou. Suas alterações ainda estão aqui.',
  'gdrive.banner.unconfirmed':
    'Não foi possível confirmar o último salvamento, então o salvamento parou. Suas alterações ainda estão aqui.',
  'gdrive.banner.deleted':
    'Este arquivo foi excluído ou movido para a lixeira no Google Drive, então o salvamento parou.',
  'gdrive.banner.readonly':
    'Você não pode mais editar este arquivo no Google Drive, então o salvamento parou. Suas alterações ainda estão aqui.',
  'gdrive.banner.checkDrive': 'Verificar o Drive',
  'gdrive.banner.reloadFromDrive': 'Recarregar do Drive',
  'gdrive.banner.leaderNotResponding':
    'A guia que salva este arquivo não está respondendo.',
  'gdrive.banner.openerNotResponding':
    'A guia que abriu este arquivo não está respondendo.',
  'gdrive.banner.takeOver': 'Assumir o salvamento',
  'gdrive.banner.openAndTakeOver': 'Abrir do Drive e assumir',
  'gdrive.banner.popupBlocked':
    'Seu navegador bloqueou a janela do Google. Permita pop-ups para este site e reconecte.',
  'gdrive.banner.reconnectFailed':
    'Não foi possível reconectar o Google. Tente novamente.',
  'gdrive.banner.sessionEnded':
    'Sua sessão do Google terminou, então o salvamento está pausado.',
  'gdrive.banner.sessionEndsSoon': 'Sua sessão do Google termina em breve.',
  'gdrive.banner.reconnect': 'Reconectar o Google',

  'gdrive.leave.title': 'Suas alterações mais recentes não foram salvas',
  'gdrive.leave.description':
    'O ERD Editor não conseguiu salvá-las no Google Drive. Baixe-as para manter uma cópia ou saia e perca-as.',
  'gdrive.leave.descriptionSignOut':
    'O ERD Editor não conseguiu salvá-las no Google Drive. Baixe-as para manter uma cópia ou saia da conta e perca-as.',
  'gdrive.leave.stay': 'Ficar',
  'gdrive.leave.leaveAnyway': 'Sair mesmo assim',
  'gdrive.leave.signOutAnyway': 'Sair da conta mesmo assim',

  'gdrive.create.title': 'Novo arquivo no Google Drive',
  'gdrive.create.inAppFolder': 'Na pasta ERD Editor',
  'gdrive.create.inFolderPending': 'Em uma pasta…',
  'gdrive.create.inHiddenFolder':
    'Em uma pasta que o ERD Editor não consegue ver',
  'gdrive.create.inFolder': 'Na pasta “{name}”',
  'gdrive.create.untitled': 'Sem título',
  'gdrive.create.savedAs': 'Será salvo como {name}',
  'gdrive.create.folderRefused':
    'O ERD Editor não pode criar arquivos nesta pasta. Criar na pasta ERD Editor?',
  'gdrive.create.failed': 'Não foi possível criar o arquivo. Tente novamente.',
  'gdrive.create.createInAppFolder': 'Criar na pasta ERD Editor',
  'gdrive.create.create': 'Criar',

  'gdrive.import.imported': {
    one: '{count} arquivo importado para o Google Drive',
    many: '{count} de arquivos importados para o Google Drive',
    other: '{count} arquivos importados para o Google Drive',
  },
  'gdrive.import.skippedBackups': {
    one: '{count} backup ignorado: os backups ficam no app local',
    many: '{count} de backups ignorados: os backups ficam no app local',
    other: '{count} backups ignorados: os backups ficam no app local',
  },
  'gdrive.import.uploadsFailed': {
    one: 'Falha em {count} envio',
    many: 'Falha em {count} de envios',
    other: 'Falha em {count} envios',
  },

  'gdrive.notice.unreadableState':
    'O Google Drive enviou um link que o ERD Editor não conseguiu ler',
  'gdrive.notice.renameFailed': 'Não foi possível renomear o arquivo',
  'gdrive.notice.createFailed': 'Não foi possível criar o arquivo',
  'gdrive.notice.checkFailed':
    'Não foi possível acessar o Google Drive. Tente novamente.',
  'gdrive.notice.reloadFailed':
    'Não foi possível recarregar do Google Drive. Tente novamente.',
  'gdrive.notice.reloadTrashed':
    'Não foi possível recarregar: o arquivo está na lixeira do Google Drive',
  'gdrive.notice.reloadTooLarge':
    'Não foi possível recarregar: o arquivo no Google Drive tem mais de {size} MB',
  'gdrive.notice.reloadNotDocument':
    'Não foi possível recarregar: o arquivo no Google Drive não é mais um documento do ERD Editor',
  'gdrive.notice.signOutUnconfirmed':
    'Você saiu aqui. O servidor do ERD Editor não confirmou, então este navegador conclui a saída na próxima vez que se conectar',
  'gdrive.notice.signOutNotRevoked':
    'Você saiu aqui, mas o Google não confirmou que removeu o acesso do ERD Editor, então seus outros dispositivos podem continuar conectados até você removê-lo em myaccount.google.com/permissions',
} satisfies Messages;
