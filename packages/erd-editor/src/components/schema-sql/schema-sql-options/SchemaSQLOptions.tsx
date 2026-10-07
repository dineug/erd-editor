import { createRef, FC, nextTick, onMounted, ref, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { useI18n } from '@/components/localeContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import Icon from '@/components/primitives/icon/Icon';
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
import { schemaSQLViewOf } from '@/components/schema-sql/schemaSQLView';
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

import { formatDropWarning } from './dropWarning';
import * as styles from './SchemaSQLOptions.styles';
import ScriptEditor from './ScriptEditor';

/** The panel's id, which the button folding it away controls. */
export const SCHEMA_SQL_OPTIONS_ID = 'schema-sql-options';

const TITLE_ID = 'schema-sql-options-title';

/** The before script's hint: SQL alone, which no language translates. */
const BEFORE_PLACEHOLDER = '-- CREATE EXTENSION, CREATE SCHEMA, SET …';

/** The one drop and re-create SQL Server ran from, said where the choice is made. */
const MSSQL_RECREATE_HINT = 'SQL Server 2016+';

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

/**
 * The options beside the Schema SQL: what the document saves, the database
 * and the bracket, then this window's statements and header, then the
 * scripts the document saves, and the buttons that save and copy the text.
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
        title: disabled
          ? notIn
          : menu.id === SchemaSQLStatements.recreate &&
              settings.database === Database.MSSQL
            ? MSSQL_RECREATE_HINT
            : '',
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
            aria-label={t('schemaSql.hideOptions')}
            title={t('schemaSql.hideOptions')}
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
            aria-label={t('schemaSql.savedInDocument')}
          >
            <span class={styles.caption}>{t('schemaSql.savedInDocument')}</span>
            <div class={styles.row}>
              <label prop:htmlFor="schema-sql-database">
                {t('common.database')}
              </label>
              <select
                class={styles.select}
                id="schema-sql-database"
                on:change={handleDatabase}
              >
                {databaseMenus.map(menu => (
                  <option
                    prop:value={String(menu.value)}
                    prop:selected={menu.value === settings.database}
                  >
                    {menu.name}
                  </option>
                ))}
              </select>
            </div>
            <div class={styles.row}>
              <label prop:htmlFor="schema-sql-bracket">
                {t('common.bracket')}
              </label>
              <select
                class={styles.select}
                id="schema-sql-bracket"
                on:change={handleBracket}
              >
                {bracketMenus.map(menu => (
                  <option
                    prop:value={String(menu.value)}
                    prop:selected={menu.value === settings.bracketType}
                  >
                    {menuLabel(i18n.value, menu)}
                  </option>
                ))}
              </select>
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
              <span>{t('schemaSql.saveFile')}</span>
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
