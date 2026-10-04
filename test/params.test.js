import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ValidationError } from '../lib/errors.js';
import { FanUnit } from '../lib/domain/FanUnit.js';
import { ParamChanged } from '../lib/domain/events.js';
import { FanCards, FanFlowCards } from '../lib/homey/flows/FanFlowCards.js';
import { FanCommands } from '../lib/ramses/commands.js';
import { decode } from '../lib/ramses/decoders.js';
import {
  decodeParam, encodeParam, FAN_PARAMS, paramById,
} from '../lib/ramses/FanParams.js';
import { Packet } from '../lib/ramses/Packet.js';
import { FakeFlow, recordingLogger } from './fakes.js';

const UNIT = '32:155617';
const REMOTE = '37:171871';
const GATEWAY = '18:203612';

/** Replies (RP and I) with a parameter, from the packet logs of ramses_rf. */
const LOGGED = readFileSync(new URL('./fixtures/ramses_rf/code_2411_wip.log', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((row) => row.match(/(RP|\s I) --- \S+ \S+ \S+ 2411 023 ([0-9A-F]{46})/)?.[2])
  .filter((payload) => payload !== undefined);

/**
 * @param {string} frame
 * @returns {Packet}
 */
function packet(frame) {
  const parsed = Packet.parse(frame);

  assert.ok(parsed, frame);

  return parsed;
}

describe('FanParams', () => {
  it('reads a parameter as ramses_rf does', () => {
    assert.deepEqual(decodeParam('0000312E10000000B400000000000007080000001EA62C'), {
      id: '31',
      type: '10',
      value: 180,
      min: 0,
      max: 1800,
      step: 30,
      trailer: 'A62C',
    });
    assert.equal(decodeParam('00003D370F00000016000000000000005000000001A632')?.value, 11);
  });

  it('writes exactly the frames a real controller writes', () => {
    const filter = decodeParam('0000312E10000000B400000000000007080000001EA62C');
    const away = decodeParam('00003D370F00000016000000000000005000000001A632');

    assert.equal(encodeParam('31', 150, filter), '00003100100000009600000000000007080000001E002C');
    assert.equal(encodeParam('3D', 12, away), '00003D000F000000180000000000000050000000010032');
  });

  it('reads every logged reply sensibly, and writes it back unchanged', () => {
    assert.ok(LOGGED.length > 20, `only ${LOGGED.length} replies in the log`);

    for (const payload of LOGGED) {
      const param = decodeParam(payload);

      if (!param) {
        continue;
      }

      assert.match(param.id, /^[0-9A-F]{2}$/);
      assert.ok(param.min <= param.max, `${payload}: min ${param.min} > max ${param.max}`);

      if (param.value >= param.min && param.value <= param.max && paramById(param.id)) {
        const written = encodeParam(param.id, param.value, param);

        assert.equal(written.slice(10, 42), payload.slice(10, 42), `${payload} written back as ${written}`);
      }
    }
  });

  it('falls back to the table before the unit reported a range', () => {
    assert.equal(encodeParam('3F', 45), '00003F000F0000005A0000000000000096000000010032');
    assert.equal(encodeParam('75', 21.5).slice(10, 18), '00000866');
  });

  it('refuses unknown parameters and values out of range', () => {
    assert.throws(() => encodeParam('99', 1), ValidationError);
    assert.throws(() => encodeParam('3F', 80), ValidationError);
    assert.throws(() => encodeParam('3F', Number.NaN), ValidationError);
    assert.equal(decodeParam('000031'), null);
    assert.equal(decodeParam('000031000FFFFFFFFF000000000000005000000001A632'), null);
  });

  it('knows its parameters by id', () => {
    assert.equal(paramById('3f')?.name.nl, 'Laag: toevoer');
    assert.equal(paramById('99'), null);
    assert.equal(FAN_PARAMS.length, 25);
  });

  it('is decoded from a 2411 packet', () => {
    const reply = packet(`RP --- ${UNIT} ${REMOTE} --:------ 2411 023 0000312E10000000B400000000000007080000001EA62C`);

    assert.equal(decode(reply).param?.value, 180);
    assert.deepEqual(decode(packet(`RQ --- ${REMOTE} ${UNIT} --:------ 2411 003 000031`)), {});
  });

  it('builds the request and write commands', () => {
    const commands = new FanCommands({ remote: REMOTE, unit: UNIT });

    assert.equal(commands.getParam(GATEWAY, '3f').toFrame(), `RQ --- ${GATEWAY} ${UNIT} --:------ 2411 003 00003F`);
    assert.equal(commands.setParam('3F', 45).verb, 'W');
  });
});

describe('FanUnit parameters', () => {
  /** @returns {{ fan: FanUnit, sent: Packet[], events: unknown[] }} */
  function unit() {
    /** @type {Packet[]} */
    const sent = [];
    /** @type {unknown[]} */
    const events = [];
    const fan = new FanUnit({
      address: UNIT,
      remote: REMOTE,
      gateway: GATEWAY,
      send: async (frame) => {
        sent.push(frame);
      },
    });

    fan.on('event', (event) => events.push(event));

    return { fan, sent, events };
  }

  it('reads a parameter and writes within the range the unit reported', async () => {
    const { fan, sent, events } = unit();

    assert.equal(await fan.readParam('3D'), true);
    fan.accept(packet(`RP --- ${UNIT} ${GATEWAY} --:------ 2411 023 00003D370F00000016000000000000005000000001A632`));

    assert.equal(fan.paramsSupported, true);
    assert.equal(fan.param('3d')?.value, 11);
    assert.ok(events.some((event) => event instanceof ParamChanged && event.param.id === '3D'));

    await fan.setParam('3D', 12);

    assert.equal(sent.at(-1)?.payload, '00003D000F000000180000000000000050000000010032');
    await assert.rejects(fan.setParam('3D', 45), ValidationError);
  });

  it('stops asking when the unit never answers parameter requests', async () => {
    const { fan, sent } = unit();

    assert.equal(await fan.readParam('31'), true);
    assert.equal(await fan.readParam('31'), true);
    assert.equal(await fan.readParam('31'), false);
    assert.equal(fan.paramsSupported, false);
    assert.equal(sent.length, 2);
    assert.equal(fan.param('31'), null);
  });

  it('needs a gateway to ask with', async () => {
    const fan = new FanUnit({ address: UNIT, send: async () => {} });

    await assert.rejects(fan.readParam('31'), ValidationError);
  });
});

describe('FanFlowCards parameters', () => {
  it('searches parameters by name in the language of Homey, and sets them', async () => {
    const flow = new FakeFlow();
    /** @type {unknown[]} */
    const calls = [];
    const cards = new FanFlowCards(flow, recordingLogger(), 'nl').register();
    const device = {
      unit: {
        setParam: async (/** @type {string} */ id, /** @type {number} */ value) => calls.push([id, value]),
      },
    };
    const search = flow.autocompletes.get(`${FanCards.SET_PARAM}.param`);
    const found = /** @type {Array<{ id: string, name: string }>} */ (await search?.('toevoer'));

    assert.ok(found.some((param) => param.id === '3F' && param.name === 'Laag: toevoer'));
    assert.deepEqual(cards.searchParams('3f').map((param) => param.id), ['3F']);
    assert.equal(new FanFlowCards(flow, recordingLogger()).searchParams('comfort')[0].name, 'Comfort temperature');

    await flow.actions.get(FanCards.SET_PARAM)?.({ device, param: { id: '75' }, value: 21 });
    assert.deepEqual(calls, [['75', 21]]);
  });
});
