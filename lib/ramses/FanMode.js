/**
 * The fan modes this app speaks of, independent of brand. How a brand numbers
 * them on the bus is up to its `FanScheme`.
 */
export const FanMode = Object.freeze({
  OFF: 'off',
  AWAY: 'away',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  AUTO: 'auto',
});

/** @returns {string[]} every mode, in the order of a remote */
export function fanModes() {
  return [FanMode.LOW, FanMode.MEDIUM, FanMode.HIGH, FanMode.AUTO, FanMode.AWAY, FanMode.OFF];
}
