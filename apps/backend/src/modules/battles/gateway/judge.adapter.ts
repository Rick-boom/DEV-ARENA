import { createModuleLogger } from '../../../lib/logger.js';
import type { IJudgePort, JudgeVerdict } from '../interfaces/battle.interfaces.js';
import type { BattleService } from '../services/battle.service.js';

const log = createModuleLogger('judge-adapter');

/**
 * Bridges the (assumed, already-built) Judge Service to the Battle
 * Engine. The judge announces verdicts; this adapter feeds them into
 * battle submission tracking. Wiring the real judge is a matter of
 * calling `handle()` from wherever verdicts arrive (a BullMQ worker, a
 * socket event, an internal call) — the engine doesn't care which.
 */
export class JudgeAdapter implements IJudgePort {
  private handler: ((v: JudgeVerdict) => void) | null = null;

  constructor(private readonly battles: BattleService) {
    // Default handler routes verdicts into the battle service.
    this.onVerdict((verdict) => {
      void this.battles.recordSubmission(verdict).catch((err) => {
        log.error({ err, battleId: verdict.battleId }, 'failed to record submission');
      });
    });
  }

  onVerdict(handler: (v: JudgeVerdict) => void): void {
    this.handler = handler;
  }

  /** Entry point the real judge service calls when a verdict is ready. */
  handle(verdict: JudgeVerdict): void {
    this.handler?.(verdict);
  }
}
