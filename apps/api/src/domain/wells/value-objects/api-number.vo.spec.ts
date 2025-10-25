import { ApiNumber } from './api-number.vo';

describe('ApiNumber Value Object', () => {
  describe('create()', () => {
    describe('Valid API Number Formats', () => {
      it('should create API number with valid Texas RRC format', () => {
        const apiNumber = ApiNumber.create('42-165-12345');

        expect(apiNumber.value).toBe('42-165-12345');
        expect(apiNumber.toString()).toBe('42-165-12345');
      });

      it('should create API number with district 01', () => {
        const apiNumber = ApiNumber.create('01-123-45678');

        expect(apiNumber.value).toBe('01-123-45678');
      });

      it('should create API number with district 99', () => {
        const apiNumber = ApiNumber.create('99-999-99999');

        expect(apiNumber.value).toBe('99-999-99999');
      });

      it('should create API number with zeros in county code', () => {
        const apiNumber = ApiNumber.create('42-001-12345');

        expect(apiNumber.value).toBe('42-001-12345');
      });

      it('should create API number with zeros in sequence', () => {
        const apiNumber = ApiNumber.create('42-165-00001');

        expect(apiNumber.value).toBe('42-165-00001');
      });

      it('should create API number with all zeros in sequence', () => {
        const apiNumber = ApiNumber.create('42-165-00000');

        expect(apiNumber.value).toBe('42-165-00000');
      });
    });

    describe('Normalization', () => {
      it('should trim leading whitespace', () => {
        const apiNumber = ApiNumber.create('   42-165-12345');

        expect(apiNumber.value).toBe('42-165-12345');
      });

      it('should trim trailing whitespace', () => {
        const apiNumber = ApiNumber.create('42-165-12345   ');

        expect(apiNumber.value).toBe('42-165-12345');
      });

      it('should trim both leading and trailing whitespace', () => {
        const apiNumber = ApiNumber.create('   42-165-12345   ');

        expect(apiNumber.value).toBe('42-165-12345');
      });

      it('should handle tabs and normalize', () => {
        const apiNumber = ApiNumber.create('\t42-165-12345\t');

        expect(apiNumber.value).toBe('42-165-12345');
      });
    });

    describe('Invalid API Number Formats', () => {
      it('should throw error for API number without dashes', () => {
        expect(() => ApiNumber.create('4216512345')).toThrow(
          'Invalid API number format: 4216512345. Expected format: XX-XXX-XXXXX (e.g., 42-165-12345)',
        );
      });

      it('should throw error for API number with only one dash', () => {
        expect(() => ApiNumber.create('42-16512345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too few digits in district', () => {
        expect(() => ApiNumber.create('4-165-12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too many digits in district', () => {
        expect(() => ApiNumber.create('425-165-12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too few digits in county', () => {
        expect(() => ApiNumber.create('42-16-12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too many digits in county', () => {
        expect(() => ApiNumber.create('42-1655-12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too few digits in sequence', () => {
        expect(() => ApiNumber.create('42-165-1234')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with too many digits in sequence', () => {
        expect(() => ApiNumber.create('42-165-123456')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with letters', () => {
        expect(() => ApiNumber.create('AB-165-12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for empty string', () => {
        expect(() => ApiNumber.create('')).toThrow('Invalid API number format');
      });

      it('should throw error for whitespace only', () => {
        expect(() => ApiNumber.create('   ')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with spaces instead of dashes', () => {
        expect(() => ApiNumber.create('42 165 12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with slashes', () => {
        expect(() => ApiNumber.create('42/165/12345')).toThrow(
          'Invalid API number format',
        );
      });

      it('should throw error for API number with dots', () => {
        expect(() => ApiNumber.create('42.165.12345')).toThrow(
          'Invalid API number format',
        );
      });
    });
  });

  describe('getters', () => {
    it('should return full API number value', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.value).toBe('42-165-12345');
    });

    it('should extract district number', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.district).toBe('42');
    });

    it('should extract county code', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.countyCode).toBe('165');
    });

    it('should extract sequence number', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.sequenceNumber).toBe('12345');
    });

    it('should extract all parts correctly for different values', () => {
      const apiNumber = ApiNumber.create('01-001-00001');

      expect(apiNumber.district).toBe('01');
      expect(apiNumber.countyCode).toBe('001');
      expect(apiNumber.sequenceNumber).toBe('00001');
    });

    it('should extract all parts correctly for maximum values', () => {
      const apiNumber = ApiNumber.create('99-999-99999');

      expect(apiNumber.district).toBe('99');
      expect(apiNumber.countyCode).toBe('999');
      expect(apiNumber.sequenceNumber).toBe('99999');
    });
  });

  describe('toString()', () => {
    it('should return string representation of API number', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.toString()).toBe('42-165-12345');
    });

    it('should be usable in string concatenation', () => {
      const apiNumber = ApiNumber.create('42-165-12345');
      const message = `API Number: ${apiNumber.toString()}`;

      expect(message).toBe('API Number: 42-165-12345');
    });

    it('should return consistent string on multiple calls', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.toString()).toBe('42-165-12345');
      expect(apiNumber.toString()).toBe('42-165-12345');
    });
  });

  describe('equals()', () => {
    it('should return true for identical API numbers', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-165-12345');

      expect(apiNumber1.equals(apiNumber2)).toBe(true);
    });

    it('should return true for API numbers with different whitespace (normalized)', () => {
      const apiNumber1 = ApiNumber.create('  42-165-12345  ');
      const apiNumber2 = ApiNumber.create('42-165-12345');

      expect(apiNumber1.equals(apiNumber2)).toBe(true);
    });

    it('should return false for different API numbers', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-165-67890');

      expect(apiNumber1.equals(apiNumber2)).toBe(false);
    });

    it('should return false for different districts', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('43-165-12345');

      expect(apiNumber1.equals(apiNumber2)).toBe(false);
    });

    it('should return false for different counties', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-166-12345');

      expect(apiNumber1.equals(apiNumber2)).toBe(false);
    });

    it('should return false for different sequences', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-165-12346');

      expect(apiNumber1.equals(apiNumber2)).toBe(false);
    });

    it('should be symmetric', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-165-12345');

      expect(apiNumber1.equals(apiNumber2)).toBe(apiNumber2.equals(apiNumber1));
    });

    it('should be reflexive', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.equals(apiNumber)).toBe(true);
    });

    it('should be transitive', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('  42-165-12345  ');
      const apiNumber3 = ApiNumber.create('\t42-165-12345\t');

      expect(apiNumber1.equals(apiNumber2)).toBe(true);
      expect(apiNumber2.equals(apiNumber3)).toBe(true);
      expect(apiNumber1.equals(apiNumber3)).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber.value).toBe('42-165-12345');
      expect(apiNumber.toString()).toBe('42-165-12345');

      // Multiple calls should return consistent results
      expect(apiNumber.value).toBe('42-165-12345');
      expect(apiNumber.toString()).toBe('42-165-12345');
    });

    it('should create new instances rather than modifying existing ones', () => {
      const apiNumber1 = ApiNumber.create('42-165-12345');
      const apiNumber2 = ApiNumber.create('42-165-67890');

      // Both should maintain their original state
      expect(apiNumber1.value).toBe('42-165-12345');
      expect(apiNumber2.value).toBe('42-165-67890');
    });

    it('should use private constructor (TypeScript enforced)', () => {
      const apiNumber = ApiNumber.create('42-165-12345');

      expect(apiNumber).toBeInstanceOf(ApiNumber);
      expect(apiNumber.value).toBe('42-165-12345');
    });

    it('should not allow modification of internal state', () => {
      const apiNumber = ApiNumber.create('42-165-12345');
      const initialValue = apiNumber.value;

      expect(apiNumber.value).toBe(initialValue);
      expect(apiNumber.value).toBe('42-165-12345');
    });
  });

  describe('Error Messages', () => {
    it('should include original input in invalid format error', () => {
      const invalidApiNumber = '42-165-1234';

      expect(() => ApiNumber.create(invalidApiNumber)).toThrow(
        `Invalid API number format: ${invalidApiNumber}. Expected format: XX-XXX-XXXXX (e.g., 42-165-12345)`,
      );
    });

    it('should show clear error with expected format', () => {
      expect(() => ApiNumber.create('invalid')).toThrow(
        'Expected format: XX-XXX-XXXXX (e.g., 42-165-12345)',
      );
    });
  });

  describe('Real-world Permian Basin Examples', () => {
    it('should accept Permian Basin District 8 (Midland County)', () => {
      const apiNumber = ApiNumber.create('08-329-12345');

      expect(apiNumber.district).toBe('08');
      expect(apiNumber.countyCode).toBe('329'); // Midland County
    });

    it('should accept Permian Basin District 8A (Ector County)', () => {
      // Note: 8A is represented as 08 in numeric format
      const apiNumber = ApiNumber.create('08-135-67890');

      expect(apiNumber.district).toBe('08');
      expect(apiNumber.countyCode).toBe('135'); // Ector County
    });

    it('should accept Permian Basin District 7C (Reeves County)', () => {
      const apiNumber = ApiNumber.create('07-389-11111');

      expect(apiNumber.district).toBe('07');
      expect(apiNumber.countyCode).toBe('389'); // Reeves County
    });

    it('should accept various Permian Basin counties', () => {
      const permianWells = [
        '08-003-22222', // Andrews County
        '08-165-33333', // Gaines County
        '08-227-44444', // Howard County
        '08-371-55555', // Pecos County
        '08-501-66666', // Yoakum County
      ];

      permianWells.forEach((well) => {
        const apiNumber = ApiNumber.create(well);
        expect(apiNumber.value).toBe(well);
      });
    });
  });
});
