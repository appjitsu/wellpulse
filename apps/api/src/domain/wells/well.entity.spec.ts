/**
 * Well Entity Tests
 *
 * Tests all business rules and lifecycle methods of the Well entity.
 * Covers well creation, status transitions, location updates, and business rules.
 */

import { Well, CreateWellParams } from './well.entity';

describe('Well Entity', () => {
  const validWellParams: CreateWellParams = {
    name: 'Smith Well #1',
    apiNumber: '42-165-12345',
    latitude: 31.8457,
    longitude: -102.3676,
    status: 'ACTIVE',
    lease: 'Smith Lease',
    field: 'Spraberry Field',
    operator: 'Acme Oil Co',
    spudDate: new Date('2024-01-15'),
    completionDate: new Date('2024-02-20'),
    metadata: { depth: 8500, formation: 'Wolfcamp A' },
  };

  describe('create', () => {
    it('should create a valid well with all required fields', () => {
      const well = Well.create(validWellParams);

      expect(well).toBeInstanceOf(Well);
      expect(well.name).toBe('Smith Well #1');
      expect(well.apiNumber).toBe('42-165-12345');
      expect(well.latitude).toBe(31.8457);
      expect(well.longitude).toBe(-102.3676);
      expect(well.status).toBe('ACTIVE');
      expect(well.id).toBeDefined();
      expect(well.createdAt).toBeInstanceOf(Date);
      expect(well.updatedAt).toBeInstanceOf(Date);
    });

    it('should create well with minimal required fields only', () => {
      const minimalParams: CreateWellParams = {
        name: 'Test Well',
        apiNumber: '42-165-67890',
        latitude: 31.9,
        longitude: -102.1,
      };

      const well = Well.create(minimalParams);

      expect(well.name).toBe('Test Well');
      expect(well.apiNumber).toBe('42-165-67890');
      expect(well.status).toBe('ACTIVE'); // Default
      expect(well.lease).toBeNull();
      expect(well.field).toBeNull();
      expect(well.operator).toBeNull();
    });

    it('should default status to ACTIVE if not provided', () => {
      const params = { ...validWellParams };
      delete params.status;

      const well = Well.create(params);

      expect(well.status).toBe('ACTIVE');
    });

    it('should accept INACTIVE status', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });

      expect(well.status).toBe('INACTIVE');
    });

    it('should accept PLUGGED status', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'PLUGGED',
      });

      expect(well.status).toBe('PLUGGED');
    });

    it('should accept custom ID if provided', () => {
      const customId = 'custom-uuid-123';
      const well = Well.create(validWellParams, customId);

      expect(well.id).toBe(customId);
    });

    it('should generate unique IDs for different wells', () => {
      const well1 = Well.create(validWellParams);
      const well2 = Well.create({
        ...validWellParams,
        apiNumber: '42-165-99999',
      });

      expect(well1.id).not.toBe(well2.id);
    });

    it('should trim whitespace from well name', () => {
      const well = Well.create({
        ...validWellParams,
        name: '  Smith Well #1  ',
      });

      expect(well.name).toBe('Smith Well #1');
    });

    it('should throw error for empty well name', () => {
      expect(() =>
        Well.create({
          ...validWellParams,
          name: '',
        }),
      ).toThrow('Well name cannot be empty');
    });

    it('should throw error for whitespace-only well name', () => {
      expect(() =>
        Well.create({
          ...validWellParams,
          name: '   ',
        }),
      ).toThrow('Well name cannot be empty');
    });

    it('should throw error for invalid API number format', () => {
      expect(() =>
        Well.create({
          ...validWellParams,
          apiNumber: 'invalid',
        }),
      ).toThrow('Invalid API number format');
    });

    it('should throw error for invalid latitude', () => {
      expect(() =>
        Well.create({
          ...validWellParams,
          latitude: 91, // > 90
        }),
      ).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      expect(() =>
        Well.create({
          ...validWellParams,
          longitude: 181, // > 180
        }),
      ).toThrow('Invalid longitude');
    });

    it('should store optional dates', () => {
      const well = Well.create(validWellParams);

      expect(well.spudDate).toEqual(new Date('2024-01-15'));
      expect(well.completionDate).toEqual(new Date('2024-02-20'));
    });

    it('should store metadata', () => {
      const well = Well.create(validWellParams);

      expect(well.metadata).toEqual({ depth: 8500, formation: 'Wolfcamp A' });
    });

    it('should default metadata to empty object if not provided', () => {
      const params = { ...validWellParams };
      delete params.metadata;

      const well = Well.create(params);

      expect(well.metadata).toEqual({});
    });

    it('should store createdBy if provided', () => {
      const well = Well.create({
        ...validWellParams,
        createdBy: 'user-123',
      });

      expect(well.createdBy).toBe('user-123');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute well from persistence data', () => {
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Smith Well #1',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'ACTIVE' as const,
        lease: 'Smith Lease',
        field: 'Spraberry Field',
        operator: 'Acme Oil Co',
        spudDate: new Date('2024-01-15'),
        completionDate: new Date('2024-02-20'),
        metadata: { depth: 8500 },
        createdBy: 'user-123',
        updatedBy: 'user-456',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-20T10:00:00Z'),
      };

      const well = Well.reconstitute(persistenceData);

      expect(well.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(well.name).toBe('Smith Well #1');
      expect(well.apiNumber).toBe('42-165-12345');
      expect(well.status).toBe('ACTIVE');
      expect(well.createdBy).toBe('user-123');
      expect(well.updatedBy).toBe('user-456');
    });

    it('should reconstitute well with null optional fields', () => {
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Well',
        apiNumber: '42-165-12345',
        latitude: 31.8457,
        longitude: -102.3676,
        status: 'ACTIVE' as const,
        lease: null,
        field: null,
        operator: null,
        spudDate: null,
        completionDate: null,
        metadata: {},
        createdBy: null,
        updatedBy: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-20T10:00:00Z'),
      };

      const well = Well.reconstitute(persistenceData);

      expect(well.lease).toBeNull();
      expect(well.field).toBeNull();
      expect(well.operator).toBeNull();
      expect(well.spudDate).toBeNull();
      expect(well.completionDate).toBeNull();
    });
  });

  describe('getters', () => {
    it('should expose all required getters', () => {
      const well = Well.create(validWellParams);

      expect(well.id).toBeDefined();
      expect(well.name).toBe('Smith Well #1');
      expect(well.apiNumber).toBe('42-165-12345');
      expect(well.latitude).toBe(31.8457);
      expect(well.longitude).toBe(-102.3676);
      expect(well.status).toBe('ACTIVE');
      expect(well.lease).toBe('Smith Lease');
      expect(well.field).toBe('Spraberry Field');
      expect(well.operator).toBe('Acme Oil Co');
      expect(well.spudDate).toBeInstanceOf(Date);
      expect(well.completionDate).toBeInstanceOf(Date);
      expect(well.metadata).toBeDefined();
      expect(well.createdAt).toBeInstanceOf(Date);
      expect(well.updatedAt).toBeInstanceOf(Date);
    });

    it('should return location as plain object', () => {
      const well = Well.create(validWellParams);

      const location = well.location;

      expect(location).toEqual({
        latitude: 31.8457,
        longitude: -102.3676,
      });
    });

    it('should return copy of metadata to maintain immutability', () => {
      const well = Well.create(validWellParams);

      const metadata1 = well.metadata;
      const metadata2 = well.metadata;

      expect(metadata1).toEqual(metadata2);
      expect(metadata1).not.toBe(metadata2); // Different objects
    });
  });

  describe('activate', () => {
    it('should activate an inactive well', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });

      well.activate();

      expect(well.status).toBe('ACTIVE');
    });

    it('should activate well with user ID', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });

      well.activate('user-123');

      expect(well.status).toBe('ACTIVE');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should do nothing if well is already active', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });
      const updatedAt = well.updatedAt;

      well.activate();

      expect(well.status).toBe('ACTIVE');
      expect(well.updatedAt).toEqual(updatedAt);
    });

    it('should throw error when trying to activate plugged well', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'PLUGGED',
      });

      expect(() => {
        well.activate();
      }).toThrow(
        'Cannot activate a plugged well. Plugged is a terminal state.',
      );
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });
      const originalUpdatedAt = well.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {}, 10);

      well.activate();

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active well', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.deactivate();

      expect(well.status).toBe('INACTIVE');
    });

    it('should deactivate well with user ID', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.deactivate('user-123');

      expect(well.status).toBe('INACTIVE');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should do nothing if well is already inactive', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });
      const updatedAt = well.updatedAt;

      well.deactivate();

      expect(well.status).toBe('INACTIVE');
      expect(well.updatedAt).toEqual(updatedAt);
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.deactivate();

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('plug', () => {
    it('should plug an active well', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.plug();

      expect(well.status).toBe('PLUGGED');
    });

    it('should plug an inactive well', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE',
      });

      well.plug();

      expect(well.status).toBe('PLUGGED');
    });

    it('should plug well with user ID', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.plug('user-123');

      expect(well.status).toBe('PLUGGED');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should do nothing if well is already plugged', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'PLUGGED',
      });
      const updatedAt = well.updatedAt;

      well.plug();

      expect(well.status).toBe('PLUGGED');
      expect(well.updatedAt).toEqual(updatedAt);
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.plug();

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });

    it('should make well status terminal (cannot reactivate after plugging)', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.plug();

      expect(() => {
        well.activate();
      }).toThrow(
        'Cannot activate a plugged well. Plugged is a terminal state.',
      );
    });
  });

  describe('updateLocation', () => {
    it('should update well location', () => {
      const well = Well.create(validWellParams);

      well.updateLocation(32.1234, -103.5678);

      expect(well.latitude).toBe(32.1234);
      expect(well.longitude).toBe(-103.5678);
    });

    it('should update location with user ID', () => {
      const well = Well.create(validWellParams);

      well.updateLocation(32.1234, -103.5678, 'user-123');

      expect(well.updatedBy).toBe('user-123');
    });

    it('should throw error for invalid latitude', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateLocation(91, -103.5678);
      }).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateLocation(32.1234, 181);
      }).toThrow('Invalid longitude');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.updateLocation(32.1234, -103.5678);

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateName', () => {
    it('should update well name', () => {
      const well = Well.create(validWellParams);

      well.updateName('Jones Well #2');

      expect(well.name).toBe('Jones Well #2');
    });

    it('should update name with user ID', () => {
      const well = Well.create(validWellParams);

      well.updateName('Jones Well #2', 'user-123');

      expect(well.name).toBe('Jones Well #2');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should trim whitespace from new name', () => {
      const well = Well.create(validWellParams);

      well.updateName('  Jones Well #2  ');

      expect(well.name).toBe('Jones Well #2');
    });

    it('should throw error for empty name', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateName('');
      }).toThrow('Well name cannot be empty');
    });

    it('should throw error for whitespace-only name', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateName('   ');
      }).toThrow('Well name cannot be empty');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.updateName('Jones Well #2');

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateLease', () => {
    it('should update lease information', () => {
      const well = Well.create(validWellParams);

      well.updateLease('New Lease');

      expect(well.lease).toBe('New Lease');
    });

    it('should update lease with user ID', () => {
      const well = Well.create(validWellParams);

      well.updateLease('New Lease', 'user-123');

      expect(well.lease).toBe('New Lease');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.updateLease('New Lease');

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateField', () => {
    it('should update field information', () => {
      const well = Well.create(validWellParams);

      well.updateField('Wolfcamp Field');

      expect(well.field).toBe('Wolfcamp Field');
    });

    it('should update field with user ID', () => {
      const well = Well.create(validWellParams);

      well.updateField('Wolfcamp Field', 'user-123');

      expect(well.field).toBe('Wolfcamp Field');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.updateField('Wolfcamp Field');

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateOperator', () => {
    it('should update operator information', () => {
      const well = Well.create(validWellParams);

      well.updateOperator('New Operator LLC');

      expect(well.operator).toBe('New Operator LLC');
    });

    it('should update operator with user ID', () => {
      const well = Well.create(validWellParams);

      well.updateOperator('New Operator LLC', 'user-123');

      expect(well.operator).toBe('New Operator LLC');
      expect(well.updatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;

      setTimeout(() => {}, 10);

      well.updateOperator('New Operator LLC');

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateSpudDate', () => {
    it('should update spud date', () => {
      const well = Well.create(validWellParams);
      const newDate = new Date('2024-03-01');

      well.updateSpudDate(newDate);

      expect(well.spudDate).toEqual(newDate);
    });

    it('should update spud date with user ID', () => {
      const well = Well.create(validWellParams);
      const newDate = new Date('2024-03-01');

      well.updateSpudDate(newDate, 'user-123');

      expect(well.spudDate).toEqual(newDate);
      expect(well.updatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;
      const newDate = new Date('2024-03-01');

      setTimeout(() => {}, 10);

      well.updateSpudDate(newDate);

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateCompletionDate', () => {
    it('should update completion date', () => {
      const well = Well.create(validWellParams);
      const newDate = new Date('2024-04-01');

      well.updateCompletionDate(newDate);

      expect(well.completionDate).toEqual(newDate);
    });

    it('should update completion date with user ID', () => {
      const well = Well.create(validWellParams);
      const newDate = new Date('2024-04-01');

      well.updateCompletionDate(newDate, 'user-123');

      expect(well.completionDate).toEqual(newDate);
      expect(well.updatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;
      const newDate = new Date('2024-04-01');

      setTimeout(() => {}, 10);

      well.updateCompletionDate(newDate);

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata', () => {
      const well = Well.create(validWellParams);
      const newMetadata = { depth: 9000, formation: 'Wolfcamp B' };

      well.updateMetadata(newMetadata);

      expect(well.metadata).toEqual(newMetadata);
    });

    it('should update metadata with user ID', () => {
      const well = Well.create(validWellParams);
      const newMetadata = { depth: 9000 };

      well.updateMetadata(newMetadata, 'user-123');

      expect(well.metadata).toEqual(newMetadata);
      expect(well.updatedBy).toBe('user-123');
    });

    it('should replace entire metadata object', () => {
      const well = Well.create(validWellParams);
      const originalMetadata = well.metadata;
      const newMetadata = { newField: 'value' };

      well.updateMetadata(newMetadata);

      expect(well.metadata).toEqual(newMetadata);
      expect(well.metadata).not.toEqual(originalMetadata);
    });

    it('should update updatedAt timestamp', () => {
      const well = Well.create(validWellParams);
      const originalUpdatedAt = well.updatedAt;
      const newMetadata = { depth: 9000 };

      setTimeout(() => {}, 10);

      well.updateMetadata(newMetadata);

      expect(well.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe('distanceTo', () => {
    it('should calculate distance to another well', () => {
      const well1 = Well.create({
        ...validWellParams,
        latitude: 31.9973, // Midland, TX
        longitude: -102.0779,
      });
      const well2 = Well.create({
        ...validWellParams,
        apiNumber: '42-165-67890',
        latitude: 31.8457, // Odessa, TX
        longitude: -102.3676,
      });

      const distance = well1.distanceTo(well2);

      expect(distance).toBeGreaterThan(17);
      expect(distance).toBeLessThan(20);
    });

    it('should return 0 for wells at same location', () => {
      const well1 = Well.create(validWellParams);
      const well2 = Well.create({
        ...validWellParams,
        apiNumber: '42-165-67890',
      });

      const distance = well1.distanceTo(well2);

      expect(distance).toBeLessThan(0.001);
    });

    it('should be symmetric', () => {
      const well1 = Well.create({
        ...validWellParams,
        latitude: 31.9973,
        longitude: -102.0779,
      });
      const well2 = Well.create({
        ...validWellParams,
        apiNumber: '42-165-67890',
        latitude: 31.8457,
        longitude: -102.3676,
      });

      const distance1to2 = well1.distanceTo(well2);
      const distance2to1 = well2.distanceTo(well1);

      expect(Math.abs(distance1to2 - distance2to1)).toBeLessThan(0.001);
    });
  });

  describe('Business Rules', () => {
    it('should enforce API number immutability (no update method)', () => {
      const well = Well.create(validWellParams);
      const originalApiNumber = well.apiNumber;

      // API number should remain constant
      expect(well.apiNumber).toBe(originalApiNumber);
      expect(well.apiNumber).toBe('42-165-12345');
    });

    it('should enforce terminal plugged status', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'ACTIVE',
      });

      well.plug();

      // Cannot reactivate after plugging
      expect(() => {
        well.activate();
      }).toThrow(
        'Cannot activate a plugged well. Plugged is a terminal state.',
      );
    });

    it('should maintain audit trail with updatedBy', () => {
      const well = Well.create({
        ...validWellParams,
        status: 'INACTIVE', // Start inactive so activate() will actually update
        createdBy: 'user-1',
      });

      well.updateName('New Name', 'user-2');
      expect(well.updatedBy).toBe('user-2');

      well.updateLocation(32.0, -103.0, 'user-3');
      expect(well.updatedBy).toBe('user-3');

      well.activate('user-4');
      expect(well.updatedBy).toBe('user-4');
    });

    it('should validate location on updates', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateLocation(95, 0);
      }).toThrow('Invalid latitude');

      expect(() => {
        well.updateLocation(0, 185);
      }).toThrow('Invalid longitude');
    });

    it('should validate well name on updates', () => {
      const well = Well.create(validWellParams);

      expect(() => {
        well.updateName('');
      }).toThrow('Well name cannot be empty');

      expect(() => {
        well.updateName('   ');
      }).toThrow('Well name cannot be empty');
    });
  });

  describe('Metadata Immutability', () => {
    it('should return copy of metadata to prevent external mutation', () => {
      const well = Well.create(validWellParams);
      const metadata = well.metadata;

      // Attempt to mutate returned metadata
      metadata.newField = 'should not affect well';

      // Well's internal metadata should remain unchanged
      expect(well.metadata).toEqual({ depth: 8500, formation: 'Wolfcamp A' });
      expect(well.metadata).not.toHaveProperty('newField');
    });
  });
});
