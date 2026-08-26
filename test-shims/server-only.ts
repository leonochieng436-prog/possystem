// Test-only shim: the real "server-only" package unconditionally throws
// when imported outside a bundler that understands the "browser"/server
// condition (e.g. plain Node under Vitest). Next.js's webpack build
// handles the real package correctly for actual server/client bundling;
// this shim only exists so unit tests can import server-side modules
// without pulling in a full Next.js build.
export {};
