/**
 * Error hierarchy of the app. Every error carries a stable machine-readable
 * `code` so the pairing views and the settings page can react without
 * parsing human-readable messages.
 */
export class RamsesError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(message, { code = 'RAMSES_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
  }
}

/** Input that does not satisfy the protocol rules. */
export class ValidationError extends RamsesError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'VALIDATION' });
  }
}

/** A command was issued while there is no connection to the broker. */
export class NotConnectedError extends RamsesError {
  /** @param {string} [detail] */
  constructor(detail) {
    super(detail ? `Not connected to the MQTT broker (${detail})` : 'Not connected to the MQTT broker', {
      code: 'NOT_CONNECTED',
    });
  }
}

/** Nothing answered at the broker address. */
export class NotReachableError extends RamsesError {
  /**
   * @param {string} address
   * @param {unknown} [cause]
   */
  constructor(address, cause) {
    super(`No MQTT broker answered at ${address}`, { code: 'NOT_REACHABLE', cause });
  }
}

/** The broker refused the user name or password. */
export class AuthError extends RamsesError {
  /** @param {unknown} [cause] */
  constructor(cause) {
    super('The MQTT broker refused the user name or password', { code: 'AUTH', cause });
  }
}

/** A requested resource (gateway, device) does not exist. */
export class NotFoundError extends RamsesError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'NOT_FOUND' });
  }
}
