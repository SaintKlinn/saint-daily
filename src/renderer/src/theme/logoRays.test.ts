import { describe, expect, it } from 'vitest';
import { LOGO_RAYS, LOGO_VIEWBOX } from './logoRays';

describe('LOGO_RAYS', () => {
  it('has the 17 rays of the Saint mark', () => {
    expect(LOGO_RAYS).toHaveLength(17);
  });

  it("is symmetric around the viewBox's horizontal midpoint", () => {
    const midX = LOGO_VIEWBOX.width / 2;
    const left = LOGO_RAYS.slice(0, 8);
    const right = LOGO_RAYS.slice(9).reverse();
    left.forEach((ray, i) => {
      const mirrored = right[i];
      expect(ray.x1 + mirrored.x1).toBeCloseTo(midX * 2, 1);
      expect(ray.x2 + mirrored.x2).toBeCloseTo(midX * 2, 1);
      expect(ray.y1).toBeCloseTo(mirrored.y1, 5);
      expect(ray.y2).toBeCloseTo(mirrored.y2, 5);
      expect(ray.o).toBeCloseTo(mirrored.o, 5);
    });
  });
});

describe('LOGO_VIEWBOX', () => {
  it('matches the Saint mark drawing dimensions', () => {
    expect(LOGO_VIEWBOX).toEqual({ minX: 0, minY: 0, width: 128, height: 85 });
  });
});
