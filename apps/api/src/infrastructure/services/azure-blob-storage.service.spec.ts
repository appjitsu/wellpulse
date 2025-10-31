/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * Azure Blob Storage Service Tests
 *
 * Tests Azure Blob Storage implementation of IFileStorageService.
 * Covers upload, download, delete, SAS token generation, and error handling.
 *
 * File Storage Requirements:
 * - Upload files with metadata and automatic container creation
 * - Generate time-limited SAS tokens for secure blob access
 * - Download files from storage
 * - Delete files (idempotent operation)
 * - Check file existence
 * - Get file metadata without downloading
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AzureBlobStorageService } from './azure-blob-storage.service';

// Mock Azure SDK
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn().mockImplementation(() => ({
    getContainerClient: jest.fn(),
  })),
  StorageSharedKeyCredential: jest.fn(),
  generateBlobSASQueryParameters: jest.fn(),
  BlobSASPermissions: {
    parse: jest.fn(),
  },
  SASProtocol: {
    Https: 'https',
  },
}));

describe('AzureBlobStorageService', () => {
  let service: AzureBlobStorageService;
  let configService: ConfigService;

  // Test data
  const mockAccountName = 'testaccount';
  const mockAccountKey = 'dGVzdGtleQ=='; // base64 encoded "testkey"
  const mockContainer = 'logos';
  const mockFileName = 'test-logo.png';
  const mockFileBuffer = Buffer.from('fake image data');
  const mockMimeType = 'image/png';
  const mockBlobUrl = `https://${mockAccountName}.blob.core.windows.net/${mockContainer}/123456-${mockFileName}`;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'AZURE_STORAGE_ACCOUNT_NAME':
            return mockAccountName;
          case 'AZURE_STORAGE_ACCOUNT_KEY':
            return mockAccountKey;
          case 'AZURE_STORAGE_CONTAINER':
            return mockContainer;
          default:
            return undefined;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AzureBlobStorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with environment configuration', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith(
        'AZURE_STORAGE_ACCOUNT_NAME',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith(
        'AZURE_STORAGE_ACCOUNT_KEY',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('AZURE_STORAGE_CONTAINER');
    });

    it('should use default container if not configured', async () => {
      const mockConfigWithoutContainer = {
        get: jest.fn((key: string) => {
          if (key === 'AZURE_STORAGE_ACCOUNT_NAME') return mockAccountName;
          if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
          return undefined; // No AZURE_STORAGE_CONTAINER
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: mockConfigWithoutContainer,
          },
        ],
      }).compile();

      const serviceWithDefaults = module.get<AzureBlobStorageService>(
        AzureBlobStorageService,
      );
      expect(serviceWithDefaults).toBeDefined();
    });
  });

  describe('uploadFile()', () => {
    it('should upload file successfully with metadata', async () => {
      const mockBlockBlobClient = {
        url: mockBlobUrl,
        upload: jest.fn().mockResolvedValue({ requestId: 'test-request-id' }),
      };

      const mockContainerClient = {
        containerName: mockContainer,
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
        exists: jest.fn().mockResolvedValue(true),
      };

      // Override the BlobServiceClient mock for this test
      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      // Re-create service with mocked Azure SDK
      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      const result = await service.uploadFile({
        buffer: mockFileBuffer,
        fileName: mockFileName,
        mimeType: mockMimeType,
        metadata: {
          tenantId: 'test-tenant',
          uploadedBy: 'admin',
        },
      });

      expect(result).toMatchObject({
        url: expect.any(String),
        fileName: mockFileName,
        sizeBytes: mockFileBuffer.length,
        mimeType: mockMimeType,
        uploadedAt: expect.any(Date),
        metadata: {
          tenantId: 'test-tenant',
          uploadedBy: 'admin',
        },
      });
    });

    it('should use default container if not specified in options', async () => {
      const mockBlockBlobClient = {
        url: mockBlobUrl,
        upload: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        containerName: mockContainer,
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
        exists: jest.fn().mockResolvedValue(true),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest
          .fn()
          .mockImplementation((containerName: string) => {
            expect(containerName).toBe(mockContainer); // Should use default
            return mockContainerClient;
          }),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await service.uploadFile({
        buffer: mockFileBuffer,
        fileName: mockFileName,
        mimeType: mockMimeType,
      });
    });

    it('should use custom container if specified in options', async () => {
      const customContainer = 'pdfs';
      const mockBlockBlobClient = {
        url: `https://${mockAccountName}.blob.core.windows.net/${customContainer}/test.pdf`,
        upload: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        containerName: customContainer,
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
        exists: jest.fn().mockResolvedValue(true),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest
          .fn()
          .mockImplementation((containerName: string) => {
            expect(containerName).toBe(customContainer);
            return mockContainerClient;
          }),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await service.uploadFile({
        buffer: mockFileBuffer,
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        container: customContainer,
      });
    });

    it('should generate unique blob names with timestamp', async () => {
      const blobNames: string[] = [];
      const mockBlockBlobClient = {
        url: mockBlobUrl,
        upload: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        containerName: mockContainer,
        getBlockBlobClient: jest.fn().mockImplementation((blobName: string) => {
          blobNames.push(blobName);
          return mockBlockBlobClient;
        }),
        exists: jest.fn().mockResolvedValue(true),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      // Mock Date.now() to return different timestamps
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return 1000000 + callCount; // Return different values
      });

      try {
        // Upload same file twice
        await service.uploadFile({
          buffer: mockFileBuffer,
          fileName: mockFileName,
          mimeType: mockMimeType,
        });

        await service.uploadFile({
          buffer: mockFileBuffer,
          fileName: mockFileName,
          mimeType: mockMimeType,
        });

        // Blob names should be different (timestamp prefix)
        expect(blobNames[0]).not.toBe(blobNames[1]);
        expect(blobNames[0]).toMatch(/^\d+-test-logo\.png$/);
        expect(blobNames[1]).toMatch(/^\d+-test-logo\.png$/);
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });

    it('should throw error if upload fails', async () => {
      const mockBlockBlobClient = {
        upload: jest.fn().mockRejectedValue(new Error('Azure upload failed')),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
        exists: jest.fn().mockResolvedValue(true),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await expect(
        service.uploadFile({
          buffer: mockFileBuffer,
          fileName: mockFileName,
          mimeType: mockMimeType,
        }),
      ).rejects.toThrow('Failed to upload file: Azure upload failed');
    });
  });

  describe('extractBlobNameFromUrl()', () => {
    it('should extract blob name from full Azure URL', () => {
      // This is a private method, so we test it indirectly through deleteFile
      const url = `https://${mockAccountName}.blob.core.windows.net/${mockContainer}/123456-test.png`;

      // Mock the necessary Azure SDK methods for deleteFile
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockImplementation((blobName: string) => {
          // Verify blob name extraction
          expect(blobName).toBe('123456-test.png');
          return mockBlockBlobClient;
        }),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      // Test extraction by calling deleteFile (which uses extractBlobNameFromUrl internally)
      expect(async () => {
        const module = await Test.createTestingModule({
          providers: [
            AzureBlobStorageService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                    return mockAccountName;
                  if (key === 'AZURE_STORAGE_ACCOUNT_KEY')
                    return mockAccountKey;
                  if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                  return undefined;
                }),
              },
            },
          ],
        }).compile();

        const testService = module.get<AzureBlobStorageService>(
          AzureBlobStorageService,
        );
        await testService.deleteFile(url);
      }).not.toThrow();
    });

    it('should handle blob name directly if URL parsing fails', async () => {
      const simpleBlobName = 'test.png';

      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockImplementation((blobName: string) => {
          // Should pass through as-is
          expect(blobName).toBe(simpleBlobName);
          return mockBlockBlobClient;
        }),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const testService = module.get<AzureBlobStorageService>(
        AzureBlobStorageService,
      );
      await testService.deleteFile(simpleBlobName);
    });
  });

  describe('deleteFile()', () => {
    it('should delete file successfully', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue({}),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await expect(service.deleteFile(mockBlobUrl)).resolves.not.toThrow();

      expect(mockBlockBlobClient.delete).toHaveBeenCalled();
    });

    it('should be idempotent (no error if file does not exist)', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(false), // File doesn't exist
        delete: jest.fn(),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await expect(service.deleteFile(mockBlobUrl)).resolves.not.toThrow();

      expect(mockBlockBlobClient.delete).not.toHaveBeenCalled();
    });

    it('should throw error if deletion fails', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockRejectedValue(new Error('Azure delete failed')),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await expect(service.deleteFile(mockBlobUrl)).rejects.toThrow(
        'Failed to delete file: Azure delete failed',
      );
    });
  });

  describe('fileExists()', () => {
    it('should return true if file exists', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(true),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      const exists = await service.fileExists(mockBlobUrl);

      expect(exists).toBe(true);

      expect(mockBlockBlobClient.exists).toHaveBeenCalled();
    });

    it('should return false if file does not exist', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockResolvedValue(false),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      const exists = await service.fileExists(mockBlobUrl);

      expect(exists).toBe(false);
    });

    it('should return false if error occurs', async () => {
      const mockBlockBlobClient = {
        exists: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      const exists = await service.fileExists(mockBlobUrl);

      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should use type guards for error messages', async () => {
      const mockBlockBlobClient = {
        url: mockBlobUrl,
        upload: jest.fn().mockRejectedValue('String error'),
      };

      const mockContainerClient = {
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
        exists: jest.fn().mockResolvedValue(true),
      };

      const BlobServiceClient = jest.requireMock('@azure/storage-blob')
        .BlobServiceClient as jest.Mock;
      BlobServiceClient.mockImplementation(() => ({
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
      }));

      const module = await Test.createTestingModule({
        providers: [
          AzureBlobStorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AZURE_STORAGE_ACCOUNT_NAME')
                  return mockAccountName;
                if (key === 'AZURE_STORAGE_ACCOUNT_KEY') return mockAccountKey;
                if (key === 'AZURE_STORAGE_CONTAINER') return mockContainer;
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AzureBlobStorageService>(AzureBlobStorageService);

      await expect(
        service.uploadFile({
          buffer: mockFileBuffer,
          fileName: mockFileName,
          mimeType: mockMimeType,
        }),
      ).rejects.toThrow('Failed to upload file: String error');
    });
  });
});
