import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateVerificationCode,
  hashVerificationCode,
  isValidEmail,
  normalizeEmail,
  verificationWindow,
  verifyVerificationCode,
} from './email.js';

test('email normalization and validation reject malformed input', () => {
  assert.equal(normalizeEmail('  Test@Example.COM  '), 'test@example.com');
  assert.equal(isValidEmail('test@example.com'), true);
  assert.equal(isValidEmail('bad@@example.com'), false);
  assert.equal(isValidEmail('bad..mail@example.com'), false);
});

test('verification codes are six numeric characters', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateVerificationCode(), /^\d{6}$/u);
  }
});

test('verification code hashes match only the original code', async () => {
  const request = {
    code_salt: 'salt',
    code_hash: await hashVerificationCode('293736', 'salt', 'secret'),
  };
  assert.equal(await verifyVerificationCode('293736', request, 'secret'), true);
  assert.equal(await verifyVerificationCode('293737', request, 'secret'), false);
});

test('verification window expires ten minutes later', () => {
  const now = new Date('2026-08-13T00:00:00.000Z');
  const window = verificationWindow(now);
  assert.equal(window.expiresAt, '2026-08-13T00:10:00.000Z');
  assert.equal(window.resendAt, '2026-08-13T00:01:00.000Z');
});
