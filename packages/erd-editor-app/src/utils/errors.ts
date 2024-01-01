export class InvalidHashError extends Error {
  name = 'InvalidHashError';

  constructor() {
    super('Invalid hash');
  }
}
