# Self Enterprise Webhooks

Self delivers verification results as **signed webhooks**. Your handler verifies the signature, then acts on the event.

## Delivery model

1. Register an HTTPS endpoint in the dashboard (Developer → Webhooks). You get the signing secret when you save it. You can send a test request to confirm reachability.
2. When an event fires, Self POSTs a JSON payload to your endpoint, signed.
3. Your handler verifies the signature (via the SDK) and processes the event.
4. Return `2xx` to acknowledge. Only `408`, `429`, `5xx`, and timeouts are retried with backoff. Any other `4xx` is a **permanent rejection, no retry** (so never return `400` for a transient failure like a database hiccup, or the event is silently dropped).

```
┌──────────────┐   1. signed POST (event)     ┌──────────────────┐
│     Self     │ ───────────────────────────▶ │  Your endpoint   │
│              │                              │  verify the sig, │
│              │ ◀─────────────────────────── │  then return 2xx │
└──────────────┘   2. ack (2xx)               └──────────────────┘

408, 429, 5xx, or a timeout? Self retries with backoff.
Any other 4xx? Permanent rejection: the delivery is dropped.
```

## Verify the signature (Next.js App Router)

Deliveries are signed with **HMAC-SHA256** against your `whsec_…` signing secret, with a **5-minute timestamp tolerance** (replay defense: a drifted server clock is a documented failure mode, keep NTP healthy). Always pass the **raw bytes**: parsing the body first breaks signature verification.

```ts
// app/api/webhooks/self/route.ts
import { SelfWebhooks, WebhookVerificationError } from '@selfxyz/enterprise-sdk';

export async function POST(req: Request) {
  const raw = await req.text(); // raw body — never req.json() before verify()
  const headers = Object.fromEntries(req.headers);

  try {
    const event = SelfWebhooks.verify(raw, headers, process.env.SELF_WEBHOOK_SECRET!);

    if (event.type === 'verification.completed') {
      // event.verification_id, event.external_uuid, event.proof_attributes, event.status
      if (event.status === 'valid') {
        // note: on on-chain flows proof_attributes is {} (rules are enforced by the contract)
        grantAccess(event.external_uuid, event.proof_attributes);
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response('bad signature', { status: 400 }); // do not retry
    }
    return new Response('error', { status: 500 }); // unknown shape / server bug — 5xx so Self retries
  }
}
```

## Framework-agnostic

Any framework works as long as you can read the raw request body before JSON parsing. Pass `(rawBody, headers, secret)` to `SelfWebhooks.verify` and switch on `event.type`.

## Event catalog

One event is delivered today: `verification.completed`, fired when a verification reaches a terminal status.

```json
{
  "type": "verification.completed",
  "verification_id": "7f3b2a1e-…",
  "external_uuid": "a1b2c3d4-…",
  "flow_id": "9c0b4f1c-…",
  "flow_version_id": "b1e2c3d4-…",
  "environment": "live",
  "status": "valid",
  "proof_attributes": { "minimumAge": 18, "ofac": true },
  "proof": {
    /* raw proof envelope: attestationId, proof, publicSignals, userContextData */
  },
  "nullifier": "0x9b1c…",
  "verified_at": "2026-07-31T12:00:00.000Z",
  "storage_state": "pending",
  "storage_uri": null
}
```

Key fields:

- `verification_id`: stable id; use it as your dedup key
- `external_uuid`: the value you passed to `sessions.create` as `externalUuid`; correlates the event with your user
- `flow_id` / `flow_version_id`: the flow and the frozen version this verification ran against
- `status`: `valid` | `invalid` | `error` | `expired`
- `proof_attributes`: the enforced rule config; on `valid` it also carries any requested data-reveal values. On **on-chain** events it's an **empty object**: the rules are enforced by the contract, not evaluated by Self's servers
- `proof`: the raw submitted proof envelope (`object | null`, currently populated on every status); most integrations ignore it (Self already verified it)
- `nullifier`: `string | null`; per-person uniqueness identifier, present on `valid`, `null` otherwise
- `storage_state` / `storage_uri`: `'pending'` / `null` on most events (storage runs async after it fires); read the final state with `sessions.get(...)`. Custom Config events carry `storage_state: 'skipped'` instead: Self stores nothing for them, this delivery is the sole record; persist before acking. Keep the SDK up to date to parse `'skipped'`.
- `product` (optional): the flow's workspace (`pre_kyc` | `age_verification` | `proof_of_human` | `sovereign` | `custom_config`), for routing on a shared endpoint
- `reason` (optional): human-readable failure cause on non-`valid` statuses; log it, don't branch on it
- `verification_mode?`, `tx_hash?`, `contract_address?`: present only for on-chain flows (additive; absent means a backend flow)

New fields and event types may be added over time. Branch on `event.type` and ignore what you don't recognize.

## Best practices

- **Idempotency** — Self may retry; key your processing on `verification_id` so re-delivery doesn't double-grant.
- **Fast ack** — verify + enqueue, then return 2xx quickly; do heavy work asynchronously.
- **Secret hygiene**: store `SELF_WEBHOOK_SECRET` server-side; if it leaks, delete and recreate the endpoint in the dashboard to rotate it.
- **Status check**: only grant access on `status === "valid"`; treat `invalid`, `error`, and `expired` as failed attempts.

Full docs: https://docs.self.xyz/docs/self-enterprise/webhooks/overview/
