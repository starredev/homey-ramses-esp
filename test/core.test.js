import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AuthError,
  NotConnectedError,
  NotFoundError,
  NotReachableError,
  RamsesError,
  ValidationError,
} from '../lib/errors.js';
import { Batcher, Debouncer, delay } from '../lib/timers.js';
import {
  clamp, loggerFrom, roundTo, silentLogger, toFiniteNumber,
} from '../lib/utils.js';
import { FakeTimers, flush } from './fakes.js';

describe('errors', () => {
  it('carry a stable code and name', () => {
    const cases = [
      [new ValidationError('x'), 'VALIDATION'],
      [new NotConnectedError(), 'NOT_CONNECTED'],
      [new NotConnectedError('broker'), 'NOT_CONNECTED'],
      [new NotReachableError('h:1'), 'NOT_REACHABLE'],
      [new AuthError(), 'AUTH'],
      [new NotFoundError('x'), 'NOT_FOUND'],
      [new RamsesError('x'), 'RAMSES_ERROR'],
    ];

    for (const [error, code] of cases) {
      assert.ok(error instanceof RamsesError);
      assert.equal(/** @type {RamsesError} */ (error).code, code);
      assert.equal(/** @type {Error} */ (error).name, error.constructor.name);
    }

    assert.match(new NotConnectedError('broker').message, /broker/);
  });
});

describe('timers', () => {
  it('debounces bursts into one call', () => {
    const timers = new FakeTimers();
    let calls = 0;
    const debouncer = new Debouncer(timers, 100, () => {
      calls += 1;
    });

    debouncer.schedule();
    timers.tick(50);
    debouncer.schedule();
    assert.equal(debouncer.pending, true);
    timers.tick(100);
    assert.equal(calls, 1);
    debouncer.schedule();
    debouncer.cancel();
    debouncer.cancel();
    timers.tick(200);
    assert.equal(calls, 1);
  });

  it('batches items per interval', () => {
    const timers = new FakeTimers();
    /** @type {number[][]} */
    const batches = [];
    const batcher = new Batcher(timers, 100, (items) => batches.push(items));

    batcher.push(1);
    batcher.push(2);
    timers.tick(100);
    batcher.push(3);
    timers.tick(100);
    batcher.cancel();

    assert.deepEqual(batches, [[1, 2], [3]]);
  });

  it('delays on the given timers', async () => {
    const timers = new FakeTimers();
    let done = false;

    delay(timers, 50).then(() => {
      done = true;
    });
    timers.tick(50);
    await flush();

    assert.equal(done, true);
  });
});

describe('utils', () => {
  it('binds a logger and offers a silent one', () => {
    /** @type {unknown[]} */
    const seen = [];
    const logger = loggerFrom({
      log: (...args) => seen.push(['log', ...args]),
      error: (...args) => seen.push(['error', ...args]),
    });

    logger.log('a');
    logger.error('b');
    silentLogger.log('ignored');
    silentLogger.error('ignored');

    assert.deepEqual(seen, [['log', 'a'], ['error', 'b']]);
  });

  it('handles numbers', () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(roundTo(1)(1.26), 1.3);
    assert.equal(toFiniteNumber('x', 7), 7);
    assert.equal(toFiniteNumber('2', 7), 2);
  });
});
