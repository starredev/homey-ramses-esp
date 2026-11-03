/** Names of the modes, in the languages of the app. */
const LABELS = Object.freeze({
  away: { en: 'Away', nl: 'Afwezig' },
  low: { en: 'Low', nl: 'Laag' },
  medium: { en: 'Medium', nl: 'Midden' },
  high: { en: 'High', nl: 'Hoog' },
  auto: { en: 'Auto', nl: 'Auto' },
  off: { en: 'Off', nl: 'Uit' },
});

/** Each mode as a number, from no ventilation up to Auto, for a graph in Insights. */
const LEVELS = Object.freeze({
  off: 0,
  away: 1,
  low: 2,
  medium: 3,
  high: 4,
  auto: 5,
});

/**
 * The mode of a unit as a word, for the indicator on the device tile
 * ("Auto", "Hoog"). The tile shows a text capability once its value changes.
 */
export class FanStatus {
  /** Capability that carries the name of the mode. */
  static LABEL_CAPABILITY = 'measure_ramses_fan_mode_label';

  /** Capability that carries the mode as a number, so Insights can graph it. */
  static LEVEL_CAPABILITY = 'measure_ramses_fan_mode_level';

  /**
   * @param {string} mode
   * @param {string} language
   * @returns {string} the name of the mode, in Dutch or English
   */
  static label(mode, language) {
    const names = LABELS[/** @type {keyof typeof LABELS} */ (mode)];

    if (!names) {
      return mode;
    }

    return language === 'nl' ? names.nl : names.en;
  }

  /**
   * @param {string} mode
   * @returns {number | null} the mode as a number, or `null` for an unknown mode
   */
  static level(mode) {
    return LEVELS[/** @type {keyof typeof LEVELS} */ (mode)] ?? null;
  }
}
