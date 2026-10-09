import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../lib/errors.js';
import { ClimateSensor } from '../lib/domain/ClimateSensor.js';
import { DeviceModel } from '../lib/domain/DeviceModel.js';
import {
  BoostStarted,
  ButtonPressed,
  BypassModeChanged,
  DeviceInfoReceived,
  DeviceDiscovered,
  FanModeChanged,
  ReadingChanged,
  SchemeDetected,
  Source,
} from '../lib/domain/events.js';
import { FanUnit } from '../lib/domain/FanUnit.js';
import { Gateway } from '../lib/domain/Gateway.js';
import { BOOST_BUTTON, Remote } from '../lib/domain/Remote.js';
import { RepeatFilter } from '../lib/domain/RepeatFilter.js';
import { StatusProbe } from '../lib/domain/StatusProbe.js';
import { BusScanner, Role, roleOf } from '../lib/ramses/BusScanner.js';
import { SCHEMES } from '../lib/ramses/FanScheme.js';
import { Packet } from '../lib/ramses/Packet.js';
import { FakeConnection, FakeTimers } from './fakes.js';
import { STATUS_31DA } from './fixtures.js';

const REMOTE = '29:173894';
const UNIT = '29:233244';
const GATEWAY = '18:203612';
const SENSOR = '29:111111';

/**
 * @param {string} line
 * @returns {Packet}
 */
function packet(line) {
  const parsed = Packet.parse(line);

  assert.ok(parsed);

  return parsed;
}

const PRESS_HIGH = packet(` I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000304`);
const PRESS_LOW = packet(` I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000104`);
const PRESS_BOOST = packet(` I --- ${REMOTE} ${UNIT} --:------ 22F3 003 00001E`);
const STATUS = packet(`RP --- ${UNIT} ${GATEWAY} --:------ 31DA 029 ${STATUS_31DA}`);

/**
 * @param {import('node:events').EventEmitter} emitter
 * @returns {unknown[]}
 */
function collect(emitter) {
  /** @type {unknown[]} */
  const events = [];

  emitter.on('event', (event) => events.push(event));

  return events;
}

describe('roleOf', () => {
  it('prefers what a device sends over its prefix', () => {
    assert.equal(roleOf(UNIT, ['31DA']), Role.FAN);
    assert.equal(roleOf(GATEWAY, []), Role.GATEWAY);
    assert.equal(roleOf(GATEWAY, ['31DA']), Role.GATEWAY);
    assert.equal(roleOf(SENSOR, ['1298', '22F1']), Role.SENSOR);
    assert.equal(roleOf(REMOTE, ['22F1', '1060']), Role.REMOTE);
    assert.equal(roleOf('30:123456', ['1FC9']), Role.GATEWAY);
    assert.equal(roleOf('32:123456', ['31E0']), Role.SENSOR);
    assert.equal(roleOf(SENSOR, ['22F1', '31E0']), Role.SENSOR);
    assert.equal(roleOf('01:123456', ['1F09']), Role.UNKNOWN);
    assert.equal(roleOf(UNIT, [], true), Role.FAN);
    assert.equal(roleOf(REMOTE, ['22F1'], true), Role.REMOTE);
  });
});

describe('BusScanner', () => {
  it('learns devices, their codes and who commands whom', () => {
    const timers = new FakeTimers();
    const scanner = new BusScanner({ clock: timers.clock });

    assert.deepEqual(scanner.record(PRESS_HIGH), [REMOTE, UNIT]);
    timers.tick(1000);
    assert.deepEqual(scanner.record(STATUS), [GATEWAY]);
    assert.deepEqual(scanner.record(packet(`045  I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000204`)), []);

    assert.equal(scanner.size, 3);
    assert.deepEqual(scanner.get(REMOTE), {
      id: REMOTE,
      role: Role.REMOTE,
      firstSeen: timers.now - 1000,
      lastSeen: timers.now,
      sent: 2,
      received: 0,
      codes: { '22F1': 2 },
      commands: [UNIT],
      demands: [],
      commanded: false,
      rssi: 45,
      hint: null,
    });
    assert.equal(scanner.get(UNIT)?.role, Role.FAN);
    assert.equal(scanner.get(GATEWAY)?.hint, 'Gateway (ramses_esp / HGI80)');
    assert.equal(scanner.get('01:000001'), null);
    assert.deepEqual(scanner.controllersOf(UNIT), [REMOTE]);
    assert.deepEqual(scanner.list(Role.FAN).map((device) => device.id), [UNIT]);
  });

  it('offers sensors that send a ventilation demand after the remotes', () => {
    const scanner = new BusScanner();

    scanner.record(packet(` I --- 37:242358 ${UNIT} 37:242358 31E0 008 0000000001001E00`));
    assert.deepEqual(scanner.controllersOf(UNIT), ['37:242358']);

    scanner.record(PRESS_HIGH);
    scanner.record(packet(` I --- 37:242358 ${UNIT} 37:242358 31E0 008 0000000001001E00`));
    assert.deepEqual(scanner.controllersOf(UNIT), [REMOTE, '37:242358']);
    assert.equal(scanner.get('37:242358')?.role, Role.SENSOR);
  });

  it('sees a silent device that receives fan commands as a unit', () => {
    const scanner = new BusScanner();

    scanner.record(PRESS_HIGH);
    assert.equal(scanner.get(UNIT)?.role, Role.FAN);

    scanner.record(packet(' I --- 37:242358 29:230674 --:------ 31E0 008 0000000001001E00'));
    assert.equal(scanner.get('29:230674')?.role, Role.FAN);
    assert.equal(new BusScanner({ snapshot: scanner.toJSON() }).get(UNIT)?.role, Role.FAN);
  });

  it('does not learn commands from requests', () => {
    const scanner = new BusScanner();

    scanner.record(packet(`RQ --- ${REMOTE} ${UNIT} --:------ 22F1 001 00`));
    scanner.record(packet(`RQ --- ${GATEWAY} ${UNIT} --:------ 31DA 001 00`));

    assert.deepEqual(scanner.get(GATEWAY)?.codes, {});

    assert.deepEqual(scanner.controllersOf(UNIT), []);
  });

  it('survives a restart through its snapshot', () => {
    const scanner = new BusScanner();

    scanner.record(PRESS_HIGH);
    scanner.record(STATUS);

    const restored = new BusScanner({ snapshot: [...JSON.parse(JSON.stringify(scanner)), { id: 'junk' }] });

    assert.deepEqual(restored.list(), scanner.list());
    const partial = /** @type {any} */ ({ id: REMOTE, firstSeen: 1, lastSeen: 2 });

    assert.deepEqual(new BusScanner({ snapshot: [partial] }).get(REMOTE)?.codes, {});
  });
});

describe('RepeatFilter', () => {
  it('lets the first frame of a burst through', () => {
    const timers = new FakeTimers();
    const filter = new RepeatFilter({ clock: timers.clock });

    assert.equal(filter.isRepeat(PRESS_HIGH), false);
    timers.tick(400);
    assert.equal(filter.isRepeat(PRESS_HIGH), true);
    assert.equal(filter.isRepeat(PRESS_LOW), false);
    timers.tick(RepeatFilter.WINDOW_MS);
    assert.equal(filter.isRepeat(PRESS_HIGH), false);
  });

  it('can check without recording', () => {
    const timers = new FakeTimers();
    const filter = new RepeatFilter({ clock: timers.clock, window: 1000 });

    assert.equal(filter.has(PRESS_HIGH), false);
    filter.remember(PRESS_HIGH);
    assert.equal(filter.has(PRESS_HIGH), true);
    timers.tick(1000);
    assert.equal(filter.has(PRESS_HIGH), false);
  });
});

describe('StatusProbe', () => {
  it('stops after unanswered requests, and keeps going once answered', () => {
    const probe = new StatusProbe();

    assert.equal(probe.supported, null);
    assert.equal(probe.shouldAsk(), true);
    assert.equal(probe.shouldAsk(), true);
    assert.equal(probe.shouldAsk(), false);
    assert.equal(probe.supported, false);
    assert.equal(probe.shouldAsk(), false);

    const answered = new StatusProbe();

    answered.shouldAsk();
    answered.answered();

    for (let round = 0; round < 5; round += 1) {
      assert.equal(answered.shouldAsk(), true);
    }

    assert.equal(answered.supported, true);
  });
});

describe('DeviceModel', () => {
  it('routes packets by direction and ignores others', () => {
    const model = new DeviceModel({ address: UNIT });

    assert.equal(model.accept(STATUS), true);
    assert.equal(model.accept(PRESS_HIGH), true);
    assert.equal(model.accept(packet(` I --- ${SENSOR} --:------ ${SENSOR} 1298 003 00028A`)), false);
    assert.ok(model.lastSeen);
  });

  it('tells its model once (10E0)', () => {
    const model = new DeviceModel({ address: UNIT });
    const events = collect(model);
    const info = packet(`RP --- ${UNIT} ${GATEWAY} --:------ 10E0 029 000001C8260E0467FFFFFFFFFFFFFFFFFFFF564D432D31355250303100`);

    model.accept(info);
    model.accept(info);

    assert.equal(model.model, 'VMC-15RP01');
    assert.deepEqual(events, [new DeviceInfoReceived('VMC-15RP01')]);
  });

  it('emits a reading only when it changes', () => {
    const model = new DeviceModel({ address: UNIT });
    const events = collect(model);

    model.applyReadings({ co2: 600 });
    model.applyReadings({ co2: 600 });
    model.applyReadings({ co2: 650 });
    model.applyReadings(undefined);

    assert.deepEqual(events, [new ReadingChanged('co2', 600, undefined), new ReadingChanged('co2', 650, 600)]);
    assert.equal(model.reading('co2'), 650);
    assert.deepEqual(model.readings(), { co2: 650 });
  });
});

describe('FanUnit', () => {
  /**
   * @param {object} [options]
   * @param {string | null} [options.remote]
   */
  function unit({ remote = REMOTE } = {}) {
    /** @type {Packet[]} */
    const sent = [];
    const timers = new FakeTimers();
    const fan = new FanUnit({
      address: UNIT,
      remote,
      gateway: GATEWAY,
      clock: timers.clock,
      send: async (frame) => {
        sent.push(frame);
      },
    });

    return {
      fan, sent, timers, events: collect(fan),
    };
  }

  it('follows its own status report', () => {
    const { fan, events } = unit();

    fan.accept(STATUS);

    assert.equal(fan.mode, 'medium');
    assert.equal(fan.reading('co2'), 650);
    assert.ok(events.some((event) => event instanceof FanModeChanged && event.source === Source.UNIT));
  });

  it('follows the commands of a remote, once per burst', () => {
    const { fan, events } = unit();

    fan.accept(PRESS_HIGH);
    fan.accept(PRESS_HIGH);
    fan.accept(PRESS_BOOST);
    fan.accept(packet(`RQ --- ${GATEWAY} ${UNIT} --:------ 31DA 001 00`));

    assert.deepEqual(events, [
      new FanModeChanged('high', null, Source.REMOTE, REMOTE),
      new BoostStarted(30, Source.REMOTE, REMOTE),
    ]);
  });

  it('sets the mode in the name of the remote', async () => {
    const { fan, sent, events } = unit();

    await fan.setMode('low');

    assert.equal(sent[0].toFrame(), ` I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000104`);
    assert.deepEqual(events, [new FanModeChanged('low', null, Source.HOMEY, REMOTE)]);
  });

  it('does not fire again when its own command is heard back', async () => {
    const { fan, events } = unit();

    await fan.setMode('low');
    fan.accept(PRESS_LOW, { echo: true });

    assert.equal(events.length, 1);
  });

  it('boosts, resets the filter and asks for its status', async () => {
    const { fan, sent, events } = unit();

    await fan.boost(20);
    await fan.resetFilter();
    await fan.requestStatus();

    assert.deepEqual(sent.map((frame) => frame.code), ['22F3', '10D0', '31D9', '31DA', '12A0', '10D0', '22F7']);
    assert.equal(sent[2].src, GATEWAY);
    assert.equal(sent[2].verb, 'RQ');
    assert.deepEqual(events, [new BoostStarted(20, Source.HOMEY, REMOTE)]);
  });

  it('stops asking for optional codes the unit never answers', async () => {
    const { fan, sent } = unit();

    for (let round = 0; round < 4; round += 1) {
      await fan.requestStatus();
    }

    assert.deepEqual(sent.map((frame) => frame.code), [
      '31D9', '31DA', '12A0', '10D0', '22F7',
      '31D9', '31DA', '12A0', '10D0', '22F7',
      '31D9',
      '31D9',
    ]);
    assert.equal(fan.extended, false);
    assert.equal(fan.humidity, false);
  });

  it('keeps asking for the humidity of a unit with a humidity sensor (Orcon RHB)', async () => {
    const { fan, sent } = unit();

    await fan.requestStatus();
    fan.accept(packet(`RP --- ${UNIT} ${GATEWAY} --:------ 12A0 002 003A`));
    await fan.requestStatus();
    await fan.requestStatus();
    await fan.requestStatus();

    assert.equal(fan.humidity, true);
    assert.equal(fan.reading('humidity'), 58);
    assert.deepEqual(sent.slice(-2).map((frame) => frame.code), ['31D9', '12A0']);
  });

  it('keeps asking for the extended status once the unit answered it', async () => {
    const { fan, sent } = unit();

    await fan.requestStatus();
    await fan.requestStatus();
    fan.accept(STATUS);
    await fan.requestStatus();
    await fan.requestStatus();

    assert.equal(fan.extended, true);
    assert.deepEqual(sent.slice(-2).map((frame) => frame.code), ['31D9', '31DA']);
    assert.equal(fan.humidity, false);
  });

  it('follows the mode an Orcon unit reports in 31D9', () => {
    const { fan, events } = unit();

    fan.accept(packet(` I --- ${UNIT} --:------ ${UNIT} 31D9 003 000004`));
    fan.accept(packet(`RP --- ${UNIT} ${GATEWAY} --:------ 31D9 003 000004`));

    assert.equal(fan.mode, 'auto');
    assert.deepEqual(events.filter((event) => event instanceof FanModeChanged), [
      new FanModeChanged('auto', null, Source.UNIT),
    ]);
    assert.equal(fan.reading('fault'), false);
    assert.equal(fan.reading('filterDirty'), false);
  });

  it('follows a timed boost of a control sensor (Orcon CO2 15RF)', () => {
    const { fan, events } = unit();

    fan.accept(packet(` I --- ${SENSOR} ${UNIT} --:------ 22F3 007 00123C03040404`));

    assert.equal(fan.mode, 'high');
    assert.deepEqual(events, [
      new FanModeChanged('high', null, Source.REMOTE, SENSOR),
      new BoostStarted(60, Source.REMOTE, SENSOR),
    ]);
  });

  it('learns the brand when a remote reveals it, unless told not to', () => {
    const { fan, events } = unit();

    fan.accept(packet(` I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000506`));

    assert.equal(fan.scheme, SCHEMES.vasco);
    assert.equal(fan.mode, 'auto');
    assert.ok(events.some((event) => event instanceof SchemeDetected && event.scheme === 'vasco'));

    const fixed = unit();

    fixed.fan.configure({ learnScheme: false });
    fixed.fan.accept(packet(` I --- ${REMOTE} ${UNIT} --:------ 22F1 003 000506`));
    assert.equal(fixed.fan.scheme, SCHEMES.orcon);
  });

  it('commands in the numbering of its brand', async () => {
    const { fan, sent } = unit();

    fan.configure({ scheme: SCHEMES.itho });
    await fan.setMode('high');
    await fan.boost(10);

    assert.deepEqual(sent.map((frame) => frame.payload), ['000404', '00000A']);
    await assert.rejects(fan.setMode('auto'), ValidationError);
  });

  it('follows and sets the bypass of a heat recovery unit', async () => {
    const { fan, sent, events } = unit();

    fan.accept(packet(`RP --- ${UNIT} ${GATEWAY} --:------ 22F7 003 00FF00`));
    assert.equal(fan.bypassMode, 'auto');
    assert.equal(fan.reading('bypass'), 0);

    await fan.setBypass('on');
    await fan.setBypass('on');

    assert.equal(sent[0].toFrame(), ` W --- ${REMOTE} ${UNIT} --:------ 22F7 003 00C8EF`);
    assert.deepEqual(events.filter((event) => event instanceof BypassModeChanged), [
      new BypassModeChanged('auto'),
      new BypassModeChanged('on'),
    ]);
    await assert.rejects(fan.setBypass('half'), ValidationError);
    assert.equal(fan.supports('22F7'), true);
  });

  it('refuses commands without a valid remote or gateway', async () => {
    const { fan } = unit({ remote: null });

    await assert.rejects(fan.setMode('high'), ValidationError);
    fan.configure({ remote: 'not-an-address' });
    await assert.rejects(fan.boost(10), ValidationError);
    fan.configure({ remote: REMOTE, gateway: '' });
    assert.equal(fan.remote, REMOTE);
    await assert.rejects(fan.requestStatus(), ValidationError);
    fan.configure({});
    assert.equal(fan.remote, REMOTE);
  });
});

describe('Remote', () => {
  it('turns a burst of frames into one button press', () => {
    const timers = new FakeTimers();
    const remote = new Remote({ address: REMOTE, clock: timers.clock });
    const events = collect(remote);

    remote.accept(PRESS_HIGH);
    remote.accept(PRESS_HIGH);
    timers.tick(5000);
    remote.accept(PRESS_HIGH);
    remote.accept(PRESS_BOOST);

    assert.deepEqual(events, [
      new ButtonPressed('high', UNIT),
      new ButtonPressed('high', UNIT),
      new ButtonPressed(BOOST_BUTTON, UNIT, 30),
    ]);
    assert.equal(remote.lastButton, BOOST_BUTTON);
  });

  it('ignores Homey speaking in its name, and non-commands', () => {
    const remote = new Remote({ address: REMOTE });
    const events = collect(remote);

    remote.accept(PRESS_HIGH, { echo: true });
    remote.accept(packet(`RQ --- ${REMOTE} ${UNIT} --:------ 22F1 001 00`));
    remote.accept(packet(` I --- ${REMOTE} --:------ ${REMOTE} 1060 003 00C801`));

    assert.deepEqual(events, [new ReadingChanged('battery', 100, undefined), new ReadingChanged('batteryLow', false, undefined)]);
  });
});

describe('ClimateSensor', () => {
  it('reports its measurements', () => {
    const sensor = new ClimateSensor({ address: SENSOR });
    const events = collect(sensor);

    sensor.accept(packet(` I --- ${SENSOR} --:------ ${SENSOR} 1298 003 00028A`));

    assert.deepEqual(events, [new ReadingChanged('co2', 650, undefined)]);
  });

  it('reports the buttons of a control sensor (Orcon CO2 15RF)', () => {
    const sensor = new ClimateSensor({ address: SENSOR });
    const events = collect(sensor);

    sensor.accept(packet(` I --- ${SENSOR} ${UNIT} --:------ 22F3 007 00123C03040404`));
    sensor.accept(packet(` I --- ${SENSOR} ${UNIT} --:------ 22F3 007 00123C03040404`));
    sensor.accept(packet(` I --- ${SENSOR} ${UNIT} --:------ 22F1 003 000404`));

    assert.deepEqual(events, [new ButtonPressed('high', UNIT, 60), new ButtonPressed('auto', UNIT)]);
  });
});

describe('Gateway', () => {
  it('forwards packets, scans the bus and reports discoveries', () => {
    const connection = new FakeConnection(GATEWAY);
    const gateway = new Gateway({ connection: /** @type {any} */ (connection) });
    /** @type {unknown[]} */
    const events = [];

    gateway.on('packet', (frame, context) => events.push([frame.code, context.echo]));
    gateway.on('discovered', (event) => events.push(event));
    connection.hear(PRESS_HIGH);

    assert.deepEqual(events, [
      ['22F1', false],
      new DeviceDiscovered(REMOTE, Role.REMOTE),
      new DeviceDiscovered(UNIT, Role.FAN),
    ]);
    assert.equal(gateway.packetCount, 1);
    assert.equal(gateway.scanner.size, 2);
    assert.equal(gateway.id, GATEWAY);
  });

  it('marks its own transmissions as echo', async () => {
    const connection = new FakeConnection(GATEWAY);
    const gateway = new Gateway({ connection: /** @type {any} */ (connection) });
    /** @type {boolean[]} */
    const echoes = [];

    gateway.on('packet', (_frame, context) => echoes.push(context.echo));
    connection.connect();
    await gateway.send(PRESS_HIGH);
    connection.hear(PRESS_HIGH);

    assert.deepEqual(echoes, [true]);
    assert.deepEqual(connection.sent, [PRESS_HIGH]);
  });

  it('passes connection state through', () => {
    const connection = new FakeConnection(GATEWAY);
    const gateway = new Gateway({ connection: /** @type {any} */ (connection) });
    const events = [];

    for (const name of ['connected', 'disconnected', 'online', 'authFailed']) {
      gateway.on(name, (value) => events.push(value === undefined ? name : [name, value]));
    }

    gateway.start();
    assert.equal(connection.started, true);
    assert.equal(gateway.online, null);
    connection.connect();
    connection.emit('online', false);
    connection.emit('authFailed', 'nope');
    connection.emit('disconnected');
    gateway.stop();

    assert.deepEqual(events, ['connected', ['online', false], ['authFailed', 'nope'], 'disconnected']);
    assert.equal(gateway.online, false);
    assert.equal(gateway.connected, true);
    assert.equal(connection.started, false);
    assert.equal(gateway.connection, connection);
  });
});
