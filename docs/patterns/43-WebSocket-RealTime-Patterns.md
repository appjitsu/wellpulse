# Pattern 43: WebSocket & Real-Time Communication Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [WebSocket Fundamentals](#websocket-fundamentals)
3. [Socket.IO Integration](#socketio-integration)
4. [Event-Driven Architecture](#event-driven-architecture)
5. [Room & Namespace Management](#room--namespace-management)
6. [Authentication & Authorization](#authentication--authorization)
7. [Message Patterns](#message-patterns)
8. [Scaling WebSockets](#scaling-websockets)
9. [Error Handling & Reconnection](#error-handling--reconnection)
10. [Performance Optimization](#performance-optimization)
11. [Testing WebSockets](#testing-websockets)

---

## Overview

Real-time communication enables instant bidirectional data flow between clients and servers, essential for collaborative features, live updates, and interactive experiences.

### When to Use WebSockets

**✅ Use WebSockets For**:

- Real-time collaboration (time tracking, project updates)
- Live notifications and alerts
- Chat and messaging systems
- Live dashboards and analytics
- Multiplayer features
- Real-time data streaming

**❌ Use REST/Polling For**:

- Infrequent updates (< 1 per minute)
- Request-response patterns
- File uploads/downloads
- Simple CRUD operations
- Public API endpoints

### WebSocket vs Alternatives

| Technology             | Latency | Complexity | Bidirectional        | Browser Support |
| ---------------------- | ------- | ---------- | -------------------- | --------------- |
| **WebSocket**          | Low     | Medium     | ✅                   | Modern browsers |
| **Server-Sent Events** | Low     | Low        | ❌ (server → client) | Modern browsers |
| **Long Polling**       | Medium  | Low        | ❌                   | All browsers    |
| **Short Polling**      | High    | Low        | ❌                   | All browsers    |

---

## WebSocket Fundamentals

### 1. WebSocket Lifecycle

```
Client                          Server
  |                                |
  |---- HTTP Upgrade Request ---→ |
  |←--- 101 Switching Protocols -- |
  |                                |
  |←------ WebSocket Open ------→ |
  |                                |
  |←----- Bidirectional Data ---→ |
  |                                |
  |←-------- WebSocket Close ---→ |
```

### 2. Native WebSocket (Client)

```typescript
// Client-side vanilla WebSocket
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  console.log('Connected to server');
  ws.send(JSON.stringify({ type: 'subscribe', room: 'time-entries' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from server');
};
```

### 3. Native WebSocket (Server - NestJS)

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}
```

---

## Socket.IO Integration

### 1. Server Setup (NestJS)

```typescript
// events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/events', // Optional namespace
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly eventBus: EventBus) {}

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
    console.log(`Total clients: ${this.server.sockets.size}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket): string {
    console.log('Received message:', data);
    return 'Message received!';
  }
}
```

### 2. Client Setup (React)

```typescript
// hooks/useSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  url: string;
  namespace?: string;
  auth?: {
    token: string;
  };
  autoConnect?: boolean;
}

export function useSocket({ url, namespace = '', auth, autoConnect = true }: UseSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${url}${namespace}`, {
      auth,
      autoConnect,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.close();
    };
  }, [url, namespace, auth, autoConnect]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
```

**Usage**:

```typescript
function TimeTrackingDashboard() {
  const { socket, isConnected } = useSocket({
    url: 'http://localhost:3001',
    namespace: '/time-tracking',
    auth: {
      token: localStorage.getItem('accessToken') || '',
    },
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('time-entry:created', (data) => {
      console.log('New time entry:', data);
      // Update UI
    });

    socket.on('time-entry:updated', (data) => {
      console.log('Time entry updated:', data);
      // Update UI
    });

    return () => {
      socket.off('time-entry:created');
      socket.off('time-entry:updated');
    };
  }, [socket]);

  return (
    <div>
      <StatusIndicator connected={isConnected} />
      {/* Dashboard content */}
    </div>
  );
}
```

---

## Event-Driven Architecture

### 1. Event Broadcasting

**Server-Side Event Handler**:

```typescript
// Domain Event Handler
@EventsHandler(TimeEntryCreatedEvent)
export class OnTimeEntryCreatedHandler implements IEventHandler<TimeEntryCreatedEvent> {
  constructor(private readonly eventsGateway: EventsGateway) {}

  async handle(event: TimeEntryCreatedEvent): Promise<void> {
    // Broadcast to all clients in the organization room
    this.eventsGateway.server
      .to(`organization:${event.timeEntry.organizationId}`)
      .emit('time-entry:created', {
        id: event.timeEntry.id,
        userId: event.timeEntry.userId,
        projectId: event.timeEntry.projectId,
        hours: event.timeEntry.hours,
        date: event.timeEntry.date,
        createdAt: event.timeEntry.createdAt,
      });
  }
}
```

### 2. Event Subscription Pattern

```typescript
@WebSocketGateway()
export class EventsGateway {
  @SubscribeMessage('subscribe')
  @UseGuards(WsJwtGuard)
  handleSubscribe(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket): void {
    const user = client.data.user;

    // Validate user has access to this room
    if (data.room.startsWith('organization:')) {
      const organizationId = data.room.split(':')[1];
      if (user.organizationId !== organizationId) {
        client.emit('error', { message: 'Access denied to this room' });
        return;
      }
    }

    client.join(data.room);
    client.emit('subscribed', { room: data.room });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(data.room);
    client.emit('unsubscribed', { room: data.room });
  }
}
```

**Client**:

```typescript
useEffect(() => {
  if (!socket) return;

  // Subscribe to organization events
  socket.emit('subscribe', { room: `organization:${organizationId}` });

  // Subscribe to user-specific events
  socket.emit('subscribe', { room: `user:${userId}` });

  return () => {
    socket.emit('unsubscribe', { room: `organization:${organizationId}` });
    socket.emit('unsubscribe', { room: `user:${userId}` });
  };
}, [socket, organizationId, userId]);
```

---

## Room & Namespace Management

### 1. Namespaces for Feature Separation

```typescript
// time-tracking.gateway.ts
@WebSocketGateway({
  namespace: '/time-tracking',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class TimeTrackingGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('start-timer')
  @UseGuards(WsJwtGuard)
  handleStartTimer(@MessageBody() data: { projectId: string }, @ConnectedSocket() client: Socket) {
    const user = client.data.user;
    // Start timer logic
    this.server
      .to(`user:${user.userId}`)
      .emit('timer:started', { projectId: data.projectId, startedAt: new Date() });
  }
}

// notifications.gateway.ts
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('mark-read')
  @UseGuards(WsJwtGuard)
  handleMarkRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Mark notification as read
  }
}
```

### 2. Room Patterns

**Organization Rooms**:

```typescript
// Join organization room on connection
handleConnection(client: Socket) {
  const user = client.data.user;
  if (user?.organizationId) {
    client.join(`organization:${user.organizationId}`);
    console.log(`User ${user.userId} joined organization room`);
  }
}

// Broadcast to organization
broadcastToOrganization(organizationId: string, event: string, data: any) {
  this.server.to(`organization:${organizationId}`).emit(event, data);
}
```

**User-Specific Rooms**:

```typescript
// Join user room
handleConnection(client: Socket) {
  const user = client.data.user;
  if (user?.userId) {
    client.join(`user:${user.userId}`);
  }
}

// Send to specific user
sendToUser(userId: string, event: string, data: any) {
  this.server.to(`user:${userId}`).emit(event, data);
}
```

**Project Rooms** (Dynamic):

```typescript
@SubscribeMessage('join-project')
@UseGuards(WsJwtGuard)
handleJoinProject(
  @MessageBody() data: { projectId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = client.data.user;

  // Verify user has access to project
  const hasAccess = await this.projectService.userHasAccess(
    user.userId,
    data.projectId,
  );

  if (!hasAccess) {
    client.emit('error', { message: 'Access denied to project' });
    return;
  }

  client.join(`project:${data.projectId}`);
  client.emit('joined-project', { projectId: data.projectId });
}
```

---

## Authentication & Authorization

### 1. JWT Authentication for WebSockets

```typescript
// ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token);

      // Attach user to socket
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
      };

      return true;
    } catch (error) {
      throw new WsException('Invalid token');
    }
  }

  private extractToken(client: any): string | null {
    // Try auth handshake first
    const authToken = client.handshake?.auth?.token;
    if (authToken) return authToken;

    // Try Authorization header
    const authorization = client.handshake?.headers?.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.substring(7);
    }

    // Try query parameter
    const queryToken = client.handshake?.query?.token;
    if (queryToken) return queryToken;

    return null;
  }
}
```

### 2. Middleware Authentication

```typescript
@WebSocketGateway()
export class EventsGateway implements OnGatewayConnection {
  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = await this.jwtService.verifyAsync(token);

      // Attach user data to socket
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
      };

      // Join organization room
      client.join(`organization:${payload.organizationId}`);
      client.join(`user:${payload.sub}`);

      console.log(`Authenticated user ${payload.email} connected`);
    } catch (error) {
      console.error('Authentication failed:', error);
      client.disconnect();
    }
  }
}
```

### 3. Role-Based Authorization

```typescript
// ws-roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!requiredRoles) {
      return true;
    }

    const client = context.switchToWs().getClient();
    const user = client.data.user;

    if (!user) {
      throw new WsException('User not authenticated');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new WsException('Insufficient permissions');
    }

    return true;
  }
}

// Usage
@SubscribeMessage('delete-project')
@UseGuards(WsJwtGuard, WsRolesGuard)
@Roles('ORG_OWNER', 'ADMIN')
handleDeleteProject(@MessageBody() data: { projectId: string }) {
  // Only ORG_OWNER and ADMIN can delete projects
}
```

---

## Message Patterns

### 1. Request-Response Pattern

```typescript
// Server
@SubscribeMessage('get-active-timer')
@UseGuards(WsJwtGuard)
async handleGetActiveTimer(
  @ConnectedSocket() client: Socket,
): Promise<{ timer: any | null }> {
  const user = client.data.user;
  const timer = await this.timerService.getActiveTimer(user.userId);
  return { timer };
}

// Client
socket.emit('get-active-timer', (response) => {
  console.log('Active timer:', response.timer);
});
```

### 2. Broadcast Pattern

```typescript
// Server - Broadcast to all clients
@SubscribeMessage('broadcast-message')
@UseGuards(WsJwtGuard)
handleBroadcast(@MessageBody() data: { message: string }) {
  this.server.emit('message-broadcast', data);
}

// Server - Broadcast to all except sender
@SubscribeMessage('broadcast-except-me')
@UseGuards(WsJwtGuard)
handleBroadcastExceptMe(
  @MessageBody() data: { message: string },
  @ConnectedSocket() client: Socket,
) {
  client.broadcast.emit('message', data);
}
```

### 3. Typing Indicator Pattern

```typescript
// Server
@SubscribeMessage('typing:start')
@UseGuards(WsJwtGuard)
handleTypingStart(
  @MessageBody() data: { projectId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = client.data.user;

  client.broadcast
    .to(`project:${data.projectId}`)
    .emit('user:typing', {
      userId: user.userId,
      userName: `${user.firstName} ${user.lastName}`,
      projectId: data.projectId,
    });
}

@SubscribeMessage('typing:stop')
@UseGuards(WsJwtGuard)
handleTypingStop(
  @MessageBody() data: { projectId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = client.data.user;

  client.broadcast
    .to(`project:${data.projectId}`)
    .emit('user:stopped-typing', {
      userId: user.userId,
      projectId: data.projectId,
    });
}

// Client
const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

useEffect(() => {
  if (!socket) return;

  socket.on('user:typing', ({ userId, userName }) => {
    setTypingUsers((prev) => new Set(prev).add(userName));
  });

  socket.on('user:stopped-typing', ({ userId }) => {
    setTypingUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  });

  return () => {
    socket.off('user:typing');
    socket.off('user:stopped-typing');
  };
}, [socket]);
```

### 4. Presence Pattern

```typescript
// Server
private onlineUsers = new Map<string, Set<string>>(); // organizationId → Set<userId>

handleConnection(client: Socket) {
  const user = client.data.user;
  if (!user) return;

  // Add user to online set
  if (!this.onlineUsers.has(user.organizationId)) {
    this.onlineUsers.set(user.organizationId, new Set());
  }
  this.onlineUsers.get(user.organizationId)!.add(user.userId);

  // Notify organization members
  client.broadcast
    .to(`organization:${user.organizationId}`)
    .emit('user:online', {
      userId: user.userId,
      email: user.email,
    });

  // Send current online users to new connection
  const onlineUserIds = Array.from(
    this.onlineUsers.get(user.organizationId) || [],
  );
  client.emit('users:online', { userIds: onlineUserIds });
}

handleDisconnect(client: Socket) {
  const user = client.data.user;
  if (!user) return;

  // Remove from online set
  this.onlineUsers.get(user.organizationId)?.delete(user.userId);

  // Notify organization members
  client.broadcast
    .to(`organization:${user.organizationId}`)
    .emit('user:offline', {
      userId: user.userId,
    });
}
```

---

## Scaling WebSockets

### 1. Redis Adapter for Multi-Server

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(3001);
}
```

### 2. Sticky Sessions (Load Balancer)

**Nginx Configuration**:

```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions based on IP
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;

    location /socket.io/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Horizontal Scaling Strategy

```typescript
// Use Redis for pub/sub across servers
@Injectable()
export class WebSocketScaler {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly eventsGateway: EventsGateway,
  ) {
    this.subscribeToRedis();
  }

  private subscribeToRedis() {
    this.redis.subscribe('ws:broadcast', (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err);
      }
    });

    this.redis.on('message', (channel, message) => {
      if (channel === 'ws:broadcast') {
        const { event, data, room } = JSON.parse(message);
        if (room) {
          this.eventsGateway.server.to(room).emit(event, data);
        } else {
          this.eventsGateway.server.emit(event, data);
        }
      }
    });
  }

  broadcastAcrossServers(event: string, data: any, room?: string) {
    this.redis.publish('ws:broadcast', JSON.stringify({ event, data, room }));
  }
}
```

---

## Error Handling & Reconnection

### 1. Client-Side Reconnection

```typescript
export function useSocket({ url, auth }: UseSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(url, {
      auth,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('Connected');
      setIsConnected(true);
      setReconnectAttempts(0);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        // Server disconnected, manually reconnect
        socket.connect();
      }
    });

    socket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      setReconnectAttempts(attemptNumber);
    });

    socket.io.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
    });

    socketRef.current = socket;

    return () => {
      socket.close();
    };
  }, [url, auth]);

  return { socket: socketRef.current, isConnected, reconnectAttempts };
}
```

### 2. Server-Side Error Handling

```typescript
@WebSocketGateway()
export class EventsGateway {
  @SubscribeMessage('risky-operation')
  @UseGuards(WsJwtGuard)
  async handleRiskyOperation(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    try {
      const result = await this.riskyService.performOperation(data);
      client.emit('operation:success', result);
    } catch (error) {
      console.error('Operation failed:', error);
      client.emit('operation:error', {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      });
    }
  }

  @Catch()
  handleException(exception: any, client: Socket) {
    console.error('WebSocket exception:', exception);
    client.emit('error', {
      message: 'An error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Performance Optimization

### 1. Message Throttling/Debouncing

```typescript
// Client-side throttling
import { throttle } from 'lodash';

const emitMouseMove = throttle((socket, position) => {
  socket.emit('mouse:move', position);
}, 100); // Max 10 messages per second

function handleMouseMove(event) {
  emitMouseMove(socket, { x: event.clientX, y: event.clientY });
}
```

### 2. Binary Data

```typescript
// Server - Send binary data
@SubscribeMessage('request-image')
handleRequestImage(@ConnectedSocket() client: Socket) {
  const imageBuffer = fs.readFileSync('path/to/image.png');
  client.emit('image:data', imageBuffer);
}

// Client - Receive binary data
socket.on('image:data', (buffer) => {
  const blob = new Blob([buffer], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  // Use image URL
});
```

### 3. Compression

```typescript
// Enable compression
@WebSocketGateway({
  cors: { origin: '*' },
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    threshold: 1024, // Only compress messages > 1KB
  },
})
export class EventsGateway {}
```

---

## Testing WebSockets

### 1. Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { EventsGateway } from './events.gateway';
import { Socket } from 'socket.io';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockClient: Partial<Socket>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get(EventsGateway);

    mockClient = {
      id: 'test-client-id',
      data: {
        user: {
          userId: 'user-123',
          organizationId: 'org-123',
        },
      },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };
  });

  it('should subscribe to room', () => {
    gateway.handleSubscribe({ room: 'organization:org-123' }, mockClient as Socket);

    expect(mockClient.join).toHaveBeenCalledWith('organization:org-123');
    expect(mockClient.emit).toHaveBeenCalledWith('subscribed', {
      room: 'organization:org-123',
    });
  });
});
```

### 2. Integration Tests

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';

describe('WebSocket Integration', () => {
  let app: INestApplication;
  let client: Socket;
  let token: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3001);

    // Get auth token
    token = await getAuthToken();
  });

  beforeEach((done) => {
    client = io('http://localhost:3001', {
      auth: { token },
    });

    client.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (client.connected) {
      client.disconnect();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('should connect with valid token', (done) => {
    expect(client.connected).toBe(true);
    done();
  });

  it('should receive time entry created event', (done) => {
    client.on('time-entry:created', (data) => {
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('hours');
      done();
    });

    // Create time entry via REST API
    createTimeEntry({ hours: 8, projectId: 'proj-123' });
  });
});
```

---

## Summary

### WebSocket Best Practices Checklist

#### ✅ Connection Management

- [ ] Implement authentication on connection
- [ ] Auto-reconnect on disconnect
- [ ] Handle connection errors gracefully
- [ ] Track connection state
- [ ] Clean up on unmount/disconnect

#### ✅ Message Handling

- [ ] Validate all incoming messages
- [ ] Throttle/debounce high-frequency events
- [ ] Use binary for large payloads
- [ ] Implement request-response pattern
- [ ] Handle message errors

#### ✅ Scaling

- [ ] Use Redis adapter for multi-server
- [ ] Implement sticky sessions
- [ ] Compress messages > 1KB
- [ ] Monitor active connections
- [ ] Rate limit messages per client

#### ✅ Security

- [ ] Authenticate on connection
- [ ] Authorize room access
- [ ] Sanitize all inputs
- [ ] Implement rate limiting
- [ ] Use secure WebSocket (wss://)

#### ✅ Testing

- [ ] Unit test event handlers
- [ ] Integration test workflows
- [ ] Load test concurrent connections
- [ ] Test reconnection logic
- [ ] Test error scenarios

---

## Related Patterns

- **Pattern 12**: [Observer Pattern](./12-Observer-Pattern.md)
- **Pattern 39**: [Security Patterns Guide](./39-Security-Patterns-Guide.md)
- **Pattern 42**: [GraphQL API Patterns](./42-GraphQL-API-Patterns.md)

---

## References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [WebSocket Protocol (RFC 6455)](https://tools.ietf.org/html/rfc6455)
- [Redis Adapter](https://socket.io/docs/v4/redis-adapter/)

---

**Last Updated**: October 8, 2025
**Version**: 1.0
**Status**: Active
