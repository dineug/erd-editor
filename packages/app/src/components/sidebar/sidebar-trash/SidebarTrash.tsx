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

import {
  useDeleteSchemaEntity,
  useEmptyTrash,
  useNow,
  useRestoreSchemaEntity,
  useTrashedSchemaEntities,
} from '@/atoms/modules/schema';
import { formatRelativeTime } from '@/utils/schemaList';

import * as styles from './SidebarTrash.styles';

interface ConfirmProps {
  title: string;
  description: React.ReactNode;
  action: string;
  onConfirm: () => void;
  children: React.ReactNode;
}

const Confirm: React.FC<ConfirmProps> = props => (
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
            Cancel
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

interface SidebarTrashProps {}

const SidebarTrash: React.FC<SidebarTrashProps> = () => {
  const entities = useTrashedSchemaEntities();
  const restoreSchemaEntity = useRestoreSchemaEntity();
  const deleteSchemaEntity = useDeleteSchemaEntity();
  const emptyTrash = useEmptyTrash();
  const now = useNow();
  const count =
    entities.length === 1 ? '1 schema' : `${entities.length} schemas`;

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button css={styles.trigger} size="2" variant="ghost" color="gray">
          <Trash2 size={16} />
          Trash ({entities.length})
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 480 }}>
        <Dialog.Title>Trash</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Schemas stay in the trash until you delete them.
        </Dialog.Description>

        {entities.length ? (
          <ScrollArea css={styles.list} scrollbars="vertical">
            <Flex css={styles.rows} direction="column" gap="1" asChild>
              <ul aria-label="Trashed schemas">
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
                          Deleted{' '}
                          {formatRelativeTime(entity.deletedAt ?? 0, now)}
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
                        Restore
                      </Button>
                      <Confirm
                        title="Delete permanently"
                        description={
                          <>
                            This cannot be undone. <Quote>{entity.name}</Quote>
                          </>
                        }
                        action="Delete"
                        onConfirm={() => deleteSchemaEntity(entity.id)}
                      >
                        <Button
                          css={styles.rowAction}
                          size="1"
                          variant="ghost"
                          color="red"
                        >
                          <Trash2 size={14} />
                          Delete permanently
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
            The trash is empty.
          </Text>
        )}

        <Flex gap="3" mt="4" justify="between">
          <Confirm
            title="Empty trash"
            description={`Permanently delete ${count}? This cannot be undone.`}
            action="Empty trash"
            onConfirm={() => emptyTrash()}
          >
            <Button variant="outline" color="red" disabled={!entities.length}>
              Empty trash
            </Button>
          </Confirm>
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SidebarTrash;
