import { Remote } from './Remote.js';

/**
 * A room sensor (CO₂, humidity, temperature). Control sensors such as the
 * Orcon CO2 15RF have buttons as well, so a sensor reports button presses
 * exactly like a remote.
 */
export class ClimateSensor extends Remote {}
