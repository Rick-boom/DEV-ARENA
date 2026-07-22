import { randomUUID } from 'node:crypto';
import { createModuleLogger } from '../../../lib/logger.js';
import type { IBattleGateway } from '../interfaces/matchmaking.interfaces.js';

const log = createModuleLogger('battle-gateway');

/**
 * Bridges matchmaking to the (assumed, already-built) Battle Engine.
 * Given a matched pair, it asks the Battle Engine to create a battle
 * and returns the id used in the match:found payload. Injected as a
 * function so the real create call (an internal service call or a
 * queue message) is wired at the composition root; the default here
 * returns a synthetic id for environments where the engine isn't bound.
 */
export class BattleGatewayAdapter implements IBattleGateway {
  constructor(
    private readonly create?: (input: {
      players: string[];
      mode: string;
      rated: boolean;
    }) => Promise<{ battleId: string }>,
  ) {}

  async createBattle(input: {
    players: string[];
    mode: string;
    rated: boolean;
  }): Promise<{ battleId: string }> {
    if (this.create) return this.create(input);
    const battleId = randomUUID();
    log.debug({ battleId, players: input.players }, 'battle created (stub gateway)');
    return { battleId };
  }
}
