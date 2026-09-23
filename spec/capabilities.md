# Capabilities document

Per-receiver advertisement of which chat kinds a Paykit receiver speaks. Cap: `MAX_CAPABILITIES_BYTES = 512` UTF-8. Duplicate JSON keys → null. Oversize → null.

## v2 document (outbound)

```
{
  version: 1,
  kind: "chat.receiver.capabilities.v0",
  receiver_path: "{app}/wallet" | "{app}/server",
  chat_kinds_v: 2,
  kinds: string[]
}
```

- `kinds` is optional. Absent → infer from `chat_kinds_v`. If `kinds` would overflow 512, omit it.
- `chat_kinds_v`: `1` = kinds-v1.1 without context/proposal; `2` = + context/proposal. Typing/receipt emit-gate remains `>= 1`.
- Extra keys: ignore. Duplicate keys: reject.

## Historical Hypercolor document

`hypercolor.receiver.capabilities` (exactly four keys, `receiver_path` `hypercolor/wallet`) is a historical fixture under `spec/historical/`. Validators do not accept it inbound. A v2 client reads and writes `chat.receiver.capabilities.v0` only. Inbound `chat.receiver.capabilities.v0` MUST NOT require exactly four keys.

## Paths

| App | Capabilities URL | Covered by grant |
|---|---|---|
| Hypercolor | `pubky://{owner}/pub/hypercolor.app/v1/receivers/{noisePublicKey}/capabilities.json` | `/pub/hypercolor.app/v1/:rw` |
| Shop | `pubky://{owner}/pub/pubky.app/v1/receivers/{noisePublicKey}/capabilities.json` | `/pub/pubky.app/:rw` |

Legacy `chat_kinds_v` also appears on `/pub/paykit.app/v0/receiver.json`. Additive parse: ignore unknown keys.

## Multi-receiver discovery

Each app keeps its own Paykit receiver (`hypercolor/wallet`, `marketplace/wallet`). Catalog, ordered:

1. Host-configured path.
2. Remaining known chat receiver paths: `hypercolor/wallet`, `marketplace/wallet`, future `chat/wallet`.

Sender: resolve markers in that order; **link to the first that answers**. Persist `remote_receiver_path` on the link row. Do not rotate a live link because a later catalog entry also answers. If the live receiver disappears (`not-enrolled`) and another catalog entry answers, that is a new `ensure_link_with_peer`, not a silent path swap.

A peer may have `hypercolor/wallet` speaking `chat_kinds_v=2` and `marketplace/wallet` speaking `2` with a shorter `kinds` list. Discovery uses the document at the receiver that answered.
