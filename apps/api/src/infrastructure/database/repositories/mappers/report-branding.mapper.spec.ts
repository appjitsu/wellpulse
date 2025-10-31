/**
 * ReportBranding Mapper Tests
 */

import { ReportBrandingMapper } from './report-branding.mapper';
import { ReportBranding } from '../../../../domain/reporting/report-branding.entity';
import { CompanyInfo } from '../../../../domain/reporting/value-objects/company-info.vo';
import { BrandColors } from '../../../../domain/reporting/value-objects/brand-colors.vo';
import { LogoAsset } from '../../../../domain/reporting/value-objects/logo-asset.vo';
import { OrgBranding } from '../../../database/master/schema';

describe('ReportBrandingMapper', () => {
  const mockDatabaseRecord: OrgBranding = {
    id: 'branding-123',
    tenantId: 'tenant-123',
    companyName: 'ACME Oil & Gas',
    address: '123 Main Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    phone: '713-555-0100',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
    primaryColor: '#1E40AF',
    secondaryColor: '#64748B',
    textColor: '#1F2937',
    backgroundColor: '#FFFFFF',
    logoBlobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    logoFileName: 'acme-logo.png',
    logoMimeType: 'image/png',
    logoSizeBytes: 500000,
    logoWidth: 800,
    logoHeight: 200,
    logoUploadedAt: new Date('2025-01-15T10:00:00Z'),
    headerText: 'Custom Header',
    footerText: 'Custom Footer',
    createdAt: new Date('2025-01-15T08:00:00Z'),
    updatedAt: new Date('2025-01-15T12:00:00Z'),
    createdBy: 'admin-123',
    updatedBy: 'admin-456',
  };

  const mockDatabaseRecordWithoutLogo: OrgBranding = {
    ...mockDatabaseRecord,
    logoBlobUrl: null,
    logoFileName: null,
    logoMimeType: null,
    logoSizeBytes: null,
    logoWidth: null,
    logoHeight: null,
    logoUploadedAt: null,
  };

  describe('toDomain', () => {
    it('should map database record to domain entity with logo', () => {
      const domain = ReportBrandingMapper.toDomain(mockDatabaseRecord);

      expect(domain).toBeInstanceOf(ReportBranding);
      expect(domain.id).toBe('branding-123');
      expect(domain.tenantId).toBe('tenant-123');
      expect(domain.companyInfo).toBeInstanceOf(CompanyInfo);
      expect(domain.companyInfo.companyName).toBe('ACME Oil & Gas');
      expect(domain.companyInfo.address).toBe('123 Main Street');
      expect(domain.brandColors).toBeInstanceOf(BrandColors);
      expect(domain.brandColors.primary).toBe('#1E40AF');
      expect(domain.logoAsset).toBeInstanceOf(LogoAsset);
      expect(domain.logoAsset?.blobUrl).toBe(
        'https://storage.azure.com/logos/acme-logo.png',
      );
      expect(domain.headerText).toBe('Custom Header');
      expect(domain.footerText).toBe('Custom Footer');
      expect(domain.createdAt).toEqual(new Date('2025-01-15T08:00:00Z'));
      expect(domain.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    });

    it('should map database record without logo', () => {
      const domain = ReportBrandingMapper.toDomain(
        mockDatabaseRecordWithoutLogo,
      );

      expect(domain).toBeInstanceOf(ReportBranding);
      expect(domain.logoAsset).toBeNull();
    });

    it('should map database record with null optional fields', () => {
      const record: OrgBranding = {
        ...mockDatabaseRecordWithoutLogo,
        phone: null,
        email: null,
        website: null,
        headerText: null,
        footerText: null,
      };

      const domain = ReportBrandingMapper.toDomain(record);

      expect(domain.companyInfo.phone).toBeNull();
      expect(domain.companyInfo.email).toBeNull();
      expect(domain.companyInfo.website).toBeNull();
      expect(domain.headerText).toBeNull();
      expect(domain.footerText).toBeNull();
    });

    it('should handle default brand colors', () => {
      const record: OrgBranding = {
        ...mockDatabaseRecordWithoutLogo,
        primaryColor: '#1E40AF',
        secondaryColor: '#64748B',
        textColor: '#1F2937',
        backgroundColor: '#FFFFFF',
      };

      const domain = ReportBrandingMapper.toDomain(record);

      expect(domain.brandColors.primary).toBe('#1E40AF');
      expect(domain.brandColors.secondary).toBe('#64748B');
    });
  });

  describe('toPersistence', () => {
    it('should map domain entity to database record with logo', () => {
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

      const domain = ReportBranding.reconstitute({
        id: 'branding-123',
        tenantId: 'tenant-123',
        companyInfo,
        brandColors,
        logoAsset,
        headerText: 'Custom Header',
        footerText: 'Custom Footer',
        createdAt: new Date('2025-01-15T08:00:00Z'),
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      const persistence = ReportBrandingMapper.toPersistence(domain);

      expect(persistence.id).toBe('branding-123');
      expect(persistence.tenantId).toBe('tenant-123');
      expect(persistence.companyName).toBe('ACME Oil & Gas');
      expect(persistence.address).toBe('123 Main Street');
      expect(persistence.city).toBe('Houston');
      expect(persistence.state).toBe('TX');
      expect(persistence.zipCode).toBe('77001');
      expect(persistence.phone).toBe('713-555-0100');
      expect(persistence.email).toBe('info@acmeoil.com');
      expect(persistence.website).toBe('https://acmeoil.com');
      expect(persistence.primaryColor).toBe('#1E40AF');
      expect(persistence.secondaryColor).toBe('#64748B');
      expect(persistence.textColor).toBe('#1F2937');
      expect(persistence.backgroundColor).toBe('#FFFFFF');
      expect(persistence.logoBlobUrl).toBe(
        'https://storage.azure.com/logos/acme-logo.png',
      );
      expect(persistence.logoFileName).toBe('acme-logo.png');
      expect(persistence.logoMimeType).toBe('image/png');
      expect(persistence.logoSizeBytes).toBe(500000);
      expect(persistence.logoWidth).toBe(800);
      expect(persistence.logoHeight).toBe(200);
      expect(persistence.logoUploadedAt).toEqual(
        new Date('2025-01-15T10:00:00Z'),
      );
      expect(persistence.headerText).toBe('Custom Header');
      expect(persistence.footerText).toBe('Custom Footer');
      expect(persistence.createdAt).toEqual(new Date('2025-01-15T08:00:00Z'));
      expect(persistence.updatedAt).toEqual(new Date('2025-01-15T12:00:00Z'));
    });

    it('should map domain entity without logo', () => {
      const companyInfo = CompanyInfo.create({
        companyName: 'ACME Oil & Gas',
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        phone: null,
        email: null,
        website: null,
      });

      const domain = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const persistence = ReportBrandingMapper.toPersistence(domain);

      expect(persistence.logoBlobUrl).toBeNull();
      expect(persistence.logoFileName).toBeNull();
      expect(persistence.logoMimeType).toBeNull();
      expect(persistence.logoSizeBytes).toBeNull();
      expect(persistence.logoWidth).toBeNull();
      expect(persistence.logoHeight).toBeNull();
      expect(persistence.logoUploadedAt).toBeNull();
    });

    it('should map domain entity with null optional fields', () => {
      const companyInfo = CompanyInfo.create({
        companyName: 'ACME Oil & Gas',
        address: '123 Main Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        phone: null,
        email: null,
        website: null,
      });

      const domain = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
      });

      const persistence = ReportBrandingMapper.toPersistence(domain);

      expect(persistence.phone).toBeNull();
      expect(persistence.email).toBeNull();
      expect(persistence.website).toBeNull();
      expect(persistence.headerText).toBeNull();
      expect(persistence.footerText).toBeNull();
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through toDomain -> toPersistence cycle', () => {
      const domain1 = ReportBrandingMapper.toDomain(mockDatabaseRecord);
      const persistence = ReportBrandingMapper.toPersistence(domain1);
      const domain2 = ReportBrandingMapper.toDomain({
        ...persistence,
        createdBy: 'admin-123',
        updatedBy: 'admin-456',
      });

      expect(domain2.id).toBe(domain1.id);
      expect(domain2.tenantId).toBe(domain1.tenantId);
      expect(domain2.companyInfo.companyName).toBe(
        domain1.companyInfo.companyName,
      );
      expect(domain2.brandColors.primary).toBe(domain1.brandColors.primary);
      expect(domain2.logoAsset?.blobUrl).toBe(domain1.logoAsset?.blobUrl);
      expect(domain2.headerText).toBe(domain1.headerText);
      expect(domain2.footerText).toBe(domain1.footerText);
    });

    it('should preserve data through toPersistence -> toDomain cycle', () => {
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

      const domain1 = ReportBranding.create({
        tenantId: 'tenant-123',
        companyInfo,
        headerText: 'Test Header',
      });

      const persistence = ReportBrandingMapper.toPersistence(domain1);
      const domain2 = ReportBrandingMapper.toDomain({
        ...persistence,
        createdBy: null,
        updatedBy: null,
      });

      expect(domain2.tenantId).toBe(domain1.tenantId);
      expect(domain2.companyInfo.companyName).toBe(
        domain1.companyInfo.companyName,
      );
      expect(domain2.headerText).toBe(domain1.headerText);
    });
  });
});
