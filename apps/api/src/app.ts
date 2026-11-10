import express from 'express';
import helmet from 'helmet';
import type pg from 'pg';
import { registerAuthRoutes } from './auth/routes.js';
import type { ApiConfig } from './config.js';

export function createApp(pool: pg.Pool, config: ApiConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));

  // Only known browser origin may mutate API state, including login/logout.
  // No CORS is enabled: the web UI communicates through same-origin /api proxy.
  registerAuthRoutes(app, pool, config);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'aeter-api' }));
  app.get('/api/ready', async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error: unknown, _req: express.Request, res: express.Response,
    _next: express.NextFunction) => {
    // Never echo thrown SQL errors, tokens, credentials, or request content.
    console.error('[aeter-api] unexpected request failure', error instanceof Error ? error.name : 'unknown');
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
