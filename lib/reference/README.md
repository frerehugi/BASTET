# `lib/reference/`

Dormant reference ports: implementations lifted from external repos Claude was asked to
study, adapted but **not wired into any live route**. Same pattern as `src/reference/`
in the sibling `frerehugi/OSIRIS` repo — a place to park "we already looked at how X
does this" instead of re-researching it cold next time. Each file's own header
documents provenance, what carried over, and — importantly, see the OSIRIS copy's
history — whether an activation path has actually been *checked*, not just assumed.

## Current contents

| File | Ported from | Purpose | Status |
|---|---|---|---|
| `paymentRequestQr.ts` | [`Investorquab/CeloDesk`](https://github.com/Investorquab/CeloDesk), `frontend/components/CheckoutClient.tsx` (`paymentQrValue()`) — same port already made in `frerehugi/OSIRIS`'s `src/reference/paymentRequestQr.ts` | Builds an EIP-681 `ethereum:<token>@<chainId>/transfer?...` payment-request URI for a scannable QR. | Dormant, **speculative fit** for the planned (not yet built) Phase 4 x402 premium endpoint in the doc-Arm — see the file header for the reasoning and the open question that needs checking before it's actually used. |

## A lesson carried over from OSIRIS, worth repeating here

The OSIRIS copy of this same module originally shipped with a wrong claim ("scan this
to fund your vault") that fell apart on a closer read of the actual contract code
(`DcaVault.sol`'s `setupPlan()` pulls funds via `safeTransferFrom` in one signed
session — there's no moment a QR would help). Before wiring `paymentRequestQr.ts` into
anything here, actually verify the same way: read the live `x402.celo.org/SKILL.md`
integration flow first (per `build/claude-code-buildplan.md` Phase 4, point 11 — "nicht
aus diesem Dokument kopieren, das veraltet") and confirm x402's own facilitator flow
doesn't already give a human browser user an equivalent (or better) payment UI on its
own. If it does, this module stays exactly as unused here as it is in OSIRIS/Sterntaler/
Clock-it.
