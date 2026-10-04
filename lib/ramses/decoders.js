import { DEFAULT_SCHEME, schemeBySuffix } from './FanScheme.js';

/** @typedef {import('./Packet.js').Packet} Packet */
/** @typedef {import('./FanScheme.js').FanScheme} FanScheme */

/**
 * @typedef {object} Decoded
 * What one packet tells about the device that sent it (or, for commands, the
 * device it was sent to). Every field is optional.
 * @property {Record<string, number | boolean>} [readings] measurements by key, see {@link Reading}
 * @property {string} [mode] a fan mode, see `FanMode`
 * @property {number} [boostMinutes] a boost timer that was started
 * @property {string} [model] the model name a device reports about itself
 * @property {string} [bypassMode] `auto`, `on` (open) or `off` (closed)
 * @property {FanScheme} [scheme] the brand a command reveals, if any
 */

/**
 * @typedef {object} DecodeOptions
 * @property {FanScheme} [scheme] how the unit numbers its modes
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
  SUPPLY_FLOW: 'supplyFlow',
  EXHAUST_FLOW: 'exhaustFlow',
  POST_HEATER: 'postHeater',
  PRE_HEATER: 'preHeater',
  BOOST_REMAINING: 'boostRemaining',
  FILTER_DAYS: 'filterDays',
  FILTER_REMAINING: 'filterRemaining',
  FILTER_DIRTY: 'filterDirty',
  FAULT: 'fault',
  FROST_PROTECTION: 'frostProtection',
  DEMAND: 'demand',
  PRESENCE: 'presence',
  BATTERY: 'battery',
  BATTERY_LOW: 'batteryLow',
});

/** Highest value a `31D9` reports as a mode, on brands that report modes there. */
const MAX_MODE_NUMBER = 0x07;

/** Device types whose `2E10` is a presence sensor (else it is a heating system mode). */
const PRESENCE_TYPES = Object.freeze(['21', '32', '37']);

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
 * Percentage in half percent steps (0..200). Values above 200 are markers
 * for "not available" or a sensor fault.
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
 * Relative humidity as a plain percentage; values above 100 are markers.
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
 * Signed hundredths of a degree. 7FFF and 31FF mean "not available", 7EFF
 * "off", and 80..9F in the high byte a sensor fault.
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null}
 */
function temperature(payload, byte) {
  const raw = u16(payload, byte);

  if (raw === null || raw === 0x7fff || raw === 0x7eff || raw === 0x31ff) {
    return null;
  }

  const high = raw >> 8;

  if ((high & 0xe0) === 0x80 || (high & 0xe0) === 0x90) {
    return null;
  }

  const signed = raw > 0x7fff ? raw - 0x10000 : raw;

  return Math.round(signed) / 100;
}

/**
 * CO₂ in ppm; 7FFF and up mean "not available" or a fault.
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
 * Flow in hundredths of a litre per second; 7FFF and up mean "not available".
 * @param {string} payload
 * @param {number} byte
 * @returns {number | null}
 */
function flow(payload, byte) {
  const raw = u16(payload, byte);

  if (raw === null || raw >= 0x7fff) {
    return null;
  }

  return raw / 100;
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

/**
 * The fault, filter and frost flags of a `31D9` status byte.
 * @param {number | null} flags
 * @returns {Record<string, boolean | null>}
 */
function stateFlags(flags) {
  if (flags === null || flags === 0xff) {
    return {};
  }

  return {
    [Reading.FAULT]: (flags & 0x80) !== 0,
    [Reading.FILTER_DIRTY]: (flags & 0x20) !== 0,
    [Reading.FROST_PROTECTION]: (flags & 0x10) !== 0,
  };
}

// --- Fan info of 31DA -------------------------------------------------------

/** Fan info values of `31DA` (lower five bits) that map onto a mode (ramses_rf `_31DA_FAN_INFO`). */
const FAN_INFO_MODES = Object.freeze({
  0x00: 'off',
  0x01: 'low',
  0x02: 'medium',
  0x03: 'high',
  0x0b: 'low',
  0x0c: 'medium',
  0x0d: 'high',
  0x15: 'away',
  0x16: 'away',
  0x17: 'high',
  0x18: 'auto',
  0x19: 'auto',
});

/**
 * @param {number | null} raw
 * @returns {string | undefined}
 */
function fanInfoMode(raw) {
  if (raw === null || raw === 0xef || raw === 0xff) {
    return undefined;
  }

  return FAN_INFO_MODES[/** @type {keyof typeof FAN_INFO_MODES} */ (raw & 0x1f)];
}

// --- Decoders per message code ------------------------------------------------

/**
 * @typedef {object} DecodeContext
 * @property {FanScheme} scheme how the unit numbers its modes
 * @property {Packet} packet the whole packet, for decoders that depend on the sender
 */

/**
 * @callback Decoder
 * @param {string} payload
 * @param {DecodeContext} context
 * @returns {Decoded}
 */

/**
 * One decoder per message code. Layouts and markers follow ramses_rf and are
 * checked against its packet logs (test/ramses_rf.test.js).
 * @type {Readonly<Record<string, Decoder>>}
 */
const DECODERS = Object.freeze({
  /**
   * Fan mode command: `00 RR SS`, RR the mode in the numbering of the brand,
   * SS its highest number (06 reveals Vasco, 0A Nuaire).
   * @param {string} payload
   * @param {DecodeContext} context
   */
  '22F1'(payload, context) {
    const revealed = schemeBySuffix(payload.slice(4, 6));
    const used = revealed ?? context.scheme;
    const mode = used.modeOf(payload.slice(2, 4));

    return {
      ...(mode ? { mode } : {}),
      ...(revealed ? { scheme: revealed } : {}),
    };
  },

  /**
   * Boost timer: `00 FF DD`, in hours when the lower bits of FF are 01
   * (long form: bit 0x40), otherwise in minutes. The long form of Orcon
   * (`00 12 3C 03 04 04 04`, sent by the CO2 15RF for "High") adds the mode
   * during the timer and the mode after it.
   * @param {string} payload
   * @param {DecodeContext} context
   */
  '22F3'(payload, context) {
    const flags = u8(payload, 1);
    const duration = u8(payload, 2);

    if (duration === null) {
      return {};
    }

    const long = payload.length >= 14;
    const inHours = flags !== null && (long ? (flags & 0x40) !== 0 : (flags & 0x07) === 1);
    /** @type {Decoded} */
    const decoded = { boostMinutes: inHours ? duration * 60 : duration };
    const mode = long ? context.scheme.modeOf(payload.slice(6, 8)) : null;

    return mode ? { ...decoded, mode } : decoded;
  },

  /**
   * Fan state: `00 FF SS`, FF status flags (fault, filter, frost). SS is the
   * mode on brands that report it there (Orcon, Vasco), else the speed in
   * half percent. Orcon also sends a four-byte form `00 FF SS 00`.
   * @param {string} payload
   * @param {DecodeContext} context
   */
  '31D9'(payload, context) {
    const flags = u8(payload, 1);
    const value = u8(payload, 2);
    const readings = stateFlags(flags);

    if (context.scheme.stateIsMode && flags !== 0xff && value !== null && value <= MAX_MODE_NUMBER) {
      const mode = context.scheme.modeOf(payload.slice(4, 6));

      return { ...present(readings), ...(mode ? { mode } : {}) };
    }

    return present({ ...readings, [Reading.FAN_SPEED]: percent(payload, 2) });
  },

  /**
   * Extended ventilation status of a heat recovery unit.
   * @param {string} payload
   */
  '31DA'(payload) {
    if (payload.length < 58) {
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
      [Reading.BOOST_REMAINING]: remaining === null || remaining === 0x3fff || remaining === 0xffff ? null : remaining,
      [Reading.POST_HEATER]: percent(payload, 23),
      [Reading.PRE_HEATER]: percent(payload, 24),
      [Reading.SUPPLY_FLOW]: flow(payload, 25),
      [Reading.EXHAUST_FLOW]: flow(payload, 27),
    });
    const mode = fanInfoMode(u8(payload, 18));

    return mode ? { ...decoded, mode } : decoded;
  },

  /**
   * Filter: `00 DD LL PP ..`, DD days left, LL lifetime, PP percent left (half percent).
   * @param {string} payload
   */
  '10D0'(payload) {
    if (payload.length < 8) {
      return {};
    }

    const days = u8(payload, 1);
    const left = u8(payload, 3);

    return present({
      [Reading.FILTER_DAYS]: days === null || days >= 0xfe ? null : days,
      [Reading.FILTER_REMAINING]: left === null || left >= 0xfe ? null : left / 2,
    });
  },

  /**
   * Battery: `00 PP LL`, PP the charge (00 and FF unknown), LL 00 = low.
   * @param {string} payload
   */
  '1060'(payload) {
    const level = u8(payload, 1);
    const flag = u8(payload, 2);

    return present({
      [Reading.BATTERY]: level === null || level === 0 || level > 200 ? null : level / 2,
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
   * Device info. The description starts at byte 18 and runs to the first
   * zero byte: `VMC-15RP01` (Orcon unit), `Evo Color` (evohome controller).
   * @param {string} payload
   */
  '10E0'(payload) {
    if (payload.length <= 36) {
      return {};
    }

    const text = (payload.slice(36).match(/../g) ?? [])
      .map((hex) => parseInt(hex, 16))
      .reduce((acc, byte) => (acc.done || byte === 0 ? { ...acc, done: true } : { ...acc, text: acc.text + String.fromCharCode(byte) }), { text: '', done: false })
      .text
      .trim();

    return /^[\x20-\x7e]+$/.test(text) ? { model: text } : {};
  },

  /**
   * Bypass: `00 MM PP`, MM the mode (00 closed, C8 open, FF auto), PP the position.
   * @param {string} payload
   */
  '22F7'(payload) {
    const mode = { 0x00: 'off', 0xc8: 'on', 0xff: 'auto' }[/** @type {0 | 200 | 255} */ (u8(payload, 1) ?? -1)];
    const position = u8(payload, 2);

    return {
      ...(mode ? { bypassMode: mode } : {}),
      ...present({ [Reading.BYPASS]: position === null || position === 0xef ? null : percent(payload, 2) }),
    };
  },

  /**
   * Presence of a presence sensor: `00 VV ..`, VV 00 = nobody.
   * @param {string} payload
   * @param {DecodeContext} context
   */
  '2E10'(payload, context) {
    if (!PRESENCE_TYPES.includes(context.packet.src.slice(0, 2)) || payload.length < 4) {
      return {};
    }

    return present({ [Reading.PRESENCE]: u8(payload, 1) !== 0 });
  },

  /**
   * Air quality: `00 QQ BB`, QQ in half percent, BB what it is based on (VOC, CO₂, humidity).
   * @param {string} payload
   */
  '12C8'(payload) {
    return present({ [Reading.AIR_QUALITY]: percent(payload, 1) });
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

  /**
   * Room temperature of a heating sensor: `00 TT UU`, TT in half degrees
   * Celsius (UU 01) or degrees Fahrenheit, 80 unknown; or signed hundredths.
   * @param {string} payload
   */
  '12C0'(payload) {
    if (payload.length >= 6 && payload.startsWith('00')) {
      const raw = u8(payload, 1);
      const units = u8(payload, 2);

      if (raw === null || raw === 0x80) {
        return {};
      }

      const celsius = units === 1 ? raw / 2 : Math.round((raw - 32) * 5 / 9 * 100) / 100;

      return present({ [Reading.TEMPERATURE]: celsius });
    }

    return present({ [Reading.TEMPERATURE]: temperature(payload, 0) });
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
 * @param {DecodeOptions} [options]
 * @returns {Decoded} empty for codes without a decoder
 */
export function decode(packet, { scheme = DEFAULT_SCHEME } = {}) {
  const decoder = DECODERS[packet.code];

  if (!decoder || packet.verb === 'RQ') {
    return {};
  }

  return decoder(packet.payload, { scheme, packet });
}

/** @returns {string[]} the codes that have a decoder */
export function decodedCodes() {
  return Object.keys(DECODERS);
}
