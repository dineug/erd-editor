export class InvalidHashError extends Error {
  name = 'InvalidHashError';

  constructor() {
    super('Invalid hash');
  }
}

export class NotFoundHostError extends Error {
  name = 'NotFoundHostError';

  constructor() {
    super('Not found host');
  }
}

export class HostStopSessionError extends Error {
  name = 'HostStopSessionError';

  constructor() {
    super('Host stop session');
  }
}
