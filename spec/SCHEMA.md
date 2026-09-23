# chat-store schema notes

Library persistence for Encrypted-Link chat. Hosts keep a single SQLite `user_version` (Hypercolor mobile v26+ for context/proposal; web v23+). Frozen Hypercolor migrations are never rewritten. Additive columns only: `chat_contexts`, `chat_proposals`, `link_messages.context_id`.

## Conversation rows

| Shape | `conversation_id` |
|---|---|
| Unscoped DM | `dm:{peerPubky}` |
| Context thread | `ctx:{peerPubky}:{context_event_id}` |
| Private group | `channel:{channel_id}` |

`chat_contexts`: `(owner_pubky, peer_pubky, subject, context_event_id, label, sent_at)`. No compatibility index on a raw Shop `conversation_id`.

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

## Listing threads

Listing threads are `chat.context.v0` with `subject` a `pubky://` ref, then messages that set `context_id`. `marketplace.chat_message.v0` is not accepted inbound, and the store does not persist its raw `conversation_id` or `listing_ref`. New attachment writes use `wrap_version=1`.
