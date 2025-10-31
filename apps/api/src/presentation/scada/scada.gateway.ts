/**
 * SCADA WebSocket Gateway
 *
 * Provides real-time SCADA data streaming to authenticated web clients.
 * Enforces tenant isolation - clients only receive data for their tenant.
 *
 * Architecture:
 * Rust SCADA Service → Redis Pub/Sub → Subscriber Service → This Gateway → Web Clients
 *
 * Endpoint: ws://localhost:4000/scada
 *
 * Authentication:
 * - JWT token via Authorization header or query parameter
 * - Tenant context extracted from JWT payload
 * - Clients can only subscribe to wells in their tenant
 *
 * Events:
 * - reading: New SCADA reading (server → client)
 * - subscribe-well: Subscribe to specific well (client → server)
 * - unsubscribe-well: Unsubscribe from specific well (client → server)
 *
 * Security:
 * - Tenant isolation: Readings filtered by tenant ID from JWT
 * - Authentication required for all connections
 * - Well-level access control: Only subscribe to wells in your tenant
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ScadaSubscriberService,
  ScadaReading,
} from '../../infrastructure/redis/scada-subscriber.service';

/**
 * Authenticated socket with user context
 */
interface AuthenticatedSocket extends Socket {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Subscribe/Unsubscribe well payload
 */
interface WellSubscriptionPayload {
  wellId: string;
}

/**
 * WebSocket Gateway for SCADA Real-Time Data
 *
 * Handles WebSocket connections, authentication, and real-time data broadcasting.
 * Enforces strict tenant isolation - clients only receive readings for their tenant.
 */
@WebSocketGateway({
  namespace: '/scada',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4001'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ScadaGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ScadaGateway.name);
  private readonly tenantSockets = new Map<string, Set<string>>(); // tenantId -> Set<socketId>
  private readonly wellSubscriptions = new Map<string, Set<string>>(); // wellId -> Set<socketId>

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly scadaSubscriber: ScadaSubscriberService,
  ) {}

  /**
   * Initialize WebSocket server
   */
  afterInit(): void {
    this.logger.log('SCADA WebSocket Gateway initialized');

    // Register message handler with subscriber service
    this.scadaSubscriber.setMessageHandler(
      (tenantId: string, reading: ScadaReading) => {
        this.broadcastReading(tenantId, reading);
      },
    );

    this.logger.log('Message handler registered with SCADA Subscriber');
  }

  /**
   * Handle new WebSocket connection
   *
   * Authenticates the client via JWT token.
   * Token can be provided via:
   * 1. Authorization header (Bearer token)
   * 2. Query parameter (token=xxx)
   *
   * @param client - WebSocket client
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract JWT token
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(
          `Connection rejected: No token provided (${client.id})`,
        );
        client.disconnect();
        return;
      }

      // Verify and decode JWT
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`Connection rejected: Invalid token (${client.id})`);
        client.disconnect();
        return;
      }

      // Attach user context to socket
      const authSocket = client as AuthenticatedSocket;
      authSocket.userId = payload.sub;
      authSocket.email = payload.email;
      authSocket.role = payload.role;
      authSocket.tenantId = payload.tenantId;

      // Track socket by tenant
      this.addTenantSocket(payload.tenantId, client.id);

      // Join tenant room (for broadcasting to all tenant sockets)
      await client.join(`tenant:${payload.tenantId}`);

      this.logger.log(
        `Client connected: ${client.id} (tenant=${payload.tenantId}, user=${payload.email})`,
      );

      // Acknowledge connection
      client.emit('connected', {
        message: 'Connected to SCADA real-time data stream',
        tenantId: payload.tenantId,
      });
    } catch (error) {
      this.logger.error(`Connection error (${client.id}):`, error);
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   *
   * @param client - WebSocket client
   */
  handleDisconnect(client: Socket): void {
    const authSocket = client as AuthenticatedSocket;

    // Remove socket from tenant tracking
    if (authSocket.tenantId) {
      this.removeTenantSocket(authSocket.tenantId, client.id);
    }

    // Remove socket from well subscriptions
    this.removeSocketFromAllWells(client.id);

    this.logger.log(
      `Client disconnected: ${client.id} (tenant=${authSocket.tenantId || 'unknown'})`,
    );
  }

  /**
   * Subscribe to specific well readings
   *
   * Client can subscribe to individual wells to receive only relevant readings.
   * If no wells are subscribed, client receives ALL readings for their tenant.
   *
   * @param data - Well subscription payload
   * @param client - WebSocket client
   */
  @SubscribeMessage('subscribe-well')
  async handleSubscribeWell(
    @MessageBody() data: WellSubscriptionPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const authSocket = client as AuthenticatedSocket;
    const { wellId } = data;

    if (!wellId) {
      this.logger.warn(
        `Invalid subscribe-well request from ${client.id}: Missing wellId`,
      );
      client.emit('error', { message: 'wellId is required' });
      return;
    }

    try {
      // Add socket to well subscription
      this.addWellSubscription(wellId, client.id);

      // Join well-specific room
      await client.join(`well:${wellId}`);

      this.logger.log(
        `Client ${client.id} subscribed to well ${wellId} (tenant=${authSocket.tenantId})`,
      );

      // Acknowledge subscription
      client.emit('subscribed', { wellId });
    } catch (error) {
      this.logger.error(`Error subscribing to well ${wellId}:`, error);
      client.emit('error', { message: 'Failed to subscribe to well' });
    }
  }

  /**
   * Unsubscribe from specific well readings
   *
   * @param data - Well subscription payload
   * @param client - WebSocket client
   */
  @SubscribeMessage('unsubscribe-well')
  async handleUnsubscribeWell(
    @MessageBody() data: WellSubscriptionPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const authSocket = client as AuthenticatedSocket;
    const { wellId } = data;

    if (!wellId) {
      this.logger.warn(
        `Invalid unsubscribe-well request from ${client.id}: Missing wellId`,
      );
      client.emit('error', { message: 'wellId is required' });
      return;
    }

    try {
      // Remove socket from well subscription
      this.removeWellSubscription(wellId, client.id);

      // Leave well-specific room
      await client.leave(`well:${wellId}`);

      this.logger.log(
        `Client ${client.id} unsubscribed from well ${wellId} (tenant=${authSocket.tenantId})`,
      );

      // Acknowledge unsubscription
      client.emit('unsubscribed', { wellId });
    } catch (error) {
      this.logger.error(`Error unsubscribing from well ${wellId}:`, error);
      client.emit('error', { message: 'Failed to unsubscribe from well' });
    }
  }

  /**
   * Broadcast SCADA reading to connected clients
   *
   * Enforces tenant isolation: Only sends reading to clients in the same tenant.
   * If clients have well-specific subscriptions, only sends to subscribed wells.
   *
   * @param tenantId - Tenant identifier
   * @param reading - SCADA reading
   */
  private broadcastReading(tenantId: string, reading: ScadaReading): void {
    try {
      // Get all sockets for this tenant
      const tenantSockets = this.tenantSockets.get(tenantId);
      if (!tenantSockets || tenantSockets.size === 0) {
        this.logger.debug(
          `No connected clients for tenant ${tenantId}. Skipping broadcast.`,
        );
        return;
      }

      // Check if well has specific subscribers
      const wellSubscribers = this.wellSubscriptions.get(reading.wellId);

      if (wellSubscribers && wellSubscribers.size > 0) {
        // Send to well-specific subscribers only
        wellSubscribers.forEach((socketId) => {
          // Verify socket is still in tenant (security check)
          if (tenantSockets.has(socketId)) {
            this.server.to(socketId).emit('reading', reading);
          }
        });

        this.logger.debug(
          `Broadcast reading to ${wellSubscribers.size} well subscribers (well=${reading.wellId}, tenant=${tenantId})`,
        );
      } else {
        // No well-specific subscriptions, broadcast to all tenant sockets
        this.server.to(`tenant:${tenantId}`).emit('reading', reading);

        this.logger.debug(
          `Broadcast reading to ${tenantSockets.size} tenant clients (well=${reading.wellId}, tenant=${tenantId})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error broadcasting reading (tenant=${tenantId}):`,
        error,
      );
    }
  }

  /**
   * Extract JWT token from socket connection
   *
   * @param client - WebSocket client
   * @returns JWT token or null
   */
  private extractToken(client: Socket): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter (token=xxx)
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  /**
   * Verify JWT token
   *
   * @param token - JWT token
   * @returns Decoded payload or null
   */
  private async verifyToken(token: string): Promise<{
    sub: string;
    email: string;
    role: string;
    tenantId: string;
  } | null> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        tenantId: string;
      }>(token, { secret });

      // Validate payload structure
      if (
        !payload.sub ||
        !payload.email ||
        !payload.role ||
        !payload.tenantId
      ) {
        throw new UnauthorizedException('Invalid JWT payload structure');
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Add socket to tenant tracking
   *
   * @param tenantId - Tenant identifier
   * @param socketId - Socket identifier
   */
  private addTenantSocket(tenantId: string, socketId: string): void {
    if (!this.tenantSockets.has(tenantId)) {
      this.tenantSockets.set(tenantId, new Set());
    }
    this.tenantSockets.get(tenantId)!.add(socketId);
  }

  /**
   * Remove socket from tenant tracking
   *
   * @param tenantId - Tenant identifier
   * @param socketId - Socket identifier
   */
  private removeTenantSocket(tenantId: string, socketId: string): void {
    const sockets = this.tenantSockets.get(tenantId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.tenantSockets.delete(tenantId);
      }
    }
  }

  /**
   * Add socket to well subscription
   *
   * @param wellId - Well identifier
   * @param socketId - Socket identifier
   */
  private addWellSubscription(wellId: string, socketId: string): void {
    if (!this.wellSubscriptions.has(wellId)) {
      this.wellSubscriptions.set(wellId, new Set());
    }
    this.wellSubscriptions.get(wellId)!.add(socketId);
  }

  /**
   * Remove socket from well subscription
   *
   * @param wellId - Well identifier
   * @param socketId - Socket identifier
   */
  private removeWellSubscription(wellId: string, socketId: string): void {
    const subscribers = this.wellSubscriptions.get(wellId);
    if (subscribers) {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.wellSubscriptions.delete(wellId);
      }
    }
  }

  /**
   * Remove socket from all well subscriptions
   *
   * @param socketId - Socket identifier
   */
  private removeSocketFromAllWells(socketId: string): void {
    this.wellSubscriptions.forEach((subscribers, wellId) => {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.wellSubscriptions.delete(wellId);
      }
    });
  }

  /**
   * Get connection statistics (for debugging/monitoring)
   */
  getConnectionStats(): {
    totalConnections: number;
    tenantCount: number;
    tenantConnections: Record<string, number>;
    wellSubscriptions: Record<string, number>;
  } {
    const tenantConnections: Record<string, number> = {};
    this.tenantSockets.forEach((sockets, tenantId) => {
      tenantConnections[tenantId] = sockets.size;
    });

    const wellSubscriptionCounts: Record<string, number> = {};
    this.wellSubscriptions.forEach((subscribers, wellId) => {
      wellSubscriptionCounts[wellId] = subscribers.size;
    });

    return {
      totalConnections: Array.from(this.tenantSockets.values()).reduce(
        (sum, sockets) => sum + sockets.size,
        0,
      ),
      tenantCount: this.tenantSockets.size,
      tenantConnections,
      wellSubscriptions: wellSubscriptionCounts,
    };
  }
}
