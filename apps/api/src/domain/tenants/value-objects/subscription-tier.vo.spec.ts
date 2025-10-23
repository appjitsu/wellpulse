import { SubscriptionTier } from './subscription-tier.vo';

describe('SubscriptionTier Value Object', () => {
  describe('Factory Methods', () => {
    describe('starter()', () => {
      it('should create a STARTER tier', () => {
        const tier = SubscriptionTier.starter();

        expect(tier.isStarter()).toBe(true);
        expect(tier.toString()).toBe('STARTER');
      });

      it('should create a new instance each time', () => {
        const tier1 = SubscriptionTier.starter();
        const tier2 = SubscriptionTier.starter();

        expect(tier1).not.toBe(tier2);
        expect(tier1.equals(tier2)).toBe(true);
      });
    });

    describe('professional()', () => {
      it('should create a PROFESSIONAL tier', () => {
        const tier = SubscriptionTier.professional();

        expect(tier.isProfessional()).toBe(true);
        expect(tier.toString()).toBe('PROFESSIONAL');
      });

      it('should create a new instance each time', () => {
        const tier1 = SubscriptionTier.professional();
        const tier2 = SubscriptionTier.professional();

        expect(tier1).not.toBe(tier2);
        expect(tier1.equals(tier2)).toBe(true);
      });
    });

    describe('enterprise()', () => {
      it('should create an ENTERPRISE tier', () => {
        const tier = SubscriptionTier.enterprise();

        expect(tier.isEnterprise()).toBe(true);
        expect(tier.toString()).toBe('ENTERPRISE');
      });

      it('should create a new instance each time', () => {
        const tier1 = SubscriptionTier.enterprise();
        const tier2 = SubscriptionTier.enterprise();

        expect(tier1).not.toBe(tier2);
        expect(tier1.equals(tier2)).toBe(true);
      });
    });

    describe('enterprisePlus()', () => {
      it('should create an ENTERPRISE_PLUS tier', () => {
        const tier = SubscriptionTier.enterprisePlus();

        expect(tier.isEnterprisePlus()).toBe(true);
        expect(tier.toString()).toBe('ENTERPRISE_PLUS');
      });

      it('should create a new instance each time', () => {
        const tier1 = SubscriptionTier.enterprisePlus();
        const tier2 = SubscriptionTier.enterprisePlus();

        expect(tier1).not.toBe(tier2);
        expect(tier1.equals(tier2)).toBe(true);
      });
    });
  });

  describe('fromString()', () => {
    describe('Valid Inputs', () => {
      it('should create STARTER tier from uppercase string', () => {
        const tier = SubscriptionTier.fromString('STARTER');

        expect(tier.isStarter()).toBe(true);
        expect(tier.toString()).toBe('STARTER');
      });

      it('should create STARTER tier from lowercase string', () => {
        const tier = SubscriptionTier.fromString('starter');

        expect(tier.isStarter()).toBe(true);
        expect(tier.toString()).toBe('STARTER');
      });

      it('should create PROFESSIONAL tier from mixed case', () => {
        const tier = SubscriptionTier.fromString('ProFesSioNal');

        expect(tier.isProfessional()).toBe(true);
        expect(tier.toString()).toBe('PROFESSIONAL');
      });

      it('should create ENTERPRISE tier from string', () => {
        const tier = SubscriptionTier.fromString('enterprise');

        expect(tier.isEnterprise()).toBe(true);
        expect(tier.toString()).toBe('ENTERPRISE');
      });

      it('should create ENTERPRISE_PLUS tier from uppercase', () => {
        const tier = SubscriptionTier.fromString('ENTERPRISE_PLUS');

        expect(tier.isEnterprisePlus()).toBe(true);
        expect(tier.toString()).toBe('ENTERPRISE_PLUS');
      });

      it('should create ENTERPRISE_PLUS tier from lowercase', () => {
        const tier = SubscriptionTier.fromString('enterprise_plus');

        expect(tier.isEnterprisePlus()).toBe(true);
        expect(tier.toString()).toBe('ENTERPRISE_PLUS');
      });
    });

    describe('Invalid Inputs', () => {
      it('should throw error for invalid tier string', () => {
        expect(() => SubscriptionTier.fromString('INVALID')).toThrow(
          'Invalid subscription tier: INVALID',
        );
      });

      it('should throw error for empty string', () => {
        expect(() => SubscriptionTier.fromString('')).toThrow(
          'Invalid subscription tier: ',
        );
      });

      it('should throw error for whitespace', () => {
        expect(() => SubscriptionTier.fromString('   ')).toThrow(
          'Invalid subscription tier:    ',
        );
      });

      it('should throw error for numeric string', () => {
        expect(() => SubscriptionTier.fromString('123')).toThrow(
          'Invalid subscription tier: 123',
        );
      });

      it('should throw error for partial match', () => {
        expect(() => SubscriptionTier.fromString('ENTER')).toThrow(
          'Invalid subscription tier: ENTER',
        );
      });

      it('should throw error for wrong separator', () => {
        expect(() => SubscriptionTier.fromString('ENTERPRISE-PLUS')).toThrow(
          'Invalid subscription tier: ENTERPRISE-PLUS',
        );
      });
    });
  });

  describe('Tier Check Methods', () => {
    describe('isStarter()', () => {
      it('should return true only for STARTER tier', () => {
        expect(SubscriptionTier.starter().isStarter()).toBe(true);
        expect(SubscriptionTier.professional().isStarter()).toBe(false);
        expect(SubscriptionTier.enterprise().isStarter()).toBe(false);
        expect(SubscriptionTier.enterprisePlus().isStarter()).toBe(false);
      });
    });

    describe('isProfessional()', () => {
      it('should return true only for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.starter().isProfessional()).toBe(false);
        expect(SubscriptionTier.professional().isProfessional()).toBe(true);
        expect(SubscriptionTier.enterprise().isProfessional()).toBe(false);
        expect(SubscriptionTier.enterprisePlus().isProfessional()).toBe(false);
      });
    });

    describe('isEnterprise()', () => {
      it('should return true only for ENTERPRISE tier', () => {
        expect(SubscriptionTier.starter().isEnterprise()).toBe(false);
        expect(SubscriptionTier.professional().isEnterprise()).toBe(false);
        expect(SubscriptionTier.enterprise().isEnterprise()).toBe(true);
        expect(SubscriptionTier.enterprisePlus().isEnterprise()).toBe(false);
      });
    });

    describe('isEnterprisePlus()', () => {
      it('should return true only for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.starter().isEnterprisePlus()).toBe(false);
        expect(SubscriptionTier.professional().isEnterprisePlus()).toBe(false);
        expect(SubscriptionTier.enterprise().isEnterprisePlus()).toBe(false);
        expect(SubscriptionTier.enterprisePlus().isEnterprisePlus()).toBe(true);
      });
    });

    describe('isPaid()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().isPaid()).toBe(false);
      });

      it('should return true for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().isPaid()).toBe(true);
      });

      it('should return true for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().isPaid()).toBe(true);
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().isPaid()).toBe(true);
      });
    });
  });

  describe('getDefaultLimits()', () => {
    describe('STARTER Tier', () => {
      it('should return correct limits for STARTER tier', () => {
        const tier = SubscriptionTier.starter();
        const limits = tier.getDefaultLimits();

        expect(limits.maxWells).toBe(50);
        expect(limits.maxUsers).toBe(5);
        expect(limits.storageQuotaGb).toBe(10);
        expect(limits.basePriceUsd).toBe(9900); // $99/month
      });
    });

    describe('PROFESSIONAL Tier', () => {
      it('should return correct limits for PROFESSIONAL tier', () => {
        const tier = SubscriptionTier.professional();
        const limits = tier.getDefaultLimits();

        expect(limits.maxWells).toBe(200);
        expect(limits.maxUsers).toBe(20);
        expect(limits.storageQuotaGb).toBe(50);
        expect(limits.basePriceUsd).toBe(29900); // $299/month
      });
    });

    describe('ENTERPRISE Tier', () => {
      it('should return correct limits for ENTERPRISE tier', () => {
        const tier = SubscriptionTier.enterprise();
        const limits = tier.getDefaultLimits();

        expect(limits.maxWells).toBe(1000);
        expect(limits.maxUsers).toBe(100);
        expect(limits.storageQuotaGb).toBe(250);
        expect(limits.basePriceUsd).toBe(99900); // $999/month
      });
    });

    describe('ENTERPRISE_PLUS Tier', () => {
      it('should return correct limits for ENTERPRISE_PLUS tier', () => {
        const tier = SubscriptionTier.enterprisePlus();
        const limits = tier.getDefaultLimits();

        expect(limits.maxWells).toBe(10000);
        expect(limits.maxUsers).toBe(500);
        expect(limits.storageQuotaGb).toBe(1000);
        expect(limits.basePriceUsd).toBe(199900); // $1,999/month
      });
    });

    it('should return immutable limits object', () => {
      const tier = SubscriptionTier.starter();
      const limits1 = tier.getDefaultLimits();
      const limits2 = tier.getDefaultLimits();

      expect(limits1).not.toBe(limits2);
      expect(limits1).toEqual(limits2);
    });
  });

  describe('Feature Flag Methods', () => {
    describe('hasAdvancedML()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().hasAdvancedML()).toBe(false);
      });

      it('should return true for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().hasAdvancedML()).toBe(true);
      });

      it('should return true for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().hasAdvancedML()).toBe(true);
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().hasAdvancedML()).toBe(true);
      });
    });

    describe('hasCustomIntegrations()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().hasCustomIntegrations()).toBe(false);
      });

      it('should return false for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().hasCustomIntegrations()).toBe(
          false,
        );
      });

      it('should return true for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().hasCustomIntegrations()).toBe(
          true,
        );
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().hasCustomIntegrations()).toBe(
          true,
        );
      });
    });

    describe('hasETLSync()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().hasETLSync()).toBe(false);
      });

      it('should return false for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().hasETLSync()).toBe(false);
      });

      it('should return false for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().hasETLSync()).toBe(false);
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().hasETLSync()).toBe(true);
      });
    });

    describe('hasMultiDatabase()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().hasMultiDatabase()).toBe(false);
      });

      it('should return false for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().hasMultiDatabase()).toBe(false);
      });

      it('should return true for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().hasMultiDatabase()).toBe(true);
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().hasMultiDatabase()).toBe(true);
      });
    });

    describe('hasPrioritySupport()', () => {
      it('should return false for STARTER tier', () => {
        expect(SubscriptionTier.starter().hasPrioritySupport()).toBe(false);
      });

      it('should return false for PROFESSIONAL tier', () => {
        expect(SubscriptionTier.professional().hasPrioritySupport()).toBe(
          false,
        );
      });

      it('should return true for ENTERPRISE tier', () => {
        expect(SubscriptionTier.enterprise().hasPrioritySupport()).toBe(true);
      });

      it('should return true for ENTERPRISE_PLUS tier', () => {
        expect(SubscriptionTier.enterprisePlus().hasPrioritySupport()).toBe(
          true,
        );
      });
    });
  });

  describe('Tier Comparison Methods', () => {
    describe('isHigherThan()', () => {
      it('should return true when comparing PROFESSIONAL to STARTER', () => {
        const professional = SubscriptionTier.professional();
        const starter = SubscriptionTier.starter();

        expect(professional.isHigherThan(starter)).toBe(true);
      });

      it('should return false when comparing STARTER to PROFESSIONAL', () => {
        const starter = SubscriptionTier.starter();
        const professional = SubscriptionTier.professional();

        expect(starter.isHigherThan(professional)).toBe(false);
      });

      it('should return false when comparing same tier', () => {
        const tier1 = SubscriptionTier.enterprise();
        const tier2 = SubscriptionTier.enterprise();

        expect(tier1.isHigherThan(tier2)).toBe(false);
      });

      it('should correctly order all tiers', () => {
        const starter = SubscriptionTier.starter();
        const professional = SubscriptionTier.professional();
        const enterprise = SubscriptionTier.enterprise();
        const enterprisePlus = SubscriptionTier.enterprisePlus();

        // Professional > Starter
        expect(professional.isHigherThan(starter)).toBe(true);

        // Enterprise > Professional > Starter
        expect(enterprise.isHigherThan(professional)).toBe(true);
        expect(enterprise.isHigherThan(starter)).toBe(true);

        // EnterprisePlus > all others
        expect(enterprisePlus.isHigherThan(enterprise)).toBe(true);
        expect(enterprisePlus.isHigherThan(professional)).toBe(true);
        expect(enterprisePlus.isHigherThan(starter)).toBe(true);
      });
    });

    describe('isLowerThan()', () => {
      it('should return true when comparing STARTER to PROFESSIONAL', () => {
        const starter = SubscriptionTier.starter();
        const professional = SubscriptionTier.professional();

        expect(starter.isLowerThan(professional)).toBe(true);
      });

      it('should return false when comparing PROFESSIONAL to STARTER', () => {
        const professional = SubscriptionTier.professional();
        const starter = SubscriptionTier.starter();

        expect(professional.isLowerThan(starter)).toBe(false);
      });

      it('should return false when comparing same tier', () => {
        const tier1 = SubscriptionTier.professional();
        const tier2 = SubscriptionTier.professional();

        expect(tier1.isLowerThan(tier2)).toBe(false);
      });

      it('should correctly order all tiers', () => {
        const starter = SubscriptionTier.starter();
        const professional = SubscriptionTier.professional();
        const enterprise = SubscriptionTier.enterprise();
        const enterprisePlus = SubscriptionTier.enterprisePlus();

        // Starter < all others
        expect(starter.isLowerThan(professional)).toBe(true);
        expect(starter.isLowerThan(enterprise)).toBe(true);
        expect(starter.isLowerThan(enterprisePlus)).toBe(true);

        // Professional < Enterprise and EnterprisePlus
        expect(professional.isLowerThan(enterprise)).toBe(true);
        expect(professional.isLowerThan(enterprisePlus)).toBe(true);

        // Enterprise < EnterprisePlus
        expect(enterprise.isLowerThan(enterprisePlus)).toBe(true);
      });
    });

    it('should have inverse relationship between isHigherThan and isLowerThan', () => {
      const starter = SubscriptionTier.starter();
      const enterprise = SubscriptionTier.enterprise();

      expect(starter.isLowerThan(enterprise)).toBe(
        enterprise.isHigherThan(starter),
      );
      expect(starter.isHigherThan(enterprise)).toBe(
        enterprise.isLowerThan(starter),
      );
    });
  });

  describe('toString()', () => {
    it('should return correct string for all tiers', () => {
      expect(SubscriptionTier.starter().toString()).toBe('STARTER');
      expect(SubscriptionTier.professional().toString()).toBe('PROFESSIONAL');
      expect(SubscriptionTier.enterprise().toString()).toBe('ENTERPRISE');
      expect(SubscriptionTier.enterprisePlus().toString()).toBe(
        'ENTERPRISE_PLUS',
      );
    });

    it('should return uppercase string regardless of input', () => {
      const tier = SubscriptionTier.fromString('professional');

      expect(tier.toString()).toBe('PROFESSIONAL');
    });
  });

  describe('equals()', () => {
    it('should return true for same tier values', () => {
      const tier1 = SubscriptionTier.professional();
      const tier2 = SubscriptionTier.professional();

      expect(tier1.equals(tier2)).toBe(true);
    });

    it('should return false for different tier values', () => {
      const tier1 = SubscriptionTier.starter();
      const tier2 = SubscriptionTier.enterprise();

      expect(tier1.equals(tier2)).toBe(false);
    });

    it('should work with fromString created instances', () => {
      const tier1 = SubscriptionTier.fromString('ENTERPRISE');
      const tier2 = SubscriptionTier.enterprise();

      expect(tier1.equals(tier2)).toBe(true);
    });

    it('should compare all tier combinations correctly', () => {
      const starter = SubscriptionTier.starter();
      const professional = SubscriptionTier.professional();
      const enterprise = SubscriptionTier.enterprise();
      const enterprisePlus = SubscriptionTier.enterprisePlus();

      expect(starter.equals(professional)).toBe(false);
      expect(starter.equals(enterprise)).toBe(false);
      expect(starter.equals(enterprisePlus)).toBe(false);
      expect(professional.equals(enterprise)).toBe(false);
      expect(professional.equals(enterprisePlus)).toBe(false);
      expect(enterprise.equals(enterprisePlus)).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should maintain state consistency', () => {
      const tier = SubscriptionTier.starter();

      // Value should be readonly at TypeScript level
      // This test verifies the tier maintains its state
      expect(tier.isStarter()).toBe(true);
      expect(tier.toString()).toBe('STARTER');

      // Multiple calls should return consistent results
      expect(tier.isStarter()).toBe(true);
      expect(tier.toString()).toBe('STARTER');
    });

    it('should create new instances rather than modifying existing ones', () => {
      const tier1 = SubscriptionTier.starter();
      const tier2 = SubscriptionTier.enterprise();

      expect(tier1.isStarter()).toBe(true);
      expect(tier2.isEnterprise()).toBe(true);
    });

    it('should use private constructor (TypeScript enforced)', () => {
      // TypeScript prevents direct instantiation at compile time
      // This test documents that instances can only be created via factory methods
      const tier = SubscriptionTier.starter();

      expect(tier).toBeInstanceOf(SubscriptionTier);
      expect(tier.isStarter()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple method calls on same instance', () => {
      const tier = SubscriptionTier.enterprise();

      expect(tier.isEnterprise()).toBe(true);
      expect(tier.isEnterprise()).toBe(true);
      expect(tier.hasAdvancedML()).toBe(true);
      expect(tier.hasCustomIntegrations()).toBe(true);
      expect(tier.getDefaultLimits().maxWells).toBe(1000);
    });

    it('should handle chained comparisons', () => {
      const starter = SubscriptionTier.starter();
      const professional = SubscriptionTier.professional();
      const enterprise = SubscriptionTier.enterprise();

      expect(
        starter.isLowerThan(professional) &&
          professional.isLowerThan(enterprise),
      ).toBe(true);
    });

    it('should maintain consistency across operations', () => {
      const tier = SubscriptionTier.professional();
      const recreated = SubscriptionTier.fromString(tier.toString());

      expect(tier.equals(recreated)).toBe(true);
      expect(tier.isProfessional()).toBe(recreated.isProfessional());
      expect(tier.hasAdvancedML()).toBe(recreated.hasAdvancedML());
      expect(tier.getDefaultLimits()).toEqual(recreated.getDefaultLimits());
    });

    it('should handle all feature flags consistently', () => {
      const enterprisePlus = SubscriptionTier.enterprisePlus();

      // Enterprise Plus should have all features
      expect(enterprisePlus.hasAdvancedML()).toBe(true);
      expect(enterprisePlus.hasCustomIntegrations()).toBe(true);
      expect(enterprisePlus.hasETLSync()).toBe(true);
      expect(enterprisePlus.hasMultiDatabase()).toBe(true);
      expect(enterprisePlus.hasPrioritySupport()).toBe(true);
      expect(enterprisePlus.isPaid()).toBe(true);
    });

    it('should handle starter tier feature flags correctly', () => {
      const starter = SubscriptionTier.starter();

      // Starter should have minimal features
      expect(starter.hasAdvancedML()).toBe(false);
      expect(starter.hasCustomIntegrations()).toBe(false);
      expect(starter.hasETLSync()).toBe(false);
      expect(starter.hasMultiDatabase()).toBe(false);
      expect(starter.hasPrioritySupport()).toBe(false);
      expect(starter.isPaid()).toBe(false);
    });
  });
});
