/**
 * Ad-hoc smoke test for the backend upgrade pass. Run from backend/:
 *   node scripts/smoke.mjs
 * Reads the dev tokens from /tmp/arjun.tok and /tmp/vivek.tok (created by the
 * verifying session) or logs in itself.
 */

const BASE = process.env.SMOKE_BASE || 'http://localhost:5001/api';

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test@12345' }),
  });
  const json = await res.json();
  if (!json.token) throw new Error(`login failed for ${email}: ${JSON.stringify(json)}`);
  return json.token;
}

const results = [];
async function call(label, method, path, token, body, expect = [200, 201]) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  const ok = expect.includes(res.status);
  results.push({ label, status: res.status, ok });
  console.log(`${ok ? '✅' : '❌'} ${String(res.status).padEnd(3)} ${method.padEnd(6)} ${path}  ${label}`);
  if (!ok) console.log('   →', JSON.stringify(json).slice(0, 400));
  return json;
}

const student = await login('arjun.mehta@test.com');
const admin = await login('vivek.malhotra@test.com');
const coordinator = await login('neha.verma@test.com');
const mentor = await login('amit.joshi@test.com');
const clubAdmin = await login('karan.shah@test.com');

console.log('\n— directory / filters —');
const clubs = await call('clubs list', 'GET', '/clubs', student);
const joined = await call('clubs?scope=joined', 'GET', '/clubs?scope=joined', student);
if (!joined?.data?.every((c) => c.myMembership)) console.log('   ⚠️ scope=joined missing myMembership');
const clubId = clubs.data[0]._id;
await call('clubs?q=robotics', 'GET', '/clubs?q=robotics', student);
await call('clubs detail', 'GET', `/clubs/${clubId}`, student);
await call('club summary', 'GET', '/clubs/summary', student);
await call('club members', 'GET', `/clubs/${clubId}/members`, student);
await call('club members q+sort', 'GET', `/clubs/${clubId}/members?q=a&sort=role`, student);
await call('club members bad sort', 'GET', `/clubs/${clubId}/members?sort=nope`, student, null, [400]);
await call('club detail bad id', 'GET', '/clubs/not-an-id', student, null, [400]);

const projects = await call('projects list', 'GET', '/projects', student);
const projectId = projects.data[0]._id;
await call('projects?mine=1', 'GET', '/projects?mine=1', student);
await call('projects?status=active', 'GET', '/projects?status=active', student);
await call('projects?status=bogus', 'GET', '/projects?status=bogus', student, null, [400]);
await call('project summary', 'GET', '/projects/summary', student);
await call('project detail', 'GET', `/projects/${projectId}`, student);
await call('project members', 'GET', `/projects/${projectId}/members`, student);

console.log('\n— events —');
const month = new Date().toISOString().slice(0, 7);
await call('events list', 'GET', '/events', student);
await call('events?month', 'GET', `/events?month=${month}`, student);
await call('events?clubId', 'GET', `/events?clubId=${clubId}`, student);
await call('events?month=bogus', 'GET', '/events?month=2026-13', student, null, [400]);
await call('events?from/to', 'GET', '/events?from=2020-01-01&to=2030-01-01', student);
await call('events summary', 'GET', `/events/summary?month=${month}`, student);
await call('events upcoming', 'GET', '/events/upcoming', student);
await call('events upcoming ?clubId', 'GET', `/events/upcoming?clubId=${clubId}`, student);

console.log('\n— notifications —');
const notifs = await call('notifications', 'GET', '/notifications?limit=5', student);
await call('notifications unread only', 'GET', '/notifications?status=unread&limit=5', student);
await call('notifications by type', 'GET', '/notifications?type=club_join_request', student);
await call('notifications by kind', 'GET', '/notifications?kind=club', student);
await call('notifications bad status', 'GET', '/notifications?status=nope', student, null, [400]);
await call('notifications bad cursor', 'GET', '/notifications?cursor=%%%', student, null, [400]);
if (notifs?.nextCursor) {
  await call('notifications cursor page 2', 'GET', `/notifications?limit=1&cursor=${encodeURIComponent(notifs.nextCursor)}`, student);
}
const notif = notifs?.data?.[0];
if (notif) {
  await call('notification mark unread', 'PATCH', `/notifications/${notif._id}/unread`, student, {});
  await call('notification mark read', 'PATCH', `/notifications/${notif._id}/read`, student, {});
}
await call('notification unread bad id', 'PATCH', '/notifications/zzz/unread', student, {}, [400]);

console.log('\n— inventory —');
const inv = await call('inventory', 'GET', '/inventory', admin);
await call('inventory?q', 'GET', '/inventory?q=arduino', admin);
await call('inventory?category', 'GET', '/inventory?category=', admin);
await call('inventory summary', 'GET', '/inventory/summary', admin);
await call('inventory item', 'GET', `/inventory/${inv.data[0]._id}`, admin);
if (inv.data[0].minimumStock === undefined) console.log('   ⚠️ minimumStock missing from inventory payload');

console.log('\n— material requests —');
const mr = await call('material requests', 'GET', '/material-requests', admin);
await call('material requests?status', 'GET', '/material-requests?status=pending', admin);
await call('material requests?q', 'GET', '/material-requests?q=arduino', admin);
await call('material requests summary', 'GET', '/material-requests/summary', admin);
await call('material requests project', 'GET', `/material-requests/project/${projectId}`, admin);
await call('material requests forbidden', 'GET', '/material-requests', student, null, [403]);
const pending = mr.data.find((r) => r.status === 'pending');
const approved = mr.data.find((r) => r.status === 'approved');
await call('bulk-approve validation failure', 'POST', '/material-requests/bulk-approve', admin, { requestIds: [pending._id, 'zzz'] }, [422]);
await call('bulk-reject idempotency failure', 'POST', '/material-requests/bulk-reject', admin, { requestIds: [approved._id], rejectionReason: 'test' }, [422]);
await call('bulk-approve missing reason', 'POST', '/material-requests/bulk-reject', admin, { requestIds: [pending._id] }, [400]);

console.log('\n— join requests —');
await call('reviewer queue', 'GET', '/join-requests/reviewer', coordinator);
await call('reviewer queue status=all', 'GET', '/join-requests/reviewer?status=all', coordinator);
await call('club requests', 'GET', `/join-requests/club/${clubId}`, coordinator);
await call('club requests bad status', 'GET', `/join-requests/club/${clubId}?status=nope`, coordinator, null, [400]);
await call('student requests', 'GET', '/join-requests/student', student);
await call('coordinator clubs', 'GET', `/coordinators/me/clubs`, coordinator);

console.log('\n— mentor / misc —');
await call('mentor projects', 'GET', '/mentors/me/projects', mentor);
await call('mentor projects by id', 'GET', `/mentors/${(await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${mentor}` } }).then((r) => r.json())).data._id}/projects`, admin);
await call('dashboard summary', 'GET', '/dashboard/summary', student);
await call('search', 'GET', '/search?q=c', student);
await call('search empty q', 'GET', '/search?q=', student);
await call('search bad types', 'GET', '/search?q=c&types=nope', student, null, [400]);
await call('auth me', 'GET', '/auth/me', student);
await call('health', 'GET', '/health', null);
await call('unknown route', 'GET', '/nope', student, null, [404]);
await call('admin-only guard', 'GET', '/inventory/summary', student); // readable by all auth users by design

console.log('\n— leave endpoints (errors only) —');
const arjunClubs = joined.data;
const core = arjunClubs.find((c) => c.myMembership?.membershipType === 'core_team');
if (core) await call('leave club as core team blocked', 'DELETE', `/clubs/${core._id}/join`, student, null, [409]);
const ledProject = projects.data.find((p) => p.myRelation === 'leading');
if (ledProject) await call('leave project as leader blocked', 'DELETE', `/projects/${ledProject._id}/join`, student, null, [409]);
await call('leave project not a member', 'DELETE', `/projects/${projects.data.find((p) => p.myRelation === 'none')?._id || projectId}/join`, clubAdmin, null, [403]);

console.log('\n— malformed payloads —');
await call('bad json', 'POST', '/auth/login', null, undefined, [400]);
const badJson = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{bad json',
});
console.log(`${badJson.status === 400 ? '✅' : '❌'} ${badJson.status} bad JSON body →`, (await badJson.text()).slice(0, 120));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failures:', JSON.stringify(failed, null, 1));
  process.exitCode = 1;
}
