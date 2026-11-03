// tests/collab-url.test.js — the collaboration backend must default to an
// address other devices can actually reach.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CollabClient } from '../scene/collab-client.js';

describe('Collaboration backend address', () => {
  test('loopback hosts are recognised in every common spelling', () => {
    for (const host of ['localhost', '127.0.0.1', '::1', '[::1]']) {
      assert.equal(CollabClient.isLoopbackHost(host), true, `${host} was not seen as loopback`);
    }
    for (const host of ['board.example.com', '10.0.0.12', '192.168.1.20']) {
      assert.equal(CollabClient.isLoopbackHost(host), false, `${host} was wrongly seen as loopback`);
    }
  });

  test('a loopback backend is reported as unreachable by students', () => {
    const client = new CollabClient(null);
    client.apiBase = 'http://127.0.0.1:4179';
    assert.equal(client.isApiBaseReachableFromOtherDevices(), false);
    client.apiBase = 'http://localhost:4179';
    assert.equal(client.isApiBaseReachableFromOtherDevices(), false);
  });

  test('a same-origin or routable backend is not flagged', () => {
    const client = new CollabClient(null);
    client.apiBase = '';
    assert.equal(client.isApiBaseReachableFromOtherDevices(), true);
    client.apiBase = 'https://board.example.com';
    assert.equal(client.isApiBaseReachableFromOtherDevices(), true);
    client.apiBase = 'http://10.0.0.12:4179';
    assert.equal(client.isApiBaseReachableFromOtherDevices(), true);
  });

  test('outside a browser there is no loopback default', () => {
    const client = new CollabClient(null);
    assert.equal(client.getSuggestedApiBase(), '');
    assert.equal(client.isLocalPage(), true);
  });
});
