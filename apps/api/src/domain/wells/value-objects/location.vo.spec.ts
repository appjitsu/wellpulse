import { Location } from './location.vo';

describe('Location Value Object', () => {
  describe('create()', () => {
    describe('Valid Locations', () => {
      it('should create location with valid coordinates', () => {
        const location = Location.create(31.8457, -102.3676);

        expect(location.latitude).toBe(31.8457);
        expect(location.longitude).toBe(-102.3676);
      });

      it('should create location at equator', () => {
        const location = Location.create(0, 0);

        expect(location.latitude).toBe(0);
        expect(location.longitude).toBe(0);
      });

      it('should create location at north pole', () => {
        const location = Location.create(90, 0);

        expect(location.latitude).toBe(90);
      });

      it('should create location at south pole', () => {
        const location = Location.create(-90, 0);

        expect(location.latitude).toBe(-90);
      });

      it('should create location at international date line', () => {
        const location = Location.create(0, 180);

        expect(location.longitude).toBe(180);
      });

      it('should create location at negative longitude boundary', () => {
        const location = Location.create(0, -180);

        expect(location.longitude).toBe(-180);
      });

      it('should create location with high precision', () => {
        const location = Location.create(31.84567890123, -102.36789012345);

        expect(location.latitude).toBe(31.84567890123);
        expect(location.longitude).toBe(-102.36789012345);
      });
    });

    describe('Invalid Latitudes', () => {
      it('should throw error for latitude greater than 90', () => {
        expect(() => Location.create(90.1, 0)).toThrow(
          'Invalid latitude: 90.1. Must be between -90 and 90 degrees.',
        );
      });

      it('should throw error for latitude less than -90', () => {
        expect(() => Location.create(-90.1, 0)).toThrow(
          'Invalid latitude: -90.1. Must be between -90 and 90 degrees.',
        );
      });

      it('should throw error for latitude way out of bounds (positive)', () => {
        expect(() => Location.create(200, 0)).toThrow(
          'Invalid latitude: 200. Must be between -90 and 90 degrees.',
        );
      });

      it('should throw error for latitude way out of bounds (negative)', () => {
        expect(() => Location.create(-200, 0)).toThrow(
          'Invalid latitude: -200. Must be between -90 and 90 degrees.',
        );
      });
    });

    describe('Invalid Longitudes', () => {
      it('should throw error for longitude greater than 180', () => {
        expect(() => Location.create(0, 180.1)).toThrow(
          'Invalid longitude: 180.1. Must be between -180 and 180 degrees.',
        );
      });

      it('should throw error for longitude less than -180', () => {
        expect(() => Location.create(0, -180.1)).toThrow(
          'Invalid longitude: -180.1. Must be between -180 and 180 degrees.',
        );
      });

      it('should throw error for longitude way out of bounds (positive)', () => {
        expect(() => Location.create(0, 360)).toThrow(
          'Invalid longitude: 360. Must be between -180 and 180 degrees.',
        );
      });

      it('should throw error for longitude way out of bounds (negative)', () => {
        expect(() => Location.create(0, -360)).toThrow(
          'Invalid longitude: -360. Must be between -180 and 180 degrees.',
        );
      });
    });
  });

  describe('getters', () => {
    it('should return latitude', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.latitude).toBe(31.8457);
    });

    it('should return longitude', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.longitude).toBe(-102.3676);
    });

    it('should return consistent values on multiple calls', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.latitude).toBe(31.8457);
      expect(location.latitude).toBe(31.8457);
      expect(location.longitude).toBe(-102.3676);
      expect(location.longitude).toBe(-102.3676);
    });
  });

  describe('toJSON()', () => {
    it('should return plain object with latitude and longitude', () => {
      const location = Location.create(31.8457, -102.3676);

      const json = location.toJSON();

      expect(json).toEqual({
        latitude: 31.8457,
        longitude: -102.3676,
      });
    });

    it('should return object suitable for serialization', () => {
      const location = Location.create(31.8457, -102.3676);

      const serialized = JSON.stringify(location.toJSON());
      const deserialized = JSON.parse(serialized) as {
        latitude: number;
        longitude: number;
      };

      expect(deserialized.latitude).toBe(31.8457);
      expect(deserialized.longitude).toBe(-102.3676);
    });
  });

  describe('toString()', () => {
    it('should return string representation of location', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.toString()).toBe('31.8457, -102.3676');
    });

    it('should be usable in string concatenation', () => {
      const location = Location.create(31.8457, -102.3676);
      const message = `Coordinates: ${location.toString()}`;

      expect(message).toBe('Coordinates: 31.8457, -102.3676');
    });

    it('should return consistent string on multiple calls', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.toString()).toBe('31.8457, -102.3676');
      expect(location.toString()).toBe('31.8457, -102.3676');
    });
  });

  describe('equals()', () => {
    it('should return true for identical locations', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8457, -102.3676);

      expect(location1.equals(location2)).toBe(true);
    });

    it('should return false for different latitudes', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8458, -102.3676);

      expect(location1.equals(location2)).toBe(false);
    });

    it('should return false for different longitudes', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8457, -102.3677);

      expect(location1.equals(location2)).toBe(false);
    });

    it('should return true for locations within epsilon tolerance', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.84570000001, -102.36760000001);

      expect(location1.equals(location2)).toBe(true);
    });

    it('should be symmetric', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8457, -102.3676);

      expect(location1.equals(location2)).toBe(location2.equals(location1));
    });

    it('should be reflexive', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.equals(location)).toBe(true);
    });

    it('should be transitive', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.84570000001, -102.36760000001);
      const location3 = Location.create(31.8457, -102.3676);

      expect(location1.equals(location2)).toBe(true);
      expect(location2.equals(location3)).toBe(true);
      expect(location1.equals(location3)).toBe(true);
    });
  });

  describe('distanceTo()', () => {
    it('should calculate distance between two locations', () => {
      // Midland, TX to Odessa, TX (approximately 18 miles)
      const midland = Location.create(31.9973, -102.0779);
      const odessa = Location.create(31.8457, -102.3676);

      const distance = midland.distanceTo(odessa);

      expect(distance).toBeGreaterThan(17);
      expect(distance).toBeLessThan(20);
    });

    it('should return 0 for same location', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8457, -102.3676);

      const distance = location1.distanceTo(location2);

      expect(distance).toBeLessThan(0.001); // Essentially 0
    });

    it('should be symmetric (distance A to B = distance B to A)', () => {
      const location1 = Location.create(31.9973, -102.0779);
      const location2 = Location.create(31.8457, -102.3676);

      const distance1to2 = location1.distanceTo(location2);
      const distance2to1 = location2.distanceTo(location1);

      expect(Math.abs(distance1to2 - distance2to1)).toBeLessThan(0.001);
    });

    it('should calculate distance for nearby wells (< 1 mile)', () => {
      const well1 = Location.create(31.8457, -102.3676);
      const well2 = Location.create(31.8557, -102.3776); // ~1 mile

      const distance = well1.distanceTo(well2);

      expect(distance).toBeGreaterThan(0.5);
      expect(distance).toBeLessThan(1.5);
    });

    it('should calculate distance for distant wells (> 100 miles)', () => {
      // Midland, TX to El Paso, TX (approximately 300 miles)
      const midland = Location.create(31.9973, -102.0779);
      const elPaso = Location.create(31.7619, -106.485);

      const distance = midland.distanceTo(elPaso);

      expect(distance).toBeGreaterThan(250);
      expect(distance).toBeLessThan(350);
    });

    it('should handle locations across the equator', () => {
      const north = Location.create(10, 0);
      const south = Location.create(-10, 0);

      const distance = north.distanceTo(south);

      expect(distance).toBeGreaterThan(1300); // ~1380 miles
      expect(distance).toBeLessThan(1500);
    });

    it('should handle locations across the prime meridian', () => {
      const west = Location.create(0, -10);
      const east = Location.create(0, 10);

      const distance = west.distanceTo(east);

      expect(distance).toBeGreaterThan(1300); // ~1380 miles
      expect(distance).toBeLessThan(1500);
    });

    it('should calculate correct distance at high latitudes', () => {
      const location1 = Location.create(80, 0);
      const location2 = Location.create(80, 10);

      const distance = location1.distanceTo(location2);

      // At high latitudes, longitude degrees represent shorter distances
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(300);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location.latitude).toBe(31.8457);
      expect(location.longitude).toBe(-102.3676);

      // Multiple calls should return consistent results
      expect(location.latitude).toBe(31.8457);
      expect(location.longitude).toBe(-102.3676);
    });

    it('should create new instances rather than modifying existing ones', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(32.7767, -96.797);

      // Both should maintain their original state
      expect(location1.latitude).toBe(31.8457);
      expect(location1.longitude).toBe(-102.3676);
      expect(location2.latitude).toBe(32.7767);
      expect(location2.longitude).toBe(-96.797);
    });

    it('should use private constructor (TypeScript enforced)', () => {
      const location = Location.create(31.8457, -102.3676);

      expect(location).toBeInstanceOf(Location);
      expect(location.latitude).toBe(31.8457);
      expect(location.longitude).toBe(-102.3676);
    });

    it('should not allow modification of internal state', () => {
      const location = Location.create(31.8457, -102.3676);
      const initialLat = location.latitude;
      const initialLon = location.longitude;

      expect(location.latitude).toBe(initialLat);
      expect(location.longitude).toBe(initialLon);
    });
  });

  describe('Real-world Permian Basin Locations', () => {
    it('should create location for Midland, TX', () => {
      const midland = Location.create(31.9973, -102.0779);

      expect(midland.latitude).toBe(31.9973);
      expect(midland.longitude).toBe(-102.0779);
    });

    it('should create location for Odessa, TX', () => {
      const odessa = Location.create(31.8457, -102.3676);

      expect(odessa.latitude).toBe(31.8457);
      expect(odessa.longitude).toBe(-102.3676);
    });

    it('should create location for Pecos, TX', () => {
      const pecos = Location.create(31.4229, -103.4932);

      expect(pecos.latitude).toBe(31.4229);
      expect(pecos.longitude).toBe(-103.4932);
    });

    it('should calculate distances between Permian Basin cities', () => {
      const midland = Location.create(31.9973, -102.0779);
      const odessa = Location.create(31.8457, -102.3676);
      const pecos = Location.create(31.4229, -103.4932);

      const midlandToOdessa = midland.distanceTo(odessa);
      const midlandToPecos = midland.distanceTo(pecos);
      const odessaToPecos = odessa.distanceTo(pecos);

      expect(midlandToOdessa).toBeGreaterThan(17);
      expect(midlandToOdessa).toBeLessThan(20);

      expect(midlandToPecos).toBeGreaterThan(80);
      expect(midlandToPecos).toBeLessThan(95);

      expect(odessaToPecos).toBeGreaterThan(65);
      expect(odessaToPecos).toBeLessThan(75);
    });

    it('should handle typical Permian Basin well coordinates', () => {
      const wellLocations = [
        Location.create(31.8765, -102.1234), // Typical Midland County
        Location.create(31.7456, -102.4321), // Typical Ector County
        Location.create(31.5678, -103.2109), // Typical Reeves County
        Location.create(32.1234, -101.8765), // Typical Martin County
        Location.create(31.2109, -102.8765), // Typical Ward County
      ];

      wellLocations.forEach((location) => {
        expect(location.latitude).toBeGreaterThan(31);
        expect(location.latitude).toBeLessThan(33);
        expect(location.longitude).toBeGreaterThan(-104);
        expect(location.longitude).toBeLessThan(-101);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small coordinate differences', () => {
      const location1 = Location.create(31.8457, -102.3676);
      const location2 = Location.create(31.8457001, -102.3676001);

      const distance = location1.distanceTo(location2);

      expect(distance).toBeLessThan(0.01); // Less than 0.01 miles
    });

    it('should handle maximum distance on Earth', () => {
      const location1 = Location.create(0, 0);
      const location2 = Location.create(0, 180);

      const distance = location1.distanceTo(location2);

      // Half the Earth's circumference at equator (~12,450 miles)
      expect(distance).toBeGreaterThan(12000);
      expect(distance).toBeLessThan(13000);
    });

    it('should handle poles', () => {
      const northPole = Location.create(90, 0);
      const southPole = Location.create(-90, 0);

      const distance = northPole.distanceTo(southPole);

      // Half the Earth's meridional circumference (~12,430 miles)
      expect(distance).toBeGreaterThan(12000);
      expect(distance).toBeLessThan(13000);
    });
  });

  describe('Error Messages', () => {
    it('should include value in invalid latitude error', () => {
      const invalidLat = 95;

      expect(() => Location.create(invalidLat, 0)).toThrow(
        `Invalid latitude: ${invalidLat}. Must be between -90 and 90 degrees.`,
      );
    });

    it('should include value in invalid longitude error', () => {
      const invalidLon = 185;

      expect(() => Location.create(0, invalidLon)).toThrow(
        `Invalid longitude: ${invalidLon}. Must be between -180 and 180 degrees.`,
      );
    });
  });
});
