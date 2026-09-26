---
name: self
summary: 'Start here. The root skill maps out the Self product family and routes your agent to the right one — Self Enterprise, Self Pass, Self Connect, or Agent ID.'
description: 'Root skill for Self (self.xyz) — a privacy-first identity protocol using zero-knowledge proofs to verify real-world documents (passports, EU ID cards, Aadhaar) without exposing personal data. Use this skill FIRST whenever the user mentions Self, self.xyz, Self Protocol, zero-knowledge identity, passport/ID verification, privacy-preserving KYC, age verification, nationality checks, OFAC screening, proof-of-human, or Sybil resistance. It explains the product family and routes you to the right product skill: self-enterprise, self-pass, self-connect, or agent-id.'
---

# Self Protocol

Self lets users prove identity attributes (age, nationality, humanity) from passports and ID cards using zero-knowledge proofs — the underlying personal data never leaves the user's device. Users scan their document's NFC chip in the Self mobile app once, then disclose only the attributes an app explicitly asks for.

This is the **root skill**. Its job is to identify which Self product fits the user's task and load the matching product skill. Read the routing table below, then install/open the matching skill.

## Pick the right product

| If the user wants to…                                                                                                                                                                                                  | Use product         | Skill to load     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------- |
| Add identity verification with a **managed dashboard + hosted page + webhooks** (no infra)                                                                                                                             | **Self Enterprise** | `self-enterprise` |
| Maintain an **existing integration** of the open-source SDK: frontend QR (`@selfxyz/qrcode`), backend verifier (`@selfxyz/core`), or on-chain Solidity contracts (legacy; new integrations should use Self Enterprise) | **Self Pass**       | `self-pass`       |
| Map **off-chain identifiers** (phone, email, social handles) to **on-chain addresses**                                                                                                                                 | **Self Connect**    | `self-connect`    |
| Give an **AI agent** a verifiable, on-chain proof-of-human identity (ERC-8004 soulbound NFT)                                                                                                                           | **Self Agent ID**   | `agent-id`        |

If unsure, ask the user two questions: (1) do they want a managed service or to run the verification themselves, and (2) is the consumer a web app, a smart contract, or an AI agent.

## The product family at a glance

- **Self Enterprise**: the managed plane. Configure a flow (Pre-KYC / Age Verification / Proof of Human / Sovereign) in the dashboard, call one `sessions.create(...)` from your backend, send the user to a hosted page, and receive a signed `verification.completed` webhook. Self handles proof verification, storage, and the verification record. Package: `@selfxyz/enterprise-sdk`.
- **Self Pass**: the open-source, self-hosted SDK, now **legacy**. You render the QR yourself and verify proofs yourself, off-chain (`@selfxyz/qrcode` + `@selfxyz/core`) or on-chain (`@selfxyz/contracts` on Celo). New integrations should use Self Enterprise; existing ones can migrate: https://docs.self.xyz/docs/self-enterprise/migration/from-self-pass-sdk/
- **Self Connect** — an open protocol mapping plaintext identifiers (phone numbers, Twitter handles, emails) to blockchain addresses via a federated `FederatedAttestations` registry and privacy-preserving ODIS hashing. Package: `@celo/identity`.
- **Self Agent ID** — an on-chain registry that binds an AI agent's identity to a Self human proof, issuing a soulbound ERC-721 NFT (ERC-8004 Proof-of-Human). SDKs in TypeScript, Python, and Rust.

## Core concepts shared across products

1. **Disclosures** — the attributes an app requests: `minimumAge`, `nationality`, `ofac` (sanctions screening), `excludedCountries` (ISO 3-letter codes, max 40), `gender`, `name`, `dateOfBirth`, etc. Request the minimum necessary — every disclosure is shown to the user for approval.
2. **Config matching is mandatory**: the verification rules (`minimumAge`, `excludedCountries`, `ofac`) the backend or contract enforces must match what the frontend requests; a mismatch fails verification (the Pass SDK throws `ConfigMismatchError`).
3. **Test vs. live** — mock passports work only on staging/testnet (Celo Sepolia); real passports work only on production/mainnet (Celo Mainnet). To create a mock passport: open the Self app and tap the Passport button **5 times** (OFAC must be disabled for mock testing).
4. **Nullifiers** give Sybil resistance — one proof per scope per person.
5. **Never invent** API keys, scopes, contract addresses, or endpoints — ask the user for real values.

## Docs

- Overview & all products: https://docs.self.xyz/
- Enterprise quickstart: https://docs.self.xyz/docs/self-enterprise/get-started/quickstart/
- The four Enterprise workspaces compared: https://docs.self.xyz/docs/self-enterprise/workspaces/
- Search the docs live with the Self MCP server: https://docs.self.xyz/mcp/
