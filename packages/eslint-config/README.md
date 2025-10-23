# @wellpulse/eslint-config

Shared ESLint configurations for the WellPulse monorepo.

## Configurations

### `base.js`

Base ESLint rules for all TypeScript projects:

- TypeScript ESLint recommended rules
- Import plugin for module resolution
- Prettier compatibility (no conflicting rules)

### `nextjs.js`

For Next.js applications (web, admin):

- Extends base.js
- Next.js specific rules
- React hooks rules

### `nestjs.js`

For NestJS backend (api):

- Extends base.js
- Node.js environment
- Decorator support

### `react.js`

For React applications (Electron renderer, mobile):

- Extends base.js
- React recommended rules
- React hooks rules

## Usage

Apps are already using ESLint 9 flat config format with their own
`eslint.config.mjs` files. This package provides shared rule sets that
can be imported if needed for consistency.

Example:

```js
import baseConfig from '@wellpulse/eslint-config/base';

export default [
  ...baseConfig,
  // App-specific rules
];
```

## Current Status

All apps currently have their own ESLint configurations due to ESLint 9's
flat config format. This package is available for future consolidation.
