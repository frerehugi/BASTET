// Einmaliges ERC-8004-Registrierungsscript für BASTET.
//
// Registriert BASTET als discoverable Agent-Identität in der ERC-8004
// Identity Registry auf Celo Mainnet. Läuft NICHT als Teil der App zur
// Laufzeit — wird einmalig lokal ausgeführt, mit einem echten Private Key
// und ein paar Cent CELO für Gas.
//
// Aufruf (lokal, nie in einer gehosteten Session mit einem echten Key):
//   AGENT_PRIVATE_KEY=0x... npm run register-agent
// oder mit .env-Datei im Projektroot (AGENT_PRIVATE_KEY=0x...):
//   npm run register-agent
//
// Vor dem Ausführen mit echtem Geld: Registry-Adresse und ABI gegen
// https://docs.celo.org/build-on-celo/build-with-ai/8004 und
// https://github.com/celo-org/agent-skills prüfen — diese Werte stammen aus
// build/claude-code-buildplan.md und wurden nicht in dieser Session gegen
// die Live-Quelle verifiziert (kein Netzwerkzugriff auf docs.celo.org von
// hier aus möglich).

import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 agentId) view returns (address)",
]);

const BASE_URL = process.env.BASTET_BASE_URL || "https://bastet-covid.org";

function buildAgentMetadata() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "BASTET",
    description:
      "KI-gestütztes Orientierungswerkzeug für Post-COVID-/ME-CFS-Betroffene im deutschen Sozialrecht (GdB/MdE) — zwei Arme (Betroffene, Ärzt:innen), eine gemeinsame Wissensbasis.",
    url: BASE_URL,
    services: [
      { name: "web-betroffene", endpoint: BASE_URL },
      { name: "web-aerzte", endpoint: `${BASE_URL}/doc` },
      { name: "chat-api", endpoint: `${BASE_URL}/api/chat` },
      { name: "doc-api", endpoint: `${BASE_URL}/api/doc` },
      { name: "premium-x402", endpoint: `${BASE_URL}/api/premium` },
    ],
    supportedTrust: ["reputation"],
  };
}

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "AGENT_PRIVATE_KEY ist nicht gesetzt. Als Env-Variable oder in einer lokalen .env-Datei setzen (nie committen)."
    );
  }

  const rpcUrl = process.env.CELO_RPC_URL || "https://forno.celo.org";
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: celo, transport });
  const walletClient = createWalletClient({ account, chain: celo, transport });

  const metadata = buildAgentMetadata();
  const agentURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString("base64");

  console.log(`Registriere Agent "${metadata.name}" von ${account.address} auf Celo Mainnet ...`);
  console.log(`Registry: ${IDENTITY_REGISTRY}`);

  // simulateContract liefert den Rückgabewert (agentId), bevor die Transaktion
  // tatsächlich gesendet wird — spart das Event-ABI, das hier nicht verifiziert ist.
  const { request, result: predictedAgentId } = await publicClient.simulateContract({
    account,
    address: IDENTITY_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  const txHash = await walletClient.writeContract(request);
  console.log(`Transaktion gesendet: ${txHash}`);
  console.log("Warte auf Bestätigung ...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`Transaktion fehlgeschlagen (Status: ${receipt.status}). Hash: ${txHash}`);
  }

  console.log(`Bestätigt in Block ${receipt.blockNumber}.`);
  console.log(`agentId (aus simulateContract vorhergesagt): ${predictedAgentId}`);

  const owner = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "ownerOf",
    args: [predictedAgentId],
  });
  console.log(`ownerOf(${predictedAgentId}) = ${owner} (sollte ${account.address} entsprechen)`);

  console.log("");
  console.log("Für die Celo-Builders-Submission vormerken:");
  console.log(`  agentWalletAddress: ${account.address}`);
  console.log(`  erc8004Url:         https://www.8004scan.io/agents/celo/${predictedAgentId}`);
}

main().catch((error) => {
  console.error("Registrierung fehlgeschlagen:", error);
  process.exit(1);
});
