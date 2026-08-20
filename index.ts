export * from './messenger-types';

// Embedded page (inside the iframe)
export * from './resizer-iframe';
export * from './theme-iframe';

// Host window (the embedding website)
export * from './resizer-window';
export * from './theme-window';

// Deliberately not re-exported: './standalone-external' runs on import. It is a bundle entry point,
// not a module - see ./README.md.
