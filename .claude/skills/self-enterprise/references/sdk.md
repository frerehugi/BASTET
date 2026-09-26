# Self Enterprise SDK — `@selfxyz/enterprise-sdk`

Node/TypeScript SDK with typed sessions and webhook verification.

```bash
npm install @selfxyz/enterprise-sdk
```

## Client

```ts
import { SelfClient } from '@selfxyz/enterprise-sdk';

const self = new SelfClient({
  apiKey: process.env.SELF_API_KEY!, // from the dashboard → Developer → API keys
});
```

## Create a session

Call this server-side whenever a user needs to verify. Both `flowId` (the deployed flow, from the workspace's Test/Live tab in the dashboard) and `externalUuid` (your stable identifier for the user) are required. `flowId` must be a UUID; `externalUuid` is any opaque string, 1-256 chars.

```ts
const session = await self.sessions.create({
  flowId: process.env.SELF_FLOW_ID!, // which flow to verify against
  externalUuid: user.id, // your stable user identifier, echoed back on the webhook as external_uuid
  // optional:
  // expiresInSeconds: 3600,          // 60–86400, default 3600
  // metadata: { plan: 'pro' },       // arbitrary JSON, ≤ 4 KB
  // successUrl: 'https://…',         // http(s) only
  // failureUrl: 'https://…',         // http(s) only
});

session.verificationUrl; // hosted page URL — send the user here (QR on desktop, deeplink on mobile)
session.id; // Self-side session/verification id
session.expiresAt; // ISO-8601. The session can't be completed after this
session.flowVersionId; // immutable pin to the flow version: deploying a new version doesn't disturb in-flight sessions
// also: status ('pending' at creation), verificationToken, createdAt
```

Send the user to `verificationUrl` (redirect, embed in an iframe-free page, or render the link/button). When they complete verification in the Self app, Self fires a webhook to your registered endpoint.

**Redirects:** if you passed `successUrl`/`failureUrl`, the hosted page sends the user there with `?userId=<externalUuid>` appended; otherwise it shows built-in result screens. The redirect is a UX convenience only: **grant access based on the webhook (or `sessions.get`), never the redirect**.

## Read a session

```ts
const detail = await self.sessions.get(session.id); // id must be a UUID, or SelfValidationError is thrown

detail.status; // 'pending' | 'valid' | 'invalid' | 'error' | 'expired'
detail.proofAttributes; // enforced rule config (null until valid)
detail.storage.state; // 'pending' | 'committed' | 'failed' | 'skipped'. On-chain flows report 'skipped' (no off-chain proof record)
```

On-chain sessions also return `verification_mode` and an `onchain` object (`contract_address`, `scope_seed`, `network`) on the wire (not in the TypeScript type yet), so cast to read them.

## Result shape (delivered via webhook)

The verification outcome is **not** returned inline — it arrives on the `verification.completed` webhook. See `references/webhooks.md`. The event carries:

- `external_uuid`: the value you passed to `sessions.create` as `externalUuid`
- `verification_id` — Self-side id
- `status`: `"valid"` | `"invalid"` | `"error"` | `"expired"`
- `proof_attributes`: the enforced rule config echoed back; on `valid` it also carries any data-reveal values the flow requested
- `nullifier`: per-person uniqueness identifier (`string | null`; present on `valid`, `null` otherwise), stable within the organization

## Error handling

Every non-2xx API response throws **`SelfApiError`** carrying `statusCode`, `code` (stable machine-readable string), `message`, `details`, and `requestId` (quote it to support). Wrap SDK calls and surface actionable errors:

- `SelfValidationError` (thrown before any request) → `flowId` isn't a UUID, `externalUuid` is empty or over 256 chars, or another field failed validation.
- 400 `validation_failed` → request body didn't match the schema; `details.issues` lists the bad fields. Don't retry.
- 401 `unauthenticated` → check `SELF_API_KEY` and that the key matches the environment (test vs. live).
- `statusCode` 402 → the org's credit balance can't cover the session; top up or upgrade in the dashboard. (Branch on the status: the code is `unauthenticated`.)
- 403 `forbidden` → key recognized but blocked at the key layer (e.g. a disabled key); generate a fresh key. (A foreign or wrong `flowId` returns 404, not 403 — lookups are scoped to the key's org. There's no test-vs-live flow mismatch: the environment comes from the key itself.)
- 403 `org_suspended` → the organization is suspended; sessions, verification and webhook delivery are all refused. Not retryable — contact team@self.xyz.
- 404 `not_found` → the `flowId`/session doesn't exist, was never deployed, or is archived; verify the ID in the dashboard.
- 409 `conflict` with `details.discriminator: "no_deployment"` → the flow has no deployed version (or, for on-chain, no deployed contract for this environment); deploy/retry from the flow's Test or Live tab.
- 429 `rate_limited` → honor `Retry-After` and back off.
- 503 `vendor_unavailable` / 500 `internal_error` → retry with backoff; each `sessions.create` call creates a new session, so a retry after an ambiguous failure is safe but may leave an unused session behind.

## Notes

- Billing is usage-based, in credits per completed verification (cost per workspace is shown in the dashboard). `valid` and `invalid` results are charged; `error` and `expired` are not; **test sessions never bill**.
- Test vs. live: the same `flowId` serves both environments: the API key's prefix (`sk_test_` / `sk_live_`) decides. Test sessions accept mock passports and deliver only to test webhook endpoints.
- Keep the API key server-side only. The hosted page does not require your secret in the browser.
- The SDK doesn't retry; back off and retry `429`/`5xx` yourself.
- Full SDK reference: https://docs.self.xyz/docs/self-enterprise/sdk/nodejs/ · error catalog: https://docs.self.xyz/docs/self-enterprise/sdk/error-handling/
