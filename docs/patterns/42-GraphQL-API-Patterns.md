# Pattern 42: GraphQL API Patterns

**Version**: 1.0
**Last Updated**: October 8, 2025
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Design](#schema-design)
3. [Query Patterns](#query-patterns)
4. [Mutation Patterns](#mutation-patterns)
5. [Subscription Patterns](#subscription-patterns)
6. [DataLoader Pattern](#dataloader-pattern)
7. [Error Handling](#error-handling)
8. [Security & Authorization](#security--authorization)
9. [Performance Optimization](#performance-optimization)
10. [NestJS Implementation](#nestjs-implementation)
11. [Testing GraphQL](#testing-graphql)

---

## Overview

GraphQL provides a powerful alternative to REST APIs, offering clients precise control over data fetching and reducing over-fetching and under-fetching issues.

### When to Use GraphQL

**✅ Use GraphQL When**:

- Clients need flexible data queries
- Multiple related resources are frequently fetched together
- Mobile apps need to minimize data transfer
- Frontend teams need rapid iteration without backend changes
- Real-time updates are important (subscriptions)

**❌ Use REST When**:

- Simple CRUD operations
- File uploads/downloads
- Heavy caching requirements
- Team unfamiliar with GraphQL
- Third-party integrations (most expect REST)

### GraphQL vs REST

| Aspect             | GraphQL                             | REST                               |
| ------------------ | ----------------------------------- | ---------------------------------- |
| **Data Fetching**  | Single request, multiple resources  | Multiple requests or over-fetching |
| **Versioning**     | Schema evolution                    | URL versioning                     |
| **Caching**        | Complex (requires normalized cache) | Simple (HTTP caching)              |
| **File Uploads**   | Requires special handling           | Native support                     |
| **Learning Curve** | Steeper                             | Gentler                            |

---

## Schema Design

### 1. Schema-First vs Code-First

**Schema-First** (Recommended for API contracts):

```graphql
# schema.graphql
type Organization {
  id: ID!
  name: String!
  slug: String!
  primaryDomain: String!
  owner: User!
  users: [User!]!
  projects: [Project!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User {
  id: ID!
  email: String!
  firstName: String!
  lastName: String!
  role: Role!
  organization: Organization!
}

enum Role {
  ORG_OWNER
  ADMIN
  MANAGER
  MEMBER
}

type Query {
  organization(id: ID!): Organization
  organizations(limit: Int, offset: Int): OrganizationConnection!
  me: User!
}

type Mutation {
  createOrganization(input: CreateOrganizationInput!): Organization!
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization!
  deleteOrganization(id: ID!): Boolean!
}
```

**Code-First** (NestJS with decorators):

```typescript
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

@ObjectType()
export class Organization {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field()
  primaryDomain!: string;

  @Field(() => User)
  owner!: User;

  @Field(() => [User])
  users!: User[];

  @Field(() => [Project])
  projects!: Project[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

registerEnumType(Role, {
  name: 'Role',
  description: 'User role within organization',
});
```

### 2. Type Design Best Practices

**Use Descriptive Names**:

```graphql
# ✅ Good
type TimeEntry {
  id: ID!
  description: String!
  hours: Float!
  billableAmount: Money
}

# ❌ Bad
type TE {
  id: ID!
  desc: String!
  hrs: Float!
  amt: Int
}
```

**Non-Nullable Fields**:

```graphql
type User {
  id: ID! # Required, always present
  email: String! # Required
  firstName: String! # Required
  lastName: String! # Required
  phone: String # Optional
  deletedAt: DateTime # Optional
}
```

**Connection Pattern for Lists**:

```graphql
type OrganizationConnection {
  edges: [OrganizationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrganizationEdge {
  node: Organization!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 3. Input Types

```graphql
input CreateOrganizationInput {
  name: String!
  primaryDomain: String!
  settings: OrganizationSettingsInput
}

input UpdateOrganizationInput {
  name: String
  settings: OrganizationSettingsInput
}

input OrganizationSettingsInput {
  timeApprovalRequired: Boolean
  clientPortalEnabled: Boolean
  defaultHourlyRate: Float
}
```

**NestJS Code-First**:

```typescript
@InputType()
export class CreateOrganizationInput {
  @Field()
  @Length(2, 100)
  name!: string;

  @Field()
  @Matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/)
  primaryDomain!: string;

  @Field(() => OrganizationSettingsInput, { nullable: true })
  settings?: OrganizationSettingsInput;
}
```

---

## Query Patterns

### 1. Basic Queries

```typescript
import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

@Resolver(() => Organization)
export class OrganizationResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly dataLoaderFactory: DataLoaderFactory,
  ) {}

  @Query(() => Organization, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async organization(@Args('id', { type: () => ID }) id: string): Promise<Organization | null> {
    const query = new GetOrganizationByIdQuery(id);
    return this.queryBus.execute(query);
  }

  @Query(() => [Organization])
  @UseGuards(GqlAuthGuard)
  async organizations(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 25 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
  ): Promise<Organization[]> {
    const query = new GetOrganizationsQuery(limit, offset);
    return this.queryBus.execute(query);
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: CurrentUserData): Promise<User> {
    const query = new GetUserByIdQuery(user.userId);
    return this.queryBus.execute(query);
  }
}
```

### 2. Pagination

**Cursor-Based Pagination** (Recommended):

```typescript
@Query(() => OrganizationConnection)
@UseGuards(GqlAuthGuard)
async organizations(
  @Args('first', { type: () => Int, nullable: true }) first?: number,
  @Args('after', { type: () => String, nullable: true }) after?: string,
  @Args('last', { type: () => Int, nullable: true }) last?: number,
  @Args('before', { type: () => String, nullable: true }) before?: string,
): Promise<OrganizationConnection> {
  const query = new GetOrganizationConnectionQuery({ first, after, last, before });
  return this.queryBus.execute(query);
}
```

**GraphQL Query**:

```graphql
query GetOrganizations {
  organizations(first: 10, after: "cursor123") {
    edges {
      node {
        id
        name
        slug
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### 3. Filtering & Sorting

```typescript
@InputType()
export class OrganizationFilterInput {
  @Field({ nullable: true })
  status?: OrganizationStatus;

  @Field({ nullable: true })
  search?: string;

  @Field(() => DateRangeInput, { nullable: true })
  createdAt?: DateRangeInput;
}

@InputType()
export class OrganizationSortInput {
  @Field(() => OrganizationSortField)
  field!: OrganizationSortField;

  @Field(() => SortOrder)
  order!: SortOrder;
}

@Query(() => OrganizationConnection)
async organizations(
  @Args('filter', { nullable: true }) filter?: OrganizationFilterInput,
  @Args('sort', { nullable: true }) sort?: OrganizationSortInput,
): Promise<OrganizationConnection> {
  // Implementation
}
```

---

## Mutation Patterns

### 1. Create Mutations

```typescript
@Mutation(() => Organization)
@UseGuards(GqlAuthGuard)
async createOrganization(
  @Args('input') input: CreateOrganizationInput,
  @CurrentUser() user: CurrentUserData,
): Promise<Organization> {
  const command = new CreateOrganizationCommand(
    user.email,
    user.userId,
    input.name,
  );

  return this.commandBus.execute(command);
}
```

**GraphQL Mutation**:

```graphql
mutation CreateOrganization {
  createOrganization(
    input: {
      name: "Acme Corporation"
      primaryDomain: "acme.com"
      settings: { timeApprovalRequired: true, defaultHourlyRate: 150 }
    }
  ) {
    id
    name
    slug
    createdAt
  }
}
```

### 2. Update Mutations

```typescript
@Mutation(() => Organization)
@UseGuards(GqlAuthGuard, GqlTenantGuard)
async updateOrganization(
  @Args('id', { type: () => ID }) id: string,
  @Args('input') input: UpdateOrganizationInput,
  @CurrentUser() user: CurrentUserData,
): Promise<Organization> {
  const command = new UpdateOrganizationCommand(
    id,
    user.userId,
    input.name,
    input.settings,
  );

  return this.commandBus.execute(command);
}
```

### 3. Delete Mutations

```typescript
@Mutation(() => Boolean)
@UseGuards(GqlAuthGuard, GqlTenantGuard)
async deleteOrganization(
  @Args('id', { type: () => ID }) id: string,
  @CurrentUser() user: CurrentUserData,
): Promise<boolean> {
  const command = new DeleteOrganizationCommand(id, user.userId);
  await this.commandBus.execute(command);
  return true;
}
```

### 4. Optimistic Response Pattern

**Client-Side (React/Apollo)**:

```typescript
const [updateOrganization] = useMutation(UPDATE_ORGANIZATION, {
  optimisticResponse: {
    __typename: 'Mutation',
    updateOrganization: {
      __typename: 'Organization',
      id: organizationId,
      name: newName,
      updatedAt: new Date().toISOString(),
    },
  },
  update: (cache, { data }) => {
    // Update cache with real response
  },
});
```

---

## Subscription Patterns

### 1. Real-Time Updates

```typescript
import { Subscription, PubSub } from '@nestjs/graphql';

@Resolver()
export class OrganizationSubscriptionResolver {
  constructor(private readonly pubSub: PubSub) {}

  @Subscription(() => Organization, {
    filter: (payload, variables) => {
      return payload.organizationUpdated.id === variables.organizationId;
    },
  })
  @UseGuards(GqlAuthGuard)
  organizationUpdated(@Args('organizationId', { type: () => ID }) organizationId: string) {
    return this.pubSub.asyncIterator('ORGANIZATION_UPDATED');
  }
}
```

**Trigger Subscription**:

```typescript
@EventsHandler(OrganizationUpdatedEvent)
export class OnOrganizationUpdatedHandler {
  constructor(private readonly pubSub: PubSub) {}

  async handle(event: OrganizationUpdatedEvent): Promise<void> {
    await this.pubSub.publish('ORGANIZATION_UPDATED', {
      organizationUpdated: event.organization,
    });
  }
}
```

**Client Subscription**:

```graphql
subscription OnOrganizationUpdated($organizationId: ID!) {
  organizationUpdated(organizationId: $organizationId) {
    id
    name
    updatedAt
  }
}
```

### 2. Redis PubSub for Scaling

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const pubSub = new RedisPubSub({
  publisher: new Redis({
    host: 'localhost',
    port: 6379,
  }),
  subscriber: new Redis({
    host: 'localhost',
    port: 6379,
  }),
});

@Module({
  providers: [
    {
      provide: 'PUB_SUB',
      useValue: pubSub,
    },
  ],
})
export class GraphQLModule {}
```

---

## DataLoader Pattern

### 1. Preventing N+1 Queries

**Without DataLoader** (N+1 Problem):

```typescript
@ResolveField(() => User)
async owner(@Parent() organization: Organization): Promise<User> {
  // Called N times for N organizations - N+1 queries!
  return this.queryBus.execute(new GetUserByIdQuery(organization.ownerId));
}
```

**With DataLoader**:

```typescript
@Injectable()
export class DataLoaderFactory {
  createUserLoader(userRepository: IUserRepository): DataLoader<string, User> {
    return new DataLoader<string, User>(async (userIds: readonly string[]) => {
      const users = await userRepository.findByIds([...userIds]);

      // Return users in same order as userIds
      const userMap = new Map(users.map((user) => [user.id.value, user]));
      return userIds.map((id) => userMap.get(id) || null);
    });
  }

  createOrganizationLoader(
    orgRepository: IOrganizationRepository,
  ): DataLoader<string, Organization> {
    return new DataLoader<string, Organization>(async (orgIds: readonly string[]) => {
      const organizations = await orgRepository.findByIds([...orgIds]);
      const orgMap = new Map(organizations.map((org) => [org.id.value, org]));
      return orgIds.map((id) => orgMap.get(id) || null);
    });
  }
}
```

**Using DataLoader**:

```typescript
@ResolveField(() => User)
async owner(
  @Parent() organization: Organization,
  @Context('userLoader') userLoader: DataLoader<string, User>,
): Promise<User> {
  // Batched and cached!
  return userLoader.load(organization.ownerId);
}
```

### 2. DataLoader Setup in Context

```typescript
@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      context: ({ req }) => {
        const dataLoaderFactory = new DataLoaderFactory();

        return {
          req,
          userLoader: dataLoaderFactory.createUserLoader(userRepository),
          organizationLoader: dataLoaderFactory.createOrganizationLoader(orgRepository),
        };
      },
    }),
  ],
})
export class AppModule {}
```

---

## Error Handling

### 1. GraphQL Errors

```typescript
import { ApolloError } from 'apollo-server-express';

@Mutation(() => Organization)
async createOrganization(@Args('input') input: CreateOrganizationInput) {
  try {
    return await this.commandBus.execute(new CreateOrganizationCommand(...));
  } catch (error) {
    if (error instanceof DuplicateOrganizationDomainException) {
      throw new ApolloError(
        `Organization with domain '${input.primaryDomain}' already exists`,
        'DUPLICATE_DOMAIN',
        { domain: input.primaryDomain },
      );
    }
    throw error;
  }
}
```

### 2. Custom Error Codes

```typescript
export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

throw new ApolloError('Invalid input', ErrorCode.BAD_USER_INPUT, {
  field: 'email',
  message: 'Email already exists',
});
```

### 3. Error Response Format

```json
{
  "errors": [
    {
      "message": "Organization with domain 'acme.com' already exists",
      "extensions": {
        "code": "DUPLICATE_DOMAIN",
        "domain": "acme.com"
      },
      "path": ["createOrganization"]
    }
  ],
  "data": null
}
```

---

## Security & Authorization

### 1. Authentication Guard

```typescript
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
```

### 2. Field-Level Authorization

```typescript
@ResolveField(() => [User])
@UseGuards(GqlAuthGuard)
async users(
  @Parent() organization: Organization,
  @CurrentUser() user: CurrentUserData,
): Promise<User[]> {
  // Only org members can see user list
  if (user.organizationId !== organization.id) {
    throw new ForbiddenException('Cannot access users from another organization');
  }

  return this.queryBus.execute(new GetOrganizationUsersQuery(organization.id));
}
```

### 3. Directive-Based Authorization

```graphql
directive @auth(requires: Role!) on FIELD_DEFINITION

type Mutation {
  deleteOrganization(id: ID!): Boolean! @auth(requires: ORG_OWNER)
  transferOwnership(id: ID!, newOwnerId: ID!): Organization! @auth(requires: ORG_OWNER)
}
```

```typescript
@Directive('@auth(requires: "ORG_OWNER")')
export class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async function (...args) {
      const context = args[2];
      const user = context.req.user;

      if (user.role !== 'ORG_OWNER') {
        throw new ForbiddenException('Requires ORG_OWNER role');
      }

      return resolve.apply(this, args);
    };
  }
}
```

---

## Performance Optimization

### 1. Query Complexity Analysis

```typescript
import { GraphQLModule } from '@nestjs/graphql';
import { fieldExtensionsEstimator, simpleEstimator } from 'graphql-query-complexity';

GraphQLModule.forRoot({
  autoSchemaFile: true,
  plugins: [
    {
      requestDidStart: () => ({
        didResolveOperation({ request, document }) {
          const complexity = getComplexity({
            schema,
            query: document,
            variables: request.variables,
            estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
          });

          if (complexity > 1000) {
            throw new Error(`Query too complex: ${complexity}. Maximum allowed: 1000`);
          }
        },
      }),
    },
  ],
});
```

### 2. Query Depth Limiting

```typescript
import depthLimit from 'graphql-depth-limit';

GraphQLModule.forRoot({
  autoSchemaFile: true,
  validationRules: [depthLimit(5)], // Maximum depth of 5
});
```

### 3. Persisted Queries

```typescript
GraphQLModule.forRoot({
  persistedQueries: {
    cache: new Map(), // Or Redis cache
  },
});
```

**Client**:

```typescript
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { sha256 } from 'crypto-hash';

const link = createPersistedQueryLink({ sha256 });
```

---

## NestJS Implementation

### 1. Module Setup

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req, connection }) => {
        // WebSocket connection for subscriptions
        if (connection) {
          return { req: connection.context };
        }
        return { req };
      },
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
    }),
  ],
  providers: [
    OrganizationResolver,
    UserResolver,
    // ... other resolvers
  ],
})
export class GraphQLAppModule {}
```

### 2. Complete Resolver Example

```typescript
@Resolver(() => Organization)
export class OrganizationResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // Queries
  @Query(() => Organization, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async organization(@Args('id', { type: () => ID }) id: string) {
    return this.queryBus.execute(new GetOrganizationByIdQuery(id));
  }

  @Query(() => [Organization])
  @UseGuards(GqlAuthGuard)
  async organizations() {
    return this.queryBus.execute(new GetOrganizationsQuery());
  }

  // Mutations
  @Mutation(() => Organization)
  @UseGuards(GqlAuthGuard)
  async createOrganization(
    @Args('input') input: CreateOrganizationInput,
    @CurrentUser() user: CurrentUserData,
  ) {
    const command = new CreateOrganizationCommand(user.email, user.userId, input.name);
    return this.commandBus.execute(command);
  }

  @Mutation(() => Organization)
  @UseGuards(GqlAuthGuard, GqlTenantGuard)
  async updateOrganization(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateOrganizationInput,
    @CurrentUser() user: CurrentUserData,
  ) {
    const command = new UpdateOrganizationCommand(id, user.userId, input.name, input.settings);
    return this.commandBus.execute(command);
  }

  // Field Resolvers
  @ResolveField(() => User)
  async owner(
    @Parent() organization: Organization,
    @Context('userLoader') userLoader: DataLoader<string, User>,
  ) {
    return userLoader.load(organization.ownerId);
  }

  @ResolveField(() => [User])
  @UseGuards(GqlAuthGuard)
  async users(@Parent() organization: Organization) {
    return this.queryBus.execute(new GetOrganizationUsersQuery(organization.id));
  }
}
```

---

## Testing GraphQL

### 1. Unit Tests

```typescript
describe('OrganizationResolver', () => {
  let resolver: OrganizationResolver;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganizationResolver,
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    resolver = module.get(OrganizationResolver);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  it('should create organization', async () => {
    const input: CreateOrganizationInput = {
      name: 'Test Org',
      primaryDomain: 'test.com',
    };
    const user: CurrentUserData = {
      userId: 'uuid',
      email: 'owner@test.com',
      role: 'ORG_OWNER',
      organizationId: 'org-uuid',
    };

    const mockOrg = { id: 'uuid', name: 'Test Org' };
    jest.spyOn(commandBus, 'execute').mockResolvedValue(mockOrg);

    const result = await resolver.createOrganization(input, user);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerEmail: user.email,
        ownerUserId: user.userId,
        name: input.name,
      }),
    );
    expect(result).toEqual(mockOrg);
  });
});
```

### 2. E2E Tests

```typescript
describe('GraphQL OrganizationResolver (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(email: "test@example.com", password: "password") {
              accessToken
            }
          }
        `,
      });

    token = loginResponse.body.data.login.accessToken;
  });

  it('should create organization', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation CreateOrganization($input: CreateOrganizationInput!) {
            createOrganization(input: $input) {
              id
              name
              slug
              primaryDomain
            }
          }
        `,
        variables: {
          input: {
            name: 'Test Organization',
            primaryDomain: 'test.com',
          },
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.createOrganization).toMatchObject({
          id: expect.any(String),
          name: 'Test Organization',
          slug: 'test-organization',
          primaryDomain: 'test.com',
        });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## Summary

### GraphQL Best Practices Checklist

#### ✅ Schema Design

- [ ] Use descriptive, business-focused type names
- [ ] Mark required fields with `!`
- [ ] Use Input types for mutations
- [ ] Implement Connection pattern for pagination
- [ ] Version schema through field deprecation

#### ✅ Performance

- [ ] Implement DataLoader for N+1 prevention
- [ ] Add query complexity analysis
- [ ] Limit query depth
- [ ] Use persisted queries in production
- [ ] Batch database queries

#### ✅ Security

- [ ] Require authentication on sensitive queries/mutations
- [ ] Implement field-level authorization
- [ ] Validate all inputs
- [ ] Sanitize user input
- [ ] Rate limit GraphQL endpoint

#### ✅ Error Handling

- [ ] Use custom error codes
- [ ] Provide helpful error messages
- [ ] Include field context in validation errors
- [ ] Log errors server-side
- [ ] Don't leak implementation details

#### ✅ Testing

- [ ] Unit test all resolvers
- [ ] E2E test critical workflows
- [ ] Test authorization rules
- [ ] Test error scenarios
- [ ] Load test complex queries

---

## Related Patterns

- **Pattern 05**: [CQRS Pattern](./05-CQRS-Pattern.md)
- **Pattern 06**: [Repository Pattern](./06-Repository-Pattern.md)
- **Pattern 39**: [Security Patterns Guide](./39-Security-Patterns-Guide.md)
- **Pattern 41**: [REST API Best Practices](./41-REST-API-Best-Practices.md)

---

## References

- [GraphQL Specification](https://spec.graphql.org/)
- [NestJS GraphQL Documentation](https://docs.nestjs.com/graphql/quick-start)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [DataLoader Documentation](https://github.com/graphql/dataloader)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

**Last Updated**: October 8, 2025
**Version**: 1.0
**Status**: Active
