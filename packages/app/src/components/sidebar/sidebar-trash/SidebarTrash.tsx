import {
  AlertDialog,
  Button,
  Dialog,
  Flex,
  Quote,
  ScrollArea,
  Text,
} from '@radix-ui/themes';
import { RotateCcw, Trash2 } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
import {
  useDeleteSchemaEntity,
  useEmptyTrash,
  useNow,
  useRestoreSchemaEntity,
  useTrashedSchemaEntities,
} from '@/atoms/modules/schema';
import { formatRelativeTime } from '@/utils/schemaList';
import { formatTrashDeletion, TRASH_RETENTION_DAYS } from '@/utils/trash';

import * as styles from './SidebarTrash.styles';

interface ConfirmProps {
  title: string;
  description: React.ReactNode;
  action: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

const Confirm: React.FC<ConfirmProps> = props => {
  const { t } = useI18n();

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>{props.children}</AlertDialog.Trigger>
      <AlertDialog.Content style={{ maxWidth: 450 }}>
        <AlertDialog.Title>{props.title}</AlertDialog.Title>
        <AlertDialog.Description size="2">
          {props.description}
        </AlertDialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              {t('common.cancel')}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action onClick={props.onConfirm}>
            <Button variant="outline" color="red">
              {props.action}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

interface SidebarTrashProps {}

const SidebarTrash: React.FC<SidebarTrashProps> = () => {
  const entities = useTrashedSchemaEntities();
  const restoreSchemaEntity = useRestoreSchemaEntity();
  const deleteSchemaEntity = useDeleteSchemaEntity();
  const emptyTrash = useEmptyTrash();
  const now = useNow();
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button
          css={styles.trigger}
          size="2"
          variant="ghost"
          color="gray"
          aria-label={t('trash.button', { count: entities.length })}
        >
          <Trash2 size={16} />
          <span css={styles.ellipsis}>{t('trash.title')}</span>{' '}
          <span css={styles.count}>({entities.length})</span>
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 480 }}>
        <Dialog.Title>{t('trash.title')}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {t('trash.description', { count: TRASH_RETENTION_DAYS })}
        </Dialog.Description>

        {entities.length ? (
          <ScrollArea css={styles.list} scrollbars="vertical">
            <Flex css={styles.rows} direction="column" gap="1" asChild>
              <ul aria-label={t('trash.listLabel')}>
                {entities.map(entity => (
                  <Flex
                    key={entity.id}
                    css={styles.item}
                    align="center"
                    gap="2"
                    asChild
                  >
                    <li>
                      <Flex css={styles.itemText} direction="column">
                        <Text css={styles.ellipsis} size="2">
                          {entity.name}
                        </Text>
                        <Text size="1" color="gray">
                          <span css={styles.nowrap}>
                            {t('trash.deleted', {
                              time: formatRelativeTime(
                                entity.deletedAt ?? 0,
                                now,
                                i18n
                              ),
                            })}{' '}
                            ·
                          </span>{' '}
                          <span css={styles.nowrap}>
                            {formatTrashDeletion(
                              entity.deletedAt ?? 0,
                              now,
                              i18n
                            )}
                          </span>
                        </Text>
                      </Flex>
                      <Button
                        css={styles.rowAction}
                        size="1"
                        variant="ghost"
                        color="gray"
                        highContrast
                        onClick={() => restoreSchemaEntity(entity.id)}
                      >
                        <RotateCcw size={14} />
                        {t('trash.restore')}
                      </Button>
                      <Confirm
                        title={t('trash.deletePermanently')}
                        description={
                          <>
                            {t('trash.cannotBeUndone')}{' '}
                            <Quote>{entity.name}</Quote>
                          </>
                        }
                        action={t('trash.delete')}
                        onConfirm={() => deleteSchemaEntity(entity.id)}
                      >
                        <Button
                          css={styles.rowAction}
                          size="1"
                          variant="ghost"
                          color="red"
                        >
                          <Trash2 size={14} />
                          {t('trash.deletePermanently')}
                        </Button>
                      </Confirm>
                    </li>
                  </Flex>
                ))}
              </ul>
            </Flex>
          </ScrollArea>
        ) : (
          <Text as="p" size="2" color="gray">
            {t('trash.empty')}
          </Text>
        )}

        <Flex gap="3" mt="4" justify="between">
          <Confirm
            title={t('trash.emptyTrash')}
            description={t('trash.emptyConfirm', { count: entities.length })}
            action={t('trash.emptyTrash')}
            onConfirm={() => emptyTrash()}
          >
            <Button variant="outline" color="red" disabled={!entities.length}>
              {t('trash.emptyTrash')}
            </Button>
          </Confirm>
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t('common.close')}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SidebarTrash;
