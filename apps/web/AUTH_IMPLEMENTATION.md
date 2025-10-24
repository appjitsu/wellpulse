# Frontend Authentication System - Sprint 2

Complete implementation of the frontend authentication system for WellPulse web application.

## Components Implemented

### 1. API Client (`/lib/api/client.ts`)

- Axios instance configured with base URL from environment variables
- Request interceptor to attach access token from localStorage
- Response interceptor with automatic token refresh on 401 errors
- Queues failed requests during token refresh
- Redirects to login on refresh failure
- Includes credentials for httpOnly cookie support

### 2. Auth API (`/lib/api/auth.api.ts`)

- **register**: Create new user account
- **verifyEmail**: Verify email with 6-digit code
- **login**: Authenticate user and receive tokens
- **logout**: Clear refresh token cookie
- **refresh**: Get new access token using refresh token
- **forgotPassword**: Request password reset email
- **resetPassword**: Reset password with token

### 3. TypeScript Types (`/lib/types/auth.types.ts`)

- User interface (id, email, name, role)
- Request/Response interfaces for all auth endpoints
- ApiError interface for error handling

### 4. Auth Store (`/lib/store/auth.store.ts`)

- Zustand store with persistence middleware
- Stores user info in localStorage (persisted)
- Stores access token in memory and localStorage (not persisted in Zustand)
- Auto-rehydration on app load
- Actions: login, logout, setAccessToken, setUser, refreshToken, setLoading

### 5. Auth Hook (`/hooks/use-auth.ts`)

- React hook wrapper for auth store
- Returns all auth state and actions with proper types

### 6. Auth Pages

All pages use React Hook Form with Zod validation and Shadcn UI components:

#### Login (`/app/(auth)/login/page.tsx`)

- Email and password fields
- Links to register and forgot password
- Redirects to dashboard on success
- Toast notifications for errors

#### Register (`/app/(auth)/register/page.tsx`)

- Name, email, password, and confirm password fields
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Shows email verification message on success
- Link to login page

#### Verify Email (`/app/(auth)/verify-email/page.tsx`)

- Email and 6-digit code fields
- Pre-fills email from URL params
- Wrapped in Suspense for useSearchParams
- Redirects to login on success

#### Forgot Password (`/app/(auth)/forgot-password/page.tsx`)

- Email field
- Shows success message (always, for security)
- Link to login page

#### Reset Password (`/app/(auth)/reset-password/page.tsx`)

- Accepts token from URL params
- New password and confirm password fields
- Password strength validation
- Wrapped in Suspense for useSearchParams
- Redirects to login on success

### 7. Auth Middleware (`/middleware.ts`)

- Protects routes that require authentication
- Checks for refresh token cookie
- Redirects unauthenticated users to login
- Redirects authenticated users away from auth pages
- Allows public routes (home, auth pages, static assets)

### 8. Dashboard Page (`/app/dashboard/page.tsx`)

- Protected route (requires authentication)
- Displays user info
- Logout functionality
- Placeholder for future features

### 9. Root Layout (`/app/layout.tsx`)

- Added Sonner Toaster component for notifications
- Updated metadata with WellPulse branding

## Technology Stack

- **Next.js 15**: App Router with React 19
- **Axios**: HTTP client with interceptors
- **Zustand**: State management with persistence
- **React Hook Form**: Form handling
- **Zod**: Schema validation
- **Shadcn UI**: Component library (Button, Input, Label, Card, Form)
- **Sonner**: Toast notifications
- **TypeScript**: Full type safety

## Security Features

1. **Access Token**: Stored in localStorage and memory, attached to requests via Authorization header
2. **Refresh Token**: Stored in httpOnly cookie (server-side only, not accessible via JavaScript)
3. **Automatic Token Refresh**: Interceptor handles 401 errors and refreshes token automatically
4. **Request Queuing**: Failed requests during refresh are queued and retried
5. **Middleware Protection**: Server-side route protection before page loads
6. **Password Validation**: Strong password requirements enforced
7. **Secure Redirects**: Automatic redirects based on authentication state

## File Structure

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── dashboard/page.tsx
│   └── layout.tsx
├── components/ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── card.tsx
│   └── form.tsx
├── hooks/
│   └── use-auth.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   └── auth.api.ts
│   ├── store/
│   │   └── auth.store.ts
│   ├── types/
│   │   └── auth.types.ts
│   └── utils.ts
└── middleware.ts
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Usage

### Login Flow

1. User visits `/login`
2. Enters email and password
3. API returns access token and user info
4. Access token stored in localStorage
5. Refresh token stored in httpOnly cookie
6. User redirected to `/dashboard`

### Registration Flow

1. User visits `/register`
2. Enters name, email, and password
3. API creates user and sends verification email
4. User redirected to `/verify-email`
5. User enters 6-digit code
6. Account activated, redirected to `/login`

### Token Refresh Flow

1. Request fails with 401 error
2. Interceptor catches error
3. Calls `/auth/refresh` endpoint (reads refresh token from cookie)
4. Receives new access token
5. Updates localStorage
6. Retries original request
7. If refresh fails, clears auth and redirects to `/login`

### Password Reset Flow

1. User visits `/forgot-password`
2. Enters email
3. API sends reset email with token
4. User clicks link in email (contains token in URL)
5. User visits `/reset-password?token=xxx`
6. Enters new password
7. Password updated, redirected to `/login`

## Quality Checks

All quality checks passed:

- ✅ TypeScript compilation (no errors)
- ✅ ESLint (no errors)
- ✅ Next.js build (successful)

## Testing

To test the authentication system:

1. Start the API server: `pnpm --filter=api dev`
2. Start the web app: `pnpm --filter=web dev`
3. Visit `http://localhost:4001`
4. Register a new account
5. Verify email
6. Login
7. Access protected dashboard

## Next Steps

- Add role-based access control (RBAC) UI
- Implement protected route guards for specific roles
- Add user profile management
- Add "Remember me" functionality
- Add social authentication (Google, Microsoft)
- Add multi-factor authentication (MFA)
- Add session management UI
- Add audit log viewer
