import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ValidationError } from '../lib/errors.js';
import { BindingSession, BindingTimeoutError } from '../lib/domain/BindingSession.js';
import { DEFAULT_CURVE, ventilationDemand, VirtualSensor } from '../lib/domain/VirtualSensor.js';
import {
  confirmPacket,
  decodeAddress,
  encodeAddress,
  freeAddress,
  offerPacket,
  parseBinding,
  Phase,
  PLAIN_SENSOR_OFFER,
  REMOTE_OFFER,
  SENSOR_OFFER,
} from '../lib/ramses/binding.js';
import { decode } from '../lib/ramses/decoders.js';
import { Packet } from '../lib/ramses/Packet.js';
import { FakeTimers, flush } from './fakes.js';

/**
 * @param {string} frame
 * @returns {Packet}
 */
function packet(frame) {
  const parsed = Packet.parse(frame);

  assert.ok(parsed, frame);

  return parsed;
}

/** Binding packets of HVAC devices, from the packet logs of ramses_rf. */
const LOGGED = readFileSync(new URL('./fixtures/ramses_rf/code_1fc9.log', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((row) => !row.startsWith('#') && / (29|32|37):\d{6} /.test(row) && row.includes('1FC9'))
  .map((row) => row.slice(0, row.includes('#') ? row.indexOf('#') : undefined).trim().split(/\s+/).slice(2).join(' '));

describe('binding packets', () => {
  it('encodes addresses as three bytes', () => {
    assert.equal(encodeAddress('29:091138'), '756402');
    assert.equal(encodeAddress('32:022222'), '8056CE');
    assert.equal(decodeAddress('756402'), '29:091138');
    assert.equal(decodeAddress('96568A'), '37:153226');
    assert.throws(() => encodeAddress('remote'), ValidationError);
  });

  it('reads the three phases of a real binding', () => {
    const offer = parseBinding(packet(' I --- 29:091138 --:------ 29:091138 1FC9 024 0022F17564020022F37564026610E0756402001FC9756402'));
    const accept = parseBinding(packet(' W --- 32:022222 29:091138 --:------ 1FC9 012 0031D98056CE0031DA8056CE'));
    const confirm = parseBinding(packet(' I --- 29:091138 32:022222 --:------ 1FC9 001 00'));

    assert.equal(offer?.phase, Phase.OFFER);
    assert.deepEqual(offer?.bindings.map((binding) => binding.code), ['22F1', '22F3', '10E0', '1FC9']);
    assert.equal(offer?.bindings[0].address, '29:091138');
    assert.equal(accept?.phase, Phase.ACCEPT);
    assert.equal(accept?.from, '32:022222');
    assert.equal(accept?.to, '29:091138');
    assert.equal(confirm?.phase, Phase.CONFIRM);
    assert.equal(parseBinding(packet(' I --- 29:091138 32:022222 --:------ 22F1 003 000304')), null);
  });

  it('reads every logged HVAC binding packet', () => {
    assert.ok(LOGGED.length > 10);

    for (const frame of LOGGED) {
      const message = parseBinding(packet(frame));

      assert.ok(message, frame);
      assert.ok(message.bindings.every((binding) => /^\d{2}:\d{6}$/.test(binding.address)), frame);
    }
  });

  it('builds offers as Orcon remotes and CO₂ sensors send them', () => {
    const remote = offerPacket('37:155617', [['00', '22F1'], ['00', '22F3'], ['67', '10E0'], ['00', '1FC9']]);

    assert.equal(
      remote.toFrame(),
      ' I --- 37:155617 --:------ 37:155617 1FC9 024 0022F1965FE10022F3965FE16710E0965FE1001FC9965FE1',
    );
    assert.equal(offerPacket('29:091138', REMOTE_OFFER).payload.length, 48);
    assert.equal(offerPacket('37:154011', PLAIN_SENSOR_OFFER).payload, '0031E096599B00129896599B002E1096599B0110E096599B001FC996599B');
    assert.equal(
      offerPacket('37:155617', SENSOR_OFFER).payload,
      '0022F1965FE10022F3965FE16710E0965FE1001FC9965FE1',
    );
    assert.equal(confirmPacket('29:091138', '32:022222').toFrame(), ' I --- 29:091138 32:022222 --:------ 1FC9 001 00');
  });

  it('picks a free address of a device type', () => {
    const taken = new Set(['29:100000']);
    const values = [0, 0.5];
    const address = freeAddress('29', taken, () => values.shift() ?? 0.5);

    assert.match(address, /^29:\d{6}$/);
    assert.notEqual(address, '29:100000');
    assert.throws(() => freeAddress('29', new Set(['29:100000']), () => 0), ValidationError);
  });
});

describe('BindingSession', () => {
  const HOMEY = '29:091138';
  const UNIT = '32:022222';
  const ACCEPT = packet(` W --- ${UNIT} ${HOMEY} --:------ 1FC9 012 0031D98056CE0031DA8056CE`);

  /**
   * @param {string | null} [unit]
   * @returns {{ session: BindingSession, sent: Packet[], timers: FakeTimers }}
   */
  function session(unit = null) {
    /** @type {Packet[]} */
    const sent = [];
    const timers = new FakeTimers();

    return {
      session: new BindingSession({
        supplicant: HOMEY,
        offer: REMOTE_OFFER,
        unit,
        timers,
        send: async (frame) => {
          sent.push(frame);
        },
      }),
      sent,
      timers,
    };
  }

  it('repeats the offer until a unit accepts, then confirms', async () => {
    const { session: binding, sent, timers } = session();
    const result = binding.start();

    timers.tick(BindingSession.OFFER_INTERVAL_MS * 2);
    assert.equal(sent.filter((frame) => frame.code === '1FC9').length, 3);

    assert.equal(binding.handle(ACCEPT), true);
    assert.equal(await result, UNIT);
    await flush();

    assert.equal(sent.at(-1)?.toFrame(), ` I --- ${HOMEY} ${UNIT} --:------ 1FC9 001 00`);
    assert.equal(timers.pendingCount, 0);
    assert.equal(binding.handle(ACCEPT), false);
    assert.equal(binding.supplicant, HOMEY);
  });

  it('ignores accepts from other units and for other devices', () => {
    const { session: binding } = session(UNIT);

    binding.start().catch(() => {});

    assert.equal(binding.handle(packet(` W --- 32:999999 ${HOMEY} --:------ 1FC9 006 0031D9BFFFFF`)), false);
    assert.equal(binding.handle(packet(` W --- ${UNIT} 29:000001 --:------ 1FC9 006 0031D98056CE`)), false);
    assert.equal(binding.handle(packet(` I --- ${UNIT} --:------ ${UNIT} 31D9 003 000004`)), false);
    assert.equal(binding.handle(ACCEPT), true);
  });

  it('gives up when no unit is in binding mode', async () => {
    const { session: binding, timers } = session();
    const result = binding.start();

    timers.tick(BindingSession.TIMEOUT_MS);

    await assert.rejects(result, BindingTimeoutError);
    assert.equal(timers.pendingCount, 0);
  });

  it('stops when sending fails, and can be cancelled', async () => {
    const binding = new BindingSession({
      supplicant: HOMEY,
      offer: REMOTE_OFFER,
      timers: new FakeTimers(),
      send: async () => {
        throw new Error('no gateway');
      },
    });

    await assert.rejects(binding.start(), /no gateway/);

    const { session: cancelled, timers } = session();

    cancelled.start().catch(() => {});
    cancelled.cancel();
    assert.equal(timers.pendingCount, 0);
  });
});

describe('VirtualSensor', () => {
  const SELF = '37:154011';
  const UNIT = '29:233244';

  /** @returns {{ sensor: VirtualSensor, sent: Packet[] }} */
  function sensor() {
    /** @type {Packet[]} */
    const sent = [];

    return {
      sensor: new VirtualSensor({
        address: SELF,
        curve: null,
        send: async (frame) => {
          sent.push(frame);
        },
      }),
      sent,
    };
  }

  it('reports like an Orcon CO2 sensor, decodable by this app', async () => {
    const { sensor: virtual, sent } = sensor();

    virtual.bindTo(UNIT);
    await virtual.reportCo2(452);
    await virtual.reportHumidity(58);
    await virtual.reportDemand(15);

    assert.deepEqual(sent.map((frame) => frame.toFrame()), [
      ` I --- ${SELF} --:------ ${SELF} 1298 003 0001C4`,
      ` I --- ${SELF} --:------ ${SELF} 12A0 002 003A`,
      ` I --- ${SELF} ${UNIT} --:------ 31E0 008 0000000001001E00`,
    ]);
    assert.deepEqual(sent.map((frame) => decode(frame).readings), [{ co2: 452 }, { humidity: 58 }, { demand: 15 }]);
    assert.equal(virtual.unit, UNIT);
    assert.equal(virtual.address, SELF);
  });

  it('derives the demand from CO₂ and humidity once bound, as a 15RF does', async () => {
    /** @type {Packet[]} */
    const sent = [];
    const virtual = new VirtualSensor({
      address: SELF,
      send: async (frame) => {
        sent.push(frame);
      },
    });

    assert.equal(await virtual.reportCo2(700), null, 'not bound yet');

    virtual.bindTo(UNIT);
    assert.equal(await virtual.reportCo2(700), 50);
    assert.equal(await virtual.reportHumidity(75), 75);
    assert.equal(sent.at(-1)?.toFrame(), ` I --- ${SELF} ${UNIT} --:------ 31E0 008 0000000001009600`);

    virtual.useCurve(null);
    assert.equal(await virtual.reportCo2(1200), null);
  });

  it('repeats its last reports, and refuses nonsense', async () => {
    const { sensor: virtual, sent } = sensor();

    await virtual.reportCo2(600);
    await virtual.reportCo2(650);
    await virtual.repeat();

    assert.equal(sent.at(-1)?.payload, '00028A');
    assert.equal(sent.length, 3);
    await assert.rejects(virtual.reportCo2(-5), ValidationError);
    await assert.rejects(virtual.reportHumidity(140), ValidationError);
    await assert.rejects(virtual.reportDemand(50), /Bind the sensor/);
  });
});

describe('ventilationDemand', () => {
  it('asks the highest of what CO₂ and humidity ask', () => {
    assert.equal(ventilationDemand({ co2: 450 }), 8);
    assert.equal(ventilationDemand({ co2: 700 }), 50);
    assert.equal(ventilationDemand({ co2: 1500 }), 100);
    assert.equal(ventilationDemand({ co2: 300 }), 0);
    assert.equal(ventilationDemand({ humidity: 70 }), 50);
    assert.equal(ventilationDemand({ co2: 700, humidity: 78 }), 90);
    assert.equal(ventilationDemand({}), null);
  });

  it('follows a custom curve, also a step', () => {
    const step = { ...DEFAULT_CURVE, humidityLow: 70, humidityHigh: 70 };

    assert.equal(ventilationDemand({ humidity: 69 }, step), 0);
    assert.equal(ventilationDemand({ humidity: 70 }, step), 100);
  });
});
