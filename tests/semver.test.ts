import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSemver, parseSemver } from '../src/semver.ts';

test('parseSemver extracts major, minor, patch, and prerelease', () => {
  const p1 = parseSemver('0.9.0');
  assert.equal(p1.major, 0);
  assert.equal(p1.minor, 9);
  assert.equal(p1.patch, 0);
  assert.equal(p1.prerelease, '');

  const p2 = parseSemver('v1.2.3-beta.1');
  assert.equal(p2.major, 1);
  assert.equal(p2.minor, 2);
  assert.equal(p2.patch, 3);
  assert.equal(p2.prerelease, 'beta.1');
});

test('compareSemver correctly compares 0.9.0 vs 0.10.0', () => {
  assert.ok(compareSemver('0.9.0', '0.10.0') < 0, '0.9.0 must be less than 0.10.0');
  assert.ok(compareSemver('0.10.0', '0.9.0') > 0, '0.10.0 must be greater than 0.9.0');
  assert.equal(compareSemver('0.10.0', '0.10.0'), 0, '0.10.0 must equal 0.10.0');
});

test('compareSemver handles patch and prerelease comparisons', () => {
  assert.ok(compareSemver('1.0.0', '1.0.1') < 0);
  assert.ok(compareSemver('2.0.0', '1.99.99') > 0);
  assert.ok(compareSemver('1.0.0-alpha', '1.0.0') < 0);
  assert.ok(compareSemver('1.0.0', '1.0.0-beta') > 0);
});
