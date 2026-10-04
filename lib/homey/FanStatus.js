/** Names of the modes, in the languages of the app. */
const LABELS = Object.freeze({
  away: { en: 'Away', nl: 'Afwezig' },
  low: { en: 'Low', nl: 'Laag' },
  medium: { en: 'Medium', nl: 'Midden' },
  high: { en: 'High', nl: 'Hoog' },
  auto: { en: 'Auto', nl: 'Auto' },
  off: { en: 'Off', nl: 'Uit' },
});

/**
 * The mode of a unit as a word, for the indicator on the device tile
 * ("Auto", "Hoog"). The tile shows a text capability once its value changes.
 */
export class FanStatus {
  /** Capability that carries the name of the mode. */
  static LABEL_CAPABILITY = 'measure_ramses_fan_mode_label';

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
}
