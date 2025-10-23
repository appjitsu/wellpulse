# Pattern 45: Background Job & Task Queue Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [BullMQ Integration](#bullmq-integration)
3. [Job Types & Patterns](#job-types--patterns)
4. [Job Scheduling](#job-scheduling)
5. [Job Prioritization](#job-prioritization)
6. [Error Handling & Retries](#error-handling--retries)
7. [Progress Tracking](#progress-tracking)
8. [Job Coordination](#job-coordination)
9. [Monitoring & Debugging](#monitoring--debugging)
10. [Best Practices](#best-practices)

---

## Overview

Background jobs handle time-consuming tasks asynchronously, improving responsiveness and enabling scheduled operations.

### Use Cases in WellPulse

- **Email Sending**: Welcome emails, password resets, notifications
- **Report Generation**: PDF invoices, time sheets, financial reports
- **Data Aggregation**: Daily revenue calculations, time tracking summaries
- **Cleanup Jobs**: Expired tokens, old audit logs, soft-deleted records
- **External API Calls**: QuickBooks sync, payment processing
- **Bulk Operations**: Mass user imports, batch invoice generation

---

## BullMQ Integration

### 1. Setup

```bash
pnpm add @nestjs/bull bullmq ioredis
```

```typescript
// queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'reports' },
      { name: 'cleanup' },
      { name: 'integrations' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

### 2. Creating a Queue

```typescript
// email.queue.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';

export interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  data: any;
}

@Injectable()
export class EmailQueue {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    await this.emailQueue.add(
      'send-welcome-email',
      {
        to: email,
        subject: 'Welcome to WellPulse',
        template: 'welcome',
        data: { userId },
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    await this.emailQueue.add(
      'send-password-reset',
      {
        to: email,
        subject: 'Reset Your Password',
        template: 'password-reset',
        data: { token },
      },
      {
        priority: 1, // High priority
        attempts: 3,
      },
    );
  }

  async sendBulkEmails(emails: SendEmailJobData[]): Promise<void> {
    const jobs = emails.map((email) => ({
      name: 'send-email',
      data: email,
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }));

    await this.emailQueue.addBulk(jobs);
  }
}
```

### 3. Processing Jobs

```typescript
// email.processor.ts
import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bullmq';
import { SendEmailJobData } from './email.queue';

@Processor('email')
export class EmailProcessor {
  constructor(private readonly emailService: EmailService) {}

  @Process('send-welcome-email')
  async handleWelcomeEmail(job: Job<SendEmailJobData>) {
    const { to, data } = job.data;

    console.log(`Processing welcome email for: ${to}`);

    await this.emailService.sendWelcomeEmail(to, data);

    return { sent: true, to };
  }

  @Process('send-password-reset')
  async handlePasswordReset(job: Job<SendEmailJobData>) {
    const { to, data } = job.data;

    await this.emailService.sendPasswordResetEmail(to, data.token);

    return { sent: true, to };
  }

  @Process({ name: 'send-email', concurrency: 5 })
  async handleEmail(job: Job<SendEmailJobData>) {
    const { to, subject, template, data } = job.data;

    await this.emailService.send({
      to,
      subject,
      template,
      data,
    });

    // Update progress
    await job.updateProgress(100);

    return { sent: true, to };
  }

  @OnQueueActive()
  onActive(job: Job) {
    console.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job, result: any) {
    console.log(`Job ${job.id} completed with result:`, result);
  }

  @OnQueueFailed()
  onError(job: Job, error: Error) {
    console.error(`Job ${job.id} failed with error:`, error.message);
  }
}
```

---

## Job Types & Patterns

### 1. One-Time Jobs

```typescript
@Injectable()
export class ReportQueue {
  constructor(@InjectQueue('reports') private readonly reportQueue: Queue) {}

  async generateInvoice(invoiceId: string): Promise<string> {
    const job = await this.reportQueue.add('generate-invoice', {
      invoiceId,
      format: 'pdf',
    });

    return job.id;
  }
}

@Processor('reports')
export class ReportProcessor {
  @Process('generate-invoice')
  async handleGenerateInvoice(job: Job<{ invoiceId: string; format: string }>) {
    const { invoiceId, format } = job.data;

    // Generate PDF
    const pdfBuffer = await this.invoiceService.generatePDF(invoiceId);

    // Upload to S3
    const key = `invoices/${invoiceId}.${format}`;
    await this.s3Service.uploadFile(pdfBuffer, key);

    return { key, size: pdfBuffer.length };
  }
}
```

### 2. Recurring Jobs (Cron)

```typescript
@Injectable()
export class ScheduledJobs {
  constructor(@InjectQueue('cleanup') private readonly cleanupQueue: Queue) {}

  async scheduleCleanupJobs() {
    // Run daily at 2 AM
    await this.cleanupQueue.add(
      'cleanup-expired-tokens',
      {},
      {
        repeat: {
          pattern: '0 2 * * *', // Cron expression
        },
      },
    );

    // Run every hour
    await this.cleanupQueue.add(
      'cleanup-pending-users',
      {},
      {
        repeat: {
          every: 3600000, // 1 hour in milliseconds
        },
      },
    );
  }
}

@Processor('cleanup')
export class CleanupProcessor {
  @Process('cleanup-expired-tokens')
  async cleanupExpiredTokens(job: Job) {
    const deleted = await this.tokenRepository.deleteExpired();
    console.log(`Cleaned up ${deleted} expired tokens`);
    return { deleted };
  }

  @Process('cleanup-pending-users')
  async cleanupPendingUsers(job: Job) {
    const result = await this.commandBus.execute(new ExpirePendingUsersCommand());
    return { expired: result.count };
  }
}
```

### 3. Delayed Jobs

```typescript
@Injectable()
export class NotificationQueue {
  constructor(@InjectQueue('notifications') private readonly queue: Queue) {}

  async sendReminder(userId: string, reminderText: string, delayMs: number) {
    await this.queue.add(
      'send-reminder',
      { userId, reminderText },
      {
        delay: delayMs, // Delay in milliseconds
      },
    );
  }

  async sendTrialExpirationWarning(userId: string, trialEndsAt: Date) {
    const threeDaysBeforeMs = trialEndsAt.getTime() - 3 * 24 * 60 * 60 * 1000;
    const delayMs = threeDaysBeforeMs - Date.now();

    if (delayMs > 0) {
      await this.queue.add('trial-expiration-warning', { userId }, { delay: delayMs });
    }
  }
}
```

### 4. Child Jobs (Job Flows)

```typescript
import { FlowProducer } from 'bullmq';

@Injectable()
export class JobFlowService {
  private flowProducer: FlowProducer;

  constructor() {
    this.flowProducer = new FlowProducer({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    });
  }

  async processMonthlyInvoicing(organizationId: string) {
    // Create a flow of dependent jobs
    await this.flowProducer.add({
      name: 'monthly-invoicing',
      queueName: 'invoicing',
      data: { organizationId },
      children: [
        {
          name: 'calculate-billable-hours',
          queueName: 'calculations',
          data: { organizationId },
          children: [
            {
              name: 'generate-invoice-pdf',
              queueName: 'reports',
              data: { organizationId },
            },
            {
              name: 'send-invoice-email',
              queueName: 'email',
              data: { organizationId },
            },
          ],
        },
      ],
    });
  }
}
```

---

## Job Scheduling

### 1. Cron Jobs

```typescript
@Injectable()
export class SchedulerService {
  constructor(@InjectQueue('scheduled-tasks') private readonly queue: Queue) {}

  async onModuleInit() {
    // Daily report at 8 AM
    await this.queue.add(
      'daily-revenue-report',
      {},
      {
        repeat: {
          pattern: '0 8 * * *',
          tz: 'America/New_York',
        },
      },
    );

    // Weekly summary on Mondays at 9 AM
    await this.queue.add(
      'weekly-summary',
      {},
      {
        repeat: {
          pattern: '0 9 * * 1',
        },
      },
    );

    // Monthly billing on 1st of month at midnight
    await this.queue.add(
      'monthly-billing',
      {},
      {
        repeat: {
          pattern: '0 0 1 * *',
        },
      },
    );

    // Every 15 minutes
    await this.queue.add(
      'sync-time-entries',
      {},
      {
        repeat: {
          every: 900000, // 15 minutes
        },
      },
    );
  }

  async removeScheduledJob(jobName: string) {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.name === jobName);

    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }
}
```

### 2. Dynamic Scheduling

```typescript
@Injectable()
export class DynamicScheduler {
  constructor(@InjectQueue('dynamic') private readonly queue: Queue) {}

  async scheduleOrganizationReports(organizationId: string, schedule: string) {
    // Store schedule preference in database
    await this.organizationRepository.updateReportSchedule(organizationId, schedule);

    // Schedule job with user-defined cron
    await this.queue.add(
      `org-report:${organizationId}`,
      { organizationId },
      {
        repeat: {
          pattern: schedule,
        },
        jobId: `org-report:${organizationId}`,
      },
    );
  }

  async updateSchedule(organizationId: string, newSchedule: string) {
    // Remove old schedule
    await this.queue.removeRepeatableByKey(`org-report:${organizationId}`);

    // Add new schedule
    await this.scheduleOrganizationReports(organizationId, newSchedule);
  }
}
```

---

## Job Prioritization

```typescript
enum JobPriority {
  CRITICAL = 1, // Password resets, security alerts
  HIGH = 3, // User-initiated actions
  NORMAL = 5, // Background sync
  LOW = 7, // Cleanup, optimization
  BULK = 10, // Mass operations
}

@Injectable()
export class PrioritizedQueue {
  constructor(@InjectQueue('tasks') private readonly queue: Queue) {}

  async addCriticalTask(data: any) {
    await this.queue.add('critical-task', data, {
      priority: JobPriority.CRITICAL,
    });
  }

  async addUserAction(data: any) {
    await this.queue.add('user-action', data, {
      priority: JobPriority.HIGH,
    });
  }

  async addBackgroundSync(data: any) {
    await this.queue.add('background-sync', data, {
      priority: JobPriority.NORMAL,
    });
  }

  async addCleanup(data: any) {
    await this.queue.add('cleanup', data, {
      priority: JobPriority.LOW,
      delay: 60000, // Wait 1 minute before processing
    });
  }
}
```

---

## Error Handling & Retries

### 1. Exponential Backoff

```typescript
await this.queue.add(
  'unreliable-api-call',
  { url: 'https://api.example.com/data' },
  {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s, 16s, 32s
    },
  },
);
```

### 2. Custom Retry Logic

```typescript
@Process('external-api-call')
async handleExternalApiCall(job: Job) {
  const attempt = job.attemptsMade + 1;

  try {
    const response = await this.externalApiService.call(job.data.url);
    return response;
  } catch (error) {
    if (this.isRetryableError(error)) {
      if (attempt < 5) {
        throw error; // Will retry
      } else {
        // Max retries reached, send to dead letter queue
        await this.deadLetterQueue.add('failed-api-call', {
          originalJob: job.data,
          error: error.message,
          attempts: attempt,
        });

        throw new Error('Max retries exceeded');
      }
    } else {
      // Non-retryable error (e.g., 400 Bad Request)
      console.error('Non-retryable error:', error);
      throw error;
    }
  }
}

private isRetryableError(error: any): boolean {
  // Retry on network errors, 5xx errors, rate limits
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    (error.response?.status >= 500 && error.response?.status < 600) ||
    error.response?.status === 429 // Rate limit
  );
}
```

### 3. Dead Letter Queue

```typescript
@Injectable()
export class DeadLetterQueueHandler {
  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @Process('failed-job')
  async handleFailedJob(job: Job) {
    // Log failure
    await this.auditService.logJobFailure({
      jobId: job.data.originalJob.id,
      jobName: job.data.originalJob.name,
      error: job.data.error,
      attempts: job.data.attempts,
      failedAt: new Date(),
    });

    // Notify admin
    await this.notificationService.notifyAdmin({
      subject: 'Job Failed After All Retries',
      body: `Job ${job.data.originalJob.name} failed after ${job.data.attempts} attempts.\n\nError: ${job.data.error}`,
    });
  }

  async retryFailedJob(jobId: string) {
    // Manually retry a job from DLQ
    const job = await this.dlq.getJob(jobId);

    if (job) {
      const originalData = job.data.originalJob;
      // Add back to original queue
      await this.queue.add(originalData.name, originalData.data);
    }
  }
}
```

---

## Progress Tracking

### 1. Job Progress Updates

```typescript
@Process('generate-report')
async handleGenerateReport(job: Job<{ reportType: string; dateRange: DateRange }>) {
  const { reportType, dateRange } = job.data;

  // Step 1: Fetch data (20%)
  await job.updateProgress(0);
  const data = await this.fetchReportData(reportType, dateRange);
  await job.updateProgress(20);

  // Step 2: Process data (40%)
  const processed = await this.processData(data);
  await job.updateProgress(60);

  // Step 3: Generate PDF (20%)
  const pdf = await this.generatePDF(processed);
  await job.updateProgress(80);

  // Step 4: Upload (10%)
  const url = await this.s3Service.uploadFile(pdf, `reports/${job.id}.pdf`);
  await job.updateProgress(90);

  // Step 5: Send notification (10%)
  await this.notificationService.notify(`Report ready: ${url}`);
  await job.updateProgress(100);

  return { url, size: pdf.length };
}
```

### 2. Client-Side Progress Monitoring

```typescript
// Backend API endpoint to get job status
@Get('jobs/:jobId/status')
async getJobStatus(@Param('jobId') jobId: string) {
  const job = await this.queue.getJob(jobId);

  if (!job) {
    throw new NotFoundException('Job not found');
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: await job.isFailed() ? null : job.returnvalue,
    error: await job.isFailed() ? job.failedReason : null,
  };
}

// React hook for polling job status
function useJobStatus(jobId: string) {
  const [status, setStatus] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!jobId || isComplete) return;

    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/jobs/${jobId}/status`);
      const data = await response.json();

      setStatus(data);

      if (data.state === 'completed' || data.state === 'failed') {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, isComplete]);

  return { status, isComplete };
}
```

---

## Job Coordination

### 1. Job Locking (Prevent Duplicates)

```typescript
@Injectable()
export class UniqueJobService {
  constructor(
    @InjectQueue('unique-tasks') private readonly queue: Queue,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async addUniqueJob(jobName: string, data: any) {
    const lockKey = `job-lock:${jobName}:${JSON.stringify(data)}`;
    const lockTTL = 3600; // 1 hour

    // Try to acquire lock
    const acquired = await this.redis.set(lockKey, '1', 'EX', lockTTL, 'NX');

    if (!acquired) {
      console.log('Job already queued, skipping');
      return null;
    }

    // Add job
    const job = await this.queue.add(jobName, data, {
      jobId: lockKey, // Use lock key as job ID
    });

    return job.id;
  }
}
```

### 2. Rate Limiting

```typescript
@Injectable()
export class RateLimitedQueue {
  constructor(@InjectQueue('rate-limited') private readonly queue: Queue) {}

  async addJob(data: any) {
    await this.queue.add('limited-job', data, {
      limiter: {
        max: 10, // Maximum 10 jobs
        duration: 1000, // Per 1 second
      },
    });
  }
}

@Processor('rate-limited')
export class RateLimitedProcessor {
  @Process({ name: 'limited-job', concurrency: 2 })
  async handleJob(job: Job) {
    // Only 2 jobs will process concurrently
    // And only 10 jobs will be processed per second
    await this.processJob(job.data);
  }
}
```

### 3. Job Groups

```typescript
@Injectable()
export class BatchJobService {
  constructor(@InjectQueue('batch') private readonly queue: Queue) {}

  async processBatch(items: any[], batchId: string) {
    const jobs = items.map((item) => ({
      name: 'process-item',
      data: { item, batchId },
      opts: {
        group: {
          id: batchId,
        },
      },
    }));

    await this.queue.addBulk(jobs);

    // Wait for all jobs in group to complete
    await this.waitForBatch(batchId);
  }

  private async waitForBatch(batchId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const jobs = await this.queue.getJobs(['active', 'waiting', 'delayed']);
        const batchJobs = jobs.filter((j) => j.data.batchId === batchId);

        if (batchJobs.length === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }
}
```

---

## Monitoring & Debugging

### 1. Job Events & Logging

```typescript
@Injectable()
export class JobMonitoringService {
  constructor(
    @InjectQueue('monitored') private readonly queue: Queue,
    private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    // Monitor queue events
    this.queue.on('active', (job) => {
      this.logger.log(`Job ${job.id} started`);
    });

    this.queue.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed`, result);
    });

    this.queue.on('failed', (job, error) => {
      this.logger.error(`Job ${job.id} failed`, error.stack);
    });

    this.queue.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled`);
    });

    this.queue.on('progress', (job, progress) => {
      this.logger.debug(`Job ${job.id} progress: ${progress}%`);
    });
  }

  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
```

### 2. Bull Board (Admin UI)

```bash
pnpm add @bull-board/express @bull-board/api
```

```typescript
// bull-board.controller.ts
import { Controller, All, Req, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Controller('admin/queues')
export class BullBoardController {
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('reports') private reportsQueue: Queue,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(this.emailQueue), new BullMQAdapter(this.reportsQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  @All('*')
  admin(@Req() req, @Res() res) {
    this.serverAdapter.getRouter()(req, res);
  }
}
```

---

## Best Practices

### ✅ Job Design Checklist

- [ ] Keep jobs idempotent (safe to retry)
- [ ] Make jobs atomic (all or nothing)
- [ ] Store minimal data in job payload
- [ ] Set appropriate timeouts
- [ ] Implement proper error handling
- [ ] Use job IDs for deduplication
- [ ] Clean up completed jobs periodically
- [ ] Monitor queue size and processing time

### ✅ Performance Checklist

- [ ] Use concurrency appropriately
- [ ] Batch similar jobs
- [ ] Implement rate limiting for external APIs
- [ ] Use job priorities effectively
- [ ] Monitor memory usage
- [ ] Scale workers horizontally
- [ ] Use separate queues for different job types
- [ ] Implement circuit breakers for failing jobs

### ✅ Reliability Checklist

- [ ] Configure retries with backoff
- [ ] Implement dead letter queue
- [ ] Monitor failed jobs
- [ ] Set up alerts for queue buildup
- [ ] Log all job failures
- [ ] Handle worker crashes gracefully
- [ ] Use Redis persistence
- [ ] Test job recovery scenarios

---

## Related Patterns

- **Pattern 12**: [Observer Pattern](./12-Observer-Pattern.md)
- **Pattern 15**: [Retry Pattern](./15-Retry-Pattern.md)
- **Pattern 43**: [WebSocket & Real-Time Patterns](./43-WebSocket-RealTime-Patterns.md)
- **Pattern 46**: [Caching Strategy Patterns](./46-Caching-Strategy-Patterns.md)

---

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS Bull Integration](https://docs.nestjs.com/techniques/queues)
- [Redis Documentation](https://redis.io/documentation)
- [Job Queue Patterns](https://www.enterpriseintegrationpatterns.com/)

---

**Last Updated**: October 8, 2025
**Version**: 1.0
**Status**: Active
