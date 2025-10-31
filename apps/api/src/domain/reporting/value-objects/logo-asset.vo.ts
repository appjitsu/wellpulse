/**
 * Logo Asset Value Object
 *
 * Encapsulates company logo information for PDF reports.
 * Stored in Azure Blob Storage.
 */

export interface LogoAssetProps {
  blobUrl: string; // Azure Blob Storage URL
  fileName: string; // Original filename
  mimeType: string; // image/png or image/jpeg
  sizeBytes: number; // File size in bytes
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  uploadedAt: Date; // Upload timestamp
}

export class LogoAsset {
  private static readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  private static readonly MAX_WIDTH = 1000; // pixels
  private static readonly MAX_HEIGHT = 300; // pixels
  private static readonly ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg'];

  private constructor(private readonly props: LogoAssetProps) {
    this.validate();
  }

  static create(props: LogoAssetProps): LogoAsset {
    return new LogoAsset(props);
  }

  get blobUrl(): string {
    return this.props.blobUrl;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get sizeBytes(): number {
    return this.props.sizeBytes;
  }

  get width(): number {
    return this.props.width;
  }

  get height(): number {
    return this.props.height;
  }

  get uploadedAt(): Date {
    return new Date(this.props.uploadedAt);
  }

  /**
   * Get aspect ratio (width / height)
   */
  get aspectRatio(): number {
    return this.width / this.height;
  }

  /**
   * Get file size in human-readable format
   */
  getFormattedSize(): string {
    const kb = this.sizeBytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Get dimensions as string
   */
  getDimensions(): string {
    return `${this.width}x${this.height}`;
  }

  /**
   * Check if logo is PNG format
   */
  isPng(): boolean {
    return this.mimeType === 'image/png';
  }

  /**
   * Check if logo is JPEG format
   */
  isJpeg(): boolean {
    return this.mimeType === 'image/jpeg';
  }

  /**
   * Calculate scaled dimensions to fit within max width/height
   * while preserving aspect ratio
   */
  getScaledDimensions(
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    const widthRatio = maxWidth / this.width;
    const heightRatio = maxHeight / this.height;
    const ratio = Math.min(widthRatio, heightRatio, 1); // Don't upscale

    return {
      width: Math.round(this.width * ratio),
      height: Math.round(this.height * ratio),
    };
  }

  /**
   * Check if two logo assets are equal
   */
  equals(other: LogoAsset): boolean {
    return (
      this.blobUrl === other.blobUrl &&
      this.fileName === other.fileName &&
      this.mimeType === other.mimeType &&
      this.sizeBytes === other.sizeBytes &&
      this.width === other.width &&
      this.height === other.height &&
      this.uploadedAt.getTime() === other.uploadedAt.getTime()
    );
  }

  private validate(): void {
    // Validate blob URL
    if (!this.props.blobUrl || this.props.blobUrl.trim().length === 0) {
      throw new Error('Logo blob URL is required');
    }

    try {
      new URL(this.props.blobUrl);
    } catch {
      throw new Error('Invalid blob URL format');
    }

    // Validate filename
    if (!this.props.fileName || this.props.fileName.trim().length === 0) {
      throw new Error('Logo filename is required');
    }

    // Validate MIME type
    if (!LogoAsset.ALLOWED_MIME_TYPES.includes(this.props.mimeType)) {
      throw new Error(
        `Logo must be PNG or JPEG format. Got: ${this.props.mimeType}`,
      );
    }

    // Validate file size
    if (this.props.sizeBytes <= 0) {
      throw new Error('Logo file size must be greater than zero');
    }

    if (this.props.sizeBytes > LogoAsset.MAX_FILE_SIZE) {
      const maxMb = (LogoAsset.MAX_FILE_SIZE / 1024 / 1024).toFixed(1);
      const actualMb = (this.props.sizeBytes / 1024 / 1024).toFixed(1);
      throw new Error(
        `Logo file size must not exceed ${maxMb}MB. Got: ${actualMb}MB`,
      );
    }

    // Validate dimensions
    if (this.props.width <= 0 || this.props.height <= 0) {
      throw new Error('Logo dimensions must be greater than zero');
    }

    if (this.props.width > LogoAsset.MAX_WIDTH) {
      throw new Error(
        `Logo width must not exceed ${LogoAsset.MAX_WIDTH}px. Got: ${this.props.width}px`,
      );
    }

    if (this.props.height > LogoAsset.MAX_HEIGHT) {
      throw new Error(
        `Logo height must not exceed ${LogoAsset.MAX_HEIGHT}px. Got: ${this.props.height}px`,
      );
    }

    // Validate upload date
    if (!(this.props.uploadedAt instanceof Date)) {
      throw new Error('Invalid upload date');
    }

    if (this.props.uploadedAt > new Date()) {
      throw new Error('Upload date cannot be in the future');
    }
  }
}
