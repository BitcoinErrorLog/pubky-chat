# Historical fixtures

Reference schemas and vectors for kinds v2 does not accept inbound.

`scripts/check-wire-vectors.mjs` checks each file in `vectors/` against the schema in `schemas/` only. Those kinds are absent from the v2 known-inbound set. A v2 vector that uses one is unknown-kind: persist on the stream, leave unprocessed, do not normalize it into a `chat.*` kind.

| Kind | Retired shape |
|---|---|
| `pubky_app.dm.v0` | DM before `chat.message.v0` |
| `marketplace.chat_message.v0` | Listing chat before `chat.context.v0` plus `chat.message.v0` |
| `chat.reaction.v0` | DM tag-add alias (`emoji`) before `chat.tag.v0` |
| `chat.group.reaction.v0` | Group tag-add alias (`emoji`) before `chat.tag.v0` |
| `hypercolor.receiver.capabilities` | Four-key capabilities document before `chat.receiver.capabilities.v0` |

`chat.reaction.v0`, `chat.group.reaction.v0`, and `hypercolor.receiver.capabilities` existed so kinds-v1 clients would keep decoding. A v2 client sends `chat.tag.v0` and `chat.receiver.capabilities.v0`. Hypercolor and the Shop cut over with a local reset, so v2 does not keep the aliases.
