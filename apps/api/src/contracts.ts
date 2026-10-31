// Vercel cannot run the raw-TypeScript workspace package '@haiku/contracts' from node_modules,
// so the API pulls the shared schemas in by relative path and Vercel compiles them with the API.
export * from '../../../packages/contracts/src/index.js';
