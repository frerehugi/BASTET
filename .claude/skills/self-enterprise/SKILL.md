---
name: self-enterprise
summary: 'The managed plane. Configure a flow in the dashboard, call sessions.create, send users to a hosted page, then receive signed verification.completed webhooks — no infrastructure required.'
description: 'Integrate Self Enterprise — the managed plane for zero-knowledge identity verification from Self (self.xyz). Use when the user wants hosted/managed KYC, age verification, or proof-of-human WITHOUT running verifier infrastructure or smart contracts, and mentions the Self dashboard, @selfxyz/enterprise-sdk, sessions.create, a hosted verification page, verificationUrl, signed verification.completed webhooks, SelfWebhooks, or usage-based billing. Covers the dashboard flow setup, the Node/TypeScript SDK session call, and verifying signed webhook events on your backend.'
---

# Self Enterprise — Managed Identity Verification

Self Enterprise is the **managed plane**. You configure a flow in a dashboard, call one SDK method, and receive signed webhook events when users verify. Self handles credential issuance, proof verification, and the verification record. No smart contracts, no verifier infra, no personal data on your side.

If the user instead wants to run the verification themselves (render the QR, verify the proof on their own backend or contract), use the `self-pass` skill.

## How it fits together

```
┌──────────────┐  2. sessions.create()  ┌─────────────────┐
│ Your backend │ ─────────────────────▶ │ Self Enterprise │ ◀── 1. configure a flow
│              │ ◀───────────────────── │   (dashboard)   │     in the dashboard
└──────────────┘  5. signed webhook     └────────┬────────┘
                  verification.completed          │ 3. serve hosted page
                                                  ▼
                                          ┌───────────────┐
                                          │  Hosted page  │  4. user scans QR,
                                          │  (QR / link)  │     verifies in Self app
                                          └───────────────┘
```

1. **Configure a flow** in the dashboard (https://dashboard.self.xyz), picking one workspace: **Pre-KYC**, **Age Verification**, **Proof of Human**, **Sovereign**, or **Custom Config** (Enterprise plan, early access).
2. **Call `sessions.create(...)`** from your backend when a user needs to verify. You get back a `verificationUrl`.
3. **Send the user to that URL** — Self serves a hosted page with a QR (or deeplink button on mobile).
4. **The user verifies in the Self mobile app**, producing a ZK proof of the requested attributes.
5. **Self verifies the proof** and fires a signed `verification.completed` webhook to your backend. You read the verified attributes and proceed.

## Quick Start

### 1. Install

```bash
npm install @selfxyz/enterprise-sdk
```

### 2. Configure a flow + get keys

In the [dashboard](https://dashboard.self.xyz): create a workspace (Pre-KYC / Age Verification / Proof of Human / Sovereign / Custom Config) and deploy it. The **`flowId`** is shown on the workspace's Test/Live tab. Then create an **API key** and register a **webhook** endpoint (you receive the signing secret when you save it). Ask the user for these. Never invent them.

Set: `SELF_API_KEY`, `SELF_FLOW_ID`, `SELF_WEBHOOK_SECRET`.

### 3. Create a session (backend)

```ts
import { SelfClient } from '@selfxyz/enterprise-sdk';

const self = new SelfClient({ apiKey: process.env.SELF_API_KEY! });

// When a user needs to verify:
const session = await self.sessions.create({
  flowId: process.env.SELF_FLOW_ID!, // the deployed flow, from the dashboard
  externalUuid: user.id, // your stable UUID for this user, echoed back on the webhook
});

// Redirect / show the hosted page:
return Response.json({ verificationUrl: session.verificationUrl });
```

### 4. Handle the webhook (backend)

```ts
// app/api/webhooks/self/route.ts
import { SelfWebhooks } from '@selfxyz/enterprise-sdk';

export async function POST(req: Request) {
  const event = SelfWebhooks.verify(
    await req.text(), // raw body — never req.json() before verify()
    Object.fromEntries(req.headers),
    process.env.SELF_WEBHOOK_SECRET!,
  );

  if (event.type === 'verification.completed' && event.status === 'valid') {
    grantAccess(event.external_uuid, event.proof_attributes);
  }

  // Return 2xx to acknowledge; 408/429/5xx/timeout triggers a retry, other 4xx = dropped.
  return new Response('ok', { status: 200 });
}
```

## The five workspaces

| Workspace            | Verifies                                                                                                                                                                                                                                                                                 | Credits | Typical use                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------ |
| **Pre-KYC**          | Identity attributes (name, nationality, DOB, document validity)                                                                                                                                                                                                                          | 25      | Onboarding, compliance gating        |
| **Age Verification** | Age threshold (default minimum age 21) + OFAC toggle, on by default                                                                                                                                                                                                                      | 10      | Age-gated content/commerce           |
| **Proof of Human**   | Uniqueness / one-person-one-account + OFAC toggle, on by default                                                                                                                                                                                                                         | 10      | Sybil resistance, airdrops, anti-bot |
| **Sovereign**        | Genuine document from a nationality allowlist (every Sovereign flow reveals the user's nationality)                                                                                                                                                                                      | 10      | Region-restricted access             |
| **Custom Config**    | Exactly the document fields you pick, delivered to your webhook under **your org's custody**; Self stores nothing (`storage_state: 'skipped'`). Early access, Enterprise plan, backend-only, live sessions require an active live webhook endpoint (`409 no_webhook_endpoint` otherwise) | 25      | Own-vault KYC, data residency        |

A workspace holds **one active configuration**, and a deployed configuration is **immutable**: to change anything (including the verification mode), archive it and create a new one. Exception: **Custom Config** holds many active configurations at once.

## Verification modes

Every flow verifies in **Backend** mode by default (Self's servers verify the proof). A flow can instead be configured **On-chain** in the dashboard: the proof is verified by a contract on Celo and the verified user receives a soulbound token. On the hosted page they connect a wallet and sign a gas-free message first. Your integration is identical either way (same `sessions.create`, same webhook), with these differences:

- The flow's contract must be **deployed** for the environment, or `sessions.create` returns `409` with `details.discriminator: "no_deployment"`. Tell the user to check the flow's Test/Live tab in the dashboard.
- The webhook carries `verification_mode: "onchain"` plus `tx_hash` and `contract_address`, and `proof_attributes` is an **empty object** (the rules are enforced by the contract, not evaluated by Self's servers).
- Rule limits: **no maximum-age rule** on-chain, and country lists are capped at **40 excluded / 41 included** countries.
- The receiving wallet must be an **EOA**: smart-contract wallets (e.g. Safe) can't receive the SBT.

Details: https://docs.self.xyz/docs/self-enterprise/flows/verification-modes/

## Critical Gotchas

1. **Verify webhook signatures** — always pass the **raw** request body (not parsed JSON) to `SelfWebhooks.verify`, or signature verification fails.
2. **`flowId` must be a UUID**; `externalUuid` is any opaque string (1-256 chars). The webhook echoes it back snake_cased as `external_uuid`; use it to correlate the event with your user.
3. **Return 2xx fast**: Self retries with backoff only on `408`, `429`, `5xx`, and timeouts; any other `4xx` is a permanent rejection with **no retry**. Make handlers idempotent.
4. **Error types**: every non-2xx API response throws `SelfApiError` (`statusCode`, `code`, `details`, `requestId`; codes include `validation_failed`, `conflict`, `rate_limited`, `vendor_unavailable`). In webhook handlers: `WebhookVerificationError` → respond `400`. Unknown payload shape (`SelfValidationError`) or a server bug → respond `5xx` so Self retries.
5. **Never invent** API keys, webhook secrets, or workspace IDs — ask the user for the real values from their dashboard.
6. **Test vs. live**: the same `flowId` serves both environments; the API key (`sk_test_` / `sk_live_`) decides. Test with mock passports before going live; test sessions never bill.
7. **Trust the webhook, not the redirect**: `successUrl`/`failureUrl` are UX only. Grant access from the signed `verification.completed` event (or `sessions.get`).

## References

- **`references/sdk.md`**: `SelfClient` config, `sessions.create`/`sessions.get` options & responses, redirects, error handling, test-vs-live, billing.
- **`references/webhooks.md`**: webhook delivery model, signature verification (Express + framework-agnostic), event catalog with payload, retry semantics.

## Docs map (route deeper questions here)

- What is Self Enterprise / overview: https://docs.self.xyz/docs/self-enterprise/get-started/what-is-self-enterprise/
- Quickstart (end to end): https://docs.self.xyz/docs/self-enterprise/get-started/quickstart/
- The five workspaces, use cases, costs: https://docs.self.xyz/docs/self-enterprise/workspaces/
- Rules & reveals (age, country, OFAC, security level): https://docs.self.xyz/docs/self-enterprise/flows/disclosures/
- Backend vs. on-chain: https://docs.self.xyz/docs/self-enterprise/flows/verification-modes/
- Webhook payload details: https://docs.self.xyz/docs/self-enterprise/webhooks/events/
- Error catalog: https://docs.self.xyz/docs/self-enterprise/sdk/error-handling/
- Test vs. live & mock passports: https://docs.self.xyz/docs/self-enterprise/flows/test-vs-live/
- Billing & credits: https://docs.self.xyz/docs/self-enterprise/billing/credits-and-usage/
- Troubleshooting: https://docs.self.xyz/docs/self-enterprise/reference/troubleshooting/
