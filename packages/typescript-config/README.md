# @wellpulse/typescript-config

Shared TypeScript configurations for the WellPulse monorepo.

## Configurations

### `base.json`

Base configuration used by all projects:

- Target: ES2022
- Strict mode enabled
- Source maps and declarations
- No unused variables or parameters

### `nextjs.json`

For Next.js applications (web, admin):

- Extends base.json
- JSX: preserve (Next.js handles transformation)
- Module resolution: bundler
- Next.js plugin support

### `nestjs.json`

For NestJS backend (api):

- Extends base.json
- Decorator metadata enabled
- Experimental decorators enabled
- CommonJS modules

### `react.json`

For React applications (Electron renderer):

- Extends base.json
- JSX: react-jsx (React 19)
- Module resolution: bundler

## Usage

In your app's `tsconfig.json`:

```json
{
  "extends": "@wellpulse/typescript-config/nextjs.json",
  "compilerOptions": {
    // App-specific overrides
  }
}
```
