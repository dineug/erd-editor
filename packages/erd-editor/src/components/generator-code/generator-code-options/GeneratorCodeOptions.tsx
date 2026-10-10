import { type AnyAction, FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import {
  menuGroups as languageMenuGroups,
  menus as languageMenus,
} from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import {
  readsBracket,
  readsDatabase,
  readsNameCases,
} from '@/components/generator-code/languageSettings';
import { useI18n } from '@/components/localeContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import Icon from '@/components/primitives/icon/Icon';
import Select from '@/components/primitives/select/Select';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { keepSpace } from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions';
import * as shell from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions.styles';
import {
  changeBracketTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeTableNameCaseAction,
} from '@/engine/modules/settings/atom.actions';
import { menuLabel } from '@/i18n/menuLabel';
import { type PlainMessageKey } from '@/i18n/translate';

import * as styles from './GeneratorCodeOptions.styles';

/** The panel's id, which the button folding it away controls. */
export const GENERATOR_CODE_OPTIONS_ID = 'generator-code-options';

const TITLE_ID = 'generator-code-options-title';

/** The note under the database, and the one under both name cases. */
const DATABASE_NOTE_ID = 'generator-code-database-unused';
const NAME_CASES_NOTE_ID = 'generator-code-name-cases-unused';

const LEFT_TO_RIGHT_MARK = '\u200e';

type Choice = {
  value: number;
  label: string;
  /** The first of a group past the first, which a rule sets apart. */
  separated?: boolean;
};

type Setting = {
  id: string;
  labelKey: PlainMessageKey;
  value: number;
  choices: Choice[];
  /** Names written left to right, some ending in a sign: the code languages. */
  leftToRight?: boolean;
  /** The id of the note saying the language ignores it, while it does. */
  noteId?: string;
  onChange: (value: number) => void;
};

export type GeneratorCodeOptionsProps = {
  isDarkMode: boolean;
  onHide: () => void;
  onSave: () => void;
  onCopy: () => void;
};

/**
 * The options beside the generated code: the settings the document saves that
 * change it, each dimmed while the language ignores it, then the buttons that
 * save and copy the text.
 */
const GeneratorCodeOptions: FC<GeneratorCodeOptionsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  const dispatchOf =
    (create: (payload: { value: number }) => AnyAction) => (value: number) => {
      app.value.store.dispatch(create({ value }));
    };

  const handleChange = (setting: Setting) => (event: Event) => {
    setting.onChange(Number((event.target as HTMLSelectElement).value));
  };

  const renderSetting = (setting: Setting) => {
    const { t, dir } = i18n.value;
    // A mark after the name, never one before it, which would keep typing its
    // first letter from finding it, ends C# with a strong letter in a list that
    // follows a right-to-left reader, so it never reads #C.
    const labelOf = (choice: Choice) =>
      setting.leftToRight && dir === 'rtl'
        ? `${choice.label}${LEFT_TO_RIGHT_MARK}`
        : choice.label;

    return (
      <div
        class={[
          'generator-code-options-setting',
          shell.column,
          setting.noteId ? styles.unused : null,
        ]}
        data-unused={setting.noteId ? 'true' : 'false'}
      >
        <label class={styles.name} prop:htmlFor={setting.id}>
          {t(setting.labelKey)}
        </label>
        <Select dimmed={Boolean(setting.noteId)}>
          <select
            id={setting.id}
            aria-describedby={setting.noteId ?? ''}
            on:change={handleChange(setting)}
          >
            {setting.choices.map(choice => (
              <>
                {choice.separated ? <hr /> : null}
                <option
                  prop:value={String(choice.value)}
                  prop:selected={choice.value === setting.value}
                >
                  {labelOf(choice)}
                </option>
              </>
            ))}
          </select>
        </Select>
      </div>
    );
  };

  const renderNote = (id: string, text: string) => (
    <p class={['generator-code-options-unused', shell.note]} id={id}>
      {text}
    </p>
  );

  return () => {
    const { store } = app.value;
    const { settings } = store.state;
    const { t, dir } = i18n.value;
    const theme = props.isDarkMode ? 'dark' : 'light';
    const language = settings.language;
    const languageName =
      languageMenus.find(menu => menu.value === language)?.name ?? '';
    const notUsed = t('code.notUsedBy', { language: languageName });
    const databaseUnused = !readsDatabase(language);
    const nameCasesUnused = !readsNameCases(language);

    const nameCases = (menus: typeof tableNameCaseMenus) =>
      menus.map<Choice>(menu => ({
        value: menu.value,
        label: menuLabel(i18n.value, menu),
      }));

    const languageSetting: Setting = {
      id: 'generator-code-language',
      labelKey: 'common.codeLanguage',
      value: language,
      choices: languageMenuGroups.flatMap((group, groupIndex) =>
        group.map((menu, index) => ({
          value: menu.value,
          label: menu.name,
          separated: groupIndex > 0 && index === 0,
        }))
      ),
      leftToRight: true,
      onChange: dispatchOf(changeLanguageAction),
    };
    const database: Setting = {
      id: 'generator-code-database',
      labelKey: 'common.database',
      value: settings.database,
      choices: databaseMenus.map(menu => ({
        value: menu.value,
        label: menu.name,
      })),
      noteId: databaseUnused ? DATABASE_NOTE_ID : undefined,
      onChange: dispatchOf(changeDatabaseAction),
    };
    const tableNameCase: Setting = {
      id: 'generator-code-table-name-case',
      labelKey: 'common.tableNameCase',
      value: settings.tableNameCase,
      choices: nameCases(tableNameCaseMenus),
      noteId: nameCasesUnused ? NAME_CASES_NOTE_ID : undefined,
      onChange: dispatchOf(changeTableNameCaseAction),
    };
    const columnNameCase: Setting = {
      id: 'generator-code-column-name-case',
      labelKey: 'common.columnNameCase',
      value: settings.columnNameCase,
      choices: nameCases(columnNameCaseMenus),
      noteId: tableNameCase.noteId,
      onChange: dispatchOf(changeColumnNameCaseAction),
    };
    const bracket: Setting = {
      id: 'generator-code-bracket',
      labelKey: 'common.bracket',
      value: settings.bracketType,
      choices: bracketMenus.map(menu => ({
        value: menu.value,
        label: menuLabel(i18n.value, menu),
      })),
      onChange: dispatchOf(changeBracketTypeAction),
    };

    return (
      <aside
        class={['generator-code-options', shell.panel]}
        id={GENERATOR_CODE_OPTIONS_ID}
        prop:dir={dir}
        aria-labelledby={TITLE_ID}
        style={{ 'color-scheme': theme }}
        on:keydown={keepSpace}
      >
        <div class={shell.head}>
          <span class={shell.title} id={TITLE_ID}>
            {t('common.tab.codeGenerator')}
          </span>
          <button
            type="button"
            class={['generator-code-options-hide', shell.icon]}
            aria-label={t('code.hideOptions')}
            title={t('code.hideOptions')}
            aria-expanded="true"
            aria-controls={GENERATOR_CODE_OPTIONS_ID}
            on:click={props.onHide}
          >
            <Icon name="panel-right-close" size={16} />
          </button>
        </div>
        <div class={['scrollbar', shell.body]}>
          <section
            class={shell.group}
            role="group"
            aria-label={t('code.savedInDocument')}
          >
            <span class={shell.caption}>{t('code.savedInDocument')}</span>
            {renderSetting(languageSetting)}
            {renderSetting(database)}
            {databaseUnused ? renderNote(DATABASE_NOTE_ID, notUsed) : null}
            {renderSetting(tableNameCase)}
            {renderSetting(columnNameCase)}
            {nameCasesUnused ? renderNote(NAME_CASES_NOTE_ID, notUsed) : null}
            {readsBracket(language) ? renderSetting(bracket) : null}
          </section>
        </div>
        <div class={shell.foot}>
          <div class={shell.actions}>
            <button
              type="button"
              class={[
                'generator-code-options-save',
                buttonStyles.button,
                buttonStyles.solid,
                buttonStyles.size2,
                shell.action,
              ]}
              on:click={props.onSave}
            >
              <Icon name="download" size={14} />
              <span>{t('code.saveFile')}</span>
            </button>
            <button
              type="button"
              class={[
                'generator-code-options-copy',
                buttonStyles.button,
                buttonStyles.soft,
                buttonStyles.size2,
                shell.action,
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

export default GeneratorCodeOptions;
