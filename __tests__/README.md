# Testing Guide for Next.js

## Overview

This project uses Jest with different test environments to properly test both React components, Next.js middleware, and utility functions including 401 authentication handling.

## Test Structure

### Component/Page Tests (jsdom environment)
- **Location**: `__tests__/components/`, `__tests__/pages/`
- **Environment**: `jsdom` (default)
- **Purpose**: Testing React components and pages that render in a browser-like environment

### Middleware Tests (Node environment)
- **Location**: `__tests__/middleware.test.ts`
- **Environment**: `node` (specified via `@jest-environment node` directive)
- **Purpose**: Testing Next.js middleware that runs in Edge Runtime

### Auth Interceptor Tests (jsdom environment)
- **Location**: `__tests__/utils/AuthInterceptor.test.ts`
- **Environment**: `jsdom` (default)
- **Purpose**: Testing client-side 401 authentication error handling

### Environment Override
Server-side tests use a special directive at the top of the file:
```typescript
/**
 * @jest-environment node
 */
```

This tells Jest to use the Node environment for specific test files (like middleware), while all other tests continue to use jsdom.

