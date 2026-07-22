import { Router, type Router as RouterType } from 'express';

/**
 * Liveness/readiness endpoints. Kept dependency-free so orchestrators
 * (Docker healthcheck, k8s probes, NGINX upstream checks) always get a
 * fast answer even if downstream systems are degraded.
 */
export const healthRouter: RouterType = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});
