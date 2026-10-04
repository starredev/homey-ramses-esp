import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Gateway } from '../lib/domain/Gateway.js';
import { BindingTimeoutError } from '../lib/domain/BindingSession.js';
import { Binder } from '../lib/homey/Binder.js';
import { GatewayRegistry } from '../lib/homey/GatewayRegistry.js';
import { VirtualSensorCards, VirtualSensorFlowCards } from '../lib/homey/flows/VirtualSensorFlowCards.js';
import { REMOTE_OFFER, SENSOR_OFFER } from '../lib/ramses/binding.js';
import { Packet } from '../lib/ramses/Packet.js';
import {
  FakeConnection, FakeFlow, FakeTimers, flush, recordingLogger,
} from './fakes.js';

const UNIT = '29:233244';

/**
 * @param {string} frame
 * @returns {Packet}
 */
function packet(frame) {
  const parsed = Packet.parse(frame);

  assert.ok(parsed, frame);

  return parsed;
}

/** @returns {{ binder: Binder, connection: FakeConnection, timers: FakeTimers }} */
function setup() {
  const registry = new GatewayRegistry();
  const connection = new FakeConnection();
  const timers = new FakeTimers();

  registry.add(new Gateway({ connection: /** @type {any} */ (connection) }));
  connection.connect();

  return { binder: new Binder({ registry, timers }), connection, timers };
}

describe('Binder', () => {
  it('picks an address no device on the bus uses', () => {
    const { binder, connection } = setup();

    connection.hear(packet(` I --- 29:173894 ${UNIT} --:------ 22F1 003 000304`));

    const address = binder.freeAddress('29');

    assert.match(address, /^29:\d{6}$/);
    assert.notEqual(address, '29:173894');
  });

  it('binds through the gateways and confirms to the unit that accepted', async () => {
    const { binder, connection } = setup();
    const result = binder.bind({ supplicant: '29:100001', offer: REMOTE_OFFER, unit: UNIT });

    await flush();
    assert.equal(connection.sent[0]?.code, '1FC9');

    connection.hear(packet(` W --- ${UNIT} 29:100001 --:------ 1FC9 006 0031D9763A9C`));

    assert.equal(await result, UNIT);
    await flush();
    assert.equal(connection.sent.at(-1)?.toFrame(), ` I --- 29:100001 ${UNIT} --:------ 1FC9 001 00`);
  });

  it('stops listening after a timeout', async () => {
    const { binder, timers, connection } = setup();
    const result = binder.bind({ supplicant: '37:100001', offer: SENSOR_OFFER });

    await flush();
    timers.tick(90000);

    await assert.rejects(result, BindingTimeoutError);
    connection.hear(packet(` W --- ${UNIT} 37:100001 --:------ 1FC9 006 0031D9763A9C`));
  });
});

describe('VirtualSensorFlowCards', () => {
  it('reports values through the sensor and shows them', async () => {
    const flow = new FakeFlow();
    /** @type {unknown[]} */
    const calls = [];
    const device = {
      sensor: {
        reportCo2: async (/** @type {number} */ ppm) => {
          calls.push(['co2', ppm]);

          return 55;
        },
        reportHumidity: async (/** @type {number} */ percent) => {
          calls.push(['humidity', percent]);

          return null;
        },
        reportDemand: async (/** @type {number} */ percent) => calls.push(['demand', percent]),
      },
      show: async (/** @type {string} */ capability, /** @type {number} */ value) => calls.push([capability, value]),
    };

    new VirtualSensorFlowCards(flow, recordingLogger()).register();
    await flow.actions.get(VirtualSensorCards.REPORT_CO2)?.({ device, ppm: 900 });
    await flow.actions.get(VirtualSensorCards.REPORT_HUMIDITY)?.({ device, percent: 60 });
    await flow.actions.get(VirtualSensorCards.REPORT_DEMAND)?.({ device, percent: 40 });

    assert.deepEqual(calls, [
      ['co2', 900], ['measure_co2', 900], ['measure_ramses_demand', 55],
      ['humidity', 60], ['measure_humidity', 60],
      ['demand', 40], ['measure_ramses_demand', 40],
    ]);
  });
});
