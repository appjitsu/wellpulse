/**
 * SCADA Subscriber Service
 *
 * Subscribes to Redis Pub/Sub channels for SCADA readings from the Rust service.
 * Broadcasts readings to WebSocket clients via the SCADA Gateway.
 *
 * Architecture:
 * Rust SCADA Service → Redis Pub/Sub → This Subscriber → SCADA Gateway → Web Clients
 *
 * Channel Format: scada:readings:{tenantId}
 * Reading Format: See ScadaReading interface
 *
 * Security:
 * - Tenant isolation: Each tenant has a dedicated Redis channel
 * - Readings are validated before broadcasting
 * - Gateway enforces authentication and tenant access control
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * SCADA Reading from Rust Service
 * Published to Redis channel: scada:readings:{tenantId}
 */
export interface ScadaReading {
  timestamp: string; // ISO 8601 timestamp
  tenantId: string; // Tenant identifier (for validation)
  wellId: string; // Well identifier
  tagName: string; // SCADA tag name (e.g., "Casing_Pressure", "Flow_Rate")
  value: number; // Tag value
  quality: 'Good' | 'Bad' | 'Uncertain'; // OPC-UA quality indicator
  sourceProtocol: string; // Protocol source (e.g., "OPC-UA", "Modbus")
}

/**
 * Redis Pub/Sub Subscriber for SCADA Readings
 *
 * Subscribes to Redis channels and broadcasts readings to WebSocket clients.
 * Handles connection errors, reconnection, and graceful shutdown.
 */
@Injectable()
export class ScadaSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScadaSubscriberService.name);
  private redisSubscriber: Redis;
  private readonly subscribedChannels = new Set<string>();
  private messageHandler?: (tenantId: string, reading: ScadaReading) => void;

  constructor(private readonly configService: ConfigService) {
    // Create Redis subscriber client
    // Separate from main Redis client to avoid blocking pub/sub operations
    this.redisSubscriber = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
      retryStrategy: (times: number) => {
        // Exponential backoff with max 10s delay
        const delay = Math.min(times * 100, 10000);
        this.logger.warn(`Redis connection lost. Retrying in ${delay}ms...`);
        return delay;
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: null, // Required for pub/sub mode
    });

    // Connection event handlers
    this.redisSubscriber.on('connect', () => {
      this.logger.log('Redis subscriber connected');
    });

    this.redisSubscriber.on('ready', () => {
      this.logger.log('Redis subscriber ready');
    });

    this.redisSubscriber.on('error', (error: Error) => {
      this.logger.error('Redis subscriber error:', error.message);
    });

    this.redisSubscriber.on('close', () => {
      this.logger.warn('Redis subscriber connection closed');
    });

    this.redisSubscriber.on('reconnecting', () => {
      this.logger.log('Redis subscriber reconnecting...');
    });

    // Message handler
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Initialize subscriber on module startup
   * Subscribes to pattern: scada:readings:*
   */
  async onModuleInit(): Promise<void> {
    try {
      // Subscribe to all SCADA reading channels using pattern matching
      // Pattern: scada:readings:* matches scada:readings:{tenantId}
      await this.redisSubscriber.psubscribe('scada:readings:*');
      this.logger.log('Subscribed to SCADA reading channels: scada:readings:*');

      // Handle pattern-based messages
      this.redisSubscriber.on(
        'pmessage',
        (pattern: string, channel: string, message: string) => {
          this.handleMessage(channel, message);
        },
      );
    } catch (error) {
      this.logger.error('Failed to subscribe to SCADA channels:', error);
      throw error;
    }
  }

  /**
   * Cleanup on module shutdown
   * Unsubscribes from all channels and closes Redis connection
   */
  async onModuleDestroy(): Promise<void> {
    try {
      // Unsubscribe from all channels
      await this.redisSubscriber.punsubscribe('scada:readings:*');
      this.logger.log('Unsubscribed from SCADA reading channels');

      // Close Redis connection
      await this.redisSubscriber.quit();
      this.logger.log('Redis subscriber connection closed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Register message handler (called by SCADA Gateway)
   *
   * @param handler - Callback function to handle incoming readings
   */
  setMessageHandler(
    handler: (tenantId: string, reading: ScadaReading) => void,
  ): void {
    this.messageHandler = handler;
    this.logger.log('Message handler registered');
  }

  /**
   * Subscribe to tenant-specific SCADA channel
   *
   * @param tenantId - Tenant identifier
   */
  async subscribeToTenant(tenantId: string): Promise<void> {
    const channel = `scada:readings:${tenantId}`;

    if (this.subscribedChannels.has(channel)) {
      this.logger.debug(`Already subscribed to ${channel}`);
      return;
    }

    try {
      await this.redisSubscriber.subscribe(channel);
      this.subscribedChannels.add(channel);
      this.logger.log(`Subscribed to tenant channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from tenant-specific SCADA channel
   *
   * @param tenantId - Tenant identifier
   */
  async unsubscribeFromTenant(tenantId: string): Promise<void> {
    const channel = `scada:readings:${tenantId}`;

    if (!this.subscribedChannels.has(channel)) {
      this.logger.debug(`Not subscribed to ${channel}`);
      return;
    }

    try {
      await this.redisSubscriber.unsubscribe(channel);
      this.subscribedChannels.delete(channel);
      this.logger.log(`Unsubscribed from tenant channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming Redis message
   *
   * @param channel - Redis channel name (e.g., scada:readings:tenant123)
   * @param message - JSON message payload
   */
  private handleMessage(channel: string, message: string): void {
    try {
      // Extract tenant ID from channel name
      // Channel format: scada:readings:{tenantId}
      const tenantId = this.extractTenantId(channel);
      if (!tenantId) {
        this.logger.warn(`Invalid channel format: ${channel}`);
        return;
      }

      // Parse reading
      const reading = this.parseReading(message);
      if (!reading) {
        this.logger.warn(`Invalid reading format from ${channel}`);
        return;
      }

      // Validate tenant ID matches channel
      if (reading.tenantId !== tenantId) {
        this.logger.error(
          `Tenant ID mismatch: channel=${tenantId}, reading=${reading.tenantId}`,
        );
        return;
      }

      // Validate reading structure
      if (!this.validateReading(reading)) {
        this.logger.warn(`Invalid reading structure from ${channel}:`, reading);
        return;
      }

      // Forward to message handler (SCADA Gateway)
      if (this.messageHandler) {
        this.messageHandler(tenantId, reading);
      } else {
        this.logger.debug(
          `No message handler registered. Dropping reading from ${channel}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${channel}:`, error);
    }
  }

  /**
   * Extract tenant ID from channel name
   *
   * @param channel - Redis channel name
   * @returns Tenant ID or null if invalid format
   */
  private extractTenantId(channel: string): string | null {
    const match = channel.match(/^scada:readings:(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Parse reading from JSON string
   *
   * @param message - JSON message payload
   * @returns Parsed reading or null if invalid
   */
  private parseReading(message: string): ScadaReading | null {
    try {
      return JSON.parse(message) as ScadaReading;
    } catch {
      return null;
    }
  }

  /**
   * Validate reading structure
   *
   * @param reading - SCADA reading
   * @returns True if valid, false otherwise
   */
  private validateReading(reading: ScadaReading): boolean {
    return !!(
      reading.timestamp &&
      reading.tenantId &&
      reading.wellId &&
      reading.tagName &&
      typeof reading.value === 'number' &&
      ['Good', 'Bad', 'Uncertain'].includes(reading.quality) &&
      reading.sourceProtocol
    );
  }

  /**
   * Get list of subscribed channels (for debugging)
   *
   * @returns Array of subscribed channel names
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels);
  }
}
