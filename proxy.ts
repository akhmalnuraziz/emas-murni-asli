// Deprecated: auth logic moved to middleware.ts (this file never ran as middleware).
// Kept as re-export for backward compatibility with any stale imports.
export { middleware as proxy, config } from './middleware'
