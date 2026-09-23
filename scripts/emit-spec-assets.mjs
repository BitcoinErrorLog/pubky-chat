#!/usr/bin/env node
/**
 * Emits spec/schemas, spec/vectors, and spec/historical from the kinds-v2 contract.
 * Historical kinds are reference fixtures. v2 does not accept them inbound.
 * Run from repo root: `node scripts/emit-spec-assets.mjs`
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(root, 'spec/schemas');
const vectorDir = join(root, 'spec/vectors');
const historicalSchemaDir = join(root, 'spec/historical/schemas');
const historicalVectorDir = join(root, 'spec/historical/vectors');
mkdirSync(schemaDir, { recursive: true });
mkdirSync(vectorDir, { recursive: true });
mkdirSync(historicalSchemaDir, { recursive: true });
mkdirSync(historicalVectorDir, { recursive: true });

const DEFS_ID = 'https://github.com/BitcoinErrorLog/pubky-chat/spec/schemas/_defs.json';
const schemaId = name => `https://github.com/BitcoinErrorLog/pubky-chat/spec/schemas/${name}.json`;
const historicalSchemaId = name =>
  `https://github.com/BitcoinErrorLog/pubky-chat/spec/historical/schemas/${name}.json`;
const HISTORICAL_SCHEMA_FILES = [
  'chat.group.reaction.v0.json',
  'chat.reaction.v0.json',
  'hypercolor.receiver.capabilities.json',
  'pubky_app.dm.v0.json',
  'marketplace.chat_message.v0.json',
];
const ref = name => ({ $ref: `${DEFS_ID}#/definitions/${name}` });

const UUID = '01234567-89ab-cdef-0123-456789abcdef';
const UUID_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_C = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UUID_D = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UUID_E = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SHOP_EVENT = '5b3f9a0e-8f2c-4f4e-9d35-1c2b4a6d8e01';
const PUBKY_A = 'a'.repeat(52);
const PUBKY_B = 'b'.repeat(52);
const PUBKY_S = 's'.repeat(52);
const SENT_AT = 1_757_000_000_000;
const SHOP_SENT = 1_756_742_400_000;
const LEGACY_ISO = '2026-08-21T10:00:00.000Z';
const LISTING_ID = '0033GVVN22HJ0FYQGZZS8R2BFC';
const CHANNEL_ID = `${PUBKY_A}:${UUID}`;
const KEY_B64 = 'A'.repeat(43);
const NONCE_B64 = 'B'.repeat(32);
const LISTING_REF = `listing:${PUBKY_S}_${LISTING_ID}`;
const CONVERSATION_ID = `conversation:${PUBKY_S}_${PUBKY_B}_${LISTING_ID}`;
const MIN_SUBJECT = `pubky://${PUBKY_S}/pub/pubky.app/pub/feed/${UUID}`;
const ATTACH_LOCATION = `pubky://${PUBKY_A}/pub/hypercolor.app/v1/attachments/${UUID}`;

const ctx = {
  senderPubky: PUBKY_A,
  ownerPubky: PUBKY_B,
  peerTrust: 'accepted',
};

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function kindSchema(kind, properties, extraRequired = [], extra = {}) {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId(kind),
    title: kind,
    type: 'object',
    additionalProperties: true,
    required: ['version', 'kind', 'event_id', 'sent_at', ...extraRequired],
    properties: {
      version: { const: 1 },
      kind: { const: kind },
      event_id: ref('uuid'),
      sent_at: ref('sentAt'),
      ...properties,
    },
    ...extra,
  };
}

const defs = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: DEFS_ID,
  title: 'pubky-chat shared definitions',
  definitions: {
    uuid: {
      type: 'string',
      pattern:
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    },
    pubky: { type: 'string', minLength: 52, maxLength: 52, pattern: '^[a-z0-9]{52}$' },
    sentAt: {
      type: 'integer',
      exclusiveMinimum: 0,
      maximum: 8_640_000_000_000_000,
    },
    sentAtInbound: {
      oneOf: [
        { $ref: '#/definitions/sentAt' },
        {
          type: 'string',
          pattern:
            '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$',
        },
      ],
    },
    channelId: {
      type: 'string',
      pattern:
        '^[a-z0-9]{52}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    },
    amount: {
      type: 'string',
      pattern: '^(?!0+(\\.0+)?$)[0-9]+(\\.[0-9]{1,11})?$',
    },
    currency: {
      type: 'string',
      pattern: '^(btc|sat|[A-Z]{3})$',
    },
    subject: {
      type: 'string',
      minLength: 16,
      maxLength: 512,
      pattern: '^pubky://',
    },
    receiverPath: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9.-]*/(wallet|server)$',
    },
    mention: {
      type: 'object',
      additionalProperties: false,
      required: ['pubky', 'start', 'end'],
      properties: {
        pubky: { $ref: '#/definitions/pubky' },
        start: { type: 'integer', minimum: 0 },
        end: { type: 'integer', minimum: 1 },
      },
    },
    b64url32: { type: 'string', minLength: 43, maxLength: 43, pattern: '^[A-Za-z0-9_-]+$' },
    b64url24: { type: 'string', minLength: 32, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' },
  },
};

const noChannel = { not: { required: ['channel_id'] } };

const schemas = {
  '_defs.json': defs,
  'chat.message.v0.json': kindSchema('chat.message.v0', {
    body: { type: 'string', minLength: 1 },
    reply_to: ref('uuid'),
    reply_to_author: ref('pubky'),
    mentions: { type: 'array', maxItems: 8, items: ref('mention') },
    forwarded_from_event_id: ref('uuid'),
    forwarded_from_author: ref('pubky'),
    forwarded_from_channel_id: ref('channelId'),
    context_id: ref('uuid'),
    channel_id: ref('channelId'),
  }, ['body'], {
    dependencies: {
      reply_to: ['reply_to_author'],
      reply_to_author: ['reply_to'],
      forwarded_from_event_id: ['forwarded_from_author'],
      forwarded_from_author: ['forwarded_from_event_id'],
    },
  }),
  'chat.attachment.v0.json': kindSchema('chat.attachment.v0', {
    location: { type: 'string', minLength: 16, pattern: '^pubky://' },
    key: { oneOf: [ref('b64url32'), { const: '__keystore__' }] },
    nonce: { oneOf: [ref('b64url24'), { const: '__keystore__' }] },
    algorithm: { const: 'XChaCha20Poly1305' },
    contentType: { type: 'string', minLength: 1 },
    size: { type: 'integer', minimum: 1, maximum: 8 * 1024 * 1024 },
    channel_id: ref('channelId'),
    context_id: ref('uuid'),
    thumbnail: {
      type: 'object',
      required: ['location', 'key', 'nonce'],
      additionalProperties: true,
      properties: {
        location: { type: 'string', minLength: 16, pattern: '^pubky://' },
        key: { oneOf: [ref('b64url32'), { const: '__keystore__' }] },
        nonce: { oneOf: [ref('b64url24'), { const: '__keystore__' }] },
        size: { type: 'integer', minimum: 1, maximum: 256 * 1024 },
      },
    },
  }, ['location', 'key', 'nonce', 'algorithm', 'contentType', 'size']),
  'chat.tag.v0.json': kindSchema('chat.tag.v0', {
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
    label: { type: 'string', minLength: 1, maxLength: 32 },
    op: { enum: ['add', 'remove'] },
    channel_id: ref('channelId'),
  }, ['target_event_id', 'target_author_pubky', 'label', 'op']),
  'chat.group.reaction.v0.json': kindSchema('chat.group.reaction.v0', {
    channel_id: ref('channelId'),
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
    emoji: { type: 'string', minLength: 1, maxLength: 32 },
  }, ['channel_id', 'target_event_id', 'target_author_pubky', 'emoji']),
  'chat.reaction.v0.json': kindSchema('chat.reaction.v0', {
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
    emoji: { type: 'string', minLength: 1, maxLength: 32 },
  }, ['target_event_id', 'target_author_pubky', 'emoji'], noChannel),
  'chat.receipt.v0.json': kindSchema('chat.receipt.v0', {
    status: { enum: ['delivered', 'read'] },
    event_ids: {
      type: 'array',
      minItems: 1,
      maxItems: 16,
      items: ref('uuid'),
    },
    channel_id: ref('channelId'),
  }, ['status', 'event_ids']),
  'chat.typing.v0.json': kindSchema('chat.typing.v0', {
    state: { enum: ['start', 'stop'] },
    channel_id: ref('channelId'),
  }, ['state']),
  'chat.edit.v0.json': kindSchema('chat.edit.v0', {
    target_event_id: ref('uuid'),
    body: { type: 'string', minLength: 1 },
    mentions: { type: 'array', maxItems: 8, items: ref('mention') },
  }, ['target_event_id', 'body'], noChannel),
  'chat.delete.v0.json': kindSchema('chat.delete.v0', {
    target_event_id: ref('uuid'),
  }, ['target_event_id'], noChannel),
  'chat.pin.v0.json': kindSchema('chat.pin.v0', {
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
    op: { enum: ['set', 'clear'] },
    channel_id: ref('channelId'),
  }, ['target_event_id', 'target_author_pubky', 'op']),
  'chat.group.message.v0.json': kindSchema('chat.group.message.v0', {
    channel_id: ref('channelId'),
    body: { type: 'string', minLength: 1 },
    reply_to: ref('uuid'),
    reply_to_author: ref('pubky'),
  }, ['channel_id', 'body']),
  'chat.group.edit.v0.json': kindSchema('chat.group.edit.v0', {
    channel_id: ref('channelId'),
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
    body: { type: 'string', minLength: 1 },
  }, ['channel_id', 'target_event_id', 'target_author_pubky', 'body']),
  'chat.group.delete.v0.json': kindSchema('chat.group.delete.v0', {
    channel_id: ref('channelId'),
    target_event_id: ref('uuid'),
    target_author_pubky: ref('pubky'),
  }, ['channel_id', 'target_event_id', 'target_author_pubky']),
  'chat.group.membership.v0.json': kindSchema('chat.group.membership.v0', {
    channel_id: ref('channelId'),
    op: { enum: ['create', 'add', 'remove', 'leave'] },
    subject_pubky: ref('pubky'),
    name: { type: 'string', minLength: 1, maxLength: 64 },
    members: { type: 'array', items: ref('pubky') },
  }, ['channel_id', 'op']),
  'chat.group.invite.v0.json': kindSchema('chat.group.invite.v0', {
    channel_id: ref('channelId'),
    invite_id: ref('uuid'),
    name: { type: 'string', minLength: 1, maxLength: 64 },
    expires_at: ref('sentAt'),
  }, ['channel_id', 'invite_id', 'name', 'expires_at']),
  'chat.public.message.v0.json': kindSchema('chat.public.message.v0', {
    channel_id: { type: 'string', minLength: 1 },
    body: { type: 'string', minLength: 1 },
    author: ref('pubky'),
    reply_to: ref('uuid'),
    reply_to_author: ref('pubky'),
  }, ['channel_id', 'body', 'author']),
  'chat.context.v0.json': kindSchema('chat.context.v0', {
    subject: ref('subject'),
    label: { type: 'string', minLength: 1, maxLength: 64 },
  }, ['subject'], noChannel),
  'chat.proposal.propose.v0.json': kindSchema('chat.proposal.propose.v0', {
    proposal_id: ref('uuid'),
    amount: ref('amount'),
    currency: ref('currency'),
    subject: ref('subject'),
    body: { type: 'string', minLength: 1 },
    context_id: ref('uuid'),
  }, ['proposal_id', 'amount', 'currency'], noChannel),
  'chat.proposal.counter.v0.json': kindSchema('chat.proposal.counter.v0', {
    proposal_id: ref('uuid'),
    amount: ref('amount'),
    currency: ref('currency'),
    supersedes_event_id: ref('uuid'),
    subject: ref('subject'),
    body: { type: 'string', minLength: 1 },
    context_id: ref('uuid'),
  }, ['proposal_id', 'amount', 'currency', 'supersedes_event_id'], noChannel),
  'chat.proposal.accept.v0.json': kindSchema('chat.proposal.accept.v0', {
    proposal_id: ref('uuid'),
    target_event_id: ref('uuid'),
    context_id: ref('uuid'),
  }, ['proposal_id', 'target_event_id'], noChannel),
  'chat.proposal.reject.v0.json': kindSchema('chat.proposal.reject.v0', {
    proposal_id: ref('uuid'),
    target_event_id: ref('uuid'),
    reason: { type: 'string', minLength: 1, maxLength: 140 },
    context_id: ref('uuid'),
  }, ['proposal_id', 'target_event_id'], noChannel),
  'chat.proposal.withdraw.v0.json': kindSchema('chat.proposal.withdraw.v0', {
    proposal_id: ref('uuid'),
    target_event_id: ref('uuid'),
    context_id: ref('uuid'),
  }, ['proposal_id', 'target_event_id'], noChannel),
  'chat.receiver.capabilities.v0.json': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId('chat.receiver.capabilities.v0'),
    title: 'chat.receiver.capabilities.v0',
    type: 'object',
    additionalProperties: true,
    required: ['version', 'kind', 'receiver_path', 'chat_kinds_v'],
    properties: {
      version: { const: 1 },
      kind: { const: 'chat.receiver.capabilities.v0' },
      receiver_path: ref('receiverPath'),
      chat_kinds_v: { type: 'integer', minimum: 1, maximum: 2 },
      kinds: { type: 'array', items: { type: 'string', minLength: 1 } },
    },
  },
  'hypercolor.receiver.capabilities.json': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId('hypercolor.receiver.capabilities'),
    title: 'hypercolor.receiver.capabilities',
    type: 'object',
    additionalProperties: false,
    minProperties: 4,
    maxProperties: 4,
    required: ['version', 'kind', 'receiver_path', 'chat_kinds_v'],
    properties: {
      version: { const: 1 },
      kind: { const: 'hypercolor.receiver.capabilities' },
      receiver_path: { const: 'hypercolor/wallet' },
      chat_kinds_v: { type: 'integer', minimum: 1 },
    },
  },
  'pubky_app.dm.v0.json': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId('pubky_app.dm.v0'),
    title: 'pubky_app.dm.v0',
    type: 'object',
    additionalProperties: true,
    required: ['version', 'kind', 'event_id', 'sent_at', 'body'],
    properties: {
      version: { const: 1 },
      kind: { const: 'pubky_app.dm.v0' },
      event_id: ref('uuid'),
      sent_at: ref('sentAtInbound'),
      body: { type: 'string', minLength: 1 },
    },
  },
  'marketplace.chat_message.v0.json': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId('marketplace.chat_message.v0'),
    title: 'marketplace.chat_message.v0',
    type: 'object',
    additionalProperties: true,
    required: ['version', 'kind', 'event_id', 'conversation_id', 'listing_ref', 'sent_at', 'body'],
    properties: {
      version: { const: 1 },
      kind: { const: 'marketplace.chat_message.v0' },
      event_id: ref('uuid'),
      conversation_id: { type: 'string', minLength: 1, maxLength: 256 },
      listing_ref: { type: 'string', minLength: 1, maxLength: 256 },
      sent_at: ref('sentAtInbound'),
      body: { type: 'string', minLength: 1 },
    },
  },
};

const historicalSchemas = {};
for (const file of HISTORICAL_SCHEMA_FILES) {
  const schema = schemas[file];
  if (!schema) throw new Error(`missing historical schema ${file}`);
  const name = file.replace(/\.json$/, '');
  schema.$id = historicalSchemaId(name);
  historicalSchemas[file] = schema;
  delete schemas[file];
}

for (const [file, schema] of Object.entries(schemas)) {
  writeJson(join(schemaDir, file), schema);
}
for (const file of HISTORICAL_SCHEMA_FILES) {
  rmSync(join(schemaDir, file), { force: true });
  writeJson(join(historicalSchemaDir, file), historicalSchemas[file]);
}

function vec(name, schema, raw, expect, extra = {}) {
  return { name, schema, raw, ctx, expect, ...extra };
}

const tagDm = {
  version: 1,
  kind: 'chat.tag.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  target_event_id: UUID,
  target_author_pubky: PUBKY_A,
  label: '👍',
  op: 'add',
};
const tagWorst = {
  ...tagDm,
  label: 'w'.repeat(32),
  channel_id: CHANNEL_ID,
};
const receiptN = (n, channel) => {
  const body = {
    version: 1,
    kind: 'chat.receipt.v0',
    event_id: UUID,
    sent_at: SENT_AT,
    status: 'delivered',
    event_ids: Array.from({ length: n }, () => UUID),
  };
  if (channel) body.channel_id = channel;
  return body;
};
const typingDm = {
  version: 1,
  kind: 'chat.typing.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  state: 'start',
};
const del = {
  version: 1,
  kind: 'chat.delete.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  target_event_id: UUID,
};
const edit = {
  version: 1,
  kind: 'chat.edit.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  target_event_id: UUID,
  body: 'x'.repeat(700),
};
const pin = {
  version: 1,
  kind: 'chat.pin.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  target_event_id: UUID,
  target_author_pubky: PUBKY_A,
  op: 'set',
};
const invite = {
  version: 1,
  kind: 'chat.group.invite.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  channel_id: CHANNEL_ID,
  invite_id: UUID,
  name: 'n'.repeat(64),
  expires_at: SENT_AT + 604_800_000,
};
const mention = { pubky: PUBKY_A, start: 0, end: 5 };
const messageReplyMentions = {
  version: 1,
  kind: 'chat.message.v0',
  event_id: UUID,
  sent_at: SENT_AT,
  body: 'hello',
  reply_to: UUID_B,
  reply_to_author: PUBKY_B,
  mentions: Array.from({ length: 8 }, () => mention),
};

const utf8 = s => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s)).byteLength;

const kindsV1 = [
  vec('message-minimal', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'hi',
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('message-reply-one-mention', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'hello',
    reply_to: UUID_B, reply_to_author: PUBKY_B, mentions: [mention],
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('tag-label-ok', 'chat.tag.v0', { ...tagDm, label: 'ok' }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('tag-emoji', 'chat.tag.v0', tagDm, { schema: 'valid', apply: 'processed', byteSize: utf8(tagDm) }, { suite: 'v1' }),
  vec('tag-worst-channel', 'chat.tag.v0', tagWorst, { schema: 'valid', apply: 'processed', byteSize: utf8(tagWorst) }, { suite: 'v1' }),
  vec('receipt-1', 'chat.receipt.v0', receiptN(1), { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('receipt-16', 'chat.receipt.v0', receiptN(16), { schema: 'valid', apply: 'processed', byteSize: utf8(receiptN(16)) }, { suite: 'v1' }),
  vec('receipt-16-channel', 'chat.receipt.v0', receiptN(16, CHANNEL_ID), { schema: 'valid', apply: 'processed', byteSize: utf8(receiptN(16, CHANNEL_ID)) }, { suite: 'v1' }),
  vec('receipt-12', 'chat.receipt.v0', receiptN(12), { schema: 'valid', byteSize: utf8(receiptN(12)) }, { suite: 'v1' }),
  vec('typing-start', 'chat.typing.v0', typingDm, { schema: 'valid', apply: 'ephemeral', byteSize: utf8(typingDm) }, { suite: 'v1' }),
  vec('typing-stop', 'chat.typing.v0', { ...typingDm, state: 'stop' }, { schema: 'valid', apply: 'ephemeral' }, { suite: 'v1' }),
  vec('edit-hi', 'chat.edit.v0', { ...edit, body: 'hi' }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('delete', 'chat.delete.v0', del, { schema: 'valid', apply: 'processed', byteSize: utf8(del) }, { suite: 'v1' }),
  vec('pin-set', 'chat.pin.v0', pin, { schema: 'valid', apply: 'processed', byteSize: utf8(pin) }, { suite: 'v1' }),
  vec('pin-clear', 'chat.pin.v0', { ...pin, op: 'clear' }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('invite', 'chat.group.invite.v0', invite, { schema: 'valid', apply: 'processed', byteSize: utf8(invite) }, { suite: 'v1' }),
  vec('attachment', 'chat.attachment.v0', {
    version: 1, kind: 'chat.attachment.v0', event_id: UUID, sent_at: SENT_AT,
    location: ATTACH_LOCATION, key: KEY_B64, nonce: NONCE_B64,
    algorithm: 'XChaCha20Poly1305', contentType: 'image/png', size: 1024,
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('group-message', 'chat.group.message.v0', {
    version: 1, kind: 'chat.group.message.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, body: 'hello group',
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('group-edit', 'chat.group.edit.v0', {
    version: 1, kind: 'chat.group.edit.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, target_event_id: UUID, target_author_pubky: PUBKY_A, body: 'edited',
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('group-delete', 'chat.group.delete.v0', {
    version: 1, kind: 'chat.group.delete.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, target_event_id: UUID, target_author_pubky: PUBKY_A,
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('group-membership-create', 'chat.group.membership.v0', {
    version: 1, kind: 'chat.group.membership.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, op: 'create', name: 'crew', members: [PUBKY_A, PUBKY_B],
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v1' }),
  vec('public-message-host-only', 'chat.public.message.v0', {
    version: 1, kind: 'chat.public.message.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: `${PUBKY_A}:${UUID}`, body: 'announce', author: PUBKY_A,
  }, { schema: 'valid', apply: 'host-only' }, { suite: 'v1' }),
  vec('oversized-known-tag', 'chat.tag.v0',
    `{"version":1,"kind":"chat.tag.v0","pad":"${'x'.repeat(1200)}"}`,
    { schema: 'invalid', error: 'oversized', drop: true }, { suite: 'v1' }),
  vec('receipt-17-ids', 'chat.receipt.v0', receiptN(17), { schema: 'invalid', error: 'event-ids-cap' }, { suite: 'v1' }),
  vec('not-json', 'chat.tag.v0', 'not-json', { schema: 'invalid', error: 'not-json' }, { suite: 'v1' }),
  vec('tag-missing-event-id', 'chat.tag.v0', {
    version: 1, kind: 'chat.tag.v0', label: 'OK',
  }, { schema: 'invalid', error: 'bad-event-id' }, { suite: 'v1' }),
  vec('tag-uppercase-label', 'chat.tag.v0', { ...tagDm, label: 'OK' }, {
    schema: 'valid', error: 'invalid-label',
  }, { suite: 'v1', notes: 'label charset is apply/parse, not JSON Schema' }),
  vec('receipt-status-seen', 'chat.receipt.v0', {
    ...receiptN(1), status: 'seen',
  }, { schema: 'invalid', error: 'invalid-status' }, { suite: 'v1' }),
  vec('typing-idle', 'chat.typing.v0', { ...typingDm, state: 'idle' }, { schema: 'invalid', error: 'invalid-state' }, { suite: 'v1' }),
  vec('reply-without-author', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'hi', reply_to: UUID_B,
  }, { schema: 'invalid', error: 'reply-fields-mismatch' }, { suite: 'v1' }),
  vec('invite-bad-id', 'chat.group.invite.v0', { ...invite, invite_id: 'not-a-uuid' }, {
    schema: 'invalid', error: 'bad-event-id',
  }, { suite: 'v1' }),
  vec('unknown-kind-unprocessed', null, {
    version: 1, kind: 'chat.foo.v0', event_id: UUID, sent_at: SENT_AT,
  }, { schema: 'skip', error: 'unknown-kind', unprocessed: true }, { suite: 'v1' }),
  vec('delete-with-channel', 'chat.delete.v0', { ...del, channel_id: CHANNEL_ID }, {
    schema: 'invalid', error: 'bad-channel-id',
  }, { suite: 'v1' }),
  vec('wrong-author-edit', 'chat.edit.v0', { ...edit, body: 'hijack' }, {
    schema: 'valid', error: 'wrong-author',
  }, { suite: 'v1', ctx: { ...ctx, senderPubky: PUBKY_B } }),
  vec('pin-future-lww', 'chat.pin.v0', { ...pin, sent_at: SENT_AT + 6 * 60 * 1000 }, {
    schema: 'valid', error: 'bad-sent-at',
  }, { suite: 'v1' }),
  vec('duplicate-event-id', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'again',
  }, { schema: 'valid', apply: 'ignore-duplicate' }, { suite: 'v1' }),
  vec('message-reply-8-mentions-bytes', 'chat.message.v0', messageReplyMentions, {
    schema: 'valid', byteSize: utf8(messageReplyMentions),
  }, { suite: 'v1' }),
  vec('typing-group', 'chat.typing.v0', { ...typingDm, channel_id: CHANNEL_ID }, {
    schema: 'valid', byteSize: utf8({ ...typingDm, channel_id: CHANNEL_ID }),
  }, { suite: 'v1' }),
  vec('edit-700', 'chat.edit.v0', edit, { schema: 'valid', byteSize: utf8(edit) }, { suite: 'v1' }),
  vec('pin-channel', 'chat.pin.v0', { ...pin, channel_id: CHANNEL_ID }, {
    schema: 'valid', byteSize: utf8({ ...pin, channel_id: CHANNEL_ID }),
  }, { suite: 'v1' }),
  vec('receipt-20', 'chat.receipt.v0', receiptN(20), { schema: 'invalid', error: 'event-ids-cap', byteSize: utf8(receiptN(20)) }, { suite: 'v1' }),
  vec('receipt-17-channel', 'chat.receipt.v0', receiptN(17, CHANNEL_ID), {
    schema: 'invalid', error: 'event-ids-cap', byteSize: utf8(receiptN(17, CHANNEL_ID)),
  }, { suite: 'v1' }),
];

const subject512 = `pubky://${PUBKY_S}/${'x'.repeat(512 - `pubky://${PUBKY_S}/`.length)}`;
const contextMin = {
  version: 1, kind: 'chat.context.v0', event_id: UUID, sent_at: SENT_AT, subject: MIN_SUBJECT, label: 'Listing',
};
const context512 = { ...contextMin, event_id: UUID_B, subject: subject512, label: 'y'.repeat(64) };

const context = [
  vec('context-minimal', 'chat.context.v0', contextMin, { schema: 'valid', apply: 'processed' }, { suite: 'v2' }),
  vec('context-512-subject', 'chat.context.v0', context512, { schema: 'valid', apply: 'processed', byteSize: utf8(context512) }, { suite: 'v2' }),
  vec('context-https-invalid', 'chat.context.v0', { ...contextMin, subject: 'https://example.com/listing' }, {
    schema: 'invalid', error: 'invalid-subject',
  }, { suite: 'v2' }),
  vec('context-short-subject', 'chat.context.v0', { ...contextMin, subject: 'pubky://short' }, {
    schema: 'invalid', error: 'invalid-subject',
  }, { suite: 'v2' }),
  vec('context-duplicate-subject', 'chat.context.v0', { ...contextMin, event_id: UUID_C }, {
    schema: 'valid', apply: 'noop-same-subject',
  }, { suite: 'v2' }),
  vec('context-second-subject', 'chat.context.v0', {
    ...contextMin, event_id: UUID_D, subject: `pubky://${PUBKY_S}/pub/pubky.app/pub/feed/${UUID_B}`,
  }, { schema: 'valid', apply: 'new-conversation' }, { suite: 'v2' }),
  vec('context-gated', 'chat.context.v0', contextMin, { schema: 'valid', error: 'gated-peer' }, {
    suite: 'v2', ctx: { ...ctx, peerTrust: 'gated' },
  }),
  vec('context-channel-forbidden', 'chat.context.v0', { ...contextMin, channel_id: CHANNEL_ID }, {
    schema: 'invalid', error: 'cross-context',
  }, { suite: 'v2' }),
  vec('message-with-context-id', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID_E, sent_at: SENT_AT, body: 'about the listing',
    context_id: UUID,
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v2' }),
  vec('message-without-context-unscoped-dm', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'plain dm',
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v2' }),
];

const propose = {
  version: 1, kind: 'chat.proposal.propose.v0', event_id: UUID, sent_at: SENT_AT,
  proposal_id: UUID_B, amount: '21.5', currency: 'USD', subject: MIN_SUBJECT,
  body: 'I will take it', context_id: UUID,
};
const counter = {
  version: 1, kind: 'chat.proposal.counter.v0', event_id: UUID_C, sent_at: SENT_AT + 1,
  proposal_id: UUID_B, amount: '25', currency: 'USD', supersedes_event_id: UUID,
  context_id: UUID,
};
const accept = {
  version: 1, kind: 'chat.proposal.accept.v0', event_id: UUID_D, sent_at: SENT_AT + 2,
  proposal_id: UUID_B, target_event_id: UUID_C, context_id: UUID,
};
const reject = {
  version: 1, kind: 'chat.proposal.reject.v0', event_id: UUID_D, sent_at: SENT_AT + 2,
  proposal_id: UUID_B, target_event_id: UUID, reason: 'too low',
};
const withdraw = {
  version: 1, kind: 'chat.proposal.withdraw.v0', event_id: UUID_C, sent_at: SENT_AT + 1,
  proposal_id: UUID_B, target_event_id: UUID,
};
const worstPropose = {
  version: 1, kind: 'chat.proposal.propose.v0', event_id: UUID, sent_at: SENT_AT,
  proposal_id: UUID_B, amount: '1234567890123', currency: 'USD', subject: subject512,
  body: 'z'.repeat(80),
};

const proposal = [
  vec('propose', 'chat.proposal.propose.v0', propose, { schema: 'valid', apply: 'open' }, { suite: 'v2' }),
  vec('counter', 'chat.proposal.counter.v0', counter, { schema: 'valid', apply: 'open' }, {
    suite: 'v2', ctx: { ...ctx, senderPubky: PUBKY_B },
  }),
  vec('accept', 'chat.proposal.accept.v0', accept, { schema: 'valid', apply: 'accepted' }, { suite: 'v2' }),
  vec('withdraw', 'chat.proposal.withdraw.v0', withdraw, { schema: 'valid', apply: 'withdrawn' }, { suite: 'v2' }),
  vec('reject', 'chat.proposal.reject.v0', reject, { schema: 'valid', apply: 'rejected' }, {
    suite: 'v2', ctx: { ...ctx, senderPubky: PUBKY_B },
  }),
  vec('wrong-party-accept', 'chat.proposal.accept.v0', {
    ...accept, target_event_id: UUID,
  }, { schema: 'valid', error: 'wrong-author' }, { suite: 'v2', ctx: { ...ctx, senderPubky: PUBKY_A } }),
  vec('double-accept-noop', 'chat.proposal.accept.v0', {
    ...accept, event_id: UUID_E,
  }, { schema: 'valid', apply: 'noop-closed' }, { suite: 'v2' }),
  vec('amount-zero', 'chat.proposal.propose.v0', { ...propose, amount: '0' }, {
    schema: 'invalid', error: 'invalid-amount',
  }, { suite: 'v2' }),
  vec('amount-zero-decimal', 'chat.proposal.propose.v0', { ...propose, amount: '0.0' }, {
    schema: 'invalid', error: 'invalid-amount',
  }, { suite: 'v2' }),
  vec('bad-currency', 'chat.proposal.propose.v0', { ...propose, currency: 'usd' }, {
    schema: 'invalid', error: 'invalid-currency',
  }, { suite: 'v2' }),
  vec('btc-currency', 'chat.proposal.propose.v0', { ...propose, currency: 'btc', amount: '0.01' }, {
    schema: 'valid', apply: 'open',
  }, { suite: 'v2' }),
  vec('sat-currency', 'chat.proposal.propose.v0', { ...propose, currency: 'sat', amount: '21000' }, {
    schema: 'valid', apply: 'open',
  }, { suite: 'v2' }),
  vec('supersedes-mismatch', 'chat.proposal.counter.v0', { ...counter, supersedes_event_id: UUID_E }, {
    schema: 'valid', error: 'bad-target-id',
  }, { suite: 'v2', ctx: { ...ctx, senderPubky: PUBKY_B } }),
  vec('propose-channel-forbidden', 'chat.proposal.propose.v0', { ...propose, channel_id: CHANNEL_ID }, {
    schema: 'invalid', error: 'cross-context',
  }, { suite: 'v2' }),
  vec('worst-case-bytes', 'chat.proposal.propose.v0', worstPropose, {
    schema: 'valid', byteSize: utf8(worstPropose),
  }, { suite: 'v2' }),
  vec('oversized-proposal', 'chat.proposal.propose.v0', {
    ...worstPropose, body: 'z'.repeat(400),
  }, { schema: 'valid', error: 'oversized', drop: true }, { suite: 'v2' }),
];

const shopMessage = {
  version: 1,
  kind: 'marketplace.chat_message.v0',
  event_id: SHOP_EVENT,
  conversation_id: CONVERSATION_ID,
  listing_ref: LISTING_REF,
  sent_at: SHOP_SENT,
  body: 'Is this still available?',
};
const shopDm = {
  version: 1,
  kind: 'pubky_app.dm.v0',
  event_id: SHOP_EVENT,
  sent_at: SHOP_SENT,
  body: 'hey — are you going on saturday?',
};
const hypercolorDm = {
  version: 1,
  kind: 'pubky_app.dm.v0',
  event_id: SHOP_EVENT,
  sent_at: SHOP_SENT,
  body: 'hello',
};

const historicalAliases = [
  vec('pubky-app-dm-unix-ms', 'pubky_app.dm.v0', shopDm, { schema: 'valid' }, { suite: 'historical' }),
  vec('pubky-app-dm-iso-sent-at', 'pubky_app.dm.v0', { ...shopDm, sent_at: LEGACY_ISO }, {
    schema: 'valid',
  }, { suite: 'historical' }),
  vec('hypercolor-shaped-pubky-app-dm', 'pubky_app.dm.v0', hypercolorDm, { schema: 'valid' }, {
    suite: 'historical',
  }),
  vec('marketplace-listing-message', 'marketplace.chat_message.v0', shopMessage, { schema: 'valid' }, {
    suite: 'historical',
  }),
  vec('marketplace-iso-sent-at', 'marketplace.chat_message.v0', { ...shopMessage, sent_at: LEGACY_ISO }, {
    schema: 'valid',
  }, { suite: 'historical' }),
];
const unknownKind = [
  vec('unknown-commerce-kind', null, {
    version: 1, kind: 'commerce.foo', event_id: UUID, sent_at: SENT_AT, body: 'nope',
  }, { schema: 'skip', error: 'unknown-kind', unprocessed: true }, { suite: 'v2' }),
  vec('reject-pubky-app-dm', null, shopDm, {
    schema: 'skip', error: 'unknown-kind', unprocessed: true,
  }, { suite: 'v2' }),
  vec('reject-marketplace-chat-message', null, shopMessage, {
    schema: 'skip', error: 'unknown-kind', unprocessed: true,
  }, { suite: 'v2' }),
  vec('reject-chat-reaction', null, {
    version: 1, kind: 'chat.reaction.v0', event_id: UUID, sent_at: SENT_AT,
    target_event_id: UUID, target_author_pubky: PUBKY_A, emoji: '👍',
  }, { schema: 'skip', error: 'unknown-kind', unprocessed: true }, { suite: 'v2' }),
  vec('reject-group-reaction', null, {
    version: 1, kind: 'chat.group.reaction.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, target_event_id: UUID, target_author_pubky: PUBKY_A, emoji: '👍',
  }, { schema: 'skip', error: 'unknown-kind', unprocessed: true }, { suite: 'v2' }),
  vec('reject-hypercolor-capabilities', null, {
    version: 1, kind: 'hypercolor.receiver.capabilities', receiver_path: 'hypercolor/wallet', chat_kinds_v: 1,
  }, { schema: 'skip', error: 'unknown-kind', unprocessed: true }, { suite: 'v2' }),
];
const historicalReactions = [
  vec('group-reaction', 'chat.group.reaction.v0', {
    version: 1, kind: 'chat.group.reaction.v0', event_id: UUID, sent_at: SENT_AT,
    channel_id: CHANNEL_ID, target_event_id: UUID, target_author_pubky: PUBKY_A, emoji: '👍',
  }, { schema: 'valid' }, { suite: 'historical' }),
  vec('dm-reaction', 'chat.reaction.v0', {
    version: 1, kind: 'chat.reaction.v0', event_id: UUID, sent_at: SENT_AT,
    target_event_id: UUID, target_author_pubky: PUBKY_A, emoji: '👍',
  }, { schema: 'valid' }, { suite: 'historical' }),
];

const capV1 = {
  version: 1,
  kind: 'hypercolor.receiver.capabilities',
  receiver_path: 'hypercolor/wallet',
  chat_kinds_v: 1,
};
const capV2 = {
  version: 1,
  kind: 'chat.receiver.capabilities.v0',
  receiver_path: 'hypercolor/wallet',
  chat_kinds_v: 2,
  kinds: ['chat.message.v0', 'chat.context.v0', 'chat.proposal.propose.v0'],
};
const capShop = {
  version: 1,
  kind: 'chat.receiver.capabilities.v0',
  receiver_path: 'marketplace/wallet',
  chat_kinds_v: 2,
};
const capOver = JSON.stringify({
  version: 1,
  kind: 'chat.receiver.capabilities.v0',
  receiver_path: 'hypercolor/wallet',
  chat_kinds_v: 2,
  pad: 'p'.repeat(600),
});

const historicalCapabilities = [
  vec('hypercolor-v1-four-key', 'hypercolor.receiver.capabilities', capV1, { schema: 'valid' }, {
    suite: 'historical',
  }),
  vec('v1-extra-key-rejected', 'hypercolor.receiver.capabilities', { ...capV1, extra: true }, {
    schema: 'invalid',
  }, { suite: 'historical' }),
];
const capabilities = [
  vec('v2-document', 'chat.receiver.capabilities.v0', capV2, { schema: 'valid', maxBytes: 512 }, { suite: 'v2' }),
  vec('v2-shop-path', 'chat.receiver.capabilities.v0', capShop, { schema: 'valid', maxBytes: 512 }, { suite: 'v2' }),
  vec('duplicate-json-keys', 'chat.receiver.capabilities.v0',
    '{"version":1,"kind":"chat.receiver.capabilities.v0","receiver_path":"hypercolor/wallet","chat_kinds_v":2,"chat_kinds_v":1}',
    { schema: 'invalid', error: 'duplicate-key' }, { suite: 'v2' }),
  vec('over-512', 'chat.receiver.capabilities.v0', capOver, {
    schema: 'invalid', error: 'oversized', maxBytes: 512,
  }, { suite: 'v2' }),
];

const redelivery = [
  vec('first-send', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'queued',
  }, { schema: 'valid', apply: 'processed' }, { suite: 'v2' }),
  vec('replay-same-event-id', 'chat.message.v0', {
    version: 1, kind: 'chat.message.v0', event_id: UUID, sent_at: SENT_AT, body: 'queued',
  }, { schema: 'valid', apply: 'ignore-duplicate', transcriptCount: 1 }, { suite: 'v2' }),
];

const admission = [
  {
    name: 'wot-prior-routed-auto-accept',
    schema: null,
    policy: 'hypercolor-wot',
    input: {
      hasPriorRoutedConversation: true,
      hasExistingLink: false,
      isFollow: true,
      isFollower: true,
      isOrderOrOfferParticipant: false,
    },
    expect: { admission: 'auto-accept' },
    suite: 'v2',
  },
  {
    name: 'wot-stranger-request',
    schema: null,
    policy: 'hypercolor-wot',
    input: {
      hasPriorRoutedConversation: false,
      hasExistingLink: false,
      isFollow: true,
      isFollower: true,
      isOrderOrOfferParticipant: false,
    },
    expect: { admission: 'request' },
    suite: 'v2',
  },
  {
    name: 'shop-order-participant-auto-accept',
    schema: null,
    policy: 'shop',
    input: {
      hasPriorRoutedConversation: false,
      hasExistingLink: false,
      isFollow: false,
      isFollower: false,
      isOrderOrOfferParticipant: true,
    },
    expect: { admission: 'auto-accept' },
    suite: 'v2',
  },
  {
    name: 'shop-unnamed-ignore',
    schema: null,
    policy: 'shop',
    input: {
      hasPriorRoutedConversation: false,
      hasExistingLink: false,
      isFollow: false,
      isFollower: false,
      isOrderOrOfferParticipant: false,
    },
    expect: { admission: 'ignore' },
    suite: 'v2',
  },
  {
    name: 'shop-existing-link-auto-accept',
    schema: null,
    policy: 'shop',
    input: {
      hasPriorRoutedConversation: false,
      hasExistingLink: true,
      isFollow: false,
      isFollower: false,
      isOrderOrOfferParticipant: false,
    },
    expect: { admission: 'auto-accept' },
    suite: 'v2',
  },
  {
    name: 'open-always-request',
    schema: null,
    policy: 'open',
    input: {
      hasPriorRoutedConversation: true,
      hasExistingLink: true,
      isFollow: true,
      isFollower: true,
      isOrderOrOfferParticipant: true,
    },
    expect: { admission: 'request' },
    suite: 'v2',
  },
];

const files = {
  'kinds-v1.json': kindsV1,
  'context.json': context,
  'proposal.json': proposal,
  'unknown-kind.json': unknownKind,
  'capabilities.json': capabilities,
  'redelivery.json': redelivery,
  'admission.json': admission,
};
const historicalFiles = {
  'aliases.json': historicalAliases,
  'reactions.json': historicalReactions,
  'capabilities.json': historicalCapabilities,
};

rmSync(join(vectorDir, 'aliases.json'), { force: true });
for (const [file, vectors] of Object.entries(files)) {
  writeJson(join(vectorDir, file), vectors);
}
for (const [file, vectors] of Object.entries(historicalFiles)) {
  writeJson(join(historicalVectorDir, file), vectors);
}

const byteProofs = {
  'tag add 👍 DM': utf8(tagDm),
  'tag worst 32xw + channel': utf8(tagWorst),
  'receipt 12 ids DM': utf8(receiptN(12)),
  'receipt 16 ids + channel': utf8(receiptN(16, CHANNEL_ID)),
  'receipt 20 ids no channel': utf8(receiptN(20)),
  'receipt 16 ids no channel': utf8(receiptN(16)),
  'receipt 17 ids + channel': utf8(receiptN(17, CHANNEL_ID)),
  'typing DM': utf8(typingDm),
  'typing group': utf8({ ...typingDm, channel_id: CHANNEL_ID }),
  delete: utf8(del),
  'edit 700-char body': utf8(edit),
  'pin DM': utf8(pin),
  'pin + channel': utf8({ ...pin, channel_id: CHANNEL_ID }),
  'invite 64-char name': utf8(invite),
  'one mention object': utf8(mention),
  'message + reply pair + 8 mentions (body 5)': utf8(messageReplyMentions),
  'context 512-byte subject + 64-char label': utf8(context512),
  'proposal worst-case 512-byte subject': utf8(worstPropose),
  'historical marketplace.chat_message.v0 sample': utf8(shopMessage),
  'historical pubky_app.dm.v0 sample': utf8(shopDm),
  'capabilities v1': utf8(capV1),
  'capabilities v2': utf8(capV2),
};

writeJson(join(root, 'spec/byte-proofs.json'), byteProofs);

const schemaCount = Object.keys(schemas).length;
const vectorCount = Object.values(files).reduce((n, v) => n + v.length, 0);
console.log(`wrote ${schemaCount} schema files, ${vectorCount} vectors`);
console.log(JSON.stringify(byteProofs, null, 2));
