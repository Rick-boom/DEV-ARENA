import type { CollabSocket, ConnectionState } from '../types/collab.types.js';
import type { SocketIOProvider } from '../providers/socket-io-provider.js';

/**
 * ── Reconnect + resync ──────────────────────────────────────────────
 * On a dropped connection we must (a) surface the state to the UI and
 * (b) once the socket is back, re-run the CRDT sync so we receive every
 * update we missed while away. Thanks to state-vector sync this is
 * O(missed updates), not a full document resend, and it's safe to run
 * repeatedly (idempotent). Exponential backoff avoids hammering the
 * server during an outage.
 *
 * We DON'T reconnect the socket ourselves — Socket.IO owns that (it
 * already exists). We just react to its connect/disconnect and trigger
 * a Yjs resync at the right moment.
 */
export class ReconnectManager {
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly socket: CollabSocket,
    private readonly provider: SocketIOProvider,
    private readonly onState?: (state: ConnectionState) => void,
  ) {
    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.provider.on('status', (s: ConnectionState) => this.onState?.(s));
  }

  private handleConnect = (): void => {
    this.attempts = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Re-run SyncStep1 to pull everything we missed.
    this.provider.resync();
  };

  private handleDisconnect = (): void => {
    this.scheduleResyncCheck();
  };

  /**
   * Backoff loop that, while disconnected, keeps checking whether the
   * socket has come back and triggers a resync when it does. (Socket.IO
   * does the actual reconnecting; this just re-syncs Yjs afterward, even
   * if we missed the 'connect' event during a race.)
   */
  private scheduleResyncCheck(): void {
    const delay = Math.min(1000 * 2 ** this.attempts, 30_000);
    this.attempts += 1;
    this.timer = setTimeout(() => {
      if (this.socket.connected) {
        this.handleConnect();
      } else {
        this.scheduleResyncCheck();
      }
    }, delay);
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
  }
}
