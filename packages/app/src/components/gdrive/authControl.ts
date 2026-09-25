import { AUTH_CONTROL_ATTRIBUTE } from '@/services/gdrive';

/**
 * Spread on every sign-in and sign-out control: the token manager's capture
 * listener then leaves a click on it to the control's own handler.
 */
export const authControl = { [AUTH_CONTROL_ATTRIBUTE]: '' } as const;
