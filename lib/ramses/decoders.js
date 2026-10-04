import { modeFromRate } from './FanMode.js';

/** @typedef {import('./Packet.js').Packet} Packet */

/**
 * @typedef {object} Decoded
 * What one packet tells about the device that sent it (or, for commands, the
 * device it was sent to). Every field is optional.
 * @property {Record<string, number | boolean>} [readings] measurements by key, see {@link Reading}
 * @property {string} [mode] a fan mode, see `FanMode`
 * @property {number} [boostMinutes] a boost timer that was started
 * @property {string} [model] the model name a device reports about itself
 */

/** Measurement keys a decoder can produce. */
export const Reading = Object.freeze({
  CO2: 'co2',
  HUMIDITY: 'humidity',
  TEMPERATURE: 'temperature',
  OUTDOOR_HUMIDITY: 'outdoorHumidity',
  OUTDOOR_TEMPERATURE: 'outdoorTemperature',
  SUPPLY_TEMPERATURE: 'supplyTemperature',
  EXHAUST_TEMPERATURE: 'exhaustTemperature',
  AIR_QUALITY: 'airQuality',
  BYPASS: 'bypass',
  FAN_SPEED: 'fanSpeed',
  SUPPLY_FAN_SPEED: 'supplyFanSpeed',
  BOOST_REMAINING: 'boostRemaining',
  FILTER_DAYS: 'filterDays',
  DEMAND: 'demand',
  BATTERY: 'battery',
  BATTERY_LOW: 'batteryLow',
});

/** Highest value a `31D9` with status 00 reports as a mode (Orcon numbering). */
const MAX_MODE_NUMBER = 0x07;

// --- Field codecs -------------------------------------------------------------

/**
 * @param {string} payload
 * @param {number} byte offset in bytes
 * @returns {number | null}
 */
function u8(payload, byte) {
  const hex = payload.slice(byte * 2, byte * 2 + 2);

  return hex.length === 2 ? parseInt(hex, 16) : null;
}

/**
 * @param {string} payload
 * @param {number} byte offset in bytes
 * @returns {number | null}
 */
function u16(payload, byte) {
  const hex = payload.slice(byte * 2, byte * 2 + 4);

  return hex.length === 4 ? parseInt(hex, 16) : null;
}

/**
 * Percentage encoded as 0..200 (half percent steps); 0xEF and up mean "not available".
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null} 0..100
 */
function percent(payload, byte) {
  const raw = u8(payload, byte);

  if (raw === null || raw > 200) {
    return null;
  }

  return raw / 2;
}

/**
 * Relative humidity as a plain percentage; 0xEF and up mean "not available".
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null}
 */
function humidity(payload, byte) {
  const raw = u8(payload, byte);

  if (raw === null || raw > 100) {
    return null;
  }

  return raw;
}

/**
 * Signed hundredths of a degree; 0x7FFF is "not available", 0x7EFF "off".
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null}
 */
function temperature(payload, byte) {
  const raw = u16(payload, byte);

  if (raw === null || raw === 0x7fff || raw === 0x7eff) {
    return null;
  }

  const signed = raw > 0x7fff ? raw - 0x10000 : raw;

  return Math.round(signed) / 100;
}

/**
 * CO₂ in ppm; 0x7FFF and up mean "not available".
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null}
 */
function co2(payload, byte) {
  const raw = u16(payload, byte);

  if (raw === null || raw >= 0x7fff) {
    return null;
  }

  return raw;
}

/**
 * Drops the readings without a value.
 * @param {Record<string, number | boolean | null>} readings
 * @returns {Decoded}
 */
function present(readings) {
  const entries = Object.entries(readings).filter(([, value]) => value !== null);

  if (entries.length === 0) {
    return {};
  }

  return { readings: /** @type {Record<string, number | boolean>} */ (Object.fromEntries(entries)) };
}

// --- Fan info of 31DA -------------------------------------------------------

/** Fan info values of `31DA` (lower five bits) that map onto a remote's mode. */
const FAN_INFO_MODES = Object.freeze({
  0x01: 'low',
  0x02: 'medium',
  0x03: 'high',
  0x18: 'auto',
  0x19: 'auto',
});

/**
 * @param {number | null} raw
 * @returns {string | undefined}
 */
function fanInfoMode(raw) {
  if (raw === null) {
    return undefined;
  }

  return FAN_INFO_MODES[/** @type {keyof typeof FAN_INFO_MODES} */ (raw & 0x1f)];
}

// --- Decoders per message code ------------------------------------------------

/**
 * One decoder per message code. Offsets follow the layout used by ramses_rf.
 * @type {Readonly<Record<string, (payload: string) => Decoded>>}
 */
const DECODERS = Object.freeze({
  /**
   * Fan mode command: `00 RR 04`.
   * @param {string} payload
   */
  '22F1'(payload) {
    const mode = modeFromRate(payload.slice(2, 4));

    return mode ? { mode } : {};
  },

  /**
   * Boost timer: `00 FF DD`, in hours when the lower bits of FF are 01
   * (long form: bit 0x40), otherwise in minutes. The long form of Orcon (`00 12 3C 03 04 04 04`, sent by the CO2
   * 15RF for "High") adds the rate during the timer and the rate after it.
   * @param {string} payload
   */
  '22F3'(payload) {
    const flags = u8(payload, 1);
    const duration = u8(payload, 2);

    if (duration === null) {
      return {};
    }

    const long = payload.length >= 14;
    const inHours = flags !== null && (long ? (flags & 0x40) !== 0 : (flags & 0x07) === 1);
    /** @type {Decoded} */
    const decoded = { boostMinutes: inHours ? duration * 60 : duration };
    const mode = long ? modeFromRate(payload.slice(6, 8)) : null;

    return mode ? { ...decoded, mode } : decoded;
  },

  /**
   * Fan state: `00 FF SS`. With status byte FF the speed comes in half
   * percent; with status 00 Orcon and Vasco units report their mode, numbered
   * as in `22F1` (ramses_rf: "31D9[4:6] is fan_speed or fan_mode").
   * @param {string} payload
   */
  '31D9'(payload) {
    const flags = u8(payload, 1);
    const value = u8(payload, 2);

    if (flags === 0x00 && value !== null && value <= MAX_MODE_NUMBER) {
      const mode = modeFromRate(payload.slice(4, 6));

      return mode ? { mode } : {};
    }

    return present({ [Reading.FAN_SPEED]: percent(payload, 2) });
  },

  /**
   * Extended ventilation status of a heat recovery unit.
   * @param {string} payload
   */
  '31DA'(payload) {
    if (payload.length < 46) {
      return {};
    }

    const remaining = u16(payload, 21);
    const decoded = present({
      [Reading.AIR_QUALITY]: percent(payload, 1),
      [Reading.CO2]: co2(payload, 3),
      [Reading.HUMIDITY]: humidity(payload, 5),
      [Reading.OUTDOOR_HUMIDITY]: humidity(payload, 6),
      [Reading.EXHAUST_TEMPERATURE]: temperature(payload, 7),
      [Reading.SUPPLY_TEMPERATURE]: temperature(payload, 9),
      [Reading.TEMPERATURE]: temperature(payload, 11),
      [Reading.OUTDOOR_TEMPERATURE]: temperature(payload, 13),
      [Reading.BYPASS]: percent(payload, 17),
      [Reading.FAN_SPEED]: percent(payload, 19),
      [Reading.SUPPLY_FAN_SPEED]: percent(payload, 20),
      [Reading.BOOST_REMAINING]: remaining === null || remaining >= 0x7fff ? null : remaining,
    });
    const mode = fanInfoMode(u8(payload, 18));

    return mode ? { ...decoded, mode } : decoded;
  },

  /**
   * Filter: `00 DD LL PP`, DD the days left (0xFF unknown).
   * @param {string} payload
   */
  '10D0'(payload) {
    const days = u8(payload, 1);

    return present({ [Reading.FILTER_DAYS]: days === 0xff ? null : days });
  },

  /**
   * Battery: `00 PP LL`, PP the charge, LL 00 = low.
   * @param {string} payload
   */
  '1060'(payload) {
    const flag = u8(payload, 2);

    return present({
      [Reading.BATTERY]: percent(payload, 1),
      [Reading.BATTERY_LOW]: flag === null ? null : flag === 0,
    });
  },

  /**
   * Ventilation demand a sensor sends to its unit. Long forms carry groups of
   * four bytes `II FF DD 00` (Orcon: `00 0000 00 01 001E 00`); DD is the demand
   * in half percent. The highest group counts.
   * @param {string} payload
   */
  '31E0'(payload) {
    if (payload.length >= 16 && payload.length % 8 === 0) {
      const groups = [];

      for (let offset = 0; offset < payload.length / 2; offset += 4) {
        groups.push(percent(payload, offset + 2));
      }

      const known = groups.filter((value) => value !== null);

      return present({ [Reading.DEMAND]: known.length > 0 ? Math.max(...known) : null });
    }

    return present({ [Reading.DEMAND]: percent(payload, 2) });
  },

  /**
   * Device info. The model name is the readable text in it, such as
   * `VMC-15RP01` (Orcon unit) or `VMS-15CM17` (Orcon CO2 sensor).
   * @param {string} payload
   */
  '10E0'(payload) {
    const runs = (payload.match(/../g) ?? [])
      .map((hex) => parseInt(hex, 16))
      .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ' '))
      .join('')
      .split(' ');
    const model = runs.filter((run) => /^[A-Za-z0-9][\w.-]{3,}$/.test(run)).pop();

    return model ? { model } : {};
  },

  '1298'(payload) {
    return present({ [Reading.CO2]: co2(payload, 1) });
  },

  /**
   * Indoor humidity, optionally followed by the temperature.
   * @param {string} payload
   */
  '12A0'(payload) {
    return present({
      [Reading.HUMIDITY]: humidity(payload, 1),
      [Reading.TEMPERATURE]: payload.length >= 8 ? temperature(payload, 2) : null,
    });
  },

  '1280'(payload) {
    return present({ [Reading.OUTDOOR_HUMIDITY]: humidity(payload, 1) });
  },

  '1260'(payload) {
    return present({ [Reading.TEMPERATURE]: temperature(payload, 1) });
  },
});

/**
 * Decodes what a packet says, using the decoder for its message code.
 * @param {Packet} packet
 * @returns {Decoded} empty for codes without a decoder
 */
export function decode(packet) {
  const decoder = DECODERS[packet.code];

  if (!decoder || packet.verb === 'RQ') {
    return {};
  }

  return decoder(packet.payload);
}

/** @returns {string[]} the codes that have a decoder */
export function decodedCodes() {
  return Object.keys(DECODERS);
}
