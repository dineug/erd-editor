import { query } from '@dineug/erd-editor-schema';
import { createRef, FC, nextTick, onMounted, ref, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { useI18n } from '@/components/localeContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import Icon from '@/components/primitives/icon/Icon';
import Select from '@/components/primitives/select/Select';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import {
  headerHint,
  isHeaderSupported,
  menus as headerMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/headerMenus';
import {
  databaseLabel,
  isStatementsSupported,
  menus as statementsMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/statementsMenus';
import {
  chooseAllTables,
  chooseNoGroup,
  chooseTableGroup,
  isEveryTableChosen,
  resolveTableChoice,
  schemaSQLViewOf,
} from '@/components/schema-sql/schemaSQLView';
import { Database, DDLScriptPosition } from '@/constants/schema';
import {
  changeBracketTypeAction,
  changeDatabaseAction,
  changeDDLScriptAction,
} from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import { ValuesType } from '@/internal-types';
import {
  resolveSchemaSQLOptions,
  SchemaSQLHeader,
  SchemaSQLStatements,
  schemaSQLSupport,
} from '@/utils/schema-sql';
import { toOpaqueHex } from '@/utils/tableColor';

import { formatDropWarning } from './dropWarning';
import * as styles from './SchemaSQLOptions.styles';
import ScriptEditor from './ScriptEditor';

/** The panel's id, which the button folding it away controls. */
export const SCHEMA_SQL_OPTIONS_ID = 'schema-sql-options';

const TITLE_ID = 'schema-sql-options-title';

const TABLES_ID = 'schema-sql-tables';

/** The before script's hint: SQL alone, which no language translates. */
const BEFORE_PLACEHOLDER = '-- CREATE EXTENSION, CREATE SCHEMA, SET …';

/**
 * What a statement notes in a database: the SQL Server release drop and
 * re-create runs from, said where the choice is made, and nothing else.
 */
const statementsHint = (database: number, id: SchemaSQLStatements): string =>
  database === Database.MSSQL && id === SchemaSQLStatements.recreate
    ? 'SQL Server 2016+'
    : '';

/** Space is the hand tool's key, whose binding cancels the keydown and with it a native button's press. */
export const keepSpace = (event: KeyboardEvent) => {
  if (event.code === 'Space') event.stopPropagation();
};

export type SchemaSQLOptionsProps = {
  isDarkMode: boolean;
  readonly: boolean;
  /** The tables a drop and re-create names, in the order the DDL writes them. */
  tables: ReadonlyArray<string>;
  /** The Oracle names over 30 bytes, which 12.2 was the first to take. */
  longNames: ReadonlyArray<string>;
  onHide: () => void;
  onSave: () => void;
  onCopy: () => void;
};

type Segment = {
  label: string;
  pressed: boolean;
  disabled: boolean;
  title: string;
  onPress: () => void;
};

/** One box of the Tables list: All, a table group or No group. */
type Choice = {
  className: string;
  label: string;
  checked: boolean;
  /** All, while some boxes are checked and some are not. */
  mixed: boolean;
  /** A group without a name, which reads unnamed in the placeholder's colour. */
  unnamed: boolean;
  /** A group's color as an opaque hex, or null for no dot. */
  color: string | null;
  onChange: (checked: boolean) => void;
};

/**
 * The options beside the Schema SQL: the database and the bracket, then this
 * window's statements, header and tables, then the scripts the document
 * saves, and the buttons that save and copy the text.
 */
const SchemaSQLOptions: FC<SchemaSQLOptionsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const save = createRef<HTMLButtonElement>();
  const { addUnsubscribe } = useUnmounted();

  // The export path asks for the Save file button, for one press to save.
  const focusSave = () => {
    const view = schemaSQLViewOf(app.value);
    if (!view.focusSave) return;

    view.focusSave = false;
    nextTick(() => save.value?.focus());
  };

  const commitScript =
    (position: ValuesType<typeof DDLScriptPosition>) => (value: string) => {
      const { store, lifecycle } = app.value;
      if (lifecycle.destroyed) return;

      store.dispatch(changeDDLScriptAction({ position, value }));
    };

  const handleDatabase = (event: Event) => {
    const { store } = app.value;
    const value = Number((event.target as HTMLSelectElement).value);

    store.dispatch(changeDatabaseAction({ value }));
  };

  const handleBracket = (event: Event) => {
    const { store } = app.value;
    const value = Number((event.target as HTMLSelectElement).value);

    store.dispatch(changeBracketTypeAction({ value }));
  };

  onMounted(() => {
    focusSave();
    addUnsubscribe(
      watch(schemaSQLViewOf(app.value)).subscribe(propName => {
        propName === 'focusSave' && focusSave();
      })
    );
  });

  const groupIdsNow = () => app.value.store.state.doc.tableGroupIds;

  const renderChoice = (choice: Choice) => (
    <label class={[choice.className, styles.choice]}>
      <input
        type="checkbox"
        prop:checked={choice.checked}
        prop:indeterminate={choice.mixed}
        on:change={(event: Event) =>
          choice.onChange((event.target as HTMLInputElement).checked)
        }
      />
      {choice.color ? (
        <span
          class={styles.dot}
          style={{ 'background-color': choice.color }}
          aria-hidden="true"
        />
      ) : null}
      <span
        class={[styles.choiceName, { unnamed: choice.unnamed }]}
        prop:dir="auto"
        title={choice.label}
      >
        {choice.label}
      </span>
    </label>
  );

  // Shown while the document has a group, every box checked meaning the whole
  // document as it is written with no group at all.
  const renderTables = () => {
    const { store } = app.value;
    const { doc, collections } = store.state;
    if (!doc.tableGroupIds.length) return null;

    const { t } = i18n.value;
    const view = schemaSQLViewOf(app.value);
    const choice = resolveTableChoice(view.tables, doc.tableGroupIds);
    const every = isEveryTableChosen(choice);
    const some = choice.noGroup || Object.values(choice.groups).some(Boolean);
    const groups = query(collections)
      .collection('tableGroupEntities')
      .selectByIds(doc.tableGroupIds);

    return (
      <div class={styles.column}>
        <span id={TABLES_ID}>{t('schemaSql.tables')}</span>
        <div
          class={['schema-sql-options-tables', styles.choices]}
          role="group"
          aria-labelledby={TABLES_ID}
        >
          {renderChoice({
            className: 'schema-sql-options-all',
            label: t('schemaSql.allTables'),
            checked: every,
            mixed: some && !every,
            unnamed: false,
            color: null,
            onChange: checked => chooseAllTables(view, groupIdsNow(), checked),
          })}
          {groups.map(group => {
            const named = Boolean(group.name.trim());

            return renderChoice({
              className: 'schema-sql-options-group',
              label: named ? group.name : t('common.unnamed'),
              checked: choice.groups[group.id],
              mixed: false,
              unnamed: !named,
              color: toOpaqueHex(group.color),
              onChange: checked =>
                chooseTableGroup(view, groupIdsNow(), group.id, checked),
            });
          })}
          {renderChoice({
            className: 'schema-sql-options-no-group',
            label: t('schemaSql.noGroup'),
            checked: choice.noGroup,
            mixed: false,
            unnamed: false,
            color: null,
            onChange: checked => chooseNoGroup(view, groupIdsNow(), checked),
          })}
        </div>
      </div>
    );
  };

  const renderSegments = (labelledBy: string, segments: Segment[]) => (
    <div class={styles.segments} role="group" aria-labelledby={labelledBy}>
      {segments.map(segment => (
        <button
          type="button"
          class={styles.segment}
          aria-pressed={segment.pressed ? 'true' : 'false'}
          aria-disabled={segment.disabled ? 'true' : 'false'}
          title={segment.title}
          on:click={segment.disabled ? null : segment.onPress}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );

  return () => {
    const { store } = app.value;
    const { settings } = store.state;
    const { t, dir } = i18n.value;
    const view = schemaSQLViewOf(app.value);
    const resolved = resolveSchemaSQLOptions(
      settings.database,
      view,
      settings.databaseName
    );
    const support = schemaSQLSupport(settings.database);
    const notIn = t('schemaSql.notInDatabase', {
      database: databaseLabel(settings.database),
    });
    const scripts = settings.ddlScripts;
    const theme = props.isDarkMode ? 'dark' : 'light';
    const warning =
      resolved.statements === SchemaSQLStatements.recreate
        ? formatDropWarning(i18n.value, settings.database, props.tables)
        : null;

    const statements = statementsMenus.map<Segment>(menu => {
      const disabled = !isStatementsSupported(support, menu.id);
      return {
        label: menu.name,
        pressed: menu.id === resolved.statements,
        disabled,
        title: disabled ? notIn : statementsHint(settings.database, menu.id),
        onPress: () => {
          view.statements = menu.id;
        },
      };
    });

    const headers = headerMenus.map<Segment>(menu => {
      const disabled = !isHeaderSupported(support, menu.id);
      return {
        label: menuLabel(i18n.value, menu),
        pressed: menu.id === resolved.header,
        disabled,
        title: disabled
          ? notIn
          : (headerHint(settings.database, menu.id) ?? ''),
        onPress: () => {
          view.header = menu.id;
        },
      };
    });

    return (
      <aside
        class={['schema-sql-options', styles.panel]}
        id={SCHEMA_SQL_OPTIONS_ID}
        prop:dir={dir}
        aria-labelledby={TITLE_ID}
        style={{ 'color-scheme': theme }}
        on:keydown={keepSpace}
      >
        <div class={styles.head}>
          <span class={styles.title} id={TITLE_ID}>
            {t('common.tab.schemaSql')}
          </span>
          <button
            type="button"
            class={['schema-sql-options-hide', styles.icon]}
            aria-label={t('code.hideOptions')}
            title={t('code.hideOptions')}
            aria-expanded="true"
            aria-controls={SCHEMA_SQL_OPTIONS_ID}
            on:click={props.onHide}
          >
            <Icon name="panel-right-close" size={16} />
          </button>
        </div>
        <div class={['scrollbar', styles.body]}>
          <section
            class={styles.group}
            role="group"
            aria-label={t('code.savedInDocument')}
          >
            <span class={styles.caption}>{t('code.savedInDocument')}</span>
            <div class={styles.row}>
              <label prop:htmlFor="schema-sql-database">
                {t('common.database')}
              </label>
              <Select class={styles.select}>
                <select id="schema-sql-database" on:change={handleDatabase}>
                  {databaseMenus.map(menu => (
                    <option
                      prop:value={String(menu.value)}
                      prop:selected={menu.value === settings.database}
                    >
                      {menu.name}
                    </option>
                  ))}
                </select>
              </Select>
            </div>
            <div class={styles.row}>
              <label prop:htmlFor="schema-sql-bracket">
                {t('common.bracket')}
              </label>
              <Select class={styles.select}>
                <select id="schema-sql-bracket" on:change={handleBracket}>
                  {bracketMenus.map(menu => (
                    <option
                      prop:value={String(menu.value)}
                      prop:selected={menu.value === settings.bracketType}
                    >
                      {menuLabel(i18n.value, menu)}
                    </option>
                  ))}
                </select>
              </Select>
            </div>
            {props.longNames.length ? (
              <p class={['schema-sql-options-long-names', styles.note]}>
                {t('schemaSql.oracleLongNames', {
                  names: props.longNames.join(', '),
                })}
              </p>
            ) : null}
          </section>
          <section
            class={[styles.group, styles.separated]}
            role="group"
            aria-label={t('schemaSql.thisWindowOnly')}
          >
            <span class={styles.caption}>{t('schemaSql.thisWindowOnly')}</span>
            <div class={styles.column}>
              <span id="schema-sql-statements">
                {t('schemaSql.statements')}
              </span>
              {renderSegments('schema-sql-statements', statements)}
            </div>
            <div class={styles.column}>
              <span id="schema-sql-header">{t('schemaSql.header')}</span>
              {renderSegments('schema-sql-header', headers)}
            </div>
            {resolved.header !== SchemaSQLHeader.none &&
            resolved.headerName !== 'valid' ? (
              <p class={['schema-sql-options-header-name', styles.note]}>
                {t('schemaSql.headerInvalidName', {
                  name: settings.databaseName,
                })}
              </p>
            ) : null}
            {renderTables()}
            {warning ? (
              <div
                class={['schema-sql-options-warning', styles.warning]}
                role="note"
              >
                <div class={styles.warningIcon} aria-hidden="true">
                  <Icon name="triangle-alert" size={14} />
                </div>
                <span>{warning}</span>
              </div>
            ) : null}
          </section>
          <section
            class={[styles.group, styles.separated]}
            role="group"
            aria-label={t('schemaSql.scriptsCaption')}
          >
            <span class={styles.caption}>{t('schemaSql.scriptsCaption')}</span>
            <div class={styles.column}>
              <label prop:htmlFor="schema-sql-before">
                {t('schemaSql.beforeTables')}
              </label>
              <ScriptEditor
                id="schema-sql-before"
                value={scripts?.before ?? ''}
                placeholder={BEFORE_PLACEHOLDER}
                theme={theme}
                readonly={props.readonly}
                onCommit={commitScript(DDLScriptPosition.before)}
              />
            </div>
            <div class={styles.column}>
              <label prop:htmlFor="schema-sql-after">
                {t('schemaSql.afterTables')}
              </label>
              <ScriptEditor
                id="schema-sql-after"
                value={scripts?.after ?? ''}
                placeholder={t('schemaSql.afterPlaceholder')}
                theme={theme}
                readonly={props.readonly}
                onCommit={commitScript(DDLScriptPosition.after)}
              />
            </div>
            <span class={styles.caption}>{t('schemaSql.mssqlGoHint')}</span>
          </section>
        </div>
        <div class={styles.foot}>
          <div class={styles.actions}>
            <button
              use:ref={ref(save)}
              type="button"
              class={[
                'schema-sql-options-save',
                buttonStyles.button,
                buttonStyles.solid,
                buttonStyles.size2,
                styles.action,
              ]}
              on:click={props.onSave}
            >
              <Icon name="download" size={14} />
              <span>{t('code.saveFile')}</span>
            </button>
            <button
              type="button"
              class={[
                'schema-sql-options-copy',
                buttonStyles.button,
                buttonStyles.soft,
                buttonStyles.size2,
                styles.action,
              ]}
              on:click={props.onCopy}
            >
              {t('code.copy')}
            </button>
          </div>
        </div>
      </aside>
    );
  };
};

export default SchemaSQLOptions;
