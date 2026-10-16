import { createRef, FC, onMounted, onUpdated, ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import type { PlainMessageKey } from '@/i18n/translate';
import { FindField, FindFieldList } from '@/utils/find-replace';
import { isComposing, isMod } from '@/utils/keyboard-shortcut';

import {
  countText,
  goToNext,
  goToPrevious,
  replaceAll,
  replaceOne,
  setQuery,
  setReplacement,
  takeSearchFocus,
  toggleField,
  toggleOption,
} from '../explorerSearch';
import { explorerViewOf } from '../explorerView';
import * as styles from './ExplorerSearch.styles';

const SCOPE_LABEL: Record<FindField, PlainMessageKey> = {
  [FindField.tableName]: 'findReplace.scope.tableName',
  [FindField.tableComment]: 'findReplace.scope.tableComment',
  [FindField.columnName]: 'findReplace.scope.columnName',
  [FindField.columnComment]: 'findReplace.scope.columnComment',
  [FindField.memo]: 'findReplace.scope.memo',
  [FindField.indexName]: 'findReplace.scope.indexName',
  [FindField.tableGroupName]: 'findReplace.scope.tableGroupName',
};

export type ExplorerSearchProps = {
  readonly: boolean;
};

/**
 * The Explorer's search above its tree: the find field and its options, the
 * Replace row folded away to begin with, the place in the matches with the
 * steps through them, and the kinds of text searched past the three dots.
 */
const ExplorerSearch: FC<ExplorerSearchProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const root = createRef<HTMLDivElement>();

  /** Takes the keyboard to the find field, query selected, when an opening asked for it. */
  const focusField = () => {
    if (!takeSearchFocus(app.value.store)) return;
    const input = root.value?.querySelector<HTMLInputElement>('.find-input');
    input?.focus();
    input?.select();
  };

  onMounted(focusField);
  onUpdated(focusField);

  const handleQueryInput = (event: InputEvent) => {
    setQuery(app.value.store, (event.target as HTMLInputElement).value);
  };

  const handleReplacementInput = (event: InputEvent) => {
    setReplacement(app.value.store, (event.target as HTMLInputElement).value);
  };

  const handleQueryKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || isComposing(event)) return;
    event.preventDefault();
    const { store } = app.value;
    event.shiftKey ? goToPrevious(store) : goToNext(store);
  };

  const handleReplacementKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || isComposing(event)) return;
    event.preventDefault();
    const { store } = app.value;
    isMod(event) ? replaceAll(store) : replaceOne(store);
  };

  const handleReplace = () => {
    props.readonly || replaceOne(app.value.store);
  };

  const handleReplaceAll = () => {
    props.readonly || replaceAll(app.value.store);
  };

  const handleToggleReplace = () => {
    const view = explorerViewOf(app.value.store);
    view.replaceOpen = !view.replaceOpen;
  };

  const handleToggleScopes = () => {
    const view = explorerViewOf(app.value.store);
    view.scopesOpen = !view.scopesOpen;
  };

  return () => {
    const { store } = app.value;
    const { t } = i18n.value;
    const view = explorerViewOf(store);
    // Read so a request to take the keyboard renders this again, whose update takes it.
    void view.focusRequest;
    const invalid = view.error === 'invalid';
    const replaceShown = !props.readonly && view.replaceOpen;
    const replaceable = !props.readonly && view.matches.length > 0;
    const toggleReplace = t('explorer.toggleReplace');
    const moreScopes = t('explorer.moreScopes');

    return (
      <div class={['explorer-search', styles.root]} use:ref={ref(root)}>
        <div class={styles.fields}>
          {props.readonly ? null : (
            <button
              class={[
                'explorer-replace-toggle',
                styles.toggle,
                styles.twisty,
                { collapsed: !view.replaceOpen },
              ]}
              type="button"
              title={toggleReplace}
              aria-label={toggleReplace}
              aria-expanded={String(view.replaceOpen)}
              on:click={handleToggleReplace}
            >
              {view.replaceOpen ? (
                <Icon name="chevron-down" size={14} />
              ) : (
                <Icon name="chevron-right" size={14} />
              )}
            </button>
          )}
          <div class={styles.rows}>
            <div class={[styles.field, { invalid }]}>
              <TextInput
                class={['find-input', styles.input, { invalid }]}
                title={t('common.find')}
                placeholder={t('common.find')}
                dir="auto"
                value={view.query}
                onInput={handleQueryInput}
                onKeydown={handleQueryKeydown}
              />
              <button
                class={[
                  'find-match-case',
                  styles.toggle,
                  { active: view.matchCase },
                ]}
                type="button"
                title={t('findReplace.matchCase')}
                aria-pressed={String(view.matchCase)}
                on:click={() => toggleOption(store, 'matchCase')}
              >
                <Icon name="case-sensitive" size={16} />
              </button>
              <button
                class={[
                  'find-whole-word',
                  styles.toggle,
                  { active: view.wholeWord },
                ]}
                type="button"
                title={t('findReplace.wholeWord')}
                aria-pressed={String(view.wholeWord)}
                on:click={() => toggleOption(store, 'wholeWord')}
              >
                <Icon name="whole-word" size={16} />
              </button>
              <button
                class={['find-regex', styles.toggle, { active: view.regex }]}
                type="button"
                title={t('findReplace.regex')}
                aria-pressed={String(view.regex)}
                on:click={() => toggleOption(store, 'regex')}
              >
                <Icon name="regex" size={16} />
              </button>
            </div>
            {replaceShown ? (
              <div class={styles.row}>
                <div class={styles.field}>
                  <TextInput
                    class={['replace-input', styles.input]}
                    title={t('findReplace.replace')}
                    placeholder={t('findReplace.replace')}
                    dir="auto"
                    value={view.replacement}
                    onInput={handleReplacementInput}
                    onKeydown={handleReplacementKeydown}
                  />
                  <button
                    class={[
                      'find-preserve-case',
                      styles.toggle,
                      { active: view.preserveCase },
                    ]}
                    type="button"
                    title={t('findReplace.preserveCase')}
                    aria-pressed={String(view.preserveCase)}
                    on:click={() => toggleOption(store, 'preserveCase')}
                  >
                    <Icon name="case-upper" size={16} />
                  </button>
                </div>
                <button
                  class={['find-replace-one', styles.toggle]}
                  type="button"
                  title={`${t('findReplace.replace')} (Enter)`}
                  bool:disabled={!replaceable}
                  on:click={handleReplace}
                >
                  <Icon name="replace" size={16} />
                </button>
                <button
                  class={['find-replace-all', styles.toggle]}
                  type="button"
                  title={t('findReplace.replaceAll')}
                  bool:disabled={!replaceable}
                  on:click={handleReplaceAll}
                >
                  <Icon name="replace-all" size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div class={styles.status}>
          <span
            class={['find-count', styles.count, { invalid }]}
            aria-live="polite"
          >
            {countText(store, i18n.value)}
          </span>
          <button
            class={['find-previous', styles.toggle]}
            type="button"
            title={`${t('findReplace.previousMatch')} (Shift+Enter)`}
            bool:disabled={!view.matches.length}
            on:click={() => goToPrevious(store)}
          >
            <Icon name="arrow-up" size={16} />
          </button>
          <button
            class={['find-next', styles.toggle]}
            type="button"
            title={`${t('findReplace.nextMatch')} (Enter)`}
            bool:disabled={!view.matches.length}
            on:click={() => goToNext(store)}
          >
            <Icon name="arrow-down" size={16} />
          </button>
          <button
            class={[
              'find-scopes-toggle',
              styles.toggle,
              { active: view.scopesOpen },
            ]}
            type="button"
            title={moreScopes}
            aria-label={moreScopes}
            aria-expanded={String(view.scopesOpen)}
            on:click={handleToggleScopes}
          >
            <Icon name="ellipsis" size={16} />
          </button>
        </div>
        {view.scopesOpen ? (
          <div class={styles.scopes}>
            {FindFieldList.map(field => (
              <button
                class={[
                  'find-scope',
                  styles.scope,
                  { active: view.fields.includes(field) },
                ]}
                type="button"
                data-field={field}
                aria-pressed={String(view.fields.includes(field))}
                on:click={() => toggleField(store, field)}
              >
                {t(SCOPE_LABEL[field])}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
};

export default ExplorerSearch;
