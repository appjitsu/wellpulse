/**
 * CompanyInfo Value Object Tests
 */

import { CompanyInfo } from './company-info.vo';

describe('CompanyInfo', () => {
  const validProps = {
    companyName: 'ACME Oil & Gas',
    address: '123 Main Street',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    phone: '713-555-0100',
    email: 'info@acmeoil.com',
    website: 'https://acmeoil.com',
  };

  describe('create', () => {
    it('should create with valid data', () => {
      const companyInfo = CompanyInfo.create(validProps);

      expect(companyInfo.companyName).toBe('ACME Oil & Gas');
      expect(companyInfo.address).toBe('123 Main Street');
      expect(companyInfo.city).toBe('Houston');
      expect(companyInfo.state).toBe('TX');
      expect(companyInfo.zipCode).toBe('77001');
      expect(companyInfo.phone).toBe('713-555-0100');
      expect(companyInfo.email).toBe('info@acmeoil.com');
      expect(companyInfo.website).toBe('https://acmeoil.com');
    });

    it('should create with optional fields as null', () => {
      const companyInfo = CompanyInfo.create({
        ...validProps,
        phone: null,
        email: null,
        website: null,
      });

      expect(companyInfo.phone).toBeNull();
      expect(companyInfo.email).toBeNull();
      expect(companyInfo.website).toBeNull();
    });

    it('should throw error for short company name', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, companyName: 'A' }),
      ).toThrow('Company name must be at least 2 characters');
    });

    it('should throw error for long company name', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, companyName: 'A'.repeat(256) }),
      ).toThrow('Company name must not exceed 255 characters');
    });

    it('should throw error for short address', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, address: '123' }),
      ).toThrow('Address must be at least 5 characters');
    });

    it('should throw error for short city', () => {
      expect(() => CompanyInfo.create({ ...validProps, city: 'A' })).toThrow(
        'City must be at least 2 characters',
      );
    });

    it('should throw error for invalid state code', () => {
      expect(() => CompanyInfo.create({ ...validProps, state: 'XX' })).toThrow(
        'State must be a valid 2-letter US state code',
      );
    });

    it('should accept valid state codes', () => {
      const states = ['CA', 'TX', 'NY', 'FL', 'AK', 'HI'];

      states.forEach((state) => {
        const companyInfo = CompanyInfo.create({ ...validProps, state });
        expect(companyInfo.state).toBe(state);
      });
    });

    it('should throw error for invalid zip code format', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, zipCode: '1234' }),
      ).toThrow('Zip code must be in format XXXXX or XXXXX-XXXX');
    });

    it('should accept valid zip code formats', () => {
      const companyInfo1 = CompanyInfo.create({
        ...validProps,
        zipCode: '77001',
      });
      expect(companyInfo1.zipCode).toBe('77001');

      const companyInfo2 = CompanyInfo.create({
        ...validProps,
        zipCode: '77001-1234',
      });
      expect(companyInfo2.zipCode).toBe('77001-1234');
    });

    it('should throw error for invalid phone format', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, phone: '123456789' }),
      ).toThrow(
        'Phone number must be in format XXX-XXX-XXXX or (XXX) XXX-XXXX',
      );
    });

    it('should accept valid phone formats', () => {
      const companyInfo1 = CompanyInfo.create({
        ...validProps,
        phone: '713-555-0100',
      });
      expect(companyInfo1.phone).toBe('713-555-0100');

      const companyInfo2 = CompanyInfo.create({
        ...validProps,
        phone: '(713) 555-0100',
      });
      expect(companyInfo2.phone).toBe('(713) 555-0100');
    });

    it('should throw error for invalid email format', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, email: 'invalid-email' }),
      ).toThrow('Invalid email format');
    });

    it('should throw error for invalid website URL', () => {
      expect(() =>
        CompanyInfo.create({ ...validProps, website: 'not-a-url' }),
      ).toThrow('Invalid website URL format');
    });
  });

  describe('getFormattedAddress', () => {
    it('should return formatted address', () => {
      const companyInfo = CompanyInfo.create(validProps);
      const formatted = companyInfo.getFormattedAddress();

      expect(formatted).toBe('123 Main Street\nHouston, TX 77001');
    });
  });

  describe('getFormattedContact', () => {
    it('should return formatted contact with all fields', () => {
      const companyInfo = CompanyInfo.create(validProps);
      const formatted = companyInfo.getFormattedContact();

      expect(formatted).toContain('Phone: 713-555-0100');
      expect(formatted).toContain('Email: info@acmeoil.com');
      expect(formatted).toContain('Web: https://acmeoil.com');
    });

    it('should return formatted contact with only some fields', () => {
      const companyInfo = CompanyInfo.create({
        ...validProps,
        phone: '713-555-0100',
        email: null,
        website: null,
      });
      const formatted = companyInfo.getFormattedContact();

      expect(formatted).toBe('Phone: 713-555-0100');
    });

    it('should return empty string when no contact fields', () => {
      const companyInfo = CompanyInfo.create({
        ...validProps,
        phone: null,
        email: null,
        website: null,
      });
      const formatted = companyInfo.getFormattedContact();

      expect(formatted).toBe('');
    });
  });

  describe('equals', () => {
    it('should return true for equal company infos', () => {
      const companyInfo1 = CompanyInfo.create(validProps);
      const companyInfo2 = CompanyInfo.create(validProps);

      expect(companyInfo1.equals(companyInfo2)).toBe(true);
    });

    it('should return false for different company infos', () => {
      const companyInfo1 = CompanyInfo.create(validProps);
      const companyInfo2 = CompanyInfo.create({
        ...validProps,
        companyName: 'Different Company',
      });

      expect(companyInfo1.equals(companyInfo2)).toBe(false);
    });
  });
});
