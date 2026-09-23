#!/usr/bin/env node
/**
 * Validate v2 vectors against spec/schemas. Historical vectors under
 * spec/historical/ are checked only against their own schemas. v2 rejects
 * those kinds as inbound (unknown-kind, not normalized).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(root, 'spec/schemas');
const vectorDir = join(root, 'spec/vectors');
const historicalSchemaDir = join(root, 'spec/historical/schemas');
const historicalVectorDir = join(root, 'spec/historical/vectors');
const LINK_MESSAGE_MAX_BYTES = 1000;
const MAX_CAPABILITIES_BYTES = 512;

const CHAT_KINDS = [
  'chat.message.v0',
  'chat.attachment.v0',
  'chat.tag.v0',
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

const HISTORICAL_KINDS = new Set([
  'pubky_app.dm.v0',
  'marketplace.chat_message.v0',
  'chat.reaction.v0',
  'chat.group.reaction.v0',
  'hypercolor.receiver.capabilities',
]);

const KNOWN_INBOUND = new Set(
  CHAT_KINDS.filter(k => k !== 'chat.public.message.v0' && k !== 'chat.receiver.capabilities.v0'),
);

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

function jsonFiles(dir) {
  return readdirSync(dir).filter(name => name.endsWith('.json') && !name.startsWith('.'));
}

function loadValidators(dir, { defs, rejectHistorical = false } = {}) {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validators = new Map();
  if (defs) ajv.addSchema(defs);
  for (const file of jsonFiles(dir)) {
    if (file === '_defs.json') continue;
    const name = file.replace(/\.json$/, '');
    if (rejectHistorical && HISTORICAL_KINDS.has(name)) {
      throw new Error(`${file} belongs in spec/historical/schemas`);
    }
    const schema = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    ajv.addSchema(schema);
    if (schema.$id) {
      const validate = ajv.getSchema(schema.$id);
      if (!validate) throw new Error(`failed to compile ${file}`);
      validators.set(name, validate);
    }
  }
  return { ajv, validators };
}

const defs = JSON.parse(readFileSync(join(schemaDir, '_defs.json'), 'utf8'));
const { ajv, validators } = loadValidators(schemaDir, { defs, rejectHistorical: true });
const historical = loadValidators(historicalSchemaDir, { defs });

for (const kind of CHAT_KINDS) {
  if (!validators.has(kind)) {
    throw new Error(`missing schema for chat kind ${kind}`);
  }
}

const failures = [];
const counts = { total: 0, v1: 0, historical: 0, schemaValid: 0, schemaInvalid: 0, historicalRejected: 0 };

for (const kind of HISTORICAL_KINDS) {
  if (KNOWN_INBOUND.has(kind) || CHAT_KINDS.includes(kind) || validators.has(kind)) {
    failures.push(`historical kind ${kind} is accepted as a v2 inbound kind`);
  }
  if (!historical.validators.has(kind)) {
    failures.push(`missing historical schema for ${kind}`);
  }
}

function fail(file, name, message) {
  failures.push(`${file} / ${name}: ${message}`);
}

function checkHistorical(file, vector) {
  counts.historical += 1;
  const name = vector.name ?? '(unnamed)';
  const expect = vector.expect ?? {};
  const raw = rawString(vector);
  const kind = peekKind(raw);
  if (expect.alias) fail(file, name, 'historical vector must not declare an inbound alias');
  if (kind && (KNOWN_INBOUND.has(kind) || validators.has(kind))) {
    fail(file, name, `v2 accepts historical kind ${kind} inbound`);
  } else if (kind && HISTORICAL_KINDS.has(kind)) {
    counts.historicalRejected += 1;
  } else {
    fail(file, name, `historical vector kind ${kind} is not in the historical set`);
  }
  if (expect.schema === 'skip' || !vector.schema) {
    fail(file, name, 'historical vector must name its own schema');
    return;
  }
  const validate = historical.validators.get(vector.schema);
  if (!validate) {
    fail(file, name, `no historical validator for schema ${vector.schema}`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (expect.schema === 'invalid') {
      counts.schemaInvalid += 1;
      return;
    }
    fail(file, name, `JSON.parse: ${error.message}`);
    return;
  }
  const ok = validate(parsed);
  if (expect.schema === 'valid') {
    counts.schemaValid += 1;
    if (!ok) fail(file, name, `schema invalid: ${historical.ajv.errorsText(validate.errors)}`);
  } else if (expect.schema === 'invalid') {
    counts.schemaInvalid += 1;
    if (ok) fail(file, name, 'expected schema invalid');
  } else {
    fail(file, name, `unknown expect.schema ${expect.schema}`);
  }
}

for (const file of jsonFiles(historicalVectorDir).sort()) {
  const vectors = JSON.parse(readFileSync(join(historicalVectorDir, file), 'utf8'));
  if (!Array.isArray(vectors)) throw new Error(`${file} must be an array`);
  for (const vector of vectors) checkHistorical(`historical/${file}`, vector);
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
      if (kind && HISTORICAL_KINDS.has(kind)) counts.historicalRejected += 1;
      continue;
    }

    if (kind && HISTORICAL_KINDS.has(kind)) {
      fail(file, name, `historical kind ${kind} must be rejected inbound`);
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

if (counts.v1 < 1) failures.push('expected kinds-v1 fixtures that are still valid v2 messages');
if (counts.historical < 1) failures.push('expected historical reference vectors');
if (counts.historicalRejected < HISTORICAL_KINDS.size) {
  failures.push(`v2 rejected ${counts.historicalRejected} historical kinds, expected at least ${HISTORICAL_KINDS.size}`);
}
if (CHAT_KINDS.length !== 21) {
  failures.push(`expected 21 chat.* kinds, got ${CHAT_KINDS.length}`);
}

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} vector check(s)`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `PASS vectors=${counts.total} v1=${counts.v1} historical=${counts.historical} historicalRejected=${counts.historicalRejected} schemaValid=${counts.schemaValid} schemaInvalid=${counts.schemaInvalid} chatKinds=${CHAT_KINDS.length}`,
);
