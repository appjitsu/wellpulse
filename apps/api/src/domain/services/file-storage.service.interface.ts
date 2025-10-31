/**
 * File Storage Service Interface
 *
 * Abstraction for file storage providers (Azure Blob, AWS S3, Local)
 * Enables Strategy Pattern for multi-provider support
 */

export interface UploadFileOptions {
  /**
   * File buffer to upload
   */
  buffer: Buffer;

  /**
   * File name (with extension)
   */
  fileName: string;

  /**
   * MIME type (e.g., 'image/png', 'application/pdf')
   */
  mimeType: string;

  /**
   * Optional container/bucket name override
   */
  container?: string;

  /**
   * Optional metadata tags
   */
  metadata?: Record<string, string>;
}

export interface FileMetadata {
  /**
   * Public URL to access the file
   */
  url: string;

  /**
   * File name
   */
  fileName: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * Upload timestamp
   */
  uploadedAt: Date;

  /**
   * Optional metadata tags
   */
  metadata?: Record<string, string>;
}

export interface DownloadFileResult {
  /**
   * File buffer
   */
  buffer: Buffer;

  /**
   * MIME type
   */
  mimeType: string;

  /**
   * File name
   */
  fileName: string;
}

export interface IFileStorageService {
  /**
   * Upload a file to storage
   *
   * @param options Upload options
   * @returns File metadata with public URL
   * @throws Error if upload fails
   */
  uploadFile(options: UploadFileOptions): Promise<FileMetadata>;

  /**
   * Download a file from storage
   *
   * @param url File URL or blob name
   * @returns File buffer and metadata
   * @throws Error if file not found or download fails
   */
  downloadFile(url: string): Promise<DownloadFileResult>;

  /**
   * Delete a file from storage
   *
   * @param url File URL or blob name
   * @throws Error if deletion fails
   */
  deleteFile(url: string): Promise<void>;

  /**
   * Check if a file exists
   *
   * @param url File URL or blob name
   * @returns True if file exists
   */
  fileExists(url: string): Promise<boolean>;

  /**
   * Generate a temporary download URL with expiration (SAS token for Azure)
   *
   * @param url File URL or blob name
   * @param expiresInMinutes Expiration time in minutes (default: 60)
   * @returns Temporary URL with access token
   */
  generateDownloadUrl(url: string, expiresInMinutes?: number): Promise<string>;

  /**
   * Get file metadata without downloading
   *
   * @param url File URL or blob name
   * @returns File metadata
   */
  getFileMetadata(url: string): Promise<FileMetadata>;
}
