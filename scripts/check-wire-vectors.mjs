#!/usr/bin/env node
/**
 * Validate every spec vector against its JSON Schema, enforce size/admission
 * rules, and prove kinds-v1 envelopes still validate under v2 schemas.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(root, 'spec/schemas');
const vectorDir = join(root, 'spec/vectors');
const LINK_MESSAGE_MAX_BYTES = 1000;
const MAX_CAPABILITIES_BYTES = 512;

const CHAT_KINDS = [
  'chat.message.v0',
  'chat.attachment.v0',
  'chat.tag.v0',
  'chat.group.reaction.v0',
  'chat.reaction.v0',
  'chat.receipt.v0',
  'chat.typing.v0',
  'chat.edit.v0',
  'chat.delete.v0',
  'chat.pin.v0',
  'chat.group.message.v0',
  'chat.group.edit.v0',
  'chat.group.delete.v0',
  'chat.group.membership.v0',
  'chat.group.invite.v0',
  'chat.public.message.v0',
  'chat.context.v0',
  'chat.proposal.propose.v0',
  'chat.proposal.counter.v0',
  'chat.proposal.accept.v0',
  'chat.proposal.reject.v0',
  'chat.proposal.withdraw.v0',
  'chat.receiver.capabilities.v0',
];

const KNOWN_INBOUND = new Set([
  ...CHAT_KINDS.filter(k => k !== 'chat.public.message.v0' && k !== 'chat.receiver.capabilities.v0'),
  'pubky_app.dm.v0',
  'marketplace.chat_message.v0',
]);

const ADMISSION = {
  'hypercolor-wot': input => (input.hasPriorRoutedConversation ? 'auto-accept' : 'request'),
  shop: input =>
    input.hasExistingLink ||
    input.hasPriorRoutedConversation ||
    input.isOrderOrOfferParticipant ||
    input.isFollow ||
    input.isFollower
      ? 'auto-accept'
      : 'ignore',
  open: () => 'request',
};

function utf8Bytes(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.byteLength(raw, 'utf8');
}

function hasDuplicateKeys(raw) {
  if (typeof raw !== 'string') return false;
  const objects = [];
  let inString = false;
  let escaped = false;
  let token = '';
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) {
      if (escaped) {
        token += char;
        escaped = false;
      } else if (char === '\\') {
        token += char;
        escaped = true;
      } else if (char === '"') {
        inString = false;
        let j = i + 1;
        while (/\s/.test(raw[j] ?? '')) j += 1;
        if (raw[j] === ':') {
          const key = JSON.parse(`${token}"`);
          const current = objects.at(-1);
          if (current?.has(key)) return true;
          current?.add(key);
        }
        token = '';
      } else {
        token += char;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      token = '"';
    } else if (char === '{') objects.push(new Set());
    else if (char === '}') objects.pop();
  }
  return false;
}

function rawString(vector) {
  return typeof vector.raw === 'string' ? vector.raw : JSON.stringify(vector.raw);
}

function peekKind(raw) {
  try {
    const value = JSON.parse(raw);
    return typeof value?.kind === 'string' ? value.kind : null;
  } catch {
    return null;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const validators = new Map();
function jsonFiles(dir) {
  return readdirSync(dir).filter(name => name.endsWith('.json') && !name.startsWith('.'));
}

for (const file of jsonFiles(schemaDir)) {
  const schema = JSON.parse(readFileSync(join(schemaDir, file), 'utf8'));
  ajv.addSchema(schema);
  if (schema.$id && file !== '_defs.json') {
    const validate = ajv.getSchema(schema.$id);
    if (!validate) throw new Error(`failed to compile ${file}`);
    validators.set(file.replace(/\.json$/, ''), validate);
  }
}

for (const kind of CHAT_KINDS) {
  if (!validators.has(kind)) {
    throw new Error(`missing schema for chat kind ${kind}`);
  }
}

const failures = [];
const counts = { total: 0, v1: 0, v1ValidUnderV2: 0, schemaValid: 0, schemaInvalid: 0 };

function fail(file, name, message) {
  failures.push(`${file} / ${name}: ${message}`);
}

for (const file of jsonFiles(vectorDir).sort()) {
  const vectors = JSON.parse(readFileSync(join(vectorDir, file), 'utf8'));
  if (!Array.isArray(vectors)) throw new Error(`${file} must be an array`);
  for (const vector of vectors) {
    counts.total += 1;
    if (vector.suite === 'v1') counts.v1 += 1;
    const name = vector.name ?? '(unnamed)';
    const expect = vector.expect ?? {};

    if (file === 'admission.json' || vector.policy) {
      const policy = ADMISSION[vector.policy];
      if (!policy) {
        fail(file, name, `unknown policy ${vector.policy}`);
        continue;
      }
      const decision = policy(vector.input ?? {});
      if (decision !== expect.admission) {
        fail(file, name, `admission ${decision} != ${expect.admission}`);
      }
      continue;
    }

    const raw = rawString(vector);
    const bytes = utf8Bytes(raw);
    const kind = peekKind(raw);

    if (expect.error === 'duplicate-key') {
      if (!hasDuplicateKeys(raw)) fail(file, name, 'expected duplicate JSON keys');
      continue;
    }

    if (expect.error === 'not-json') {
      try {
        JSON.parse(raw);
        fail(file, name, 'expected JSON.parse to throw');
      } catch {
        /* expected */
      }
      continue;
    }

    if (expect.unprocessed || expect.error === 'unknown-kind') {
      if (kind && KNOWN_INBOUND.has(kind)) {
        fail(file, name, `kind ${kind} is known inbound, not unprocessed`);
      }
      continue;
    }

    if (expect.maxBytes === MAX_CAPABILITIES_BYTES && bytes > MAX_CAPABILITIES_BYTES) {
      if (expect.schema !== 'invalid') fail(file, name, 'capabilities oversize must be schema invalid');
    }

    if (expect.drop || expect.error === 'oversized') {
      const cap = expect.maxBytes ?? LINK_MESSAGE_MAX_BYTES;
      if (bytes <= cap && expect.drop) {
        fail(file, name, `expected oversized > ${cap}, got ${bytes}`);
      }
    }

    if (typeof expect.byteSize === 'number' && expect.byteSize !== bytes) {
      fail(file, name, `byteSize ${bytes} != ${expect.byteSize}`);
    }

    if (expect.schema === 'skip' || !vector.schema) continue;

    const validate = validators.get(vector.schema);
    if (!validate) {
      fail(file, name, `no validator for schema ${vector.schema}`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      if (expect.schema === 'invalid') {
        counts.schemaInvalid += 1;
        continue;
      }
      fail(file, name, `JSON.parse: ${error.message}`);
      continue;
    }

    const ok = validate(parsed);
    if (expect.schema === 'valid') {
      counts.schemaValid += 1;
      if (!ok) fail(file, name, `schema invalid: ${ajv.errorsText(validate.errors)}`);
      if (vector.suite === 'v1') {
        counts.v1ValidUnderV2 += 1;
        const v2Name = vector.schema;
        const v2 = validators.get(v2Name);
        if (v2 && !v2(parsed)) {
          fail(file, name, `kinds-v1 vector failed v2 schema ${v2Name}: ${ajv.errorsText(v2.errors)}`);
        }
      }
      if (expect.drop) {
        if (bytes <= LINK_MESSAGE_MAX_BYTES) fail(file, name, `drop vector is not > ${LINK_MESSAGE_MAX_BYTES}`);
      } else if (!expect.maxBytes && bytes > LINK_MESSAGE_MAX_BYTES) {
        fail(file, name, `valid envelope is ${bytes} bytes, cap ${LINK_MESSAGE_MAX_BYTES}`);
      }
    } else if (expect.schema === 'invalid') {
      counts.schemaInvalid += 1;
      if (ok && !(expect.maxBytes && bytes > expect.maxBytes)) {
        fail(file, name, 'expected schema invalid');
      }
    } else {
      fail(file, name, `unknown expect.schema ${expect.schema}`);
    }
  }
}

if (counts.v1ValidUnderV2 < 10) {
  failures.push(`kinds-v1 valid-under-v2 count too low: ${counts.v1ValidUnderV2}`);
}
if (CHAT_KINDS.length !== 23) {
  failures.push(`expected 23 chat.* kinds, got ${CHAT_KINDS.length}`);
}

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} vector check(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `PASS vectors=${counts.total} v1=${counts.v1} v1ValidUnderV2=${counts.v1ValidUnderV2} schemaValid=${counts.schemaValid} schemaInvalid=${counts.schemaInvalid} chatKinds=${CHAT_KINDS.length}`,
);
