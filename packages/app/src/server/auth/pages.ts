import { type AuthEnv, handleAuthRequest } from './index';

/**
 * The Pages Function behind functions/api/auth/[[route]].ts. Its env holds the
 * dashboard's variables; fetch is bound here, where workerd would refuse it.
 */
export const onRequest = (context: { request: Request; env: AuthEnv }) =>
  handleAuthRequest(context.request, context.env, {
    fetch: (input, init) => fetch(input, init),
  });
