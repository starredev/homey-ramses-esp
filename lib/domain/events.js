/**
 * Domain events. Models emit them as `event`; the Homey layer turns them into
 * capability values and flow triggers.
 */

/** Who caused a change of the fan mode. */
export const Source = Object.freeze({
  /** Homey sent the command. */
  HOMEY: 'homey',
  /** A remote or sensor on the bus sent the command. */
  REMOTE: 'remote',
  /** The ventilation unit reported its own state. */
  UNIT: 'unit',
});

/** A measured value changed. */
export class ReadingChanged {
  /**
   * @param {string} key see `Reading`
   * @param {number | boolean} value
   * @param {number | boolean | undefined} previous
   */
  constructor(key, value, previous) {
    this.key = key;
    this.value = value;
    this.previous = previous;
    Object.freeze(this);
  }
}

/** The mode of a ventilation unit changed. */
export class FanModeChanged {
  /**
   * @param {string} mode
   * @param {string | null} previous
   * @param {string} source see {@link Source}
   * @param {string | null} [by] the address that sent the command
   */
  constructor(mode, previous, source, by = null) {
    this.mode = mode;
    this.previous = previous;
    this.source = source;
    this.by = by;
    Object.freeze(this);
  }
}

/** A boost timer was started on a ventilation unit. */
export class BoostStarted {
  /**
   * @param {number} minutes
   * @param {string} source see {@link Source}
   * @param {string | null} [by]
   */
  constructor(minutes, source, by = null) {
    this.minutes = minutes;
    this.source = source;
    this.by = by;
    Object.freeze(this);
  }
}

/** A button on a physical remote was pressed. */
export class ButtonPressed {
  /**
   * @param {string} button a fan mode, or `boost`
   * @param {string | null} target the unit it commanded
   * @param {number} [minutes] boost duration
   */
  constructor(button, target, minutes = 0) {
    this.button = button;
    this.target = target;
    this.minutes = minutes;
    Object.freeze(this);
  }
}

/** A device told its model. */
export class DeviceInfoReceived {
  /** @param {string} model */
  constructor(model) {
    this.model = model;
    Object.freeze(this);
  }
}

/** A device was heard on the bus for the first time. */
export class DeviceDiscovered {
  /**
   * @param {string} id
   * @param {string} role
   */
  constructor(id, role) {
    this.id = id;
    this.role = role;
    Object.freeze(this);
  }
}

/** @typedef {ReadingChanged | FanModeChanged | BoostStarted | ButtonPressed | DeviceInfoReceived} DeviceEvent */
