import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotConnectedError, NotFoundError, ValidationError } from '../lib/errors.js';
import {
  BoostStarted, ButtonPressed, DeviceDiscovered, FanModeChanged, ReadingChanged, Source,
} from '../lib/domain/events.js';
import { Gateway } from '../lib/domain/Gateway.js';
import { CapabilityStore } from '../lib/homey/CapabilityStore.js';
import { FanCards, FanFlowCards } from '../lib/homey/flows/FanFlowCards.js';
import { FlowCardSet } from '../lib/homey/flows/FlowCardSet.js';
import { GatewayCards, GatewayFlowCards } from '../lib/homey/flows/GatewayFlowCards.js';
import { RemoteCards, RemoteFlowCards, SENSOR_PREFIX } from '../lib/homey/flows/RemoteFlowCards.js';
import { GatewayRegistry } from '../lib/homey/GatewayRegistry.js';
import { PacketPresenter, RingBuffer } from '../lib/homey/PacketPresenter.js';
import {
  DevicePairing,
  GATEWAY_NAME,
  GatewayPairing,
  NoGatewayAddedError,
  NoGatewaysError,
} from '../lib/homey/Pairing.js';
import { RamsesApi } from '../lib/homey/RamsesApi.js';
import { LEGACY_CAPABILITIES, READING_BINDINGS, ReadingCapabilities } from '../lib/homey/ReadingCapabilities.js';
import { FanPresenter } from '../lib/homey/FanPresenter.js';
import { FanStatus } from '../lib/homey/FanStatus.js';
import { Channels, RealtimeHub } from '../lib/homey/RealtimeHub.js';
import { Role } from '../lib/ramses/BusScanner.js';
import { Packet } from '../lib/ramses/Packet.js';
import {
  FakeCapabilityHost,
  FakeConnection,
  FakeFlow,
  FakeTimers,
  flush,
  recordingLogger,
} from './fakes.js';

const REMOTE = '29:173894';
const UNIT = '29:233244';
const GATEWAY = '18:203612';

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

/**
 * @param {string} [id]
 * @returns {{ gateway: Gateway, connection: FakeConnection }}
 */
function gatewayWith(id = GATEWAY) {
  const connection = new FakeConnection(id);

  return { gateway: new Gateway({ connection: /** @type {any} */ (connection) }), connection };
}

describe('CapabilityStore', () => {
  it('skips writes that change nothing and missing capabilities', async () => {
    const host = new FakeCapabilityHost(['measure_co2']);
    const store = new CapabilityStore(host, recordingLogger());

    await store.set('measure_co2', 600);
    await store.set('measure_co2', 600);
    await store.set('measure_humidity', 50);

    assert.equal(store.get('measure_co2'), 600);
    assert.equal(store.get('measure_humidity'), null);
    assert.equal(store.has('measure_humidity'), false);
  });

  it('logs failed writes instead of throwing', async () => {
    const host = new FakeCapabilityHost(['measure_co2']);
    const logger = recordingLogger();

    host.failSet = new Error('busy');
    await new CapabilityStore(host, logger).set('measure_co2', 1);

    assert.equal(logger.errors.length, 1);
  });

  it('adds and removes capabilities, with options only when given', async () => {
    const host = new FakeCapabilityHost();
    const store = new CapabilityStore(host, recordingLogger());

    await store.add('measure_co2');
    await store.add('measure_temperature.outdoor', { title: { en: 'Outdoor' } });
    await store.add('measure_co2', { title: { en: 'ignored' } });
    await store.remove('measure_co2');
    await store.remove('measure_co2');

    assert.deepEqual([...host.values.keys()], ['measure_temperature.outdoor']);
    assert.deepEqual([...host.options.keys()], ['measure_temperature.outdoor']);
  });
});

describe('ReadingCapabilities', () => {
  it('adds the capability on the first reading and sets it', async () => {
    const host = new FakeCapabilityHost();
    const readings = new ReadingCapabilities(new CapabilityStore(host, recordingLogger()));

    assert.equal(await readings.apply('outdoorTemperature', -2), true);
    assert.equal(await readings.apply('co2', 650), true);
    assert.equal(await readings.apply('nonsense', 1), false);

    assert.equal(host.values.get('measure_temperature.outdoor'), -2);
    assert.equal(host.values.get('measure_co2'), 650);
    assert.deepEqual(host.options.get('measure_temperature.outdoor'), {
      title: READING_BINDINGS.outdoorTemperature.title,
    });
  });
});

describe('ReadingCapabilities migration', () => {
  it('removes the capabilities of earlier versions', async () => {
    const host = new FakeCapabilityHost(['ramses_fan_level', 'ramses_fan_mode', 'measure_co2']);
    const readings = new ReadingCapabilities(new CapabilityStore(host, recordingLogger()));

    assert.deepEqual(await readings.migrate(), ['ramses_fan_level']);
    assert.deepEqual([...host.values.keys()], ['ramses_fan_mode', 'measure_co2']);
    assert.ok(LEGACY_CAPABILITIES.every((id) => !READING_BINDINGS.co2.capability.includes(id)));
  });
});

/**
 * @param {Record<string, unknown>} values
 * @param {Partial<import('../lib/homey/FanPresenter.js').FanSource>} [overrides]
 * @returns {import('../lib/homey/FanPresenter.js').FanSource & { modes: string[] }}
 */
function fanSource(values, overrides = {}) {
  /** @type {string[]} */
  const modes = [];

  return {
    id: UNIT,
    name: 'Ventilatie',
    available: true,
    mode: null,
    capabilityValue: (capability) => values[capability] ?? null,
    setMode: async (mode) => {
      modes.push(mode);
    },
    modes,
    ...overrides,
  };
}

describe('FanStatus', () => {
  it('names the mode in the language of Homey', () => {
    assert.equal(FanStatus.label('high', 'nl'), 'Hoog');
    assert.equal(FanStatus.label('away', 'en'), 'Away');
    assert.equal(FanStatus.label('auto', 'de'), 'Auto');
    assert.equal(FanStatus.label('turbo', 'nl'), 'turbo');
    assert.equal(FanStatus.LABEL_CAPABILITY, 'measure_ramses_fan_mode_label');
  });
});

describe('FanPresenter', () => {
  it('presents the mode and readings', () => {
    const view = FanPresenter.view(fanSource({
      ramses_fan_mode: 'high',
      measure_co2: 650,
      measure_humidity: 'x',
    }));

    assert.deepEqual(view, {
      id: UNIT,
      name: 'Ventilatie',
      available: true,
      mode: 'high',
      speed: null,
      co2: 650,
      humidity: null,
      temperature: null,
    });
  });

  it('prefers the live mode over the stored one', () => {
    assert.equal(FanPresenter.view(fanSource({ ramses_fan_mode: 'high' }, { mode: 'low' })).mode, 'low');
    assert.equal(FanPresenter.view(fanSource({})).mode, null);
  });
});

describe('GatewayRegistry', () => {
  it('forwards packets and discoveries of every gateway', () => {
    const registry = new GatewayRegistry();
    const { gateway, connection } = gatewayWith();
    /** @type {unknown[]} */
    const events = [];

    registry.on('packet', (frame, context, from) => events.push([frame.code, context.echo, from.id]));
    registry.on('discovered', (event) => events.push(event.id));
    registry.add(gateway);
    connection.hear(PRESS_HIGH);

    assert.deepEqual(events, [['22F1', false, GATEWAY], REMOTE, UNIT]);
    assert.equal(registry.get(GATEWAY), gateway);
    assert.equal(registry.size, 1);
  });

  it('stops forwarding once a gateway is removed', () => {
    const registry = new GatewayRegistry();
    const { gateway, connection } = gatewayWith();
    let changes = 0;
    let packets = 0;

    registry.on('changed', () => {
      changes += 1;
    });
    registry.on('packet', () => {
      packets += 1;
    });
    registry.add(gateway);
    connection.connect();
    registry.remove(GATEWAY);
    registry.remove(GATEWAY);
    connection.hear(PRESS_HIGH);

    assert.equal(packets, 0);
    assert.equal(changes, 3);
    assert.equal(registry.get(GATEWAY), null);
  });

  it('sends through the preferred gateway, or any connected one', async () => {
    const registry = new GatewayRegistry();
    const first = gatewayWith('18:000001');
    const second = gatewayWith('18:000002');

    await assert.rejects(registry.send(PRESS_HIGH), /no gateway added/);

    registry.add(first.gateway);
    registry.add(second.gateway);
    await assert.rejects(registry.send(PRESS_HIGH), NotConnectedError);

    second.connection.connect();
    await registry.send(PRESS_HIGH, '18:000001');
    first.connection.connect();
    await registry.send(PRESS_HIGH, '18:000001');

    assert.equal(second.connection.sent.length, 1);
    assert.equal(first.connection.sent.length, 1);
    assert.equal(registry.pick(null), first.gateway);
  });
});

describe('PacketPresenter', () => {
  it('presents a packet for the live view with what it carries', () => {
    const view = PacketPresenter.packet(packet(`045  I --- ${REMOTE} ${UNIT} --:------ 22F3 003 00001E`), {
      gateway: GATEWAY,
      time: 5,
    });

    assert.equal(view.name, 'Fan boost timer');
    assert.equal(view.echo, false);
    assert.equal(view.rssi, 45);
    assert.deepEqual(view.decoded, { boostMinutes: 30 });
    assert.deepEqual(PacketPresenter.packet(PRESS_HIGH, { gateway: GATEWAY, time: 1, echo: true }).decoded, {
      mode: 'high',
    });
  });

  it('makes flow tokens without nulls', () => {
    const announcement = packet(` I --- ${UNIT} --:------ ${UNIT} 31D9 003 00FF64`);

    assert.deepEqual(PacketPresenter.tokens(announcement), {
      verb: 'I',
      src: UNIT,
      dst: '',
      code: '31D9',
      payload: '00FF64',
      frame: announcement.toFrame(),
      rssi: 0,
    });
  });

  it('keeps a bounded log', () => {
    const log = new RingBuffer(2);

    log.push(1);
    log.push(2);
    log.push(3);
    assert.deepEqual(log.toArray(), [2, 3]);
    log.clear();
    assert.deepEqual(log.toArray(), []);
  });
});

describe('RamsesApi', () => {
  /** @returns {{ api: RamsesApi, registry: GatewayRegistry, log: RingBuffer<any> }} */
  function setup() {
    const registry = new GatewayRegistry();
    const log = new RingBuffer(10);
    const api = new RamsesApi({ registry, log, isPaired: (address) => address === UNIT });

    return { api, registry, log };
  }

  it('lists gateways with their health', () => {
    const { api, registry } = setup();
    const { gateway, connection } = gatewayWith();

    registry.add(gateway);
    connection.connect();
    connection.hear(PRESS_HIGH);

    assert.deepEqual(api.gateways(), [{
      id: GATEWAY,
      broker: '192.168.1.10:1883',
      connected: true,
      online: null,
      devices: 2,
      packets: 1,
    }]);
  });

  it('merges the devices of every gateway, keeping the busiest view', () => {
    const { api, registry } = setup();
    const a = gatewayWith('18:000001');
    const b = gatewayWith('18:000002');

    registry.add(a.gateway);
    registry.add(b.gateway);
    a.connection.hear(PRESS_HIGH);
    b.connection.hear(PRESS_HIGH);
    b.connection.hear(PRESS_HIGH);

    const devices = api.devices();

    assert.deepEqual(devices.map((device) => [device.id, device.gateway, device.paired]), [
      [REMOTE, '18:000002', false],
      [UNIT, '18:000002', true],
    ]);
  });

  it('returns the packet log', () => {
    const { api, log } = setup();

    log.push({ code: '22F1' });

    assert.deepEqual(api.packets(), [{ code: '22F1' }]);
  });

  it('sends a typed frame through a connected gateway', async () => {
    const { api, registry } = setup();
    const { gateway, connection } = gatewayWith();

    await assert.rejects(api.send({ frame: '' }), ValidationError);
    await assert.rejects(api.send(undefined), ValidationError);
    await assert.rejects(api.send({ frame: 'nonsense' }), ValidationError);
    await assert.rejects(api.send({ frame: PRESS_HIGH.toFrame() }), NotFoundError);

    registry.add(gateway);
    connection.connect();

    assert.deepEqual(await api.send({ frame: PRESS_HIGH.toFrame(), gateway: GATEWAY }), {
      frame: PRESS_HIGH.toFrame(),
      gateway: GATEWAY,
    });
    assert.equal(connection.sent.length, 1);
  });
});

describe('RamsesApi fans', () => {
  /**
   * @param {ReturnType<typeof fanSource>[]} fans
   * @returns {RamsesApi}
   */
  function apiWith(fans) {
    return new RamsesApi({
      registry: new GatewayRegistry(), log: new RingBuffer(1), isPaired: () => false, fans: () => fans,
    });
  }

  it('lists units and finds one by id, or the first', () => {
    const first = fanSource({ ramses_fan_mode: 'low' });
    const second = fanSource({}, { id: '29:000002', name: 'Zolder' });
    const api = apiWith([first, second]);

    assert.deepEqual(api.fans().map((fan) => fan.id), [UNIT, '29:000002']);
    assert.equal(api.fan(undefined)?.id, UNIT);
    assert.equal(api.fan('29:000002')?.name, 'Zolder');
    assert.equal(api.fan('29:999999'), null);
    assert.equal(apiWith([]).fan(undefined), null);

    const withoutFans = new RamsesApi({
      registry: new GatewayRegistry(),
      log: new RingBuffer(1),
      isPaired: () => false,
    });

    assert.deepEqual(withoutFans.fans(), []);
  });

  it('sets the mode of a unit', async () => {
    const fan = fanSource({});
    const api = apiWith([fan]);

    assert.equal((await api.setFanMode({ id: UNIT, mode: 'high' })).id, UNIT);
    await api.setFanMode({ mode: 'auto' });
    assert.deepEqual(fan.modes, ['high', 'auto']);
  });

  it('rejects unknown modes and units', async () => {
    const api = apiWith([fanSource({})]);

    await assert.rejects(api.setFanMode({ id: UNIT, mode: 'turbo' }), ValidationError);
    await assert.rejects(api.setFanMode(undefined), ValidationError);
    await assert.rejects(api.setFanMode({ id: '29:999999', mode: 'low' }), NotFoundError);
  });
});

describe('RealtimeHub', () => {
  it('batches packets and announces bus changes', async () => {
    const timers = new FakeTimers();
    /** @type {Array<[string, unknown]>} */
    const published = [];
    const hub = new RealtimeHub({
      api: {
        realtime: async (channel, data) => {
          published.push([channel, data]);
        },
      },
      timers,
      logger: recordingLogger(),
    });

    hub.packet(/** @type {any} */ ({ code: 'A' }));
    hub.packet(/** @type {any} */ ({ code: 'B' }));
    hub.busChanged();
    hub.fan(/** @type {any} */ ({ id: UNIT }));
    timers.tick(RealtimeHub.BATCH_MS);
    await flush();

    assert.deepEqual(published, [
      [Channels.BUS, null],
      [Channels.FAN, { id: UNIT }],
      [Channels.PACKETS, [{ code: 'A' }, { code: 'B' }]],
    ]);

    hub.packet(/** @type {any} */ ({ code: 'C' }));
    hub.dispose();
    timers.tick(RealtimeHub.BATCH_MS);
    assert.equal(published.length, 3);
  });

  it('logs failures of a closed view', async () => {
    const logger = recordingLogger();
    const hub = new RealtimeHub({
      api: {
        realtime: async () => {
          throw new Error('no listeners');
        },
      },
      timers: new FakeTimers(),
      logger,
    });

    hub.busChanged();
    await flush();

    assert.equal(logger.errors.length, 1);
  });
});

describe('GatewayPairing', () => {
  /**
   * @param {string[]} gateways
   * @returns {any}
   */
  function probeFinding(gateways) {
    return {
      probe: async () => ({ gateways }),
    };
  }

  it('offers the unpaired gateways with the broker as settings', async () => {
    const pairing = new GatewayPairing(probeFinding(['18:000001', GATEWAY]));
    const found = await pairing.find({ host: '192.168.1.10', username: 'u', password: 'p' }, new Set(['18:000001']));

    assert.deepEqual(found, [{
      name: GATEWAY_NAME,
      data: { id: GATEWAY },
      settings: {
        host: '192.168.1.10',
        port: 1883,
        username: 'u',
        password: 'p',
        tls: false,
        gateway_id: GATEWAY,
      },
    }]);
  });

  it('accepts a gateway address typed by the user', async () => {
    const pairing = new GatewayPairing(probeFinding([]));
    const found = await pairing.find({ host: 'x', gatewayId: ` ${GATEWAY} ` }, new Set());

    assert.deepEqual(found.map((device) => device.data.id), [GATEWAY]);
  });

  it('fails clearly when nothing was found or the input is wrong', async () => {
    const pairing = new GatewayPairing(probeFinding([]));

    await assert.rejects(pairing.find({ host: 'x', gatewayId: 'nope' }, new Set()), NoGatewaysError);
    await assert.rejects(pairing.find({ host: '' }, new Set()), ValidationError);
  });
});

describe('DevicePairing', () => {
  const name = (/** @type {string} */ id) => `Device ${id}`;

  it('requires a gateway', () => {
    const pairing = new DevicePairing({ registry: new GatewayRegistry(), timers: new FakeTimers() });

    assert.throws(() => pairing.candidates({ role: Role.FAN, paired: new Set(), name }), NoGatewayAddedError);
  });

  it('offers units with the remote that commands them', () => {
    const registry = new GatewayRegistry();
    const { gateway, connection } = gatewayWith();

    registry.add(gateway);
    connection.hear(PRESS_HIGH);
    connection.hear(packet(`RP --- ${UNIT} ${GATEWAY} --:------ 31D9 003 00FF64`));

    const pairing = new DevicePairing({ registry, timers: new FakeTimers() });

    assert.deepEqual(pairing.candidates({ role: Role.FAN, paired: new Set(), name }), [{
      name: `Device ${UNIT}`,
      data: { id: UNIT },
      store: { gateway: GATEWAY },
      settings: {
        address: UNIT,
        gateway: GATEWAY,
        remote_id: REMOTE,
      },
    }]);
    assert.deepEqual(pairing.candidates({ role: Role.REMOTE, paired: new Set([REMOTE]), name }), []);
  });

  it('lists a device heard by two gateways once', () => {
    const registry = new GatewayRegistry();
    const a = gatewayWith('18:000001');
    const b = gatewayWith('18:000002');

    registry.add(a.gateway);
    registry.add(b.gateway);
    a.connection.hear(PRESS_HIGH);
    b.connection.hear(PRESS_HIGH);

    const pairing = new DevicePairing({ registry, timers: new FakeTimers() });
    const remotes = pairing.candidates({ role: Role.REMOTE, paired: new Set(), name });

    assert.deepEqual(remotes.map((device) => device.store?.gateway), ['18:000001']);
    assert.equal(remotes[0].settings?.remote_id, undefined);
  });

  it('keeps scanning until a device talks', async () => {
    const registry = new GatewayRegistry();
    const timers = new FakeTimers();
    const { gateway, connection } = gatewayWith();

    registry.add(gateway);

    const pairing = new DevicePairing({ registry, timers });
    const result = pairing.scan({ role: Role.REMOTE, paired: new Set(), name });

    await timers.advance(3000, DevicePairing.POLL_MS);
    connection.hear(PRESS_HIGH);
    await timers.advance(DevicePairing.POLL_MS, DevicePairing.POLL_MS);

    assert.deepEqual((await result).map((device) => device.data.id), [REMOTE]);
  });

  it('gives up after the scan time', async () => {
    const registry = new GatewayRegistry();
    const timers = new FakeTimers();

    registry.add(gatewayWith().gateway);

    const result = new DevicePairing({ registry, timers }).scan({ role: Role.SENSOR, paired: new Set(), name });

    await timers.advance(DevicePairing.SCAN_MS, DevicePairing.POLL_MS);

    assert.deepEqual(await result, []);
  });
});

describe('FlowCardSet', () => {
  it('caches trigger cards and logs failing triggers', async () => {
    const flow = new FakeFlow();
    const logger = recordingLogger();
    const cards = new FlowCardSet(flow, logger);
    const device = {};

    assert.equal(cards.trigger('a'), cards.trigger('a'));
    flow.failing.add('b');
    await cards.fire(device, [{ card: 'a' }, { card: 'b', tokens: { x: 1 } }]);

    assert.deepEqual(flow.fired, [{
      card: 'a', device, tokens: {}, state: {},
    }]);
    assert.equal(logger.errors.length, 1);
  });
});

describe('FanFlowCards', () => {
  it('translates mode changes and boosts', () => {
    assert.deepEqual(FanFlowCards.translate(new FanModeChanged('high', 'low', Source.REMOTE, REMOTE)), [
      { card: FanCards.MODE_CHANGED, tokens: { mode: 'high', source: 'remote' } },
      { card: FanCards.MODE_CHANGED_TO, state: { mode: 'high' } },
    ]);
    assert.deepEqual(FanFlowCards.translate(new BoostStarted(30, Source.HOMEY)), [
      { card: FanCards.BOOST_STARTED, tokens: { minutes: 30, source: 'homey' } },
    ]);
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('co2', 1, undefined)), []);
  });

  it('fires fault and filter triggers on changes, not on a healthy first report', () => {
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('fault', false, undefined)), []);
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('fault', true, false)), [{ card: FanCards.FAULT_ON }]);
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('fault', false, true)), [{ card: FanCards.FAULT_OFF }]);
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('filterDirty', true, false)), [{ card: FanCards.FILTER_DIRTY }]);
    assert.deepEqual(FanFlowCards.translate(new ReadingChanged('filterDirty', false, true)), []);
  });

  it('wires conditions and actions to the unit', async () => {
    const flow = new FakeFlow();
    /** @type {string[]} */
    const calls = [];
    const unit = {
      mode: 'auto',
      setMode: async (/** @type {string} */ mode) => calls.push(`mode:${mode}`),
      boost: async (/** @type {number} */ minutes) => calls.push(`boost:${minutes}`),
      resetFilter: async () => calls.push('filter'),
      requestStatus: async () => calls.push('status'),
      setBypass: async (/** @type {string} */ mode) => calls.push(`bypass:${mode}`),
      reading: (/** @type {string} */ key) => (key === 'fault' ? true : undefined),
    };
    const device = { unit };

    new FanFlowCards(flow, recordingLogger()).register();

    assert.equal(await flow.conditions.get(FanCards.MODE_IS)?.({ device, mode: 'auto' }), true);
    await flow.actions.get(FanCards.SET_MODE)?.({ device, mode: 'low' });
    await flow.actions.get(FanCards.START_BOOST)?.({ device, minutes: 15 });
    await flow.actions.get(FanCards.RESET_FILTER)?.({ device });
    await flow.actions.get(FanCards.REQUEST_STATUS)?.({ device });

    await flow.actions.get(FanCards.SET_BYPASS)?.({ device, mode: 'auto' });
    assert.equal(await flow.conditions.get(FanCards.HAS_FAULT)?.({ device }), true);

    assert.deepEqual(calls, ['mode:low', 'boost:15', 'filter', 'status', 'bypass:auto']);
    assert.equal(await flow.triggers.get(FanCards.MODE_CHANGED_TO).listener({ mode: 'high' }, { mode: 'high' }), true);
    assert.equal(await flow.triggers.get(FanCards.MODE_CHANGED_TO).listener({ mode: 'low' }, { mode: 'high' }), false);
  });
});

describe('RemoteFlowCards', () => {
  it('fires the button card for the pressed button only', async () => {
    const flow = new FakeFlow();

    new RemoteFlowCards(flow, recordingLogger()).register();

    const invocations = RemoteFlowCards.translate(new ButtonPressed('boost', UNIT, 30));
    const listener = flow.triggers.get(RemoteCards.BUTTON_PRESSED).listener;

    assert.deepEqual(invocations, [
      { card: RemoteCards.BUTTON_PRESSED, tokens: { minutes: 30 }, state: { button: 'boost' } },
      { card: RemoteCards.ANY_BUTTON_PRESSED, tokens: { button: 'boost', minutes: 30 } },
    ]);
    assert.equal(await listener({ button: 'boost' }, { button: 'boost' }), true);
    assert.equal(await listener({ button: 'high' }, { button: 'boost' }), false);
    assert.deepEqual(RemoteFlowCards.translate(new ReadingChanged('battery', 50, undefined)), []);
  });

  it('uses prefixed card ids for control sensors', async () => {
    const flow = new FakeFlow();

    new RemoteFlowCards(flow, recordingLogger(), SENSOR_PREFIX).register();

    const [pressed, any] = RemoteFlowCards.translate(new ButtonPressed('high', UNIT, 60), SENSOR_PREFIX);

    assert.equal(pressed.card, 'sensor_button_pressed');
    assert.equal(any.card, 'sensor_any_button_pressed');
    assert.equal(await flow.triggers.get('sensor_button_pressed').listener({ button: 'high' }, pressed.state), true);
  });
});

describe('GatewayFlowCards', () => {
  it('translates packets, discoveries and status', () => {
    const [all, byCode] = GatewayFlowCards.packet(PRESS_HIGH);

    assert.equal(all.card, GatewayCards.PACKET_RECEIVED);
    assert.equal(all.tokens?.code, '22F1');
    assert.deepEqual(byCode.state, { code: '22F1', src: REMOTE, dst: UNIT });
    assert.deepEqual(GatewayFlowCards.discovered(new DeviceDiscovered(UNIT, Role.FAN)), [
      { card: GatewayCards.DEVICE_DISCOVERED, tokens: { address: UNIT, role: Role.FAN } },
    ]);
    assert.deepEqual(GatewayFlowCards.online(true), [{ card: GatewayCards.CAME_ONLINE }]);
    assert.deepEqual(GatewayFlowCards.online(false), [{ card: GatewayCards.WENT_OFFLINE }]);
  });

  it('filters the code trigger on code and address', async () => {
    const flow = new FakeFlow();

    new GatewayFlowCards(flow, recordingLogger()).register();

    const listener = flow.triggers.get(GatewayCards.CODE_RECEIVED).listener;
    const state = { code: '22F1', src: REMOTE, dst: UNIT };

    assert.equal(await listener({ code: '22f1', address: '' }, state), true);
    assert.equal(await listener({ code: '22F1', address: '*' }, state), true);
    assert.equal(await listener({ code: '22F1', address: UNIT }, state), true);
    assert.equal(await listener({ code: '22F1', address: '29:000000' }, state), false);
    assert.equal(await listener({ code: '31DA', address: '*' }, state), false);
  });

  it('sends frames and commands, and checks the gateway', async () => {
    const flow = new FakeFlow();
    const { gateway, connection } = gatewayWith();
    const device = { gateway };

    new GatewayFlowCards(flow, recordingLogger()).register();

    assert.equal(await flow.conditions.get(GatewayCards.IS_ONLINE)?.({ device }), false);
    connection.connect();
    assert.equal(await flow.conditions.get(GatewayCards.IS_ONLINE)?.({ device }), true);

    await flow.actions.get(GatewayCards.SEND_FRAME)?.({ device, frame: PRESS_HIGH.toFrame() });
    await flow.actions.get(GatewayCards.SEND_COMMAND)?.({
      device, verb: 'RQ', address: UNIT, code: '31DA', payload: '00',
    });
    await flow.actions.get(GatewayCards.SEND_COMMAND)?.({
      device, verb: 'I', address: '', code: '1F09', payload: 'FF',
    });
    await assert.rejects(
      async () => flow.actions.get(GatewayCards.SEND_FRAME)?.({ device, frame: 'garbage' }),
      ValidationError,
    );

    assert.deepEqual(connection.sent.map((frame) => frame.toFrame()), [
      PRESS_HIGH.toFrame(),
      `RQ --- ${GATEWAY} ${UNIT} --:------ 31DA 001 00`,
      ` I --- ${GATEWAY} --:------ --:------ 1F09 001 FF`,
    ]);
  });
});
