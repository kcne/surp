import { applyOfflineEnv } from '../scripts/offline-env';

// The e2e suite boots AppModule, which validates the entire environment on
// load. Shared with the OpenAPI generator so the two cannot drift apart and
// leave one of them failing on a fresh clone.
applyOfflineEnv();
