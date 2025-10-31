/**
 * Azure Blob Storage Service Implementation
 *
 * Implements IFileStorageService using Azure Blob Storage
 * Supports upload, download, delete, and SAS token generation
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  ContainerClient,
} from '@azure/storage-blob';
import {
  IFileStorageService,
  UploadFileOptions,
  FileMetadata,
  DownloadFileResult,
} from '../../domain/services/file-storage.service.interface';

@Injectable()
export class AzureBlobStorageService implements IFileStorageService {
  private readonly logger = new Logger(AzureBlobStorageService.name);
  private readonly blobServiceClient: BlobServiceClient;
  private readonly defaultContainer: string;
  private readonly accountName: string;
  private readonly accountKey: string;

  constructor(private readonly configService: ConfigService) {
    this.accountName =
      this.configService.get<string>('AZURE_STORAGE_ACCOUNT_NAME') || '';
    this.accountKey =
      this.configService.get<string>('AZURE_STORAGE_ACCOUNT_KEY') || '';
    this.defaultContainer =
      this.configService.get<string>('AZURE_STORAGE_CONTAINER') || 'logos';

    // Create BlobServiceClient with shared key credentials
    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey,
    );

    this.blobServiceClient = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      sharedKeyCredential,
    );

    this.logger.log(
      `Azure Blob Storage initialized: account=${this.accountName}, container=${this.defaultContainer}`,
    );
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(options: UploadFileOptions): Promise<FileMetadata> {
    const containerName = options.container || this.defaultContainer;
    const containerClient =
      this.blobServiceClient.getContainerClient(containerName);

    // Ensure container exists
    await this.ensureContainerExists(containerClient);

    // Generate unique blob name with timestamp to avoid collisions
    const timestamp = Date.now();
    const blobName = `${timestamp}-${options.fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      // Upload with metadata and content type
      await blockBlobClient.upload(options.buffer, options.buffer.length, {
        blobHTTPHeaders: {
          blobContentType: options.mimeType,
        },
        metadata: options.metadata,
      });

      this.logger.log(
        `File uploaded successfully: ${blobName} (${options.buffer.length} bytes)`,
      );

      return {
        url: blockBlobClient.url,
        fileName: options.fileName,
        sizeBytes: options.buffer.length,
        mimeType: options.mimeType,
        uploadedAt: new Date(),
        metadata: options.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${blobName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Download a file from Azure Blob Storage
   */
  async downloadFile(url: string): Promise<DownloadFileResult> {
    try {
      const blobName = this.extractBlobNameFromUrl(url);
      const containerClient = this.blobServiceClient.getContainerClient(
        this.defaultContainer,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Check if blob exists
      const exists = await blockBlobClient.exists();
      if (!exists) {
        throw new NotFoundException(`File not found: ${blobName}`);
      }

      // Download blob
      const downloadResponse = await blockBlobClient.download();
      const buffer = await this.streamToBuffer(
        downloadResponse.readableStreamBody!,
      );

      const properties = await blockBlobClient.getProperties();

      this.logger.log(`File downloaded successfully: ${blobName}`);

      return {
        buffer,
        mimeType: properties.contentType || 'application/octet-stream',
        fileName: blobName.split('-').slice(1).join('-'), // Remove timestamp prefix
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to download file from ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(url: string): Promise<void> {
    try {
      const blobName = this.extractBlobNameFromUrl(url);
      const containerClient = this.blobServiceClient.getContainerClient(
        this.defaultContainer,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Check if blob exists
      const exists = await blockBlobClient.exists();
      if (!exists) {
        this.logger.warn(`File not found for deletion: ${blobName}`);
        return; // Idempotent delete - no error if already deleted
      }

      await blockBlobClient.delete();
      this.logger.log(`File deleted successfully: ${blobName}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if a file exists in Azure Blob Storage
   */
  async fileExists(url: string): Promise<boolean> {
    try {
      const blobName = this.extractBlobNameFromUrl(url);
      const containerClient = this.blobServiceClient.getContainerClient(
        this.defaultContainer,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      return await blockBlobClient.exists();
    } catch (error) {
      this.logger.error(
        `Failed to check file existence for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Generate a temporary download URL with SAS token
   */
  generateDownloadUrl(
    url: string,
    expiresInMinutes: number = 60,
  ): Promise<string> {
    try {
      const blobName = this.extractBlobNameFromUrl(url);
      const containerClient = this.blobServiceClient.getContainerClient(
        this.defaultContainer,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Generate SAS token
      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.accountName,
        this.accountKey,
      );

      const sasOptions = {
        containerName: this.defaultContainer,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // Read only
        startsOn: new Date(),
        expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
        protocol: SASProtocol.Https,
      };

      const sasToken = generateBlobSASQueryParameters(
        sasOptions,
        sharedKeyCredential,
      ).toString();

      const urlWithSas = `${blockBlobClient.url}?${sasToken}`;

      this.logger.log(
        `Generated SAS URL for ${blobName}, expires in ${expiresInMinutes} minutes`,
      );

      return Promise.resolve(urlWithSas);
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get file metadata without downloading
   */
  async getFileMetadata(url: string): Promise<FileMetadata> {
    try {
      const blobName = this.extractBlobNameFromUrl(url);
      const containerClient = this.blobServiceClient.getContainerClient(
        this.defaultContainer,
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Check if blob exists
      const exists = await blockBlobClient.exists();
      if (!exists) {
        throw new NotFoundException(`File not found: ${blobName}`);
      }

      const properties = await blockBlobClient.getProperties();

      return {
        url: blockBlobClient.url,
        fileName: blobName.split('-').slice(1).join('-'), // Remove timestamp prefix
        sizeBytes: properties.contentLength || 0,
        mimeType: properties.contentType || 'application/octet-stream',
        uploadedAt: properties.createdOn || new Date(),
        metadata: properties.metadata,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to get file metadata for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to get file metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract blob name from full URL
   * Example: https://account.blob.core.windows.net/container/blob-name → blob-name
   */
  private extractBlobNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter((p) => p);
      // Expect format: /container/blob-name
      if (pathParts.length < 2) {
        throw new Error('Invalid blob URL format');
      }
      return pathParts.slice(1).join('/'); // Everything after container name
    } catch {
      // If URL parsing fails, assume it's just the blob name
      return url;
    }
  }

  /**
   * Ensure container exists, create if not
   */
  private async ensureContainerExists(
    containerClient: ContainerClient,
  ): Promise<void> {
    try {
      const exists = await containerClient.exists();
      if (!exists) {
        await containerClient.create({
          access: 'blob', // Public read access for blobs
        });
        this.logger.log(`Container created: ${containerClient.containerName}`);
      }
    } catch (error) {
      // Ignore if container already exists (race condition)
      if (
        error instanceof Error &&
        !error.message.includes('ContainerAlreadyExists')
      ) {
        throw error;
      }
    }
  }

  /**
   * Convert readable stream to buffer
   */
  private async streamToBuffer(
    readableStream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data: Buffer) => {
        chunks.push(data);
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }
}
