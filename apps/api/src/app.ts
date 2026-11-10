import express from 'express';

export type DatabaseProbe = { query: (statement: string) => Promise<unknown> };

export function createApp(database: DatabaseProbe) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

  // Liveness does not expose database or credential details.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'aeter-api' }));

  // Readiness checks whether this API can reach its own PostgreSQL database.
  app.get('/api/ready', async (_req, res) => {
    try {
      await database.query('select 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // No member endpoints until authentication and role checks are implemented.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}
