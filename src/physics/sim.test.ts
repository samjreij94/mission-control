import { describe, expect, it } from 'vitest';
import { MU_EARTH, MU_SUN, R_EARTH } from './constants';
import { circularOrbitSpeed } from './orbit';
import { hohmannTransfer } from './hohmann';
import { createSim } from './sim';
import { propellantForDeltaV, rocketDeltaV } from './rocket';

describe('circular LEO speed', () => {
  it('is approx 7.67-7.8 km/s at 200-300 km', () => {
    for (const altKm of [200, 250, 300]) {
      const r = R_EARTH + altKm * 1000;
      const v = circularOrbitSpeed(r, MU_EARTH);
      expect(v).toBeGreaterThan(7670);
      expect(v).toBeLessThan(7800);
    }
    const v250 = circularOrbitSpeed(R_EARTH + 250_000, MU_EARTH);
    expect(v250).toBeCloseTo(Math.sqrt(MU_EARTH / (R_EARTH + 250_000)), 6);
  });
});

describe('Earth-Mars Hohmann analytic (1% tolerance)', () => {
  const t = hohmannTransfer();
  const a = 0.5 * (t.r1 + t.r2);

  it('matches closed-form delta-v and TOF within 1%', () => {
    const v1 = Math.sqrt(MU_SUN / t.r1);
    const v2 = Math.sqrt(MU_SUN / t.r2);
    const vp = Math.sqrt(MU_SUN * (2 / t.r1 - 1 / a));
    const va = Math.sqrt(MU_SUN * (2 / t.r2 - 1 / a));
    const dVd = Math.abs(vp - v1);
    const dVa = Math.abs(v2 - va);
    const tof = Math.PI * Math.sqrt((a * a * a) / MU_SUN);

    expect(Math.abs(t.deltaVDepart - dVd) / dVd).toBeLessThan(0.01);
    expect(Math.abs(t.deltaVArrive - dVa) / dVa).toBeLessThan(0.01);
    expect(Math.abs(t.timeOfFlightSec - tof) / tof).toBeLessThan(0.01);
  });
});

describe('SimAPI', () => {
  it('reset setThrottle ignite step loop does not NaN', () => {
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 550_000,
      dryMassKg: 50_000,
      ispSec: 300,
      thrustN: 7.6e6,
    });
    sim.setThrottle(1);
    sim.ignite();
    expect(sim.getTelemetry().phase).toBe('ascent');

    let tel = sim.getTelemetry();
    for (let i = 0; i < 500; i++) {
      tel = sim.step(0.1);
      expect(Number.isFinite(tel.altitudeM)).toBe(true);
      expect(Number.isFinite(tel.speedMs)).toBe(true);
      expect(Number.isFinite(tel.massKg)).toBe(true);
      expect(Number.isFinite(tel.accelMs2)).toBe(true);
      expect(tel.throttle).toBeGreaterThanOrEqual(0);
      expect(tel.throttle).toBeLessThanOrEqual(1);
      if (tel.phase === 'failed') break;
    }
    expect(sim.getTrajectory().length).toBeGreaterThan(1);
    expect(sim.getTarget()).toBe('LEO');
  });

  it('burn reduces mass correctly via rocket equation', () => {
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 100_000,
      dryMassKg: 40_000,
      ispSec: 300,
      thrustN: 2e6,
    });
    sim.setThrottle(1);
    sim.ignite();
    for (let i = 0; i < 50; i++) sim.step(0.1);

    const before = sim.getTelemetry();
    const dv = 500;
    const expectedProp = propellantForDeltaV(dv, 300, before.massKg);
    sim.burn(dv);
    const after = sim.getTelemetry();

    expect(after.massKg).toBeCloseTo(before.massKg - expectedProp, 0);
    expect(after.deltaVUsedMs).toBeGreaterThan(before.deltaVUsedMs);
    const realized = rocketDeltaV(300, before.massKg, after.massKg);
    expect(realized).toBeCloseTo(dv, 0);
  });

  it('setThrottle clamps to 0-1', () => {
    const sim = createSim();
    sim.reset('LEO');
    sim.setThrottle(2);
    expect(sim.getTelemetry().throttle).toBe(1);
    sim.setThrottle(-1);
    expect(sim.getTelemetry().throttle).toBe(0);
  });

  it('ignite refuses TWR <= 1 on pad', () => {
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 1_000_000,
      thrustN: 1e5,
      ispSec: 300,
      dryMassKg: 100_000,
    });
    sim.setThrottle(0.1);
    sim.ignite();
    expect(sim.getTelemetry().phase).toBe('pad');
  });

  it('Mars target burn path stays finite and tracks Hohmann delta-v', () => {
    const sim = createSim();
    sim.reset('MARS_TRANSFER');
    const h = hohmannTransfer();
    expect(h.deltaVDepart).toBeGreaterThan(2900);
    expect(h.deltaVArrive).toBeGreaterThan(2500);
    sim.setThrottle(1);
    sim.ignite();
    for (let i = 0; i < 200; i++) sim.step(0.2);
    const before = sim.getTelemetry().massKg;
    sim.burn(h.deltaVDepart);
    const tel = sim.getTelemetry();
    expect(Number.isFinite(tel.massKg)).toBe(true);
    expect(tel.massKg).toBeLessThan(before);
    expect(tel.deltaVUsedMs).toBeGreaterThan(0);
  });
});
