# Jest Testing Patterns

**Version**: 1.0
**Last Updated**: October 7, 2025

Comprehensive guide to testing patterns and best practices for Jest in the WellPulse project.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Testing Principles](#core-testing-principles)
3. [Test Organization](#test-organization)
4. [Mocking Patterns](#mocking-patterns)
5. [Domain Testing Patterns](#domain-testing-patterns)
6. [Application Layer Testing](#application-layer-testing)
7. [Infrastructure Testing](#infrastructure-testing)
8. [Presentation Layer Testing](#presentation-layer-testing)
9. [Common Pitfalls](#common-pitfalls)
10. [Best Practices](#best-practices)

---

## Overview

### Testing Strategy

Our testing approach follows the **Test Pyramid**:

```
        /\
       /E2E\       ← Few, high-value tests
      /------\
     /  INT   \    ← Moderate coverage
    /----------\
   /   UNIT     \  ← Extensive coverage
  /--------------\
```

**Coverage Requirements**:

- **Statements**: ≥80%
- **Branches**: ≥80%
- **Functions**: ≥80%
- **Lines**: ≥80%

### Test Types

1. **Unit Tests** - Test individual units in isolation
2. **Integration Tests** - Test interactions between components
3. **E2E Tests** - Test complete user flows (future)

---

## Core Testing Principles

### 1. AAA Pattern (Arrange-Act-Assert)

Always structure tests using the AAA pattern:

```typescript
it('should create user with valid email', () => {
  // Arrange - Set up test data and mocks
  const email = 'test@example.com';
  const mockRepo = { save: jest.fn() };

  // Act - Execute the code under test
  const user = User.create(email, 'John', 'Doe');

  // Assert - Verify the outcome
  expect(user.email.getValue()).toBe(email);
  expect(user.firstName).toBe('John');
});
```

### 2. Test Isolation

Each test must be independent and not rely on other tests:

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    // Fresh mocks for each test
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    service = new UserService(mockRepo);
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  it('test 1', () => {
    /* ... */
  });
  it('test 2', () => {
    /* ... */
  });
});
```

### 3. Test Documentation

Use JSDoc to document test suites:

```typescript
/**
 * Test Suite: ApprovePendingUserHandler
 *
 * Tests the approval workflow for pending user requests.
 * Verifies that:
 * - Pending users can be approved and converted to User entities
 * - User entities are created with correct properties (inactive state)
 * - PendingUserApprovedEvent is published with userId
 * - Proper error handling for not found, already approved, and expired cases
 * - Domain events are properly managed (published and cleared)
 */
describe('ApprovePendingUserHandler', () => {
  // Tests...
});
```

---

## Test Organization

### File Naming Conventions

```
src/
├── domain/
│   └── user/
│       ├── user.entity.ts
│       ├── user.entity.spec.ts          ← Unit test
│       └── email.vo.spec.ts
├── application/
│   └── auth/
│       └── commands/
│           ├── login.handler.ts
│           └── login.handler.spec.ts    ← Unit test
├── infrastructure/
│   └── database/
│       └── repositories/
│           ├── drizzle-user.repository.ts
│           └── drizzle-user.repository.spec.ts
└── presentation/
    └── auth/
        ├── auth.controller.ts
        └── auth.controller.spec.ts
```

### Test Suite Structure

```typescript
describe('EntityOrService', () => {
  // Setup
  let instance: EntityOrService;
  let dependencies: MockedDependencies;

  beforeEach(() => {
    // Arrange common setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should handle success case', () => {
      /* ... */
    });
    it('should handle error case', () => {
      /* ... */
    });
    it('should validate input', () => {
      /* ... */
    });
  });

  describe('anotherMethod', () => {
    it('should...', () => {
      /* ... */
    });
  });
});
```

---

## Mocking Patterns

### 1. Factory Functions (Recommended)

**Problem**: Shared mock objects get mutated across tests.

**Solution**: Use factory functions to create fresh instances.

```typescript
// ❌ BAD - Shared mock gets mutated
const mockUser = User.create(/* ... */);

describe('Tests', () => {
  it('test 1', () => {
    mockUser.activate(); // Mutates shared object!
  });

  it('test 2', () => {
    // This test now sees activated user!
  });
});

// ✅ GOOD - Factory creates fresh instances
const createMockUser = () => {
  const user = User.create(Email.create('test@example.com'), 'John', 'Doe');
  user.clearDomainEvents(); // Clear creation events
  return user;
};

describe('Tests', () => {
  it('test 1', () => {
    const user = createMockUser(); // Fresh instance
    user.activate();
  });

  it('test 2', () => {
    const user = createMockUser(); // Fresh instance
    // User is inactive
  });
});
```

### 2. Mock Repository Pattern

```typescript
describe('CommandHandler', () => {
  let handler: CommandHandler;
  let mockRepo: jest.Mocked<IRepository>;

  beforeEach(() => {
    // Create mock with jest.Mocked type
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IRepository>;

    handler = new CommandHandler(mockRepo);
  });

  it('should save entity', async () => {
    mockRepo.findById.mockResolvedValue(entity);

    await handler.execute(command);

    expect(mockRepo.save).toHaveBeenCalledWith(entity);
  });
});
```

### 3. Mock Chaining for Drizzle

```typescript
describe('DrizzleRepository', () => {
  let repository: DrizzleUserRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockRow]),
    };

    repository = new DrizzleUserRepository(mockDb);
  });

  it('should find by id', async () => {
    const result = await repository.findById(userId);

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(1);
  });
});
```

### 4. Mock Chaining with Multiple where() Calls

When your code calls `where()` multiple times, use `mockReturnValueOnce`:

```typescript
it('should update existing entity', async () => {
  // First where() in select chain
  mockDb.where.mockReturnValueOnce(mockDb);
  mockDb.limit.mockResolvedValue([mockRow]); // Found

  // Second where() in update chain
  mockDb.where.mockResolvedValue([]);

  await repository.save(entity);

  expect(mockDb.update).toHaveBeenCalled();
  expect(mockDb.where).toHaveBeenCalledTimes(2);
});
```

### 5. Transaction Mocking

```typescript
it('should use transaction if provided', async () => {
  // Create independent transaction mock
  const mockTx: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([mockRow]),
  };

  await repository.findById(id, mockTx);

  // Verify transaction was used, not main db
  expect(mockTx.select).toHaveBeenCalled();
  expect(mockDb.select).not.toHaveBeenCalled();
});
```

### 6. EventBus Mocking

```typescript
describe('EventPublishing', () => {
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
    } as jest.Mocked<EventBus>;
  });

  it('should publish domain events', async () => {
    await handler.execute(command);

    expect(eventBus.publish).toHaveBeenCalled();

    const publishedEvent = (eventBus.publish as jest.Mock).mock.calls[0][0];
    expect(publishedEvent).toBeInstanceOf(UserCreatedEvent);
    expect(publishedEvent.userId).toBe('user-123');
  });
});
```

### 7. Logger Mocking

```typescript
beforeEach(() => {
  // Suppress console output in tests
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
});
```

---

## Domain Testing Patterns

### 1. Entity Testing

```typescript
describe('User Entity', () => {
  describe('create', () => {
    it('should create user with valid data', () => {
      const email = Email.create('test@example.com');
      const user = User.create(email, 'John', 'Doe');

      expect(user.email).toBe(email);
      expect(user.firstName).toBe('John');
      expect(user.isActive()).toBe(false); // Method call, not property
    });

    it('should publish UserCreated event', () => {
      const user = User.create(/* ... */);

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
    });
  });

  describe('activate', () => {
    it('should activate inactive user', () => {
      const user = User.create(/* ... */);
      user.clearDomainEvents(); // Clear creation event

      user.activate();

      expect(user.isActive()).toBe(true);
      expect(user.getDomainEvents()).toHaveLength(1);
    });

    it('should throw when already active', () => {
      const user = User.create(/* ... */);
      user.activate();

      expect(() => user.activate()).toThrow('User is already active');
    });
  });
});
```

### 2. Value Object Testing

```typescript
describe('Email Value Object', () => {
  describe('create', () => {
    it('should create valid email', () => {
      const email = Email.create('test@example.com');
      expect(email.getValue()).toBe('test@example.com');
    });

    it('should throw for invalid format', () => {
      expect(() => Email.create('invalid')).toThrow('Invalid email format');
    });

    it('should throw for too long email', () => {
      const longEmail = 'a'.repeat(255) + '@example.com';
      expect(() => Email.create(longEmail)).toThrow();
    });
  });

  describe('equals', () => {
    it('should compare by value', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');

      expect(email1.equals(email2)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const email1 = Email.create('Test@Example.com');
      const email2 = Email.create('test@example.com');

      expect(email1.equals(email2)).toBe(true);
    });
  });
});
```

### 3. Domain Events Testing

```typescript
describe('Domain Events', () => {
  it('should clear events after retrieval', () => {
    const user = User.create(/* ... */);

    const events = user.getDomainEvents();
    expect(events).toHaveLength(1);

    user.clearDomainEvents();
    expect(user.getDomainEvents()).toHaveLength(0);
  });

  it('should accumulate multiple events', () => {
    const user = User.create(/* ... */);
    user.clearDomainEvents();

    user.activate();
    user.updateProfile('Jane', 'Smith');

    expect(user.getDomainEvents()).toHaveLength(2);
  });
});
```

---

## Application Layer Testing

### 1. Command Handler Testing

```typescript
describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      save: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn(),
    } as any;

    handler = new CreateUserHandler(mockUserRepo, mockEventBus);
  });

  it('should create user when email not exists', async () => {
    const command = new CreateUserCommand('test@example.com', 'John', 'Doe');

    mockUserRepo.findByEmail.mockResolvedValue(null);

    const userId = await handler.execute(command);

    expect(mockUserRepo.save).toHaveBeenCalledWith(expect.any(User));
    expect(userId).toBeDefined();
  });

  it('should throw when email already exists', async () => {
    const command = new CreateUserCommand(/* ... */);
    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(handler.execute(command)).rejects.toThrow('Email already in use');
  });

  it('should publish UserCreated event', async () => {
    const command = new CreateUserCommand(/* ... */);
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await handler.execute(command);

    expect(mockEventBus.publish).toHaveBeenCalled();
    const event = (mockEventBus.publish as jest.Mock).mock.calls[0][0];
    expect(event).toBeInstanceOf(UserCreatedEvent);
  });
});
```

### 2. Query Handler Testing

```typescript
describe('GetUserByIdHandler', () => {
  let handler: GetUserByIdHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
    } as any;

    handler = new GetUserByIdHandler(mockUserRepo);
  });

  it('should return user when found', async () => {
    const query = new GetUserByIdQuery('user-123');
    const mockUser = User.create(/* ... */);

    mockUserRepo.findById.mockResolvedValue(mockUser);

    const result = await handler.execute(query);

    expect(result).toBe(mockUser);
  });

  it('should throw NotFoundException when not found', async () => {
    const query = new GetUserByIdQuery('non-existent');
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });
});
```

### 3. Event Handler Testing

```typescript
describe('OnUserCreatedHandler', () => {
  let handler: OnUserCreatedHandler;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockEmailService = {
      sendWelcomeEmail: jest.fn(),
    } as any;

    handler = new OnUserCreatedHandler(mockEmailService);
  });

  it('should send welcome email', async () => {
    const event = new UserCreatedEvent('user-123', 'test@example.com', 'John');

    await handler.handle(event);

    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'John');
  });

  it('should handle email errors gracefully', async () => {
    const event = new UserCreatedEvent(/* ... */);
    mockEmailService.sendWelcomeEmail.mockRejectedValue(new Error('SMTP failed'));

    // Should not throw
    await expect(handler.handle(event)).resolves.not.toThrow();
  });
});
```

---

## Infrastructure Testing

### 1. Repository Testing

```typescript
describe('DrizzleUserRepository', () => {
  let repository: DrizzleUserRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    repository = new DrizzleUserRepository(mockDb);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockRow = {
        id: 'user-123',
        email: 'test@example.com',
        // ...
      };
      mockDb.limit.mockResolvedValue([mockRow]);

      const result = await repository.findById(UserId.create('user-123'));

      expect(result).toBeInstanceOf(User);
      expect(result?.id.getValue()).toBe('user-123');
    });

    it('should return null when not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById(UserId.create('non-existent'));

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should insert new user', async () => {
      const user = User.create(/* ... */);
      mockDb.limit.mockResolvedValue([]); // Not found

      await repository.save(user);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should update existing user', async () => {
      const user = User.fromPersistence(/* ... */);
      mockDb.limit.mockResolvedValue([mockRow]); // Found

      await repository.save(user);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
```

### 2. External Service Testing

```typescript
describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
    };

    service = new EmailService(mockTransporter);
  });

  it('should send email with correct params', async () => {
    await service.sendWelcomeEmail('test@example.com', 'John');

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: expect.stringContaining('Welcome'),
      html: expect.stringContaining('John'),
    });
  });

  it('should retry on transient errors', async () => {
    mockTransporter.sendMail
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ messageId: '123' });

    await service.sendWelcomeEmail('test@example.com', 'John');

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
  });
});
```

---

## Presentation Layer Testing

### 1. Controller Testing

```typescript
describe('UserController', () => {
  let controller: UserController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(() => {
    mockCommandBus = {
      execute: jest.fn(),
    } as any;

    mockQueryBus = {
      execute: jest.fn(),
    } as any;

    controller = new UserController(mockCommandBus, mockQueryBus);
  });

  describe('createUser', () => {
    it('should create user and return response', async () => {
      const dto = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockCommandBus.execute.mockResolvedValue('user-123');

      const result = await controller.createUser(dto);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(CreateUserCommand));
      expect(result).toEqual({
        id: 'user-123',
        message: 'User created successfully',
      });
    });
  });

  describe('getUser', () => {
    it('should return user DTO', async () => {
      const mockUser = {
        id: { getValue: () => 'user-123' },
        email: { getValue: () => 'test@example.com' },
        firstName: 'John',
        lastName: 'Doe',
      };

      mockQueryBus.execute.mockResolvedValue(mockUser);

      const result = await controller.getUser('user-123');

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.email).toBe('test@example.com');
    });
  });
});
```

### 2. DTO Testing

```typescript
describe('UserResponseDto', () => {
  describe('fromDomain', () => {
    it('should map domain entity to DTO', () => {
      const user = User.create(Email.create('test@example.com'), 'John', 'Doe');

      const dto = UserResponseDto.fromDomain(user);

      expect(dto.id).toBe(user.id.getValue());
      expect(dto.email).toBe('test@example.com');
      expect(dto.firstName).toBe('John');
      expect(dto.lastName).toBe('Doe');
    });

    it('should handle null values', () => {
      const user = User.fromPersistence({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        deletedAt: null,
        deletedBy: null,
      });

      const dto = UserResponseDto.fromDomain(user);

      expect(dto.deletedAt).toBeNull();
      expect(dto.deletedBy).toBeNull();
    });
  });
});
```

---

## Common Pitfalls

### 1. Shared Mock Mutation

```typescript
// ❌ BAD
const mockUser = User.create(/* ... */);

it('test 1', () => {
  mockUser.activate(); // Mutates!
});

it('test 2', () => {
  expect(mockUser.isActive()).toBe(false); // Fails! User is active from test 1
});

// ✅ GOOD
const createMockUser = () => User.create(/* ... */);

it('test 1', () => {
  const user = createMockUser();
  user.activate();
});

it('test 2', () => {
  const user = createMockUser();
  expect(user.isActive()).toBe(false); // Passes!
});
```

### 2. Accessing Private Properties

```typescript
// ❌ BAD
expect(user.password.hash).toBe('hashed'); // 'hash' is private

// ✅ GOOD
expect(user.password.getHash()).toBe('hashed'); // Use public method
```

### 3. Property vs Method Access

```typescript
// ❌ BAD
expect(user.isActive).toBe(true); // isActive is a method

// ✅ GOOD
expect(user.isActive()).toBe(true);
```

### 4. UUID Validation

```typescript
// ❌ BAD
const id = PendingUserId.fromString('invalid-id'); // Throws validation error

// ✅ GOOD
const id = PendingUserId.fromString('550e8400-e29b-41d4-a716-446655440000');
```

### 5. Forgetting to Clear Domain Events

```typescript
// ❌ BAD
const user = User.create(/* ... */); // Has UserCreated event

user.activate(); // Adds UserActivated event

expect(user.getDomainEvents()).toHaveLength(1); // Fails! Length is 2

// ✅ GOOD
const user = User.create(/* ... */);
user.clearDomainEvents(); // Clear creation event

user.activate();

expect(user.getDomainEvents()).toHaveLength(1); // Passes!
```

### 6. Async Test Errors

```typescript
// ❌ BAD
it('should throw error', () => {
  expect(async () => {
    await handler.execute(command);
  }).toThrow(); // Won't work! Async function returns Promise
});

// ✅ GOOD
it('should throw error', async () => {
  await expect(handler.execute(command)).rejects.toThrow('Expected error message');
});
```

### 7. Not Mocking Logger

```typescript
// ❌ BAD - Console spam in test output
it('should log error', async () => {
  await handler.execute(badCommand); // Logs error to console
});

// ✅ GOOD - Mock logger
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});
```

---

## Best Practices

### 1. Test Naming

```typescript
// ✅ GOOD - Descriptive names
describe('User.activate', () => {
  it('should activate inactive user', () => {});
  it('should throw when already active', () => {});
  it('should publish UserActivated event', () => {});
});

// ❌ BAD - Vague names
describe('User', () => {
  it('works', () => {});
  it('test activate', () => {});
});
```

### 2. Test Data Builders

```typescript
// Create test data builders for complex objects
class UserBuilder {
  private email = 'test@example.com';
  private firstName = 'John';
  private lastName = 'Doe';

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  withName(firstName: string, lastName: string): this {
    this.firstName = firstName;
    this.lastName = lastName;
    return this;
  }

  build(): User {
    return User.create(Email.create(this.email), this.firstName, this.lastName);
  }
}

// Usage
it('should validate email', () => {
  const user = new UserBuilder().withEmail('custom@example.com').build();
});
```

### 3. Parameterized Tests

```typescript
describe('Email validation', () => {
  it.each([
    ['test@example.com', true],
    ['user@domain.co.uk', true],
    ['invalid', false],
    ['@example.com', false],
    ['test@', false],
  ])('should validate email %s as %s', (email, isValid) => {
    if (isValid) {
      expect(() => Email.create(email)).not.toThrow();
    } else {
      expect(() => Email.create(email)).toThrow();
    }
  });
});
```

### 4. Test Coverage Goals

```typescript
// Aim for high coverage, but prioritize:
// 1. Critical business logic (100% coverage)
// 2. Edge cases and error handling (100% coverage)
// 3. Happy paths (100% coverage)
// 4. Integration points (80%+ coverage)
// 5. Infrastructure code (60%+ coverage is acceptable)
```

### 5. Avoid Testing Implementation Details

```typescript
// ❌ BAD - Testing implementation
it('should call private method', () => {
  const spy = jest.spyOn(service as any, 'privateMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled();
});

// ✅ GOOD - Testing behavior
it('should process data correctly', () => {
  const result = service.publicMethod(input);
  expect(result).toBe(expectedOutput);
});
```

### 6. Integration Test Setup

```typescript
describe('UserRepository Integration', () => {
  let repository: DrizzleUserRepository;
  let db: Database;

  beforeAll(async () => {
    // Setup test database
    db = await createTestDatabase();
    repository = new DrizzleUserRepository(db);
  });

  afterAll(async () => {
    // Cleanup
    await db.close();
  });

  beforeEach(async () => {
    // Clean data before each test
    await db.delete(users).execute();
  });

  it('should persist and retrieve user', async () => {
    const user = User.create(/* ... */);

    await repository.save(user);
    const retrieved = await repository.findById(user.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.email.getValue()).toBe(user.email.getValue());
  });
});
```

---

## Coverage Reports

### Running Tests with Coverage

```bash
# All tests with coverage
pnpm --filter=api test:cov

# Specific file with coverage
pnpm --filter=api test user.entity.spec.ts --coverage

# Watch mode
pnpm --filter=api test --watch

# Update snapshots
pnpm --filter=api test -u
```

### Coverage Thresholds

Configure in `jest.config.js`:

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
```

### Excluding Files from Coverage

```javascript
module.exports = {
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/dist/',
    '.d.ts$',
    'index.ts$', // Barrel files
    '.module.ts$', // NestJS modules
  ],
};
```

---

## Quick Reference

### Essential Test Patterns

| Pattern            | Use Case              | Example             |
| ------------------ | --------------------- | ------------------- |
| Factory Functions  | Prevent mock mutation | `createMockUser()`  |
| AAA Structure      | All tests             | Arrange-Act-Assert  |
| Mock Chaining      | Drizzle queries       | `mockReturnThis()`  |
| Event Verification | Domain events         | `getDomainEvents()` |
| Error Testing      | Exception cases       | `rejects.toThrow()` |

### Mock Types

```typescript
// Repository mock
jest.Mocked<IUserRepository>

// Service mock
jest.Mocked<EmailService>

// EventBus mock
jest.Mocked<EventBus>

// Database mock
any (for Drizzle)
```

### Common Assertions

```typescript
// Value comparison
expect(value).toBe(expected);
expect(value).toEqual(expected);

// Type checks
expect(result).toBeInstanceOf(User);
expect(result).toBeDefined();
expect(result).toBeNull();

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow(Error);

// Mocks
expect(mock).toHaveBeenCalled();
expect(mock).toHaveBeenCalledWith(arg);
expect(mock).toHaveBeenCalledTimes(2);
```

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Test-Driven Development](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)

---

**Remember**: Good tests are:

1. **Fast** - Run quickly to encourage frequent execution
2. **Independent** - No dependencies between tests
3. **Repeatable** - Same result every time
4. **Self-validating** - Pass/fail, no manual verification
5. **Timely** - Written before or with the code

Write tests that document behavior, not implementation details.
