# pubky-chat kinds v2

Normative wire contract for Encrypted-Link Private Application Messages (PAMs). Envelope field `version` is `1` for every `*.v0` kind. `CHAT_KINDS_V` advertised on the capabilities document is `2`. Typing and receipt emit-gating still fires at `chat_kinds_v >= 1`.

Transport cap: `LINK_MESSAGE_MAX_BYTES = 1000` UTF-8 of `JSON.stringify`. Authorship is the Noise-authenticated link peer. A JSON `author` / `sender` field is never trusted. Extra JSON keys on a known kind: ignore. Missing required keys or wrong types: malformed. Unknown kinds: persist on the stream, leave unprocessed, never skip the transport checkpoint. Oversized **known** kinds: consume/seen, do not persist. Oversized unknown: store, unprocessed.

JSON Schemas live in `spec/schemas/`. Vectors live in `spec/vectors/`. `scripts/check-wire-vectors.mjs` checks every vector against its schema and that kinds-v1 vectors still validate under v2 schemas.

## Envelope

Common required fields:

| Field | Rule |
|---|---|
| `version` | `1` |
| `kind` | string; schema of the PAM |
| `event_id` | UUID `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| `sent_at` | positive Unix ms, integer, max `8.64e15` |

`channel_id` is omitted for 1:1. Private groups use founder-bound `{52-char-pubky}:{uuid}`. Group-scoped control kinds require an active member.

Dedup DM: `(owner_pubky, sender_pubky, kind, event_id)`. Dedup group: `(owner_pubky, channel_id, sender_pubky, event_id)`. Display order: `sent_at`, tie-break `event_id`. Replay of the same dedup key → ignore.

LWW `sent_at` clamp: reject `sent_at` more than **5 minutes** ahead of the receiver clock for `chat.edit.v0` and `chat.pin.v0`. Group edit/delete keep arrival-order apply.

Device prefs (not on the wire): `receipts_enabled` default on, `typing_enabled` default on. Off → do not emit; still accept inbound (typing UI suppressed if pref off).

## Conversation identity

A **link** is 1:1 with a peer. A **conversation** is `(peer, context_id | null)`:

| Shape | Local `conversation_id` | Wire |
|---|---|---|
| Unscoped DM | `dm:{peerPubky}` | `chat.message.v0` with no `context_id` |
| Context thread | `ctx:{peerPubky}:{context_event_id}` | `chat.context.v0` then messages/proposals with `context_id` = that `event_id` |
| Private group | `channel:{channel_id}` | group kinds; no context overlay in v0.1.0 |

Inbound `chat.message.v0` without `context_id` lands in the unscoped DM. Listing threads **must** set `context_id` outbound so two listings with the same seller do not collapse. Byte cost of `"context_id":"<uuid>"` ≈ 52 UTF-8.

## Kind catalog (23 `chat.*` kinds)

### `chat.message.v0`

```
{ version:1, kind:"chat.message.v0", event_id, sent_at, body,
  reply_to?, reply_to_author?, mentions?, forwarded_from_event_id?,
  forwarded_from_author?, forwarded_from_channel_id?, context_id? }
```

- `body`: trim, non-empty.
- Reply: `reply_to` and `reply_to_author` required together. Quoted excerpt never on the wire.
- Mentions: `[{ pubky, start, end }]`, UTF-16 offsets, max 8, no overlap, no surrogate split.
- Forward: citation only, no nested body. Public-channel → private is `cross-context`.
- Optional `context_id` (v2). Shop listing threads always set it. Unscoped DMs omit it.

### `chat.attachment.v0`

Access PAM. Ciphertext at `location`; key/nonce on the link; AAD = `location`. Optional thumbnail at `location + ".thumb"` with its own key/nonce and AAD = thumbnail `location`. Caps: 8 MiB + 256 KiB thumb. `contentType` is sender-asserted; renderers sniff. Path prefix is **host-injected** (Hypercolor `/pub/hypercolor.app/v1/attachments/`; Shop `/pub/pubky.app/v1/attachments/`). Library types MUST NOT hard-code Hypercolor. Optional `context_id`. Algorithm `XChaCha20Poly1305`. Durable copies replace key/nonce with `__keystore__`.

### `chat.tag.v0`

```
{ version:1, kind:"chat.tag.v0", event_id, sent_at, target_event_id,
  target_author_pubky, label, op:"add"|"remove", channel_id? }
```

- `label`: NFC trim; one emoji grapheme **or** `/^[a-z0-9_]{1,32}$/`; UTF-8 ≤ 32 B.
- Add is idempotent per semantic PK. Remove deletes that row only.

### `chat.group.reaction.v0` / `chat.reaction.v0`

Legacy aliases for tag add (`label` / `emoji`). Dual-write one release for group senders (different `event_id`s). Decode → `chat.tag.v0` op=add.

### `chat.receipt.v0`

```
{ version:1, kind:"chat.receipt.v0", event_id, sent_at,
  status:"delivered"|"read", event_ids: UUID[1..16], channel_id? }
```

Monotonic `sent → delivered → read`. Never own ids. Group receipts 1:1 to the author only. Emit only if peer `chat_kinds_v >= 1`. Unknown target ids ignored.

### `chat.typing.v0`

```
{ version:1, kind:"chat.typing.v0", event_id, sent_at, state:"start"|"stop", channel_id? }
```

Never SQLite. 5 s TTL. 2 s coalesce. Emit-gated. Unknown `state` → `invalid-state`.

### `chat.edit.v0` / `chat.delete.v0`

Edit: `{ version:1, kind:"chat.edit.v0", event_id, sent_at, target_event_id, body, mentions? }`  
Delete: `{ version:1, kind:"chat.delete.v0", event_id, sent_at, target_event_id }`

Author only. Edit stored-compare LWW + 5 min clamp. Cannot edit tombstones, attachments, or payment PAMs (`not-editable`). Delete = unsend tombstone: redact stream rows, delete `delivery_queue` for the target, wipe attachment KeyStore via sender-scoped `att:{owner}:{sender}:{eventId}` → `unavailable-from-backup`. `channel_id` on DM edit/delete is `bad-channel-id`.

### `chat.pin.v0`

```
{ version:1, kind:"chat.pin.v0", event_id, sent_at, target_event_id,
  target_author_pubky, op:"set"|"clear", channel_id? }
```

DM: either peer. Group: active admin. One pin per conversation. LWW + 5 min clamp. On `clear`, target fields are required on the wire but ignored on apply.

### `chat.group.message.v0` / `chat.group.edit.v0` / `chat.group.delete.v0`

Pairwise fan-out; no shared group key. Edit/delete: author only; arrival-order (not LWW clamp). `channel_id` required.

### `chat.group.membership.v0`

```
{ version:1, kind:"chat.group.membership.v0", event_id, sent_at, channel_id,
  op:"create"|"add"|"remove"|"leave", subject_pubky?, name?, members? }
```

Founder-bound create. Admin add/remove. Leave self only.

### `chat.group.invite.v0`

PAM invite, **not** in `GROUP_WIRE_KINDS`. Peek-route. No bearer URL.

```
{ version:1, kind:"chat.group.invite.v0", event_id, sent_at, channel_id,
  invite_id, name, expires_at }
```

`invite_id` UUID. `name` ≤ 64 NFC. `expires_at` Unix ms, 1h–7d ahead of `sent_at`.

### `chat.public.message.v0`

Host-only (Hypercolor public channels, homeserver plaintext). The library MAY ignore as unknown. Schema exists so hosts can validate.

### `chat.context.v0` (v2)

Bind a 1:1 link slice to a subject the **app** resolves. The library does not fetch or validate the resource beyond URL shape.

```
{ version:1, kind:"chat.context.v0", event_id, sent_at,
  subject, label?, channel_id? }
```

- `subject`: `pubky://` URL, 16..512 UTF-8. No `https://`. No relative paths. Query strings allowed (opaque).
- `label`: optional NFC trim, 1..64; display hint; ignore if empty.
- `channel_id` present → `cross-context` (forbidden in v0.1.0).
- Authority: any peer on the DM link. First valid context for `(owner, peer, subject)` creates the conversation row. Replay same `event_id` → ignore. Later context with the **same** `subject` is a no-op. Later context with a **different** `subject` opens another conversation row on the same link.
- Local PK: `(owner_pubky, peer_pubky, subject)`. Store `context_event_id = event_id` of the **first** accepted row. Do not rotate `context_id` when a duplicate arrives.
- Validation: `invalid-subject`, `invalid-label`, `cross-context`, `bad-pubky`.
- Gated peers: persist, do not route.

### `chat.proposal.propose.v0`

```
{ version:1, kind:"chat.proposal.propose.v0", event_id, sent_at,
  proposal_id, amount, currency, subject?, body?, context_id?, channel_id? }
```

- `amount`: `/^[0-9]+(\.[0-9]{1,11})?$/` and not all-zero. `0` / `0.0` → `invalid-amount`.
- `currency`: `btc` | `sat` | `[A-Z]{3}` (ISO 4217).
- `subject` if set must be a `pubky://` URL; if `context_id` is set it must match an accepted context on this link.
- `channel_id` forbidden (`cross-context`).

### `chat.proposal.counter.v0`

Same terms as propose, plus `supersedes_event_id` (UUID of the currently-open propose/counter). `proposal_id` unchanged.

### `chat.proposal.accept.v0` / `reject.v0` / `withdraw.v0`

```
{ version:1, kind:"chat.proposal.accept.v0"|"chat.proposal.reject.v0"|"chat.proposal.withdraw.v0",
  event_id, sent_at, proposal_id, target_event_id, reason?, context_id? }
```

`reason` is reject-only; trim ≤ 140 NFC; omit if empty.

### Proposal state machine

Per `proposal_id` on `(owner, peer)`:

```
                 propose
                   │
                   ▼
              ┌─────────┐  counter (from other party)
              │  open   │◄────────────────────────┐
              └─────────┘                         │
               │  │  │                            │
     accept*   │  │  │ withdraw†                  │
               │  │  │ reject*                    │
               ▼  ▼  ▼                            │
         accepted / withdrawn / rejected          │
```

1. Only one `open` proposal per `(owner, peer, proposal_id)`. A second `propose` with a **new** `proposal_id` is allowed. A second `propose` with the same id while open → ignore.
2. `counter` is valid only from the party who did **not** author the currently-open event; `supersedes_event_id` must match that event else `bad-target-id`.
3. `accept` / `reject`: same actor rule as (2). Wrong actor → `wrong-author`, processed, no state change.
4. `withdraw`: only the author of the currently-open event. After withdraw, no further counter/accept.
5. Terminal states ignore later verbs for that `proposal_id` (idempotent no-op, processed).
6. Accept **does not move money**. Settlement is a later `paykit.payment_*` on the same link, or a host service. Do not invent a `chat.payment.*` kind.
7. Gated peers: persist, do not apply.
8. Apply is keyed by `event_id` first (dedup), then by the state machine.

Who may accept on the wire: the Noise peer who is **not** the `senderPubky` of the currently-open propose/counter. Hosts MAY further restrict in the composer.

### `chat.receiver.capabilities.v0`

See [capabilities.md](capabilities.md). Inbound also accepts `hypercolor.receiver.capabilities` (exactly four keys). Outbound emit v2. Cap 512 UTF-8.

## Paykit payment kinds (not `chat.*`)

Official Paykit PAMs travel on the same link: `paykit.payment_request`, `paykit.payment_request_acceptance`, `paykit.payment_request_rejection`, `paykit.payment_request_cancellation`, `paykit.payment_proof`, `paykit.private_payment_list`. Proof is `not-editable` / `not-deletable`. Outbound chat uses only `chat.*` and `paykit.payment_*`.

## Known-inbound registry (v2)

`isKnownInboundChatKind` is the web list plus `chat.context.v0` and all five `chat.proposal.*` kinds: message, `pubky_app.dm.v0`, attachment, tag, receipt, typing, edit, delete, pin, invite, group wire kinds, Paykit payment kinds, context, propose/counter/accept/reject/withdraw. `chat.public.message.v0` stays host-only. `chat.group.invite.v0` is peek-routed, not in `GROUP_WIRE_KINDS`.

## Legacy aliases (one release)

| Inbound kind | Normalize to | Fields |
|---|---|---|
| `pubky_app.dm.v0` | `chat.message.v0` | `body`, `event_id`, `sent_at` (Unix-ms **or** ISO-8601). No `context_id`. Unscoped DM `dm:{peer}`. |
| `marketplace.chat_message.v0` | `chat.message.v0` + synthetic context | `body`, `event_id`, `sent_at`, raw `conversation_id` (`conversation:{seller}_{buyer}_{listingId}`), raw `listing_ref`. Live Shop listing_ref is `listing:{seller}_{listingId}` (underscore). Upsert a local context: `subject` = host-resolved `pubky://` if a resolver is injected; else `legacy-subject` = the raw `listing_ref` (do **not** wrap as `listing:{listing_ref}`). Persist raw `conversation_id` on a compatibility index. |
| `chat.group.reaction.v0` / `chat.reaction.v0` | `chat.tag.v0` op=add | existing |
| `hypercolor.receiver.capabilities` | `chat.receiver.capabilities.v0` | four-key document, legacy parse only |

Outbound: **only** `chat.*` and `paykit.payment_*`. After the window, inbound aliases become unknown-kind.

## Admission, redelivery, capabilities

- Admission policies: [admission.md](admission.md) (`hypercolor-wot`, `shop`, `open`).
- Capabilities document and multi-receiver discovery: [capabilities.md](capabilities.md).
- After SDK recovery establishes a new link: re-send every **own** un-receipted outbound item on the new link, **idempotent by `event_id`**. Receivers already dedupe `(owner, sender, kind, event_id)`. Attachment keys re-bind to `(peer, conversation)`, never JS `linkId`. **Zero remote deletes** of link history; fail closed into `reconnect_required`. Do not call Shop `clearEncryptedLinkOutbox` on an established or recoverable snapshot. Queued copy is `Queued` while `deliveryState === 'sending'`. Never label a queued item `Sent`.

## Reason enum

`not-json` · `oversized` · `unknown-kind` · `wrong-kind` · `bad-version` · `bad-event-id` · `bad-sent-at` · `bad-channel-id` · `bad-target-id` · `bad-pubky` · `invalid-label` · `invalid-op` · `invalid-status` · `invalid-event-ids` · `event-ids-cap` · `invalid-state` · `empty-body` · `invalid-mentions` · `reply-fields-mismatch` · `cross-context` · `wrong-author` · `not-member` · `not-admin` · `not-editable` · `not-deletable` · `gated-peer` · `expired` · `invalid-subject` · `invalid-amount` · `invalid-currency` · `proposal-closed`

## Byte proofs

UTF-8 of `JSON.stringify`, fixtures `uuid=01234567-89ab-cdef-0123-456789abcdef`, `pubky=a×52`, `sent_at=1757000000000`. Re-run 2026-09-21:

```
tag add 👍 DM: 268
tag worst 32xw + channel: 401
receipt 12 ids DM: 615
receipt 16 ids + channel: 876
receipt 20 ids no channel: 927
receipt 16 ids no channel: 771
receipt 17 ids + channel: 915
typing DM: 127
typing group: 232
delete: 168
edit 700-char body: 876
pin DM: 253
pin + channel: 358
invite 64-char name: 374
one mention object: 82
message + reply pair + 8 mentions (body 5): 927
context 512-byte subject + 64-char label: 712
proposal worst-case 512-byte subject: 831
shop marketplace.chat_message.v0 sample: 428
shop pubky_app.dm.v0 sample: 156
capabilities v1: 108
capabilities v2: 178
```

Every listed envelope is under 1000 B (capabilities under 512 B). Literal values: `spec/byte-proofs.json`.

## Test vectors

| File | Coverage |
|---|---|
| `vectors/kinds-v1.json` | kinds-v1.1 replay: valid, oversized, malformed, wrong-author, LWW, duplicate `event_id`, byte proofs |
| `vectors/context.json` | minimal / 512-byte subject, `invalid-subject`, duplicate subject, two subjects, gated, `cross-context`, optional `context_id` on message |
| `vectors/proposal.json` | propose→counter→accept, withdraw, reject, wrong-party accept, double accept, amount `0`, currency, `supersedes_event_id` mismatch, oversized |
| `vectors/aliases.json` | `pubky_app.dm.v0` Unix-ms and ISO `sent_at`; Shop `marketplace.chat_message.v0` with live `listing_ref`; unknown `commerce.foo` |
| `vectors/capabilities.json` | v1 four-key, v2 document, Shop path, extra key, duplicate JSON keys, >512 B |
| `vectors/redelivery.json` | same `event_id` twice after recovery → one transcript row |
| `vectors/admission.json` | WoT prior-routed vs stranger; Shop named/unnamed/existing-link; open |

Each envelope vector is `{ name, schema, raw, ctx, expect, suite }`. `suite: v1` vectors with `expect.schema: valid` must still pass the v2 schema of the same kind.
