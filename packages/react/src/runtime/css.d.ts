// Ambient declaration for side-effect CSS imports. The runtime is
// compiled by the consumer's React plugin, which handles CSS transforms;
// TypeScript just needs to know the import resolves.
declare module "*.css";
