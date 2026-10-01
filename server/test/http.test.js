import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchJson } from '../src/lib/http.js';

test('upstream timeout remains active while a response body is streaming', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.flushHeaders();
    const timer = setTimeout(() => res.end('{"ok":true}'), 500);
    res.on('close', () => clearTimeout(timer));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/slow-body`;
  await assert.rejects(fetchJson(url, {}, 100), /timed out after 100ms/i);
});
