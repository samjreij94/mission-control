import { describe, expect, it } from 'vitest';
import { G0 } from './constants';
import { propellantForDeltaV, rocketDeltaV, massFlowRate, exhaustVelocity } from './rocket';

describe('rocket equation', () => {
  it('matches classic Δv = Isp g0 ln(m0/mf)', () => {
    const isp = 300;
    const m0 = 100_000;
    const mf = 40_000;
    const expected = isp * G0 * Math.log(m0 / mf);
    expect(rocketDeltaV(isp, m0, mf)).toBeCloseTo(expected, 6);
  });

  it('round-trips propellant for a target Δv', () => {
    const isp = 310;
    const m0 = 550_000;
    const dv = 3500;
    const prop = propellantForDeltaV(dv, isp, m0);
    const mf = m0 - prop;
    expect(rocketDeltaV(isp, m0, mf)).toBeCloseTo(dv, 4);
  });

  it('computes mass flow from thrust and Isp', () => {
    const thrust = 7.6e6;
    const isp = 300;
    expect(massFlowRate(thrust, isp)).toBeCloseTo(thrust / (isp * G0), 6);
  });

  it('exhaust velocity is Isp * g0', () => {
    expect(exhaustVelocity(300)).toBeCloseTo(300 * G0, 6);
  });
});
