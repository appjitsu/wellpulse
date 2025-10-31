/**
 * ReportBranding Entity Tests
 */

import { ReportBranding } from './report-branding.entity';
import { CompanyInfo } from './value-objects/company-info.vo';
import { BrandColors } from './value-objects/brand-colors.vo';
import { LogoAsset } from './value-objects/logo-asset.vo';

describe('ReportBranding', () => {
  const companyInfo = CompanyInfo.create({
    companyName: 'ACME Oil & Gas',
    address: '123 Main Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    phone: '713-555-0100',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
  });

  const brandColors = BrandColors.create({
    primary: '#1E40AF',
    secondary: '#64748B',
    text: '#1F2937',
    background: '#FFFFFF',
  });

  const logoAsset = LogoAsset.create({
    blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    fileName: 'acme-logo.png',
    mimeType: 'image/png',
    sizeBytes: 500000,
    width: 800,
    height: 200,
    uploadedAt: new Date('2025-01-15T10:00:00Z'),
  });

  describe('create', () => {
    it('should create with required fields only', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.id).toBeDefined();
      expect(branding.tenantId).toBe('tenant-123');
      expect(branding.companyInfo).toBe(companyInfo);
      expect(branding.brandColors).toEqual(BrandColors.DEFAULT);
      expect(branding.logoAsset).toBeNull();
      expect(branding.headerText).toBeNull();
      expect(branding.footerText).toBeNull();
      expect(branding.createdAt).toBeInstanceOf(Date);
      expect(branding.updatedAt).toBeInstanceOf(Date);
    });

    it('should create with custom brand colors', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        brandColors,
      });

      expect(branding.brandColors).toBe(brandColors);
    });

    it('should create with custom header and footer text', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        headerText: 'Custom Header',
        footerText: 'Custom Footer',
      });

      expect(branding.headerText).toBe('Custom Header');
      expect(branding.footerText).toBe('Custom Footer');
    });

    it('should throw error for missing tenant ID', () => {
      expect(() =>
        ReportBranding.create({
          tenantId: '',
          companyInfo,
        }),
      ).toThrow('Tenant ID is required');
    });

    it('should throw error for header text exceeding 500 characters', () => {
      expect(() =>
        ReportBranding.create({
          tenantId: 'tenant-123',
          companyInfo,
          headerText: 'A'.repeat(501),
        }),
      ).toThrow('Header text must not exceed 500 characters');
    });

    it('should throw error for footer text exceeding 500 characters', () => {
      expect(() =>
        ReportBranding.create({
          tenantId: 'tenant-123',
          companyInfo,
          footerText: 'A'.repeat(501),
        }),
      ).toThrow('Footer text must not exceed 500 characters');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence', () => {
      const props = {
        id: 'branding-123',
        tenantId: 'tenant-123',
        companyInfo,
        brandColors,
        logoAsset,
        headerText: 'Custom Header',
        footerText: 'Custom Footer',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      };

      const branding = ReportBranding.reconstitute(props);

      expect(branding.id).toBe('branding-123');
      expect(branding.tenantId).toBe('tenant-123');
      expect(branding.companyInfo).toBe(companyInfo);
      expect(branding.brandColors).toBe(brandColors);
      expect(branding.logoAsset).toBe(logoAsset);
      expect(branding.headerText).toBe('Custom Header');
      expect(branding.footerText).toBe('Custom Footer');
      expect(branding.createdAt).toEqual(new Date('2025-01-15T10:00:00Z'));
      expect(branding.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    });
  });

  describe('updateCompanyInfo', () => {
    it('should update company info', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const newCompanyInfo = CompanyInfo.create({
        companyName: 'New Company Name',
        address: '456 Oak Avenue',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75001',
        phone: null,
        email: null,
        website: null,
      });

      const oldUpdatedAt = branding.updatedAt;
      branding.updateCompanyInfo(newCompanyInfo);

      expect(branding.companyInfo).toBe(newCompanyInfo);
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });
  });

  describe('updateBrandColors', () => {
    it('should update brand colors', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const newColors = BrandColors.create({
        primary: '#FF0000',
        secondary: '#00FF00',
        text: '#000000',
        background: '#FFFFFF',
      });

      const oldUpdatedAt = branding.updatedAt;
      branding.updateBrandColors(newColors);

      expect(branding.brandColors).toBe(newColors);
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });
  });

  describe('uploadLogo', () => {
    it('should upload logo', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const oldUpdatedAt = branding.updatedAt;
      branding.uploadLogo(logoAsset);

      expect(branding.logoAsset).toBe(logoAsset);
      expect(branding.hasLogo()).toBe(true);
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });

    it('should replace existing logo', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      branding.uploadLogo(logoAsset);

      const newLogo = LogoAsset.create({
        blobUrl: 'https://storage.azure.com/logos/new-logo.png',
        fileName: 'new-logo.png',
        mimeType: logoAsset.mimeType,
        sizeBytes: logoAsset.sizeBytes,
        width: logoAsset.width,
        height: logoAsset.height,
        uploadedAt: logoAsset.uploadedAt,
      });

      branding.uploadLogo(newLogo);

      expect(branding.logoAsset).toBe(newLogo);
      expect(branding.hasLogo()).toBe(true);
    });
  });

  describe('removeLogo', () => {
    it('should remove logo', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      branding.uploadLogo(logoAsset);
      expect(branding.hasLogo()).toBe(true);

      const oldUpdatedAt = branding.updatedAt;
      branding.removeLogo();

      expect(branding.logoAsset).toBeNull();
      expect(branding.hasLogo()).toBe(false);
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });

    it('should not error when removing non-existent logo', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.hasLogo()).toBe(false);
      expect(() => branding.removeLogo()).not.toThrow();
      expect(branding.hasLogo()).toBe(false);
    });
  });

  describe('updateHeaderText', () => {
    it('should update header text', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const oldUpdatedAt = branding.updatedAt;
      branding.updateHeaderText('New Header');

      expect(branding.headerText).toBe('New Header');
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });

    it('should clear header text with null', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        headerText: 'Existing Header',
      });

      branding.updateHeaderText(null);
      expect(branding.headerText).toBeNull();
    });

    it('should throw error for text exceeding 500 characters', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(() => branding.updateHeaderText('A'.repeat(501))).toThrow(
        'Header text must not exceed 500 characters',
      );
    });
  });

  describe('updateFooterText', () => {
    it('should update footer text', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const oldUpdatedAt = branding.updatedAt;
      branding.updateFooterText('New Footer');

      expect(branding.footerText).toBe('New Footer');
      expect(branding.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });

    it('should clear footer text with null', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        footerText: 'Existing Footer',
      });

      branding.updateFooterText(null);
      expect(branding.footerText).toBeNull();
    });

    it('should throw error for text exceeding 500 characters', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(() => branding.updateFooterText('A'.repeat(501))).toThrow(
        'Footer text must not exceed 500 characters',
      );
    });
  });

  describe('hasLogo', () => {
    it('should return false when no logo', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.hasLogo()).toBe(false);
    });

    it('should return true when logo exists', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      branding.uploadLogo(logoAsset);
      expect(branding.hasLogo()).toBe(true);
    });
  });

  describe('isComplete', () => {
    it('should return true when all required fields present', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        brandColors,
      });

      expect(branding.isComplete()).toBe(true);
    });

    it('should return true even without logo (logo is optional)', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.isComplete()).toBe(true);
    });
  });

  describe('getEffectiveHeaderText', () => {
    it('should return custom header text when set', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        headerText: 'Custom Header',
      });

      expect(branding.getEffectiveHeaderText()).toBe('Custom Header');
    });

    it('should return default header text when not set', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.getEffectiveHeaderText()).toBe('ACME Oil & Gas Report');
    });
  });

  describe('getEffectiveFooterText', () => {
    it('should return custom footer text when set', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        footerText: 'Custom Footer',
      });

      expect(branding.getEffectiveFooterText()).toBe('Custom Footer');
    });

    it('should return default footer text when not set', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      expect(branding.getEffectiveFooterText()).toBe('Generated by WellPulse');
    });
  });

  describe('toPrimitives', () => {
    it('should convert to primitives', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        brandColors,
        headerText: 'Custom Header',
        footerText: 'Custom Footer',
      });

      branding.uploadLogo(logoAsset);

      const primitives = branding.toPrimitives();

      expect(primitives.id).toBe(branding.id);
      expect(primitives.tenantId).toBe('tenant-123');
      expect(primitives.companyInfo.companyName).toBe('ACME Oil & Gas');
      expect(primitives.brandColors.primary).toBe('#1E40AF');
      expect(primitives.logoAsset?.blobUrl).toBe(
        'https://storage.azure.com/logos/acme-logo.png',
      );
      expect(primitives.headerText).toBe('Custom Header');
      expect(primitives.footerText).toBe('Custom Footer');
    });

    it('should handle null logo asset', () => {
      const branding = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const primitives = branding.toPrimitives();

      expect(primitives.logoAsset).toBeNull();
    });
  });
});
