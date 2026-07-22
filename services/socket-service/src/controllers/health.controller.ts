import type { Request, Response } from 'express';
import type { DevArenaIO } from '../gateway/io-server.js';

/**
 * HTTP health endpoint alongside the socket server. Load balancers hit
 * this for liveness; it also reports the live socket count on THIS node
 * (per-node, not cluster-wide) which is useful for autoscaling signals.
 */
export function createHealthHandler(io: DevArenaIO) {
  return async (_req: Request, res: Response): Promise<void> => {
    const sockets = await io.local.fetchSockets();
    res.json({
      success: true,
      data: { status: 'ok', node: process.pid, localConnections: sockets.length },
    });
  };
}
