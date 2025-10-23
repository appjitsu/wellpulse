# Pattern 44: File Upload & Download Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [File Upload Strategies](#file-upload-strategies)
3. [Local Storage](#local-storage)
4. [Cloud Storage (S3)](#cloud-storage-s3)
5. [File Validation & Security](#file-validation--security)
6. [Streaming Large Files](#streaming-large-files)
7. [Progress Tracking](#progress-tracking)
8. [Image Processing](#image-processing)
9. [Download Patterns](#download-patterns)
10. [Best Practices](#best-practices)

---

## Overview

File handling is critical for document management, user avatars, invoice attachments, and other business needs in a PSA platform.

### Use Cases in WellPulse

- **User Avatars**: Profile pictures
- **Invoice Attachments**: PDF invoices, receipts
- **Project Documents**: Contracts, SOWs, deliverables
- **Time Entry Attachments**: Screenshots, work evidence
- **Expense Receipts**: Scanned receipts, photos
- **Report Exports**: CSV, PDF reports

---

## File Upload Strategies

### 1. Multipart Form Data (Small Files < 10MB)

**NestJS Controller**:

```typescript
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

@Controller('api/v1/files')
export class FileController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    }));
  }
}
```

**React Client**:

```typescript
function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:3001/api/v1/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });

      const data = await response.json();
      console.log('File uploaded:', data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}
```

### 2. Chunked Upload (Large Files > 10MB)

**Server**:

```typescript
interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  uploadId: string;
}

@Controller('api/v1/files')
export class ChunkedFileController {
  private uploadSessions = new Map<
    string,
    {
      chunks: Buffer[];
      totalChunks: number;
      filename: string;
    }
  >();

  @Post('upload-chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(@UploadedFile() chunk: Express.Multer.File, @Body() metadata: ChunkMetadata) {
    const { uploadId, chunkIndex, totalChunks, filename } = metadata;

    // Initialize upload session
    if (!this.uploadSessions.has(uploadId)) {
      this.uploadSessions.set(uploadId, {
        chunks: new Array(totalChunks),
        totalChunks,
        filename,
      });
    }

    const session = this.uploadSessions.get(uploadId)!;
    session.chunks[chunkIndex] = chunk.buffer;

    // Check if all chunks received
    const allChunksReceived = session.chunks.every((c) => c !== undefined);

    if (allChunksReceived) {
      // Combine chunks
      const completeFile = Buffer.concat(session.chunks);

      // Save file
      const filepath = await this.saveFile(completeFile, filename);

      // Clean up session
      this.uploadSessions.delete(uploadId);

      return {
        status: 'complete',
        filepath,
        size: completeFile.length,
      };
    }

    return {
      status: 'incomplete',
      receivedChunks: session.chunks.filter((c) => c !== undefined).length,
      totalChunks,
    };
  }

  private async saveFile(buffer: Buffer, filename: string): Promise<string> {
    const filepath = path.join('/uploads', `${Date.now()}-${filename}`);
    await fs.promises.writeFile(filepath, buffer);
    return filepath;
  }
}
```

**Client**:

```typescript
async function uploadLargeFile(file: File) {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}-${Math.random()}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('filename', file.name);
    formData.append('uploadId', uploadId);

    const response = await fetch('http://localhost:3001/api/v1/files/upload-chunk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.status === 'complete') {
      console.log('Upload complete:', data.filepath);
      return data;
    }

    // Update progress
    const progress = ((chunkIndex + 1) / totalChunks) * 100;
    console.log(`Upload progress: ${progress.toFixed(2)}%`);
  }
}
```

---

## Local Storage

### 1. Multer Configuration

```typescript
// multer.config.ts
import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerOptions = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  },
};

// app.module.ts
@Module({
  imports: [MulterModule.register(multerOptions)],
})
export class AppModule {}
```

### 2. File Entity

```typescript
// file.entity.ts
export class File {
  private constructor(
    public readonly id: FileId,
    public readonly filename: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly path: string,
    public readonly uploadedBy: string,
    public readonly uploadedAt: Date,
    public deletedAt?: Date,
  ) {}

  static create(props: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    uploadedBy: string;
  }): File {
    return new File(
      FileId.create(),
      props.filename,
      props.originalName,
      props.mimeType,
      props.size,
      props.path,
      props.uploadedBy,
      new Date(),
    );
  }

  softDelete(): void {
    this.deletedAt = new Date();
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isPDF(): boolean {
    return this.mimeType === 'application/pdf';
  }
}
```

---

## Cloud Storage (S3)

### 1. AWS S3 Setup

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```typescript
// s3.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET!;
  }

  async uploadFile(file: Express.Multer.File, key: string): Promise<{ key: string; url: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private',
    });

    await this.s3Client.send(command);

    const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

    return { key, url };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async getFileStream(key: string): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body as ReadableStream;
  }
}
```

### 2. Upload to S3 Controller

```typescript
@Controller('api/v1/files')
export class FileController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadToS3(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    const key = `${user.organizationId}/${Date.now()}-${file.originalname}`;
    const { url } = await this.s3Service.uploadFile(file, key);

    // Save file metadata to database
    const fileEntity = File.create({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: key,
      uploadedBy: user.userId,
    });

    await this.fileRepository.save(fileEntity);

    return {
      id: fileEntity.id.value,
      url,
      filename: file.originalname,
      size: file.size,
    };
  }

  @Get(':id/download-url')
  async getDownloadUrl(@Param('id') id: string) {
    const file = await this.fileRepository.findById(new FileId(id));

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const signedUrl = await this.s3Service.getSignedUrl(file.path, 300); // 5 minutes

    return { url: signedUrl };
  }
}
```

---

## File Validation & Security

### 1. Comprehensive Validation

```typescript
import { extname } from 'path';
import * as fileType from 'file-type';

export class FileValidator {
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  static async validate(file: Express.Multer.File): Promise<void> {
    // 1. Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // 2. Check MIME type from client
    if (!this.ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`);
    }

    // 3. Verify actual file type (prevent MIME type spoofing)
    const detectedType = await fileType.fromBuffer(file.buffer);

    if (!detectedType || !this.ALLOWED_MIME_TYPES.has(detectedType.mime)) {
      throw new BadRequestException(
        'File type mismatch. The actual file type does not match the declared type.',
      );
    }

    // 4. Validate file extension
    const ext = extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];

    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(`File extension not allowed: ${ext}`);
    }

    // 5. Scan for malware (optional - integrate with ClamAV or similar)
    // await this.scanForMalware(file.buffer);
  }

  static sanitizeFilename(filename: string): string {
    // Remove dangerous characters
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }
}

// Use in controller
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  await FileValidator.validate(file);

  const sanitizedFilename = FileValidator.sanitizeFilename(file.originalname);

  // Continue with upload
}
```

### 2. Virus Scanning with ClamAV

```typescript
import NodeClam from 'clamscan';

@Injectable()
export class AntivirusService {
  private clamscan: NodeClam;

  async onModuleInit() {
    this.clamscan = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      scanLog: null,
      debugMode: false,
      clamdscan: {
        host: 'localhost',
        port: 3310,
      },
    });
  }

  async scanFile(filePath: string): Promise<{ isInfected: boolean; viruses: string[] }> {
    const { isInfected, viruses } = await this.clamscan.isInfected(filePath);

    if (isInfected) {
      console.warn(`Infected file detected: ${filePath}`, viruses);
    }

    return { isInfected, viruses };
  }

  async scanBuffer(buffer: Buffer): Promise<{ isInfected: boolean; viruses: string[] }> {
    const tempFile = `/tmp/${Date.now()}-scan.tmp`;
    await fs.promises.writeFile(tempFile, buffer);

    try {
      return await this.scanFile(tempFile);
    } finally {
      await fs.promises.unlink(tempFile);
    }
  }
}
```

---

## Streaming Large Files

### 1. Stream Download

```typescript
@Controller('api/v1/files')
export class FileController {
  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.fileRepository.findById(new FileId(id));

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Set headers
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
      'Content-Length': file.size,
    });

    // Stream from S3
    const stream = await this.s3Service.getFileStream(file.path);
    stream.pipe(res);
  }

  @Get(':id/stream')
  async streamFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.fileRepository.findById(new FileId(id));

    if (!file) {
      throw new NotFoundException('File not found');
    }

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Accept-Ranges': 'bytes',
    });

    const stream = await this.s3Service.getFileStream(file.path);
    stream.pipe(res);
  }
}
```

### 2. Range Requests (Video/Audio Streaming)

```typescript
@Get(':id/stream')
async streamWithRange(
  @Param('id') id: string,
  @Req() req: Request,
  @Res() res: Response,
) {
  const file = await this.fileRepository.findById(new FileId(id));

  if (!file) {
    throw new NotFoundException('File not found');
  }

  const range = req.headers.range;

  if (!range) {
    // No range header, send entire file
    const stream = await this.s3Service.getFileStream(file.path);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': file.size,
    });
    stream.pipe(res);
    return;
  }

  // Parse range header
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : file.size - 1;
  const chunkSize = end - start + 1;

  // Get stream with range
  const stream = await this.s3Service.getFileStreamWithRange(file.path, start, end);

  res.status(206); // Partial Content
  res.set({
    'Content-Range': `bytes ${start}-${end}/${file.size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': file.mimeType,
  });

  stream.pipe(res);
}
```

---

## Progress Tracking

### 1. Upload Progress (Client)

```typescript
function FileUploadWithProgress() {
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setProgress(Math.round(percentComplete));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        console.log('Upload complete');
        const response = JSON.parse(xhr.responseText);
        console.log(response);
      }
    });

    xhr.addEventListener('error', () => {
      console.error('Upload failed');
    });

    xhr.open('POST', 'http://localhost:3001/api/v1/files/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files && uploadFile(e.target.files[0])} />
      {progress > 0 && (
        <div>
          <progress value={progress} max="100" />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

### 2. Server-Side Progress (WebSocket)

```typescript
@WebSocketGateway()
export class FileUploadGateway {
  @SubscribeMessage('upload:start')
  async handleUploadStart(
    @MessageBody() data: { uploadId: string; filename: string; totalSize: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Track upload session
  }

  notifyProgress(uploadId: string, loaded: number, total: number) {
    this.server.emit(`upload:progress:${uploadId}`, {
      loaded,
      total,
      progress: (loaded / total) * 100,
    });
  }
}
```

---

## Image Processing

### 1. Image Resizing with Sharp

```bash
pnpm add sharp
```

```typescript
import sharp from 'sharp';

@Injectable()
export class ImageProcessingService {
  async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  async createThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(200, 200, {
        fit: 'cover',
      })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  async createAvatarSizes(buffer: Buffer): Promise<{
    small: Buffer;
    medium: Buffer;
    large: Buffer;
  }> {
    return {
      small: await this.resizeImage(buffer, 50, 50),
      medium: await this.resizeImage(buffer, 150, 150),
      large: await this.resizeImage(buffer, 300, 300),
    };
  }

  async optimizeImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer).jpeg({ quality: 85, progressive: true }).toBuffer();
  }
}
```

### 2. Avatar Upload with Processing

```typescript
@Post('avatar')
@UseInterceptors(FileInterceptor('avatar'))
async uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: CurrentUserData,
) {
  if (!file.mimetype.startsWith('image/')) {
    throw new BadRequestException('Only image files are allowed');
  }

  // Process image
  const sizes = await this.imageService.createAvatarSizes(file.buffer);

  // Upload all sizes to S3
  const [small, medium, large] = await Promise.all([
    this.s3Service.uploadFile(
      { ...file, buffer: sizes.small },
      `avatars/${user.userId}/small.jpg`,
    ),
    this.s3Service.uploadFile(
      { ...file, buffer: sizes.medium },
      `avatars/${user.userId}/medium.jpg`,
    ),
    this.s3Service.uploadFile(
      { ...file, buffer: sizes.large },
      `avatars/${user.userId}/large.jpg`,
    ),
  ]);

  // Update user avatar URLs
  await this.commandBus.execute(
    new UpdateUserAvatarCommand(user.userId, {
      small: small.url,
      medium: medium.url,
      large: large.url,
    }),
  );

  return {
    small: small.url,
    medium: medium.url,
    large: large.url,
  };
}
```

---

## Download Patterns

### 1. Direct Download

```typescript
@Get(':id/download')
async download(
  @Param('id') id: string,
  @Res() res: Response,
) {
  const file = await this.fileRepository.findById(new FileId(id));

  if (!file) {
    throw new NotFoundException('File not found');
  }

  const stream = await this.s3Service.getFileStream(file.path);

  res.set({
    'Content-Type': file.mimeType,
    'Content-Disposition': `attachment; filename="${file.originalName}"`,
    'Content-Length': file.size,
  });

  stream.pipe(res);
}
```

### 2. Pre-Signed URL Download

```typescript
@Get(':id/download-url')
async getDownloadUrl(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserData,
) {
  const file = await this.fileRepository.findById(new FileId(id));

  if (!file) {
    throw new NotFoundException('File not found');
  }

  // Check permissions
  if (!await this.canAccessFile(user, file)) {
    throw new ForbiddenException('Access denied');
  }

  // Generate short-lived signed URL
  const url = await this.s3Service.getSignedUrl(file.path, 300); // 5 minutes

  return { url };
}
```

### 3. ZIP Archive Download

```bash
pnpm add archiver
```

```typescript
import archiver from 'archiver';

@Get('project/:projectId/download-all')
async downloadProjectFiles(
  @Param('projectId') projectId: string,
  @Res() res: Response,
) {
  const files = await this.fileRepository.findByProjectId(projectId);

  if (files.length === 0) {
    throw new NotFoundException('No files found for this project');
  }

  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="project-${projectId}-files.zip"`,
  });

  archive.pipe(res);

  for (const file of files) {
    const stream = await this.s3Service.getFileStream(file.path);
    archive.append(stream, { name: file.originalName });
  }

  await archive.finalize();
}
```

---

## Best Practices

### ✅ File Upload Checklist

- [ ] Validate file type (MIME type + magic bytes)
- [ ] Limit file size appropriately
- [ ] Sanitize filenames
- [ ] Use unique filenames (prevent collisions)
- [ ] Scan for viruses (production)
- [ ] Store metadata in database
- [ ] Use cloud storage for production (S3, etc.)
- [ ] Generate thumbnails for images
- [ ] Implement access control
- [ ] Track upload progress for large files

### ✅ Security Checklist

- [ ] Never trust client-supplied MIME types
- [ ] Verify actual file type from content
- [ ] Store files outside web root
- [ ] Use pre-signed URLs for access
- [ ] Implement rate limiting
- [ ] Audit file access
- [ ] Encrypt sensitive files at rest
- [ ] Use HTTPS for all transfers
- [ ] Implement virus scanning
- [ ] Validate file content (e.g., parse PDFs)

### ✅ Performance Checklist

- [ ] Use streaming for large files
- [ ] Implement chunked uploads for files > 10MB
- [ ] Use CDN for static file delivery
- [ ] Compress images automatically
- [ ] Generate multiple sizes for images
- [ ] Implement caching headers
- [ ] Use range requests for video/audio
- [ ] Clean up temporary files
- [ ] Monitor storage usage
- [ ] Implement file retention policies

---

## Related Patterns

- **Pattern 39**: [Security Patterns Guide](./39-Security-Patterns-Guide.md)
- **Pattern 41**: [REST API Best Practices](./41-REST-API-Best-Practices.md)
- **Pattern 45**: [Background Job Patterns](./45-Background-Job-Patterns.md)

---

## References

- [Multer Documentation](https://github.com/expressjs/multer)
- [AWS S3 SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [File Type Detection](https://github.com/sindresorhus/file-type)

---

**Last Updated**: October 8, 2025
**Version**: 1.0
**Status**: Active
