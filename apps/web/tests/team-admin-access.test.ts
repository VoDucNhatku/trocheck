import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceRouteAllowed } from '../src/lib/workspace/safe-path';

test('team directories proxy allows only exact read-only routes', () => {
  for (const route of ['team/users', 'team/sources']) {
    assert.equal(workspaceRouteAllowed(route, 'GET'), true);
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) assert.equal(workspaceRouteAllowed(route, method), false);
    for (const suffix of ['/admin', '/..', '%2fadmin']) assert.equal(workspaceRouteAllowed(route + suffix, 'GET'), false);
  }
});
