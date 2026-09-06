import { describe, expect, it } from 'vitest';
import { MU_EARTH, R_EARTH } from './constants';
import {
  circularOrbitSpeed,
  eccentricityFromState,
  semiMajorAxis,
  specificEnergy,
  visViva,
} from './orbit';

describe('orbital energy', () => {
  it('circular LEO energy equals -μ/(2r)', () => {
    const r = R_EARTH + 400_000;
    const v = circularOrbitSpeed(r, MU_EARTH);
    const eps = specificEnergy(r, v, MU_EARTH);
    expect(eps).toBeCloseTo(-MU_EARTH / (2 * r), 3);
    expect(semiMajorAxis(eps, MU_EARTH)).toBeCloseTo(r, 0);
  });

  it('circular orbit has near-zero eccentricity', () => {
    const r = R_EARTH + 300_000;
    const v = circularOrbitSpeed(r, MU_EARTH);
    const e = eccentricityFromState({ r, v, vr: 0, vt: v }, MU_EARTH);
    expect(e).toBeLessThan(1e-6);
  });

  it('vis-viva matches circular speed when a = r', () => {
    const r = R_EARTH + 200_000;
    expect(visViva(r, r, MU_EARTH)).toBeCloseTo(circularOrbitSpeed(r, MU_EARTH), 6);
  });
});
