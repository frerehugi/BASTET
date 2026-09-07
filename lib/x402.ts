// x402-Facilitator-Integration für BASTET.
//
// Kein Monetarisierungsziel — Patient:innen- und Ärzte-Arm bleiben vollständig
// kostenfrei. Zweck ist ein verifizierbarer, funktionierender Zahlungskanal
// (Hackathon-Nachweis) und eine spätere Option für freiwillige Unterstützung.
// Siehe build/claude-code-buildplan.md, Phase 4.

import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export const CELO_MAINNET_NETWORK = "eip155:42220";

export const AGENT_WALLET_ADDRESS =
  process.env.AGENT_WALLET_ADDRESS || "0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608";

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://x402.celo.org";

let cachedServer: x402ResourceServer | null = null;

export function getX402Server(): x402ResourceServer {
  if (!cachedServer) {
    const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
    cachedServer = new x402ResourceServer(facilitatorClient).register(
      CELO_MAINNET_NETWORK,
      new ExactEvmScheme()
    );
  }
  return cachedServer;
}
