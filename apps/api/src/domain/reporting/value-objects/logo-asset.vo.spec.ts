/**
 * LogoAsset Value Object Tests
 */

import { LogoAsset } from './logo-asset.vo';

describe('LogoAsset', () => {
  const validProps = {
    blobUrl: 'https://storage.azure.com/logos/acme-logo.png',
    fileName: 'acme-logo.png',
    mimeType: 'image/png',
    sizeBytes: 500000, // 500KB
    width: 800,
    height: 200,
    uploadedAt: new Date('2025-01-15T10:00:00Z'),
  };

  describe('create', () => {
    it('should create with valid PNG logo', () => {
      const logo = LogoAsset.create(validProps);

      expect(logo.blobUrl).toBe(
        'https://storage.azure.com/logos/acme-logo.png',
      );
      expect(logo.fileName).toBe('acme-logo.png');
      expect(logo.mimeType).toBe('image/png');
      expect(logo.sizeBytes).toBe(500000);
      expect(logo.width).toBe(800);
      expect(logo.height).toBe(200);
      expect(logo.uploadedAt).toEqual(new Date('2025-01-15T10:00:00Z'));
    });

    it('should create with valid JPEG logo', () => {
      const logo = LogoAsset.create({
        ...validProps,
        fileName: 'acme-logo.jpg',
        mimeType: 'image/jpeg',
      });

      expect(logo.mimeType).toBe('image/jpeg');
    });

    it('should throw error for empty blob URL', () => {
      expect(() => LogoAsset.create({ ...validProps, blobUrl: '' })).toThrow(
        'Logo blob URL is required',
      );
    });

    it('should throw error for invalid blob URL', () => {
      expect(() =>
        LogoAsset.create({ ...validProps, blobUrl: 'not-a-url' }),
      ).toThrow('Invalid blob URL format');
    });

    it('should throw error for empty filename', () => {
      expect(() => LogoAsset.create({ ...validProps, fileName: '' })).toThrow(
        'Logo filename is required',
      );
    });

    it('should throw error for unsupported mime type', () => {
      expect(() =>
        LogoAsset.create({ ...validProps, mimeType: 'image/svg+xml' }),
      ).toThrow('Logo must be PNG or JPEG format. Got: image/svg+xml');
    });

    it('should throw error for GIF format', () => {
      expect(() =>
        LogoAsset.create({ ...validProps, mimeType: 'image/gif' }),
      ).toThrow('Logo must be PNG or JPEG format. Got: image/gif');
    });

    it('should throw error for zero file size', () => {
      expect(() => LogoAsset.create({ ...validProps, sizeBytes: 0 })).toThrow(
        'Logo file size must be greater than zero',
      );
    });

    it('should throw error for file size exceeding 2MB', () => {
      const oversized = 3 * 1024 * 1024; // 3MB
      expect(() =>
        LogoAsset.create({ ...validProps, sizeBytes: oversized }),
      ).toThrow('Logo file size must not exceed 2.0MB. Got: 3.0MB');
    });

    it('should accept file at exactly 2MB limit', () => {
      const exactLimit = 2 * 1024 * 1024;
      const logo = LogoAsset.create({ ...validProps, sizeBytes: exactLimit });

      expect(logo.sizeBytes).toBe(exactLimit);
    });

    it('should throw error for zero width', () => {
      expect(() => LogoAsset.create({ ...validProps, width: 0 })).toThrow(
        'Logo dimensions must be greater than zero',
      );
    });

    it('should throw error for zero height', () => {
      expect(() => LogoAsset.create({ ...validProps, height: 0 })).toThrow(
        'Logo dimensions must be greater than zero',
      );
    });

    it('should throw error for width exceeding 1000px', () => {
      expect(() => LogoAsset.create({ ...validProps, width: 1001 })).toThrow(
        'Logo width must not exceed 1000px. Got: 1001px',
      );
    });

    it('should throw error for height exceeding 300px', () => {
      expect(() => LogoAsset.create({ ...validProps, height: 301 })).toThrow(
        'Logo height must not exceed 300px. Got: 301px',
      );
    });

    it('should accept dimensions at exact limits', () => {
      const logo = LogoAsset.create({
        ...validProps,
        width: 1000,
        height: 300,
      });

      expect(logo.width).toBe(1000);
      expect(logo.height).toBe(300);
    });

    it('should throw error for future upload date', () => {
      const futureDate = new Date('2099-01-01T00:00:00Z');
      expect(() =>
        LogoAsset.create({ ...validProps, uploadedAt: futureDate }),
      ).toThrow('Upload date cannot be in the future');
    });
  });

  describe('aspectRatio', () => {
    it('should calculate aspect ratio', () => {
      const logo = LogoAsset.create(validProps); // 800x200
      expect(logo.aspectRatio).toBe(4); // 800/200 = 4
    });

    it('should calculate aspect ratio for square logo', () => {
      const logo = LogoAsset.create({ ...validProps, width: 200, height: 200 });
      expect(logo.aspectRatio).toBe(1);
    });
  });

  describe('getFormattedSize', () => {
    it('should format size in KB', () => {
      const logo = LogoAsset.create({ ...validProps, sizeBytes: 500000 });
      expect(logo.getFormattedSize()).toBe('488.28 KB');
    });

    it('should format size in MB', () => {
      const logo = LogoAsset.create({
        ...validProps,
        sizeBytes: 1500000, // 1.5MB
      });
      expect(logo.getFormattedSize()).toBe('1.43 MB');
    });

    it('should format small size in KB', () => {
      const logo = LogoAsset.create({ ...validProps, sizeBytes: 1024 });
      expect(logo.getFormattedSize()).toBe('1.00 KB');
    });
  });

  describe('getDimensions', () => {
    it('should return dimensions as string', () => {
      const logo = LogoAsset.create(validProps);
      expect(logo.getDimensions()).toBe('800x200');
    });
  });

  describe('isPng', () => {
    it('should return true for PNG', () => {
      const logo = LogoAsset.create(validProps);
      expect(logo.isPng()).toBe(true);
    });

    it('should return false for JPEG', () => {
      const logo = LogoAsset.create({ ...validProps, mimeType: 'image/jpeg' });
      expect(logo.isPng()).toBe(false);
    });
  });

  describe('isJpeg', () => {
    it('should return true for JPEG', () => {
      const logo = LogoAsset.create({ ...validProps, mimeType: 'image/jpeg' });
      expect(logo.isJpeg()).toBe(true);
    });

    it('should return false for PNG', () => {
      const logo = LogoAsset.create(validProps);
      expect(logo.isJpeg()).toBe(false);
    });
  });

  describe('getScaledDimensions', () => {
    it('should scale down proportionally when too large', () => {
      const logo = LogoAsset.create(validProps); // 800x200
      const scaled = logo.getScaledDimensions(400, 100);

      expect(scaled.width).toBe(400);
      expect(scaled.height).toBe(100);
    });

    it('should not upscale if smaller than max', () => {
      const logo = LogoAsset.create({ ...validProps, width: 200, height: 50 });
      const scaled = logo.getScaledDimensions(400, 100);

      expect(scaled.width).toBe(200); // Original size
      expect(scaled.height).toBe(50); // Original size
    });

    it('should scale based on constraining dimension', () => {
      const logo = LogoAsset.create(validProps); // 800x200
      const scaled = logo.getScaledDimensions(600, 200); // Width is more constraining

      expect(scaled.width).toBe(600);
      expect(scaled.height).toBe(150); // Maintains 4:1 ratio
    });

    it('should handle tall logos', () => {
      const logo = LogoAsset.create({
        ...validProps,
        width: 100,
        height: 200,
      });
      const scaled = logo.getScaledDimensions(150, 100);

      expect(scaled.width).toBe(50); // Constrained by height
      expect(scaled.height).toBe(100);
    });
  });

  describe('equals', () => {
    it('should return true for equal logos', () => {
      const logo1 = LogoAsset.create(validProps);
      const logo2 = LogoAsset.create(validProps);

      expect(logo1.equals(logo2)).toBe(true);
    });

    it('should return false for different blob URLs', () => {
      const logo1 = LogoAsset.create(validProps);
      const logo2 = LogoAsset.create({
        ...validProps,
        blobUrl: 'https://storage.azure.com/logos/different.png',
      });

      expect(logo1.equals(logo2)).toBe(false);
    });

    it('should return false for different dimensions', () => {
      const logo1 = LogoAsset.create(validProps);
      const logo2 = LogoAsset.create({ ...validProps, width: 700 });

      expect(logo1.equals(logo2)).toBe(false);
    });
  });
});
