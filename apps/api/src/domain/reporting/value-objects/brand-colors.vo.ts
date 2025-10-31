/**
 * Brand Colors Value Object
 *
 * Encapsulates brand color palette for PDF reports.
 * All colors are stored in hex format (#RRGGBB).
 */

export interface BrandColorsProps {
  primary: string; // Main brand color for headers, accents
  secondary: string; // Secondary color for subheadings
  text: string; // Body text color
  background: string; // Background color
}

export class BrandColors {
  private constructor(private readonly props: BrandColorsProps) {
    this.validate();
  }

  static create(props: BrandColorsProps): BrandColors {
    return new BrandColors(props);
  }

  static DEFAULT: BrandColors = new BrandColors({
    primary: '#1E40AF', // Blue
    secondary: '#64748B', // Gray
    text: '#1F2937', // Dark gray
    background: '#FFFFFF', // White
  });

  get primary(): string {
    return this.props.primary;
  }

  get secondary(): string {
    return this.props.secondary;
  }

  get text(): string {
    return this.props.text;
  }

  get background(): string {
    return this.props.background;
  }

  /**
   * Convert hex color to RGB values for PDFKit
   */
  static hexToRgb(hex: string): [number, number, number] {
    const result = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid hex color: ${hex}`);
    }

    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }

  /**
   * Get primary color as RGB for PDFKit
   */
  getPrimaryRgb(): [number, number, number] {
    return BrandColors.hexToRgb(this.primary);
  }

  /**
   * Get secondary color as RGB for PDFKit
   */
  getSecondaryRgb(): [number, number, number] {
    return BrandColors.hexToRgb(this.secondary);
  }

  /**
   * Get text color as RGB for PDFKit
   */
  getTextRgb(): [number, number, number] {
    return BrandColors.hexToRgb(this.text);
  }

  /**
   * Get background color as RGB for PDFKit
   */
  getBackgroundRgb(): [number, number, number] {
    return BrandColors.hexToRgb(this.background);
  }

  /**
   * Check if colors have sufficient contrast for accessibility
   */
  hasGoodContrast(): boolean {
    // Calculate contrast ratio between text and background
    const textRgb = this.getTextRgb();
    const bgRgb = this.getBackgroundRgb();

    const textLuminance = this.calculateLuminance(textRgb);
    const bgLuminance = this.calculateLuminance(bgRgb);

    const contrastRatio = this.calculateContrastRatio(
      textLuminance,
      bgLuminance,
    );

    // WCAG AA requires 4.5:1 for normal text
    return contrastRatio >= 4.5;
  }

  private calculateLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private calculateContrastRatio(l1: number, l2: number): number {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if two brand colors are equal
   */
  equals(other: BrandColors): boolean {
    return (
      this.primary === other.primary &&
      this.secondary === other.secondary &&
      this.text === other.text &&
      this.background === other.background
    );
  }

  private validate(): void {
    this.validateHexColor(this.props.primary, 'primary');
    this.validateHexColor(this.props.secondary, 'secondary');
    this.validateHexColor(this.props.text, 'text');
    this.validateHexColor(this.props.background, 'background');
  }

  private validateHexColor(color: string, fieldName: string): void {
    const hexPattern = /^#[0-9A-F]{6}$/i;

    if (!hexPattern.test(color)) {
      throw new Error(
        `Invalid ${fieldName} color format. Must be hex format (#RRGGBB)`,
      );
    }
  }
}
