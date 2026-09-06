import { describe, expect, it } from 'vitest';
import { AU, MU_SUN, R_EARTH_ORBIT, R_MARS_ORBIT } from './constants';
import { hohmannTransfer } from './hohmann';

describe('Earth–Mars Hohmann transfer', () => {
  const t = hohmannTransfer(R_EARTH_ORBIT, R_MARS_ORBIT, MU_SUN);

  it('semi-major axis is average of Earth and Mars radii', () => {
    expect(t.aTransfer).toBeCloseTo(0.5 * (R_EARTH_ORBIT + R_MARS_ORBIT), 0);
  });

  it('depart Δv is ~2.9–3.1 km/s (textbook)', () => {
    // Classic value ≈ 2.95 km/s
    expect(t.deltaVDepart).toBeGreaterThan(2900);
    expect(t.deltaVDepart).toBeLessThan(3100);
  });

  it('arrive Δv is ~2.5–2.8 km/s (textbook)', () => {
    expect(t.deltaVArrive).toBeGreaterThan(2500);
    expect(t.deltaVArrive).toBeLessThan(2800);
  });

  it('TOF is ~250–270 days', () => {
    const days = t.timeOfFlightSec / 86400;
    expect(days).toBeGreaterThan(250);
    expect(days).toBeLessThan(270);
  });

  it('transfer periapsis speed exceeds Earth circular', () => {
    expect(t.vPeriapsis).toBeGreaterThan(t.vCircular1);
    expect(t.vApoapsis).toBeLessThan(t.vCircular2);
  });

  it('uses ~1 AU and ~1.52 AU radii', () => {
    expect(R_EARTH_ORBIT / AU).toBeCloseTo(1.0, 5);
    expect(R_MARS_ORBIT / AU).toBeCloseTo(1.524, 2);
  });
});
