import { Button, Flex, Spinner, Text } from '@radix-ui/themes';

import { useI18n } from '@/atoms/modules/locale';
import { authControl } from '@/components/gdrive/authControl';
import GdriveNotice from '@/components/gdrive/gdrive-screens/GdriveNotice';
import type { PlainMessageKey } from '@/i18n/translate';
import type { GdriveSession, TokenSnapshot } from '@/services/gdrive';

import * as styles from './GdriveSignIn.styles';

/** Google's G, as its sign-in branding draws it; lucide ships no brand marks. */
const GoogleMark: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

interface GoogleButtonProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

/** Google's own button, the one exception to the gray buttons (the user's call, U6). */
const GoogleButton: React.FC<GoogleButtonProps> = ({
  label,
  disabled,
  onClick,
}) => (
  <button
    css={styles.googleButton}
    type="button"
    disabled={disabled}
    onClick={onClick}
    {...authControl}
  >
    <GoogleMark />
    <span>{label}</span>
  </button>
);

const ERRORS: Record<NonNullable<TokenSnapshot['error']>, PlainMessageKey> = {
  'popup-blocked': 'gdrive.signIn.popupBlocked',
  failed: 'gdrive.signIn.failed',
};

interface GdriveSignInProps {
  session: GdriveSession;
  token: TokenSnapshot;
  /** What else the screen offers, under the sign-in. */
  children?: React.ReactNode;
}

/**
 * Sign in with Google through ERD Editor's popup, or Continue with Google on
 * Google's own token popup while the sign-in server is unavailable.
 */
const GdriveSignIn: React.FC<GdriveSignInProps> = ({
  session,
  token,
  children,
}) => {
  const fallback = token.mode === 'fallback';
  const { t } = useI18n();

  if (token.signingIn) {
    return (
      <GdriveNotice
        title={t('gdrive.signIn.waitingTitle')}
        description={t('gdrive.signIn.waitingDescription')}
      >
        <Flex direction="column" align="center" gap="3">
          <Flex align="center" gap="3">
            <Spinner size="2" />
            {fallback ? null : (
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={() => session.cancelSignIn()}
                {...authControl}
              >
                {t('common.cancel')}
              </Button>
            )}
          </Flex>
          {children}
        </Flex>
      </GdriveNotice>
    );
  }

  return (
    <GdriveNotice
      title={t('gdrive.signIn.title')}
      description={t(
        fallback
          ? 'gdrive.signIn.fallbackDescription'
          : 'gdrive.signIn.description'
      )}
    >
      <Flex direction="column" align="center" gap="3">
        <GoogleButton
          label={t(
            fallback ? 'gdrive.signIn.continue' : 'gdrive.signIn.signIn'
          )}
          disabled={fallback && token.gis !== 'ready'}
          onClick={() => session.signIn()}
        />
        {fallback && token.gis === 'blocked' ? (
          <Text size="2" color="red">
            {t('gdrive.signIn.gisBlocked')}
          </Text>
        ) : token.error ? (
          <Text size="2" color="red">
            {t(ERRORS[token.error])}
          </Text>
        ) : null}
        {children}
      </Flex>
    </GdriveNotice>
  );
};

export default GdriveSignIn;
