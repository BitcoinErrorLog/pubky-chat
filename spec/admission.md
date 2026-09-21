# Handshake admission

Admission is a **request filter**, not a delivery block for already-accepted conversations. `reject` is not a wire verb. Decline is local: wipe 1:1 held stream + link messages; keep already-authorized group history.

```
type AdmissionDecision = 'auto-accept' | 'request' | 'ignore';

interface AdmissionInput {
  ownerPubky: string;
  peerPubky: string;
  hasPriorRoutedConversation: boolean;
  hasExistingLink: boolean;
  isFollow: boolean;
  isFollower: boolean;
  isOrderOrOfferParticipant: boolean;
}
```

## Shipped policies

| Name | `auto-accept` when | Else |
|---|---|---|
| `hypercolor-wot` | `hasPriorRoutedConversation` | `request` |
| `shop` | `hasExistingLink` OR `hasPriorRoutedConversation` OR `isOrderOrOfferParticipant` OR host `isFollow`/`isFollower` when those oracles return true | `ignore` |
| `open` | never | `request` |

`hypercolor-wot`: follow, mutual follow, and manual add **must not** auto-accept. They are ranking signals, not accept conditions.

`shop`: the library MUST NOT call Nexus. Host oracles MAY return false until Shop wires follows/followers. Shop WASM cannot enumerate unknown inbound initiators, so unnamed peers map to `ignore` (do not probe / do not answer).

`open`: persist handshake and surface in requests. Requires a transport that can observe unknown inbound initiators. If the adapter cannot enumerate them, `open` degrades to `ignore` and the host must document that.

Vectors: `spec/vectors/admission.json`.
