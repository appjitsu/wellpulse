/**
 * BrandColors Value Object Tests
 */

import { BrandColors } from './brand-colors.vo';

describe('BrandColors', () => {
  const validProps = {
    primary: '#1E40AF',
    secondary: '#64748B',
    text: '#1F2937',
    background: '#FFFFFF',
  };

  describe('create', () => {
    it('should create with valid hex colors', () => {
      const colors = BrandColors.create(validProps);

      expect(colors.primary).toBe('#1E40AF');
      expect(colors.secondary).toBe('#64748B');
      expect(colors.text).toBe('#1F2937');
      expect(colors.background).toBe('#FFFFFF');
    });

    it('should throw error for invalid hex format', () => {
      expect(() =>
        BrandColors.create({ ...validProps, primary: 'blue' }),
      ).toThrow('Invalid primary color format. Must be hex format (#RRGGBB)');
    });

    it('should throw error for short hex code', () => {
      expect(() =>
        BrandColors.create({ ...validProps, primary: '#FFF' }),
      ).toThrow('Invalid primary color format. Must be hex format (#RRGGBB)');
    });

    it('should throw error for long hex code', () => {
      expect(() =>
        BrandColors.create({ ...validProps, primary: '#FFFFFFF' }),
      ).toThrow('Invalid primary color format. Must be hex format (#RRGGBB)');
    });

    it('should throw error for hex without hash', () => {
      expect(() =>
        BrandColors.create({ ...validProps, primary: '1E40AF' }),
      ).toThrow('Invalid primary color format. Must be hex format (#RRGGBB)');
    });

    it('should accept lowercase hex colors', () => {
      const colors = BrandColors.create({
        primary: '#1e40af',
        secondary: '#64748b',
        text: '#1f2937',
        background: '#ffffff',
      });

      expect(colors.primary).toBe('#1e40af');
    });
  });

  describe('DEFAULT', () => {
    it('should have default colors defined', () => {
      expect(BrandColors.DEFAULT.primary).toBe('#1E40AF');
      expect(BrandColors.DEFAULT.secondary).toBe('#64748B');
      expect(BrandColors.DEFAULT.text).toBe('#1F2937');
      expect(BrandColors.DEFAULT.background).toBe('#FFFFFF');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      const rgb = BrandColors.hexToRgb('#1E40AF');
      expect(rgb).toEqual([30, 64, 175]);
    });

    it('should convert white to RGB', () => {
      const rgb = BrandColors.hexToRgb('#FFFFFF');
      expect(rgb).toEqual([255, 255, 255]);
    });

    it('should convert black to RGB', () => {
      const rgb = BrandColors.hexToRgb('#000000');
      expect(rgb).toEqual([0, 0, 0]);
    });

    it('should handle lowercase hex', () => {
      const rgb = BrandColors.hexToRgb('#1e40af');
      expect(rgb).toEqual([30, 64, 175]);
    });

    it('should throw error for invalid hex', () => {
      expect(() => BrandColors.hexToRgb('invalid')).toThrow(
        'Invalid hex color',
      );
    });
  });

  describe('RGB conversion methods', () => {
    it('should get primary as RGB', () => {
      const colors = BrandColors.create(validProps);
      const rgb = colors.getPrimaryRgb();

      expect(rgb).toEqual([30, 64, 175]);
    });

    it('should get secondary as RGB', () => {
      const colors = BrandColors.create(validProps);
      const rgb = colors.getSecondaryRgb();

      expect(rgb).toEqual([100, 116, 139]);
    });

    it('should get text as RGB', () => {
      const colors = BrandColors.create(validProps);
      const rgb = colors.getTextRgb();

      expect(rgb).toEqual([31, 41, 55]);
    });

    it('should get background as RGB', () => {
      const colors = BrandColors.create(validProps);
      const rgb = colors.getBackgroundRgb();

      expect(rgb).toEqual([255, 255, 255]);
    });
  });

  describe('hasGoodContrast', () => {
    it('should return true for good contrast (dark text on white)', () => {
      const colors = BrandColors.create({
        primary: '#1E40AF',
        secondary: '#64748B',
        text: '#1F2937', // Dark gray
        background: '#FFFFFF', // White
      });

      expect(colors.hasGoodContrast()).toBe(true);
    });

    it('should return true for good contrast (white text on dark)', () => {
      const colors = BrandColors.create({
        primary: '#1E40AF',
        secondary: '#64748B',
        text: '#FFFFFF', // White
        background: '#1F2937', // Dark gray
      });

      expect(colors.hasGoodContrast()).toBe(true);
    });

    it('should return false for poor contrast (light gray on white)', () => {
      const colors = BrandColors.create({
        primary: '#1E40AF',
        secondary: '#64748B',
        text: '#E5E7EB', // Light gray
        background: '#FFFFFF', // White
      });

      expect(colors.hasGoodContrast()).toBe(false);
    });

    it('should return false for poor contrast (similar colors)', () => {
      const colors = BrandColors.create({
        primary: '#1E40AF',
        secondary: '#64748B',
        text: '#64748B', // Gray
        background: '#9CA3AF', // Slightly lighter gray
      });

      expect(colors.hasGoodContrast()).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for equal brand colors', () => {
      const colors1 = BrandColors.create(validProps);
      const colors2 = BrandColors.create(validProps);

      expect(colors1.equals(colors2)).toBe(true);
    });

    it('should return false for different brand colors', () => {
      const colors1 = BrandColors.create(validProps);
      const colors2 = BrandColors.create({
        ...validProps,
        primary: '#FF0000',
      });

      expect(colors1.equals(colors2)).toBe(false);
    });
  });
});
