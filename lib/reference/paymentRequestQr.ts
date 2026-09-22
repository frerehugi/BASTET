// ─── Reference port: EIP-681 payment-request QR (from CeloDesk) ───────────────
//
// Ported from the public repo Investorquab/CeloDesk
// (https://github.com/Investorquab/CeloDesk), frontend/components/
// CheckoutClient.tsx, function paymentQrValue() — the same port already made
// in the sibling frerehugi/OSIRIS repo (src/reference/paymentRequestQr.ts).
// Copied here (not imported cross-repo — these are separate deployments)
// because BASTET is, of the OSIRIS/APIS/Sterntaler/Clock-it/BASTET family,
// the first project where this pattern has a *plausible* fit. See
// lib/reference/README.md for why OSIRIS/Sterntaler/Clock-it were each
// checked and ruled out.
//
// DORMANT AND UNVERIFIED — read before activating.
//
// The candidate use case: build/claude-code-buildplan.md's Phase 4 (not yet
// built — no app/api/premium/route.ts or lib/x402.ts exist in this repo yet)
// describes an x402-protected "PDF-Zusammenfassung mit vollständigen
// Referenzen" endpoint in the doc-Arm, priced in USDC, paid to the
// registered agent wallet. Unlike OSIRIS/Sterntaler's vault funding (a pull
// via approve()+setupPlan() in one signed wallet session — see the OSIRIS
// file header for why that ruled out this module there), a one-off premium
// purchase by a doctor browsing bastet-covid.org/doc in an ordinary browser
// is exactly the shape of moment this module was built for: someone who
// isn't mid-transaction in a connected dApp session needs to be told
// "send exactly this much, of this token, to this address" without typing
// any of it by hand.
//
// THE OPEN QUESTION, not yet resolved: x402 itself is an HTTP-native
// payment protocol (a 402 response carries payment requirements; the client
// resubmits with a payment header, verified/settled via a facilitator) —
// designed primarily for programmatic/agent clients, not a human sitting in
// a browser. Whether x402.celo.org's facilitator flow already provides its
// own human-friendly payment UI (which would make this module redundant),
// or whether a human hitting a 402 response needs a separate, simpler
// fallback path — has NOT been checked. The build plan itself says to fetch
// https://x402.celo.org/SKILL.md live before writing any of Phase 4's code,
// specifically because this document (build/claude-code-buildplan.md) can be
// stale. Do that first. If x402's own flow already covers the human-payer
// case, this module has no use here either.
//
// What carried over from CeloDesk: the URI format itself — EIP-681's
// `ethereum:<tokenAddress>@<chainId>/transfer?address=<to>&uint256=<atomic>`
// — plus the decimal-to-atomic conversion, both copied faithfully since
// they're just spec compliance, not CeloDesk-specific business logic.
//
// What did NOT carry over, on purpose: CeloDesk's
// `wallet_switchEthereumChain`/`wallet_addEthereumChain` chain-switch dance.
// BASTET has no MiniPay-specific wallet layer yet (unlike OSIRIS's
// src/minipayWallet.ts) — if one is ever added, check there first for
// whether chain-switching even applies before porting that logic too.

/** Minimal token descriptor — this repo has no shared token-registry module yet. */
export interface Eip681Token {
  /** ERC-20 contract address, or omit for a native-currency request. */
  address: `0x${string}`;
  decimals: number;
}

/**
 * Converts a human decimal amount ("12.5") to its atomic integer form for a
 * token with the given decimals, without floating-point rounding.
 */
export function decimalToAtomic(value: string | number, decimals: number): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`decimalToAtomic: invalid decimal amount "${value}"`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0");
}

export interface Eip681PaymentRequestParams {
  /** The token being requested — only `address`/`decimals` are used. */
  token: Eip681Token;
  /** Numeric chain ID — 42220 for Celo Mainnet. */
  chainId: string | number;
  /** Receiving wallet address (BASTET's registered agent wallet, for the Phase 4 case). */
  to: `0x${string}`;
  /** Human decimal amount, e.g. "5.00". */
  amount: string | number;
}

/**
 * Builds an EIP-681 "transfer" payment-request URI: scanning it in a
 * compatible wallet prefills a token transfer of `amount` of `token` to
 * `to`, on `chainId`. This is a payment *request*, not a redirect to a
 * website — the wallet never leaves its own send flow.
 */
export function buildEip681PaymentUri(params: Eip681PaymentRequestParams): string {
  const atomic = decimalToAtomic(params.amount, params.token.decimals);
  return `ethereum:${params.token.address}@${params.chainId}/transfer?address=${params.to}&uint256=${atomic.toString()}`;
}
