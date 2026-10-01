# One chat for Pubky: unification plan

**For:** engineers on Rooms, Hypercolor, Paykit, Pubky core, Ring/Passport, pubky.app and the Shop.

**Related documents:**

- SSO: [Pubky SSO design](https://github.com/BitcoinErrorLog/pubky-marketplace/blob/master/docs/sso/pubky-sso-design.md) and [SSO proposal for the team](https://github.com/BitcoinErrorLog/pubky-marketplace/blob/master/docs/sso/sso-proposal-for-team.md).
- Shop messaging context:
  - [Shop team brief](https://github.com/BitcoinErrorLog/pubky-marketplace/blob/master/docs/launch/shop-team-brief.md);
  - [Paykit team brief](https://github.com/BitcoinErrorLog/pubky-marketplace/blob/master/docs/spec-feedback/paykit-team-brief.md);
  - the Shop's [messaging research and implementation notes](https://github.com/BitcoinErrorLog/pubky-app/blob/release/shop-v0.6.8/docs/ecommerce/messaging/README.md).
- Chat spec today: [pubky-chat `spec/`](https://github.com/BitcoinErrorLog/pubky-chat/tree/main/spec).

Sizes follow the SSO plan:

- **S:** one component, no wire change.
- **M:** several modules or a new UI surface; any wire change is additive.
- **L:** a protocol change with new verification rules and coordination across repos.

## Answer

- **The vocabulary already exists; the transport is the gap.** Hypercolor's work already produced most of what one chat needs:
  - one `chat.*` message vocabulary with schemas and vectors;
  - a package layout for a shared library (`@pubky/chat-*`);
  - admission policies, honest status copy, and recovery rules that never delete remote history.

  Keep all of it. What it can't give is a transport with forward secrecy and post-compromise security, multi-device, cryptographic group membership, or a first message to an offline peer. Paykit Encrypted Links (Noise XX) provide none of these.
- **Crypto.** Use **MLS (RFC 9420)** for private conversations, as a new transport behind the library's existing `ChatTransport` seam. Encrypted Links remain Paykit's payment channel, and they carry chat only until MLS ships.
- **Delivery.** Each device writes its own ciphertext to its owner's homeserver under `/pub/chat/v1/`. Readers fetch from the authors' homeservers. This is the author-owned model Rooms uses for public rooms.
- **Identity binding.** A device key counts only when the user's grant names it. This closes the unsigned-marker gap, and it is the chat form of SSO item Y3 ("the grant doubles as the app certificate").
- **Hub:** [BitcoinErrorLog/pubky-chat](https://github.com/BitcoinErrorLog/pubky-chat) (§7).
- **The Shop now:**
  - marker hardening (S) and encrypted history at rest (S);
  - the SSO messaging port (Y1, Y2, F2) stays on the SSO critical path, because it is the near-term way off cookies for Bitkit and Passport users.

## 1. Prior work and decisions

### 1.1 Sources

| Source | What it is | Status |
|---|---|---|
| [pubky-rooms](https://github.com/secondl1ght/pubky-rooms) `1c5e16b` (Matt) | Public live rooms in Phoenix LiveView. Author-owned files under `/pub/pubky-rooms/`. Grant held by the server. Tag/Nexus discovery | Feature-complete, on staging |
| [hypercolor](https://github.com/BitcoinErrorLog/hypercolor) `6713b2f` | React Native messenger on Encrypted Links | Android 1.1.0. [#7](https://github.com/BitcoinErrorLog/hypercolor/pull/7) (SDK-managed links) open |
| [hypercolor-web](https://github.com/BitcoinErrorLog/hypercolor-web) `9534b79` | Web client, plus [ADRs 0001–0004](https://github.com/BitcoinErrorLog/hypercolor-web/tree/main/docs/adr) and the [graph review](https://github.com/BitcoinErrorLog/hypercolor-web/blob/main/docs/graph-utilisation-review.md) | ADRs are Proposed. [#7](https://github.com/BitcoinErrorLog/hypercolor-web/pull/7) (stock Ring auth) open |
| hypercolor-web branch `feat/homeserver-migration-proof`, `docs/architecture-comparison.md` | Hypercolor compared with Signal and Keet on identity, delivery, portability, censorship, metadata and history | Branch only |
| [pubky-chat](https://github.com/BitcoinErrorLog/pubky-chat) `fcdb094` | `kinds-v2` (21 `chat.*` kinds), capabilities, admission, store schema, 90 vectors, CI | Spec only. No packages yet |
| pubky-chat package specification, rev2 (21 Sep 2026) | `@pubky/chat-*` package boundaries, public API, extraction map, Q1–Q10. Program decisions D1–D9 | Passed independent review and security audit. Not published |
| SDK-managed links migration design, rev2, and client migration waves (21–23 Sep) | Owner decisions 1–9 on Encrypted-Link recovery | Passed the security audit; implementation is in the open PRs above |
| First-contact root-cause analysis (Sep 2026) | Why a stranger's first message is never seen | Not published |
| Pubky chat context dossier and chat app plan (29–30 Aug) | Feature bar, authority order, deferred items | Superseded where noted below |
| [pubky-app-specs#142](https://github.com/pubky/pubky-app-specs/pull/142) (social specs v1 RFC) | App-neutral `{pub,priv}/social/v1/` namespace and an owner-only `/priv/` tier | Open RFC |
| SSO docs (linked above) | Grants, delegation, borrowed sessions, Y1–Y3, F2 | Published |

### 1.2 Decisions already made, and what this plan does with them

**Adopt** means the decision is kept as is. **Adapt** keeps its intent with a stated change. **Supersede** replaces it, with the argument given.

| # | Decision (source) | Verdict | Reason |
|---|---|---|---|
| P1 | One `chat.*` vocabulary, with no `commerce.*` namespace. Listings are `chat.context.v0`; offers are `chat.proposal.*` (D2, kinds-v2) | **Adopt** | It is transport-independent. It becomes the plaintext inside MLS application messages |
| P2 | Repo is `BitcoinErrorLog/pubky-chat`, MIT (D1) | **Adopt** | §7 |
| P3 | Package suite: `chat-core`, `chat-store`, `chat-transport-paykit`, `chat-attachments`, `chat-payments`, `chat-react`, `chat-backup`, `native/`. Hosts inject the session, homeserver client and oracles (package spec §1) | **Adopt**, plus a new `chat-transport-mls` | The layering already isolates transport. MLS slots in beside Paykit |
| P4 | "Never TypeScript crypto." Web runs the same Rust state machine through WASM (dossier; migration design decision 5) | **Adopt** | The MLS engine is Rust (OpenMLS), exposed through WASM and UniFFI. TypeScript keeps kinds, apply and storage |
| P5 | Production primitives only: no Sealed Blob v2, UKD/AppCert, Molt, drop relay, or legacy `pubky-noise` (D-constraints) | **Adopt** | The `att` claim (§3.2) is a proposal for the official grant format in pubky-core, not the fork-only AppCert. MLS is an IETF standard, not one of the excluded research primitives. Adopting it needs core's agreement (Q-C8) |
| P6 | Encrypted Links via SDK `ensure_link_with_peer`, behind `ChatTransport` (D4). Zero remote deletes on recovery. Re-delivery by `event_id`. Never rotate the receiver key to repair one link (migration decisions 1–9) | **Adopt for the transition** | It is the safe way to run Encrypted-Link chat until MLS. Its rules carry over: no remote deletes, re-delivery by `event_id` |
| P7 | Each app keeps its own receiver (`hypercolor/wallet`, `marketplace/wallet`), with multi-receiver discovery (D3) | **Supersede** for MLS | Under MLS every app installation is a device in the same group, so no app chooses a receiver. D3 still governs the Encrypted-Link transition |
| P8 | Admission policies `hypercolor-wot`, `shop` and `open`. Follow, mutual follow or manual add must not auto-accept (D5, admission.md) | **Adopt** | Admission is a request filter above the transport |
| P9 | Request rows show only the pubky, the arrival time and locally attested facts. Profiles resolve only when the row is opened, and render as untrusted plain text (ADR 0004 §7) | **Adopt** as a UX requirement | It closes a phishing surface and a delivery-confirmation channel |
| P10 | Outbound status is only `Queued`, `Sent` or `Failed`. "Delivered" and "read" never render until a receipt protocol ships (UX contract §B.3) | **Adopt** | `chat.receipt.v0` is in kinds-v2. "Read" shows only for peers who opted in to receipts |
| P11 | Foreground drain only; an opt-in, content-free push waker later (D7, NOTIFICATIONS.md) | **Adopt** | |
| P12 | Backup: a random 32-byte recovery code, shown once. It restores history but not link keys (D6, DECISIONS.md) | **Adapt** | The same code also seals the archive key (§3.6). MLS state is never backed up; devices rejoin |
| P13 | Attachments: per-file XChaCha20-Poly1305 key; v1 content-addressed with `blob_id`, AAD = `blob_id`, and re-seed (ADR 0001 §4) | **Adopt** v1 | The prefix is no longer injected by the host (package spec Q3): blobs live in the device folder |
| P14 | Private DMs stay Encrypted Links. Private groups are a group-as-pubky with per-member prefixes, a signed DAG and epoch keys sent over pairwise links. **MLS rejected as "wrong first increment"** (ADR 0001) | **Supersede** | §3.1 rebuts each reason. In short: grants have since made revocation real, pairwise epoch keys give no post-compromise security or multi-device, and a group tenant brings group-key custody Ring can't hold (ADR 0001 open question 1) |
| P15 | No sequencer; a causal DAG instead, for forkability (ADR 0001, alternatives) | **Adapt** | Only *commits* have a committer, and only membership changes wait on it. Forking stays possible: members re-create the group under a new committer (§3.4) |
| P16 | Public rooms are posts, tags and feeds under `/pub/pubky.app/` (ADR 0002) | **Adapt** | Keep tags as room discovery (Rooms already tags rooms) and "public is labeled public". Messages stay Rooms' room files, not posts (§3.5) |
| P17 | Open inbox through a sealed-pointer drop relay; exit through an upstream `Action::Append` (ADR 0004) | **Adapt** | The relay is excluded (P5). Keep "a pointer, never a body" and the append-only ask (H8) |
| P18 | Kinds-v2 accepts no inbound aliases. "Hypercolor and the Shop have no installed base"; cut over with a local reset (kinds-v2). Owner rule, 23 Sep: Hypercolor has no real users, so the upgrade is a clean cutover | **Adopt for Hypercolor; ask for the Shop** | Shop messaging is live for Ring users. The wire keeps no aliases, but the Shop imports history *locally* (Q-T4) |
| P19 | `chat.public.message.v0`, GIF search, contacts, TrustEngine and AuthKeepalive stay in the host (package spec §1.1) | **Adopt** | |
| P20 | Stock Ring `pubkyauth`; no fork handoff ([hypercolor#4](https://github.com/BitcoinErrorLog/hypercolor/pull/4), [hypercolor-web#7](https://github.com/BitcoinErrorLog/hypercolor-web/pull/7)) | **Adopt** | It matches the SSO grant model |
| P21 | Deferred: Double Ratchet, groups over 50, voice and video (dossier §9) | **Supersede** the first two | MLS covers both. Voice and video stay deferred |
| P22 | The founding Hypercolor plan: a bitchat mesh overlay with BLE (`hypercolor-chat-app-plan.md`) | **Superseded** already | Mesh is flagged off (DECISIONS.md) |
| P23 | Shared data moves to bare-word, app-neutral paths with an owner-only `/priv/` tier, and mutes go to `/priv/social/v1/mutes/` ([social specs v1](https://github.com/pubky/pubky-app-specs/pull/142)) | **Adopt** | Hence `/pub/chat/v1/` (not `chat.app`). Chat honors social-specs mutes |

**John's direction, 16 Sep:** "should we have a different thing than paykit for dedicated chat needs? because applying pubky-noise and applying paykit features are neither actual normal chat tools in themselves." This plan's answer is yes: a chat transport built for chat, with Paykit kept for payments.

## 2. What exists

| | **Rooms** (Matt) | **Shop messaging** | **Hypercolor + pubky-chat** |
|---|---|---|---|
| Crypto | **None.** Public JSON under `/pub/pubky-rooms/` | Encrypted Links, `Noise_XX_25519_ChaChaPoly_SHA256`, no rekey (`pubky-noise` rc5) | Same Encrypted Links (official-fork AAR or WASM). Attachments use XChaCha20-Poly1305 |
| Identity binding | Path ownership | Random receiver key in an **unsigned** marker. The peer's static key isn't checked against it | Same marker. The SDK-managed design adds a receiver-key fingerprint check on `Linked` |
| Forward secrecy / post-compromise security | n/a | Weak: snapshots keep the handshake ephemeral seed. None | Same transport |
| Multi-device | Yes: public files plus a server cache | **No**: a new browser replaces the key | **No**: backup restores history, not keys |
| Groups | Creator-owned room; members write in their own folders; the creator's bans are honored by readers | None | Pairwise fan-out, cap 50, no cryptographic removal |
| First message to an offline or unknown peer | n/a (public) | The initiator waits for the responder's handshake. Strangers are undiscoverable | Same. Root cause: the responder can't derive the path without the sender's pubky |
| Metadata | All public | Marker, link timing; length in rc5 (fixed in `pubky-noise` rc11); **buyer → seller → listing public** | Ciphertext paths; attachments on `/pub` |
| Auth | Grant held by the server, `/pub/pubky-rooms/:rw` | Cookie only (pubky 0.8 WASM) | Stock Ring `pubkyauth`; cookie-backed `SessionHandle` on web |
| Maturity | Staging with CI, e2e and VRT | Production, unreviewed fork stack | Pre-release apps; reviewed spec and designs |
| UX | Best live layer: presence, typing, pending → stored | Honest queued states, Requests, mutes | Richest vocabulary and copy rules |

**The common root cause:** write access to a path stands in for identity, and a pairwise handshake stands in for a messaging protocol.

## 3. Recommended design

### 3.1 Crypto: MLS, with ADR 0001's objections answered

| ADR 0001's reason against MLS | Status now |
|---|---|
| "Does not revoke homeserver sessions"; sessions last a year and only the holder can revoke | **Obsolete.** Grant auth checks revocation on every request. Ring and the SSO agent revoke per app or per browser (SSO §1, R2) |
| "Does not wipe old plaintext" | True of every protocol, including the epoch-key design ADR 0001 recommends |
| "Large implementation; not a Pubky primitive" | OpenMLS is a maintained Rust implementation. Wire's [core-crypto](https://github.com/wireapp/core-crypto) ships it to web, Android and iOS from one Rust core. Pubky still needs to adopt it (Q-C8) |
| "n ≤ 50 pairwise links can carry an epoch key" | They carry no post-compromise security and no multi-device. Writes grow as members × devices, and first contact still needs the responder online |

What MLS adds: asynchronous first message (KeyPackage + Welcome), forward secrecy and post-compromise security per epoch, a device as a leaf, logarithmic rekey, and cryptographic add and remove.

**Ciphersuite:** `MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519` (0x0003). Add a post-quantum hybrid ciphersuite once one is standardized.

**Required before launch:** an independent protocol review and a security audit.

### 3.2 Key hierarchy and the unsigned marker

```
pubky identity key (Ring / Bitkit / Passport; never in an app)
 └─ grant (signed by the identity, or by the SSO agent under H1 delegation)
     cnf = the app's PoP key; caps include /pub/chat/v1/:rw
     att = [{ purpose: "pubky-chat/device/v1", key: <device Ed25519 public key> }]   ← K5
      └─ device signature key = the MLS credential (one per app installation)
          ├─ KeyPackages (signed by the device key)
          └─ MLS epochs → message keys
```

- **Verification.** A device record is valid only when four things hold:
  - its grant verifies to the pubky;
  - the grant's `att` names the device key;
  - the grant is unexpired;
  - the grant is not revoked (H3).

  Another app that can write `/pub/chat/` can add only *itself*, as a device the user authorized, shown with its verified client id.
- **Fallback if core rejects `att`.** The SDK offers a domain-separated `signAttestation` with the PoP key, and the device record carries the grant. This is SSO Y3 applied to chat.
- **Not UKD/AppCert.** `att` lives inside the official grant and is verified by the official homeserver and SDK. Nothing depends on fork-only documents.
- **Never** derive message keys from identity, grant, PoP or session material (messaging plan).
- **Before grants exist.** Ring cookie users can publish an unattested device record. It is marked **unverified** and pinned on first use.

### 3.3 Data layout

Everything sits on the author's own homeserver. Readers fetch by public GET, and nothing is indexed (Q-C6).

```
/pub/chat/v1/
  devices/<device_id>/device.json        {v, sig_key, grant_jws, client_id, kinds_v, created_at}
  devices/<device_id>/kp/<kp_ref>        KeyPackage pool (≈20); the owner deletes each one after use
  devices/<device_id>/kp/last-resort     reused only when the pool is empty
  devices/<device_id>/w/<kp_ref>         Welcome, written by the *sender* for that KeyPackage
  devices/<device_id>/g/<tag>/<seq>      MLS PrivateMessages from this device
  devices/<device_id>/b/<blob_id>        attachment ciphertext (P13)
  groups/<tag>/c/<epoch>                 commit slot of the committer user (create-only, H7)
```

- **Path tags.** `tag` = `MLS-Exporter("pubky-chat/path/v1", group_id, 16)`. It rotates every epoch, so files can't be linked across epochs or across members.
- **No pubky in paths.** No member pubky appears in a path, which avoids the roster leak ADR 0001 P-B names.
- **Padding.** Messages are padded to buckets (256 B, 1 KiB, 4 KiB, 16 KiB). Bodies are capped at 16 KiB, which replaces the 1000-byte limit and its byte proofs.
- **Capabilities.** `kinds_v` in `device.json` replaces `chat.receiver.capabilities.v0` and multi-receiver discovery.
- **Sync.** Event streams, then listing from the last `seq`: Rooms' "bootstrap, live events, exact poll" pattern.
- **Owner-only state.** Read cursors, drafts and the archive go under `/priv/chat/v1/`, encrypted under the archive key. Mutes follow social specs (P23).

### 3.4 Conversations, groups, ordering

- **A DM is an MLS group** of both users' devices, with `group_id = H("pubky-chat/dm/v1" ‖ sort(A, B))`. If both sides create it at once, the lower pubky's group wins. This matches the SDK's deterministic role rule.
- **Private groups and private rooms** are MLS groups. The group context extension carries the name, admins and committer.
- **Committer** (adapts P15).
  - Commits for a group go only to the committer user's create-only slot, so commits have one order even across that user's devices.
  - Other members send proposals. Application messages never wait.
  - If the committer disappears, any admin re-creates the group with the same members and a `predecessor` reference. This is ADR 0001's fork, without a group key to capture.
  - **Trade-off:** membership changes stall while the committer is offline (Q-T2).
- **Multi-device.** A new device publishes its record and KeyPackages. The user's **self group** (only their own devices) asks an existing device to propose it into each conversation. The self group also carries the archive key and device notices.
- **Content** is kinds-v2. What changes:
  - authorship comes from the MLS sender's credential, not the Noise peer;
  - `chat.group.membership.v0` and `chat.group.invite.v0` become MLS proposals plus Welcome;
  - `channel_id` becomes the `group_id`;
  - the redelivery, dedup, unknown-kind and proposal-state rules are unchanged.

### 3.5 Public rooms

- **Keep Rooms' layout** as "public rooms v1": a room file, membership files, message, reaction and ban files, and creator bans honored by readers. Discovery uses tags on the room URI, which is what Rooms already does.
- **Messages are not posts** (adapting ADR 0002):
  - room lines would flood social feeds and the indexer;
  - creator bans and edits don't map onto posts;
  - Rooms has already proved the file model.
- **Kept from ADR 0002:** tags for discovery, Nexus as an untrusted accelerator, no private surface ever querying Nexus, and "posting here is public" copy.

### 3.6 First contact, attachments, notifications, moderation, recovery

- **First contact.**
  - Known peers: poll `w/` on the homeservers of contacts and counterparties.
  - Strangers: a fixed-size **pointer**, sealed to the recipient's device and never carrying a body, in an append-only inbox prefix on the recipient's homeserver (H8, ADR 0004 Phase D).
  - Until H8, strangers stay unreachable. The UI says so and never claims "they can start the chat" (first-contact analysis).
  - The Shop's listing threads seal their notice, so the listing is no longer public. The follow edge still is.
- **Admission:** P8. **Request rows:** P9.
- **Attachments:** P13. **Notifications:** P11.
- **Moderation.**
  - Blocking leaves the DM group and ignores that pubky's Welcomes.
  - Group admins remove by commit.
  - Public rooms use creator bans plus social-specs mutes.
- **Recovery.**
  - Lose one device: the others remove it.
  - Lose every device: the account survives. Peers' committers re-add the new device. History returns only from the archive sealed under the recovery code (P12). The UI never claims more.

### 3.7 Library

- **Packages.** Keep Hypercolor's package suite (P3) unchanged, and add two pieces:
  - `pubky-chat-mls`: a Rust crate on OpenMLS that implements the layout in §3.3 and the commit rules in §3.4. It builds to WASM and UniFFI.
  - `@pubky/chat-transport-mls`: a TypeScript `ChatTransport` over that crate, next to `@pubky/chat-transport-paykit`.
- **Storage borrows the host session** (SSO principle 7). Every transport writes through a host-provided storage interface backed by the app's own grant session. The library never restores, refreshes or signs out that session. This is the same interface as Paykit Y1.
- **Hosts:**
  - **Hypercolor:** mobile and web are the reference clients.
  - **Shop:** listing threads (`chat.context.v0`) and offers (`chat.proposal.*`), with the `shop` admission policy.
  - **pubky.app:** DMs and groups.
  - **Rooms:** private rooms run the WASM transport in the browser, with a browser-held grant. A grant held by the Rooms server must never attest a chat device.
- **Tabs.** One tab per app holds the MLS state lease (Web Locks). This is separate from the SSO bearer fix, H5.

### 3.8 UX principles

1. **Sending to an offline peer always works**, and shows `Queued` until it is written (P10).
2. **One conversation everywhere.** Product surface: the SSO recommendation is "one app owns Messages, others link to it" (Q-T1). The Shop keeps its listing threads in place.
3. **Trust is quiet until it changes.** Names come from a verified chain. "New device" and "key changed" notices appear inline.
4. **Strangers cost nothing** (P9). Public is labeled public (§3.5).
5. **Rooms' live layer is the baseline:** presence, typing, pending → stored, paging.
6. **No claimed reachability, delivery or recovery that the client can't observe.**

## 4. Migration

- **Hypercolor:** a clean cutover (owner rule, P18). Land the SDK-managed links pair first, then move to the packages and MLS with a local reset.
- **Shop (production).** Run both transports on each thread:
  - if the peer publishes `/pub/chat/v1/devices/*`, send over MLS; otherwise use Encrypted Links;
  - existing history and the queued outbox are imported locally into `chat-store`. Nothing is re-sent, and the wire keeps no aliases;
  - outbox items keep their `event_id`;
  - `marketplace.chat_message.v0` maps to one `chat.context.v0` per listing.
- **Sunset.** Once the Shop and Hypercolor ship MLS:
  - Encrypted-Link chat becomes receive-only for a window, then is removed after a workspace-wide dead-code check;
  - the Shop deletes its own `conversation-requests/*` files;
  - the `marketplace/wallet` marker stays only if Paykit payments still use it.
- **Peers who never upgrade** see "This person needs to update to keep chatting."

## 5. Phased plan

| # | Item | Owner | Size | Depends on |
|---|---|---|---|---|
| **Phase 0: now** | | | | |
| S0.1 | **Unsigned-marker hardening (Shop)** <ul><li>Detect drift: don't silently republish over another app's marker; warn.</li><li>Pin each peer's marker key with a "key changed" notice.</li><li>Narrow to `/pub/paykit/v0/marketplace/:rw,/pub/paykit/v0/private/marketplace/:rw` at the next re-approval.</li></ul> It narrows takeover and makes it visible, but doesn't close it for first contact | us | **S** | — |
| S0.2 | Encrypt Shop history and outbox at rest under the existing keyring | us | S | — |
| S0.3 | Land the Hypercolor SDK-managed links pair ([#7](https://github.com/BitcoinErrorLog/hypercolor/pull/7) with its web counterpart) and stock Ring auth ([web#7](https://github.com/BitcoinErrorLog/hypercolor-web/pull/7)) | Hypercolor (us) | M (in review) | — |
| Y1, Y2 | Paykit storage interface; WASM `paykit-sdk` (SSO) | Paykit | M–L, M | — |
| F2 | Shop messaging on Y2, folder-scoped: the interim way off cookies for Bitkit and Passport users (SSO) | us | M | Y2 |
| Y3 | Receiver marker signed by the app key, grant attached: the proper marker fix while Encrypted Links carry chat (SSO) | Paykit | M | grants |
| **Phase 1: protocol and library** | | | | |
| C1 | pubky-chat spec v3: MLS profile, §3.3 layout, device record, commit rules, kinds-v2 inside MLS, public rooms v1, vectors | us, Matt, Paykit | L | — |
| C2 | TypeScript packages extracted per the package spec, first on `chat-transport-paykit` (package spec §6 acceptance) | us | L | S0.3 |
| C3 | `pubky-chat-mls` (Rust, WASM, UniFFI) and `chat-transport-mls` | us | L | C1 |
| K5 | `att` grant claim (or `signAttestation`) in the homeserver, SDK and signers | core | M | H1 for agent child grants |
| H7 | Create-only conditional PUT | core | S | — |
| H3 | Grant status for verifiers (SSO) | core | S–M | — |
| X1 | Independent protocol review and security audit of C1 and C3 | us (dispatch) | — | C3 |
| **Phase 2: embed** | | | | |
| E1 | Shop on the packages: both transports and the migration in §4 | us | L | C2, C3 |
| E2 | Hypercolor on MLS | us | M | C3 |
| E3 | pubky.app DMs | pubky-app maintainers | M | C2, A1 ([#2614](https://github.com/pubky/pubky-app/pull/2614)) |
| E4 | Rooms private rooms (browser-held keys) | Matt | L | C3 |
| **Phase 3: complete** | | | | |
| D1 | Self group, archive, recovery | us | L | C3 |
| D2 | Push waker | us | M | C3 |
| H8 | Append-only inbox for first contact | core | L | Q-C3 |
| F5 | Remove Encrypted-Link chat | us | S | E1, E2, sunset |

**SSO dependencies:**

- **Verified devices** need grants: R0 for Ring, Bitkit grants already, and Passport.
- **Agent-issued devices** need H1 and P1, and K5 must be carried through child grants.
- **Every chat tab** needs H5 and H6.
- **Until R0,** Ring cookie users run in unverified mode.

## 6. Open questions

**For Matt:**

- **Q-M1.** Can private rooms run with a browser-held grant and keys, with the Rooms server relaying ciphertext only?
- **Q-M2.** May "public rooms v1" standardize Rooms' layout under pubky-chat, so pubky.app can render rooms?
- **Q-M3.** Will `pubky_ex` act as the second implementation of the public-room and device-record rules?
- **Q-M4.** Should member-list discovery share H8?

**For Paykit:**

- **Q-P1.** Do you agree that chat moves to MLS and Paykit keeps Encrypted Links for payments, or should Paykit's private messages ride the chat transport?
- **Q-P2.** Will you ship Y1, Y2 and Y3, and review C1 and C3?
- **Q-P3.** Which receivers must outlive chat?

**For core:**

- **Q-C1.** Will grants carry `att` through child grants (K5)? If not, will the SDK expose `signAttestation`?
- **Q-C2.** Will homeservers support create-only PUTs (H7)?
- **Q-C3.** Will you accept `Action::Append` with per-writer quotas (H8)? If not, what is the endorsed first-contact path?
- **Q-C4.** Is `/pub/chat/v1/` acceptable as an app-neutral namespace, alongside `social/v1`?
- **Q-C5.** Can Ring hold the archive key?
- **Q-C6.** Will Nexus never index `/pub/chat/`?
- **Q-C7.** How should a verifier check grant revocation offline?
- **Q-C8.** Will Pubky adopt MLS (OpenMLS) as the chat primitive? The authority order in the dossier makes this an upstream decision.

**For John and the team:**

- **Q-T1.** Is there one Messages surface (pubky.app, per the SSO recommendation), or chat in every app?
- **Q-T2.** Do you accept that membership changes stall while the committer is offline?
- **Q-T3.** What is the abuse-reporting policy for public rooms?
- **Q-T4.** Keep Shop history with a local import (recommended, S), or reset it like Hypercolor (P18)?

## 7. Hub

**[BitcoinErrorLog/pubky-chat](https://github.com/BitcoinErrorLog/pubky-chat)** is the hub.

**Why:**

- It is already the decided repo (D1).
- It is public, MIT, BitcoinErrorLog-owned, and runs vector CI on every push.
- It holds the only shared spec and vectors.
- Its planned layout has room for `packages/`, `native/` and a Rust crate.

**Alternatives:**

| Repo | Why not |
|---|---|
| [pubky-marketplace](https://github.com/BitcoinErrorLog/pubky-marketplace) | Organized around the Shop; chat would read as a Shop feature |
| [pubky/paykit-rs](https://github.com/pubky/paykit-rs) | It's the payments stack, and it's outside BitcoinErrorLog |
| [pubky-rooms](https://github.com/secondl1ght/pubky-rooms) | One app in one language, under a personal account |
| [hypercolor-web](https://github.com/BitcoinErrorLog/hypercolor-web) | An app. Its ADRs are inputs, not the shared contract |

**Rules for the hub:**

- This plan lives in `docs/`, and spec v3 in `spec/`.
- Propose moving the repo to the `pubky` org once core answers Q-C8.
