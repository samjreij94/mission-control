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

  it('Mars Hohmann analytics stay in expected band', () => {
    const h = hohmannTransfer();
    expect(h.deltaVDepart).toBeGreaterThan(2900);
    expect(h.deltaVArrive).toBeGreaterThan(2500);
    expect(Number.isFinite(h.timeOfFlightSec)).toBe(true);
  });

  it('TMI while suborbital coast is denied without dumping Earth-frame Δv', () => {
    const sim = createSim();
    sim.reset('MARS_TRANSFER', {
      wetMassKg: 550_000,
      dryMassKg: 40_000,
      ispSec: 320,
      thrustN: 1.2e7,
    });
    sim.setThrottle(1);
    sim.ignite();
    let tel = sim.getTelemetry();
    // Brief ascent then early MECO — typically peri≪0 / not parked
    for (let i = 0; i < 40; i++) {
      tel = sim.step(0.1);
      if (tel.phase === 'failed') break;
    }
    sim.setThrottle(0);
    tel = sim.getTelemetry();
    expect(tel.phase).toBe('coast');
    expect(tel.phase).not.toBe('failed');
    // Not in LEO parking
    expect((tel.periapsisM ?? -1) < 160_000).toBe(true);

    const periBefore = tel.periapsisM ?? -1e12;
    const speedBefore = tel.speedMs;
    const h = hohmannTransfer();
    sim.burn(h.deltaVDepart);
    tel = sim.getTelemetry();

    expect(tel.phase).not.toBe('transfer');
    expect(tel.phase === 'coast' || tel.phase === 'ascent').toBe(true);
    expect(tel.message).toMatch(/TMI denied|LEO parking/i);
    // Must not have slammed ~2.9 km/s into Earth-frame velocity
    expect(Math.abs(tel.speedMs - speedBefore)).toBeLessThan(50);
    // Peri should not be wrecked further by a 2945 m/s Earth dump
    if (Number.isFinite(periBefore) && Number.isFinite(tel.periapsisM ?? NaN)) {
      expect((tel.periapsisM ?? 0) - periBefore).toBeGreaterThan(-50_000);
    }
  });

  it('setThrottle(0) during ascent immediately enters coast (MECO)', () => {
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 550_000,
      dryMassKg: 50_000,
      ispSec: 300,
      thrustN: 7.6e6,
    });
    sim.setThrottle(1);
    sim.ignite();
    for (let i = 0; i < 30; i++) sim.step(0.1);

    expect(sim.getTelemetry().phase).toBe('ascent');
    sim.setThrottle(0);
    const tel = sim.getTelemetry();
    expect(tel.phase).toBe('coast');
    expect(tel.throttle).toBe(0);
    expect(tel.thrustN).toBe(0);
    expect(tel.message).toMatch(/MECO|coast/i);

    // Further steps must stay coast (not stuck in ascent) until burn/fail
    for (let i = 0; i < 20; i++) sim.step(0.2);
    const after = sim.getTelemetry();
    expect(after.phase === 'coast' || after.phase === 'failed').toBe(true);
    expect(after.phase).not.toBe('ascent');
  });

  it('MECO then circularization burn can reach LEO orbit', () => {
    // Capable single-stack so apoapsis can be raised above LEO_ALT_MIN with propellant left.
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 500_000,
      dryMassKg: 30_000,
      ispSec: 420,
      thrustN: 9e6,
    });
    sim.setThrottle(1);
    sim.ignite();

    let tel = sim.getTelemetry();
    for (let i = 0; i < 5000; i++) {
      tel = sim.step(0.1);
      if (tel.phase === 'failed') break;
      if ((tel.apoapsisM ?? 0) >= 280_000 && tel.altitudeM > 100_000) break;
      if (tel.phase === 'coast') break;
    }
    expect(tel.phase).toBe('ascent');
    expect(tel.apoapsisM ?? 0).toBeGreaterThanOrEqual(280_000);

    sim.setThrottle(0);
    tel = sim.getTelemetry();
    expect(tel.phase).toBe('coast');
    expect(tel.thrustN).toBe(0);

    // Coast toward apoapsis, then circularize with a modest impulsive burn.
    for (let i = 0; i < 800; i++) {
      tel = sim.step(0.5);
      if (tel.phase === 'failed') break;
      if (tel.altitudeM >= (tel.apoapsisM ?? 0) - 2000) break;
    }
    expect(tel.phase).toBe('coast');
    expect(tel.deltaVRemainingMs).toBeGreaterThan(400);

    sim.burn(500);
    tel = sim.getTelemetry();
    expect(tel.phase).toBe('orbit');
    expect(tel.message).toMatch(/SUCCESS|LEO/i);
  });

  it('Mars: LEO parking then TMI enters transfer and stays stable', () => {
    const sim = createSim();
    // Inject a parked LEO state (checkLeoOrbit band) without relying on ascent luck.
    sim.reset('MARS_TRANSFER', {
      wetMassKg: 200_000,
      dryMassKg: 40_000,
      ispSec: 320,
      thrustN: 5e6,
    });
    const r = R_EARTH + 250_000;
    const vCirc = circularOrbitSpeed(r, MU_EARTH);
    const internal = sim as unknown as {
      s: {
        phase: string;
        r: number;
        vr: number;
        vt: number;
        enginesOn: boolean;
        throttle: number;
        t: number;
        message: string;
      };
    };
    internal.s.phase = 'coast';
    internal.s.r = r;
    internal.s.vr = 0;
    internal.s.vt = vCirc;
    internal.s.enginesOn = false;
    internal.s.throttle = 0;
    internal.s.t = 100;
    internal.s.message = 'Injected parking';

    // Coast path should promote to orbit parking for Mars.
    let tel = sim.step(0.1);
    expect(tel.phase).toBe('orbit');
    expect(tel.message).toMatch(/parking|TMI|SUCCESS|LEO/i);
    expect(tel.periapsisM ?? 0).toBeGreaterThan(160_000);

    const h = hohmannTransfer();
    const massBefore = tel.massKg;
    const speedBefore = tel.speedMs;
    sim.burn(h.deltaVDepart);
    tel = sim.getTelemetry();
    expect(tel.phase).toBe('transfer');
    expect(tel.message).toMatch(/TMI|SUCCESS/i);
    expect(tel.massKg).toBeLessThan(massBefore);
    // Heliocentric handoff: Earth-frame speed unchanged
    expect(Math.abs(tel.speedMs - speedBefore)).toBeLessThan(1);

    for (let i = 0; i < 40; i++) tel = sim.step(0.5);
    expect(tel.phase).toBe('transfer');
    expect(tel.phase).not.toBe('failed');
  });

  it('LEO: peri≳150 km & apo in band yields orbit SUCCESS', () => {
    const sim = createSim();
    sim.reset('LEO', {
      wetMassKg: 180_000,
      dryMassKg: 40_000,
      ispSec: 300,
      thrustN: 4e6,
    });
    // Mildly eccentric but playable LEO: peri ~180 km, apo ~400 km
    const periR = R_EARTH + 180_000;
    const apoR = R_EARTH + 400_000;
    const a = 0.5 * (periR + apoR);
    // Place at periapsis with vis-viva speed, vr=0
    const vPeri = Math.sqrt(MU_EARTH * (2 / periR - 1 / a));
    const internal = sim as unknown as {
      s: {
        phase: string;
        r: number;
        vr: number;
        vt: number;
        enginesOn: boolean;
        throttle: number;
        t: number;
      };
    };
    internal.s.phase = 'coast';
    internal.s.r = periR;
    internal.s.vr = 0;
    internal.s.vt = vPeri;
    internal.s.enginesOn = false;
    internal.s.throttle = 0;
    internal.s.t = 50;

    let tel = sim.step(0.1);
    expect(tel.periapsisM ?? 0).toBeGreaterThan(150_000);
    expect(tel.apoapsisM ?? 0).toBeLessThan(2_000_000);
    expect(tel.phase).toBe('orbit');
    expect(tel.message).toMatch(/SUCCESS/i);
  });
});
