module.exports = {
  // TypeScript files: format only (lint runs via turbo)
  '**/*.{ts,tsx}': [
    'prettier --write --cache --cache-location .cache/prettier',
  ],
  // JSON, Markdown, YAML: format only
  '**/*.{json,md,yml,yaml}': ['prettier --write --cache --cache-location .cache/prettier'],
  // Run lint and type-check on the whole project once (not per file)
  '*': () => 'pnpm exec turbo run lint type-check --parallel',
};
