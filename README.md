# pubky-chat

Encrypted-Link chat kinds for Pubky apps. Spec first; TypeScript packages (`@pubky/chat-*`) land when Hypercolor consumes them.

## Spec

| Path | What |
|---|---|
| [spec/kinds-v2.md](spec/kinds-v2.md) | Envelope, 21 `chat.*` kinds, proposal state machine, size limits, redelivery |
| [spec/capabilities.md](spec/capabilities.md) | Per-receiver capabilities document and multi-receiver discovery |
| [spec/admission.md](spec/admission.md) | Handshake policies: Hypercolor WoT, Shop, open |
| [spec/SCHEMA.md](spec/SCHEMA.md) | Store tables and wipe order |
| [spec/schemas/](spec/schemas/) | JSON Schema per accepted kind |
| [spec/vectors/](spec/vectors/) | Kinds-v1 replay of still-valid v2 messages, context, proposal, capabilities, redelivery, admission |
| [spec/historical/](spec/historical/) | Reference fixtures for retired kinds. Not accepted inbound. |

```
npm test
```

runs `scripts/check-wire-vectors.mjs`: every v2 vector against its schema. Historical vectors are checked only against their own schemas, and v2 validation rejects them as inbound. Kinds-v1 fixtures that remain in `spec/vectors/` are still valid v2 messages.

## Constraints

- MIT. Public. Packages unpublished until a later tagged release.
- Production primitives only. No Sealed Blob v2, UKD/AppCert, Molt, Drop relay, or legacy `pubky-noise`.
- Paykit owns transport and payments. Chat kinds are an app-defined meta-protocol on Encrypted Links.
- One `chat.*` vocabulary. Marketplace needs are `chat.context.v0` plus `chat.proposal.*`. No `commerce.*` namespace.

## Layout

```
spec/           normative contract, schemas, vectors
scripts/        vector validator (Node, Ajv)
packages/       not present yet — extraction requires callers
native/         not present yet
```
