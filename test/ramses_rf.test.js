/**
 * Checks the decoders against the packet logs of ramses_rf (see
 * fixtures/ramses_rf/README.md): for every frame with known values, the
 * readings this app decodes must match what ramses_rf decodes.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { decode } from '../lib/ramses/decoders.js';
import { Packet } from '../lib/ramses/Packet.js';

const FIXTURES = new URL('./fixtures/ramses_rf/', import.meta.url);

/**
 * A fraction (0..1) in ramses_rf is a percentage here.
 * @param {number} value
 * @returns {number}
 */
const percent = (value) => value * 100;

/**
 * @typedef {[string, string, ((value: any) => unknown)?]} FieldMap
 * ramses_rf key, key in this app's decoded output, conversion
 */

/** Per fixture file: which ramses_rf values map onto which of ours. */
/** @type {Record<string, FieldMap[]>} */
const FIELDS = {
  'code_1060.log': [['battery_low', 'readings.batteryLow'], ['battery_level', 'readings.battery', percent]],
  'code_10d0.log': [['days_remaining', 'readings.filterDays'], ['percent_remaining', 'readings.filterRemaining', percent]],
  'code_10e0.log': [['description', 'model']],
  'code_1260.log': [['temperature', 'readings.temperature']],
  'code_1298.log': [['co2_level', 'readings.co2']],
  'code_12a0.log': [['indoor_humidity', 'readings.humidity', percent], ['temperature', 'readings.temperature']],
  'code_12c0.log': [['temperature', 'readings.temperature']],
  'code_22f3.log': [['minutes', 'boostMinutes']],
  'code_22f7.log': [['bypass_position', 'readings.bypass', percent], ['bypass_mode', 'bypassMode']],
  'code_2e10_wip.log': [['presence_detected', 'readings.presence']],
  'code_31d9.log': [
    ['has_fault', 'readings.fault'],
    ['filter_dirty', 'readings.filterDirty'],
    ['frost_cycle', 'readings.frostProtection'],
  ],
  'code_31d9_orcon.log': [
    ['has_fault', 'readings.fault'],
    ['filter_dirty', 'readings.filterDirty'],
    ['frost_cycle', 'readings.frostProtection'],
  ],
  'code_31da.log': [
    ['co2_level', 'readings.co2'],
    ['indoor_humidity', 'readings.humidity', percent],
    ['outdoor_humidity', 'readings.outdoorHumidity', percent],
    ['exhaust_temp', 'readings.exhaustTemperature'],
    ['supply_temp', 'readings.supplyTemperature'],
    ['indoor_temp', 'readings.temperature'],
    ['outdoor_temp', 'readings.outdoorTemperature'],
    ['bypass_position', 'readings.bypass', percent],
    ['exhaust_fan_speed', 'readings.fanSpeed', percent],
    ['supply_fan_speed', 'readings.supplyFanSpeed', percent],
    ['remaining_mins', 'readings.boostRemaining'],
    ['air_quality', 'readings.airQuality', percent],
    ['post_heat', 'readings.postHeater', percent],
    ['pre_heat', 'readings.preHeater', percent],
    ['supply_flow', 'readings.supplyFlow'],
    ['exhaust_flow', 'readings.exhaustFlow'],
  ],
  'code_31e0.log': [['vent_demand', 'readings.demand', percent]],
};

/**
 * Turns a Python dict literal, as ramses_rf writes it in its logs, into JSON.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function pythonDict(text) {
  const json = text
    .replace(/'/g, '"')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/,\s*}/g, '}');

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @param {string} file
 * @returns {Array<{ line: number, frame: string, expected: Record<string, unknown> }>}
 */
function cases(file) {
  const text = readFileSync(new URL(file, FIXTURES), 'utf8');

  return text.split(/\r?\n/).flatMap((row, index) => {
    if (row.startsWith('#') || !row.includes('#')) {
      return [];
    }

    const [left, right] = [row.slice(0, row.indexOf('#')), row.slice(row.indexOf('#') + 1)];
    const frame = left.trim().split(/\s+/).slice(2).join(' ');
    const expected = pythonDict(right.trim());

    if (!expected || Array.isArray(expected)) {
      return [];
    }

    return [{ line: index + 1, frame, expected }];
  });
}

/**
 * @param {Record<string, any>} object
 * @param {string} path
 * @returns {unknown}
 */
function pick(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

/**
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {boolean}
 */
function same(actual, expected) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) < 0.51;
  }

  return actual === expected;
}

describe('decoders match ramses_rf', () => {
  for (const [file, fields] of Object.entries(FIELDS)) {
    it(file, () => {
      const failures = [];
      let checked = 0;

      for (const { line, frame, expected } of cases(file)) {
        const packet = Packet.parse(frame);

        if (!packet) {
          continue;
        }

        const decoded = decode(packet);

        for (const [theirs, ours, convert = (/** @type {unknown} */ value) => value] of fields) {
          if (!(theirs in expected)) {
            continue;
          }

          const want = expected[theirs] === null ? undefined : convert(expected[theirs]);
          const got = pick(decoded, ours);

          checked += 1;

          if (!same(got, want)) {
            failures.push(`line ${line} ${theirs}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}  (${frame})`);
          }
        }
      }

      assert.ok(checked > 0, `no values checked in ${file}`);
      assert.deepEqual(failures, [], failures.slice(0, 15).join('\n'));
    });
  }
});
