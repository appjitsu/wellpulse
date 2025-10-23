import { TenantStatus } from './tenant-status.vo';

describe('TenantStatus Value Object', () => {
  describe('Factory Methods', () => {
    describe('active()', () => {
      it('should create an ACTIVE status', () => {
        const status = TenantStatus.active();

        expect(status.isActive()).toBe(true);
        expect(status.toString()).toBe('ACTIVE');
      });

      it('should create a new instance each time', () => {
        const status1 = TenantStatus.active();
        const status2 = TenantStatus.active();

        expect(status1).not.toBe(status2);
        expect(status1.equals(status2)).toBe(true);
      });
    });

    describe('trial()', () => {
      it('should create a TRIAL status', () => {
        const status = TenantStatus.trial();

        expect(status.isTrial()).toBe(true);
        expect(status.toString()).toBe('TRIAL');
      });

      it('should create a new instance each time', () => {
        const status1 = TenantStatus.trial();
        const status2 = TenantStatus.trial();

        expect(status1).not.toBe(status2);
        expect(status1.equals(status2)).toBe(true);
      });
    });

    describe('suspended()', () => {
      it('should create a SUSPENDED status', () => {
        const status = TenantStatus.suspended();

        expect(status.isSuspended()).toBe(true);
        expect(status.toString()).toBe('SUSPENDED');
      });

      it('should create a new instance each time', () => {
        const status1 = TenantStatus.suspended();
        const status2 = TenantStatus.suspended();

        expect(status1).not.toBe(status2);
        expect(status1.equals(status2)).toBe(true);
      });
    });

    describe('deleted()', () => {
      it('should create a DELETED status', () => {
        const status = TenantStatus.deleted();

        expect(status.isDeleted()).toBe(true);
        expect(status.toString()).toBe('DELETED');
      });

      it('should create a new instance each time', () => {
        const status1 = TenantStatus.deleted();
        const status2 = TenantStatus.deleted();

        expect(status1).not.toBe(status2);
        expect(status1.equals(status2)).toBe(true);
      });
    });
  });

  describe('fromString()', () => {
    describe('Valid Inputs', () => {
      it('should create ACTIVE status from uppercase string', () => {
        const status = TenantStatus.fromString('ACTIVE');

        expect(status.isActive()).toBe(true);
        expect(status.toString()).toBe('ACTIVE');
      });

      it('should create ACTIVE status from lowercase string', () => {
        const status = TenantStatus.fromString('active');

        expect(status.isActive()).toBe(true);
        expect(status.toString()).toBe('ACTIVE');
      });

      it('should create ACTIVE status from mixed case string', () => {
        const status = TenantStatus.fromString('AcTiVe');

        expect(status.isActive()).toBe(true);
        expect(status.toString()).toBe('ACTIVE');
      });

      it('should create TRIAL status from string', () => {
        const status = TenantStatus.fromString('trial');

        expect(status.isTrial()).toBe(true);
        expect(status.toString()).toBe('TRIAL');
      });

      it('should create SUSPENDED status from string', () => {
        const status = TenantStatus.fromString('SUSPENDED');

        expect(status.isSuspended()).toBe(true);
        expect(status.toString()).toBe('SUSPENDED');
      });

      it('should create DELETED status from string', () => {
        const status = TenantStatus.fromString('deleted');

        expect(status.isDeleted()).toBe(true);
        expect(status.toString()).toBe('DELETED');
      });
    });

    describe('Invalid Inputs', () => {
      it('should throw error for invalid status string', () => {
        expect(() => TenantStatus.fromString('INVALID')).toThrow(
          'Invalid tenant status: INVALID',
        );
      });

      it('should throw error for empty string', () => {
        expect(() => TenantStatus.fromString('')).toThrow(
          'Invalid tenant status: ',
        );
      });

      it('should throw error for whitespace string', () => {
        expect(() => TenantStatus.fromString('   ')).toThrow(
          'Invalid tenant status:    ',
        );
      });

      it('should throw error for numeric string', () => {
        expect(() => TenantStatus.fromString('123')).toThrow(
          'Invalid tenant status: 123',
        );
      });

      it('should throw error for partial match', () => {
        expect(() => TenantStatus.fromString('ACT')).toThrow(
          'Invalid tenant status: ACT',
        );
      });
    });
  });

  describe('State Check Methods', () => {
    describe('isActive()', () => {
      it('should return true only for ACTIVE status', () => {
        expect(TenantStatus.active().isActive()).toBe(true);
        expect(TenantStatus.trial().isActive()).toBe(false);
        expect(TenantStatus.suspended().isActive()).toBe(false);
        expect(TenantStatus.deleted().isActive()).toBe(false);
      });
    });

    describe('isTrial()', () => {
      it('should return true only for TRIAL status', () => {
        expect(TenantStatus.active().isTrial()).toBe(false);
        expect(TenantStatus.trial().isTrial()).toBe(true);
        expect(TenantStatus.suspended().isTrial()).toBe(false);
        expect(TenantStatus.deleted().isTrial()).toBe(false);
      });
    });

    describe('isSuspended()', () => {
      it('should return true only for SUSPENDED status', () => {
        expect(TenantStatus.active().isSuspended()).toBe(false);
        expect(TenantStatus.trial().isSuspended()).toBe(false);
        expect(TenantStatus.suspended().isSuspended()).toBe(true);
        expect(TenantStatus.deleted().isSuspended()).toBe(false);
      });
    });

    describe('isDeleted()', () => {
      it('should return true only for DELETED status', () => {
        expect(TenantStatus.active().isDeleted()).toBe(false);
        expect(TenantStatus.trial().isDeleted()).toBe(false);
        expect(TenantStatus.suspended().isDeleted()).toBe(false);
        expect(TenantStatus.deleted().isDeleted()).toBe(true);
      });
    });
  });

  describe('canAccess()', () => {
    it('should return true for ACTIVE status', () => {
      const status = TenantStatus.active();

      expect(status.canAccess()).toBe(true);
    });

    it('should return true for TRIAL status', () => {
      const status = TenantStatus.trial();

      expect(status.canAccess()).toBe(true);
    });

    it('should return false for SUSPENDED status', () => {
      const status = TenantStatus.suspended();

      expect(status.canAccess()).toBe(false);
    });

    it('should return false for DELETED status', () => {
      const status = TenantStatus.deleted();

      expect(status.canAccess()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the string representation of status', () => {
      expect(TenantStatus.active().toString()).toBe('ACTIVE');
      expect(TenantStatus.trial().toString()).toBe('TRIAL');
      expect(TenantStatus.suspended().toString()).toBe('SUSPENDED');
      expect(TenantStatus.deleted().toString()).toBe('DELETED');
    });

    it('should return uppercase string regardless of input', () => {
      const status = TenantStatus.fromString('active');

      expect(status.toString()).toBe('ACTIVE');
    });
  });

  describe('equals()', () => {
    it('should return true for same status values', () => {
      const status1 = TenantStatus.active();
      const status2 = TenantStatus.active();

      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different status values', () => {
      const status1 = TenantStatus.active();
      const status2 = TenantStatus.trial();

      expect(status1.equals(status2)).toBe(false);
    });

    it('should work with fromString created instances', () => {
      const status1 = TenantStatus.fromString('ACTIVE');
      const status2 = TenantStatus.active();

      expect(status1.equals(status2)).toBe(true);
    });

    it('should compare all status types correctly', () => {
      const active = TenantStatus.active();
      const trial = TenantStatus.trial();
      const suspended = TenantStatus.suspended();
      const deleted = TenantStatus.deleted();

      expect(active.equals(trial)).toBe(false);
      expect(active.equals(suspended)).toBe(false);
      expect(active.equals(deleted)).toBe(false);
      expect(trial.equals(suspended)).toBe(false);
      expect(trial.equals(deleted)).toBe(false);
      expect(suspended.equals(deleted)).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const status = TenantStatus.active();

      // Value should be readonly at TypeScript level
      // This test verifies the status maintains its state
      expect(status.isActive()).toBe(true);
      expect(status.toString()).toBe('ACTIVE');

      // Multiple calls should return consistent results
      expect(status.isActive()).toBe(true);
      expect(status.toString()).toBe('ACTIVE');
    });

    it('should create new instances rather than modifying existing ones', () => {
      const status1 = TenantStatus.active();
      const status2 = TenantStatus.trial();

      // Both should maintain their original state
      expect(status1.isActive()).toBe(true);
      expect(status2.isTrial()).toBe(true);
    });

    it('should use private constructor (TypeScript enforced)', () => {
      // TypeScript prevents direct instantiation at compile time
      // This test documents that instances can only be created via factory methods
      const status = TenantStatus.active();

      expect(status).toBeInstanceOf(TenantStatus);
      expect(status.isActive()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple status checks on same instance', () => {
      const status = TenantStatus.active();

      expect(status.isActive()).toBe(true);
      expect(status.isActive()).toBe(true);
      expect(status.canAccess()).toBe(true);
      expect(status.canAccess()).toBe(true);
    });

    it('should handle chained operations', () => {
      const status = TenantStatus.fromString('ACTIVE');

      expect(status.isActive()).toBe(true);
      expect(status.canAccess()).toBe(true);
      expect(status.toString()).toBe('ACTIVE');
    });

    it('should maintain consistency across operations', () => {
      const status = TenantStatus.active();
      const recreated = TenantStatus.fromString(status.toString());

      expect(status.equals(recreated)).toBe(true);
      expect(status.isActive()).toBe(recreated.isActive());
      expect(status.canAccess()).toBe(recreated.canAccess());
    });
  });
});
