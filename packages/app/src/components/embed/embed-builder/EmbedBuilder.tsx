import {
  Button,
  Code,
  Flex,
  Heading,
  Select,
  Switch,
  Text,
  TextField,
  VisuallyHidden,
} from '@radix-ui/themes';
import { accentColors } from '@radix-ui/themes/props';
import { Check, Copy } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useI18n, useSystemLocale } from '@/atoms/modules/locale';
import { useResolvedTheme } from '@/atoms/modules/theme';
import EmbedFrame from '@/components/embed/embed-frame/EmbedFrame';
import { localeInfoOf, LOCALES } from '@/i18n/locales';
import { copyToClipboard } from '@/utils/clipboard';
import {
  DEFAULT_EMBED_HEIGHT,
  EMBED_DEFAULTS,
  EMBED_GRAY_COLORS,
  embedAppearance,
  type EmbedDisplayOptions,
  type EmbedGrayColor,
  type EmbedLocale,
  type EmbedNameView,
  parseDocumentUrl,
  parseEmbedHeight,
  toEmbedUrl,
  toIframeSnippet,
} from '@/utils/embedOptions';
import { toGithubRawUrl } from '@/utils/githubRawUrl';
import {
  type AccentColor,
  type AppearancePreference,
  isSystemDark,
  type ResolvedAppearance,
  watchSystemDark,
} from '@/utils/theme';

import * as styles from './EmbedBuilder.styles';

const COPIED_MS = 2000;
// The name view's item for the document's own, since a select item takes no empty value.
const AS_SAVED = 'saved';

/**
 * A color's item, named by its Radix key as the editor's theme builder names it.
 * Its swatch reads the scale on a theme class of its own, since the select's
 * Theme maps the gray scale to the app's gray.
 */
function colorItem(color: string, appearance: ResolvedAppearance) {
  return (
    <Select.Item key={color} value={color}>
      <span
        css={styles.swatch}
        className={`${appearance}-theme`}
        style={{ backgroundColor: `var(--${color}-9)` }}
        aria-hidden
      />
      {color}
    </Select.Item>
  );
}

interface CopyButtonProps {
  value: string;
  primary?: boolean;
}

/**
 * Copies the value, then says so for a moment, on the button and in a status a
 * screen reader announces, while the value is still the one copied; nothing to
 * copy disables it.
 */
const CopyButton: React.FC<CopyButtonProps> = ({ value, primary }) => {
  const { t } = useI18n();
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const timerRef = useRef(-1);
  const mountedRef = useRef(false);
  const copied = copiedValue === value;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    copyToClipboard(value).then(() => {
      // A copy that ends after the button left starts no timer.
      if (!mountedRef.current) return;
      setCopiedValue(value);
      clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        () => setCopiedValue(null),
        COPIED_MS
      );
    });
  };

  return (
    <>
      <Button
        css={styles.copy}
        variant={primary ? 'solid' : 'outline'}
        color="gray"
        highContrast={primary}
        disabled={!value}
        onClick={handleClick}
      >
        {copied ? (
          <Check size={16} aria-hidden />
        ) : (
          <Copy size={16} aria-hidden />
        )}
        {copied ? t('embed.copied') : t('embed.copy')}
      </Button>
      <VisuallyHidden role="status">
        {copied ? t('embed.copied') : null}
      </VisuallyHidden>
    </>
  );
};

interface ResultProps {
  label: string;
  value: string;
  primary?: boolean;
}

/** A read-only result with its copy button, grouped under its label. */
const Result: React.FC<ResultProps> = ({ label, value, primary }) => {
  const id = useId();

  return (
    <Flex
      direction="column"
      gap="1"
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <Text
        as="label"
        id={`${id}-label`}
        htmlFor={`${id}-field`}
        size="2"
        weight="medium"
      >
        {label}
      </Text>
      <Flex gap="2">
        <TextField.Root
          css={styles.grow}
          id={`${id}-field`}
          value={value}
          dir="ltr"
          readOnly
          onFocus={event => event.currentTarget.select()}
        />
        <CopyButton value={value} primary={primary} />
      </Flex>
    </Flex>
  );
};

/** The id and name of an option's control, which a click on its label reaches. */
interface OptionControl {
  id: string;
  'aria-labelledby': string;
}

interface OptionProps {
  label: string;
  onLabelClick?: React.MouseEventHandler<HTMLLabelElement>;
  children: (control: OptionControl) => React.ReactNode;
}

/** A labelled option whose control names itself by the label it shows. */
const Option: React.FC<OptionProps> = ({ label, onLabelClick, children }) => {
  const id = useId();
  const labelId = `${id}-label`;
  const controlId = `${id}-control`;

  return (
    <Flex direction="column" gap="1">
      <Text
        as="label"
        id={labelId}
        htmlFor={controlId}
        size="2"
        weight="medium"
        onClick={onLabelClick}
      >
        {label}
      </Text>
      {children({ id: controlId, 'aria-labelledby': labelId })}
    </Flex>
  );
};

interface SelectOptionProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

/**
 * A labelled select whose label opens its list on every click, since Radix's
 * trigger opens for the click a label hands it only until a mouse pressed it.
 */
const SelectOption: React.FC<SelectOptionProps> = ({
  label,
  value,
  onValueChange,
  children,
}) => {
  const [open, setOpen] = useState(false);

  const handleLabelClick = (event: React.MouseEvent<HTMLLabelElement>) => {
    // The list opens here, so the trigger gets no click to open it again.
    event.preventDefault();
    setOpen(true);
  };

  return (
    <Option label={label} onLabelClick={handleLabelClick}>
      {control => (
        <Select.Root
          open={open}
          onOpenChange={setOpen}
          value={value}
          onValueChange={onValueChange}
        >
          <Select.Trigger {...control} />
          <Select.Content>{children}</Select.Content>
        </Select.Root>
      )}
    </Option>
  );
};

/**
 * The page of /embed without a src: a document URL, applied on Enter or blur,
 * and the viewer's options, shown at once in a preview of the page an iframe
 * of the written URL shows, with the URL and that iframe to copy.
 */
const EmbedBuilder: React.FC = () => {
  const { t } = useI18n();
  const id = useId();
  const systemLocale = useSystemLocale();
  const systemDark = useSyncExternalStore(watchSystemDark, isSystemDark);
  const { appearance } = useResolvedTheme();
  const [draftUrl, setDraftUrl] = useState('');
  const [committedUrl, setCommittedUrl] = useState('');
  const [display, setDisplay] = useState<EmbedDisplayOptions>(EMBED_DEFAULTS);
  const [heightInput, setHeightInput] = useState(String(DEFAULT_EMBED_HEIGHT));

  const options = useMemo(
    () => ({ ...display, src: committedUrl }),
    [display, committedUrl]
  );
  const preview = useMemo(() => ({ systemLocale }), [systemLocale]);
  const height = parseEmbedHeight(heightInput);
  const embedUrl = toEmbedUrl(location.origin, options);
  const snippet = embedUrl ? toIframeSnippet(embedUrl, height) : '';
  const system = localeInfoOf(systemLocale);
  const urlId = `${id}-url`;
  const fetchId = `${id}-fetch`;

  const change = <K extends keyof EmbedDisplayOptions>(
    key: K,
    value: EmbedDisplayOptions[K]
  ) => setDisplay(prev => ({ ...prev, [key]: value }));

  const commit = () => setCommittedUrl(parseDocumentUrl(draftUrl));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) commit();
  };

  return (
    <div css={styles.root}>
      <Flex css={styles.body} direction="column" gap="5">
        <Heading as="h1" size="6" weight="medium">
          {t('embed.title')}
        </Heading>

        <Flex direction="column" gap="1">
          <Text as="label" htmlFor={urlId} size="2" weight="medium">
            {t('embed.documentUrl')}
          </Text>
          <TextField.Root
            id={urlId}
            type="url"
            dir="ltr"
            placeholder="https://example.com/diagram.erd.json"
            autoComplete="off"
            spellCheck={false}
            value={draftUrl}
            aria-describedby={committedUrl ? fetchId : undefined}
            onChange={event => setDraftUrl(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
          />
          {committedUrl ? (
            <Text as="p" id={fetchId} size="1" color="gray">
              {t('embed.fetchUrl')}{' '}
              <Code css={styles.fetchUrl} size="1" variant="ghost" dir="ltr">
                {toGithubRawUrl(committedUrl)}
              </Code>
            </Text>
          ) : null}
        </Flex>

        <div css={styles.options}>
          <SelectOption
            label={t('common.theme')}
            value={display.theme ?? EMBED_DEFAULTS.theme}
            onValueChange={value =>
              change('theme', value as AppearancePreference)
            }
          >
            <Select.Item value="system">{t('common.system')}</Select.Item>
            <Select.Item value="light">{t('common.light')}</Select.Item>
            <Select.Item value="dark">{t('common.dark')}</Select.Item>
          </SelectOption>

          <SelectOption
            label={t('common.displayLanguage')}
            value={display.locale ?? EMBED_DEFAULTS.locale}
            onValueChange={value => change('locale', value as EmbedLocale)}
          >
            <Select.Item value="system">
              {t('common.system')}
              <span css={styles.hint} lang={system.code} dir="auto">
                {system.label}
              </span>
            </Select.Item>
            <Select.Separator />
            {LOCALES.map(({ code, label }) => (
              <Select.Item key={code} value={code}>
                <span lang={code} dir="auto">
                  {label}
                </span>
              </Select.Item>
            ))}
          </SelectOption>

          <SelectOption
            label={t('embed.nameView')}
            value={display.nameView ?? AS_SAVED}
            onValueChange={value =>
              change(
                'nameView',
                value === AS_SAVED ? null : (value as EmbedNameView)
              )
            }
          >
            <Select.Item value={AS_SAVED}>{t('embed.nameAsSaved')}</Select.Item>
            <Select.Item value="physical">
              {t('embed.physicalNames')}
            </Select.Item>
            <Select.Item value="logical">{t('embed.logicalNames')}</Select.Item>
            <Select.Item value="both">{t('embed.bothNames')}</Select.Item>
          </SelectOption>

          <SelectOption
            label={t('embed.accentColor')}
            value={display.accentColor ?? EMBED_DEFAULTS.accentColor}
            onValueChange={value => change('accentColor', value as AccentColor)}
          >
            {accentColors.map(color => colorItem(color, appearance))}
          </SelectOption>

          <SelectOption
            label={t('embed.grayColor')}
            value={display.grayColor ?? EMBED_DEFAULTS.grayColor}
            onValueChange={value =>
              change('grayColor', value as EmbedGrayColor)
            }
          >
            {EMBED_GRAY_COLORS.map(color => colorItem(color, appearance))}
          </SelectOption>

          <Option label={t('embed.minimap')}>
            {control => (
              <Switch
                {...control}
                checked={display.minimap}
                onCheckedChange={checked => change('minimap', checked)}
              />
            )}
          </Option>
          <Option label={t('embed.controls')}>
            {control => (
              <Switch
                {...control}
                checked={display.controls}
                onCheckedChange={checked => change('controls', checked)}
              />
            )}
          </Option>
          <Option label={t('embed.height')}>
            {control => (
              <TextField.Root
                {...control}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={heightInput}
                onChange={event => setHeightInput(event.target.value)}
              >
                <TextField.Slot side="right">px</TextField.Slot>
              </TextField.Root>
            )}
          </Option>
        </div>

        <Flex
          direction="column"
          gap="1"
          role="group"
          aria-labelledby={`${id}-preview`}
        >
          <Text as="div" id={`${id}-preview`} size="2" weight="medium">
            {t('embed.preview')}
          </Text>
          <div css={styles.preview} style={{ height }}>
            <EmbedFrame
              options={options}
              appearance={embedAppearance(display.theme, systemDark)}
              preview={preview}
            />
          </div>
        </Flex>

        <Result label={t('embed.embedUrl')} value={embedUrl} />
        <Result label={t('embed.embedCode')} value={snippet} primary />
      </Flex>
    </div>
  );
};

export default EmbedBuilder;
