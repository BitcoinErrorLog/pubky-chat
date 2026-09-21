# chat-store schema notes

Library persistence for Encrypted-Link chat. Hosts keep a single SQLite `user_version` (Hypercolor mobile v26+ for context/proposal; web v23+). Frozen Hypercolor migrations are never rewritten. Additive columns only: `chat_contexts`, `chat_proposals`, `link_messages.context_id`.

## Conversation rows

| Shape | `conversation_id` |
|---|---|
| Unscoped DM | `dm:{peerPubky}` |
| Context thread | `ctx:{peerPubky}:{context_event_id}` |
| Private group | `channel:{channel_id}` |

`chat_contexts`: `(owner_pubky, peer_pubky, subject, context_event_id, label, sent_at)` plus a compatibility index on raw Shop `conversation_id` for one dual-read release.

`chat_proposals`: `(owner_pubky, peer_pubky, proposal_id, state, open_event_id, terms_json, updated_at)`.

## Wipe

Sign-out / owner-switch calls `clearOwnerChatData` in this order:

1. `store.listAttachmentMeta()` (need `key_ref` / cache paths **before** SQL delete)
2. `keyStore.deleteAttachmentSecret` per row, then `clearAttachmentSecretsForOwner` (and `clearIfOwner` on switch)
3. host cache file deletes
4. host journals keystore/cache failures into **host** `pending_cleanup` via `journalFailure` (library does not INSERT)
5. `store.clearOwnerData()` SQL deletes — includes `links_archive`, `attachments`, `chat_contexts`, `chat_proposals`

`pending_cleanup` stays host-owned. Hypercolor **must** pass `journalFailure`; omitting it is a host defect. `ChatStore.ownerPubky` is bound at construction. Reuse across owners is forbidden.

Wipe-guard tests must name `chat_contexts`, `chat_proposals`, and `links_archive` in the DELETE body.

## Shop dual-read

Live Shop Dexie listing_ref is `listing:{seller}_{listingId}` (underscore, `buildMarketplaceListingAggregateId`). Conversation aggregate is `conversation:{seller}_{buyer}_{listingId}`. Persist both raw ids. Do not prefix `listing:` onto an already-prefixed `listing_ref`. `wrap_version` 0/absent = legacy plaintext tolerated on read; new writes `wrap_version=1` only.
