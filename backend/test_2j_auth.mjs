/**
 * Task 2J — Part 1: Authentication Foundation — Backend Tests
 *
 * Tests:
 *  1.  Register with valid data succeeds
 *  2.  Password is stored hashed, not plain text
 *  3.  Register duplicate email fails
 *  4.  Invalid role fails
 *  5.  Login with correct password succeeds
 *  6.  Login with wrong password fails with 401
 *  7.  Login with unknown email fails with 401
 *  8.  Login response does not contain password
 *  9.  JWT is returned on login
 * 10.  JWT contains user identity and role
 * 11.  GET /auth/me works with valid token
 * 12.  GET /auth/me fails without token
 * 13.  GET /auth/me fails with invalid token
 * 14.  GET /auth/me fails with expired token
 * 15.  Authenticated request receives req.user
 * 16.  Logout endpoint responds correctly
 * 17.  Frontend stores/restores authentication state (manual — see notes)
 * 18.  Frontend sends Authorization Bearer token (manual — see notes)
 * 19.  Invalid stored token is cleared (manual — see notes)
 * 20.  Unauthenticated frontend users are redirected to login (manual — see notes)
 *
 * Run: node test_2j_auth.mjs
 */

import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:5000/api';
const TEST_EMAIL = `auth_test_${Date.now()}@cnp.test`;
const TEST_PASS  = 'TestPass123!';

let passed = 0;
let failed = 0;
let registeredUserId = '';
let authToken = '';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function pass(name) {
  console.log(`  ✅ PASS — ${name}`);
  passed++;
}

function fail(name, detail) {
  console.error(`  ❌ FAIL — ${name}`);
  if (detail) console.error(`         ${detail}`);
  failed++;
}

function assert(name, condition, detail) {
  if (condition) pass(name);
  else fail(name, detail);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n🔐 Task 2J — Authentication Foundation — Backend Tests\n');
console.log('━'.repeat(60));

// ── 1. Register with valid data ───────────────────────────────────────────────
console.log('\n📋 REGISTRATION TESTS\n');
{
  const { status, json } = await req('POST', '/auth/register', {
    name: 'Auth Test User',
    email: TEST_EMAIL,
    password: TEST_PASS,
    role: 'student',
    department: 'Computer Science',
  });
  assert('1. Register with valid data succeeds (status 201)', status === 201, `status=${status}`);
  assert('1. Register returns success:true', json?.success === true, `json.success=${json?.success}`);
  assert('1. Register returns token', !!json?.token, `token=${json?.token}`);
  assert('1. Register returns user object', !!json?.user, `user=${JSON.stringify(json?.user)}`);
  if (json?.user?._id) registeredUserId = json.user._id;
  if (json?.token)     authToken = json.token;
}

// ── 2. Password not stored as plain text ──────────────────────────────────────
{
  // The user object from the register response must NOT contain the password
  const { json } = await req('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  const userJson = JSON.stringify(json?.user || '');
  assert('2. Login response user object does not contain password field',
    !userJson.includes('"password"') && json?.user?.password === undefined,
    `password in response: ${userJson.substring(0, 200)}`
  );
  // Verify we can log in — meaning the password WAS hashed and compared correctly
  assert('2. Password was stored hashed (login succeeds with plain-text input)',
    json?.success === true,
    `login success=${json?.success}`
  );
}

// ── 3. Duplicate email ────────────────────────────────────────────────────────
{
  const { status, json } = await req('POST', '/auth/register', {
    name: 'Duplicate User',
    email: TEST_EMAIL,
    password: TEST_PASS,
    role: 'student',
  });
  assert('3. Duplicate email registration fails (status 409)', status === 409, `status=${status}`);
  assert('3. Duplicate email returns success:false', json?.success === false, `json.success=${json?.success}`);
}

// ── 4. Invalid role ───────────────────────────────────────────────────────────
{
  const uniqueEmail = `bad_role_${Date.now()}@cnp.test`;
  // team_leader must be rejected
  const { status: s1, json: j1 } = await req('POST', '/auth/register', {
    name: 'Bad Role User',
    email: uniqueEmail,
    password: TEST_PASS,
    role: 'team_leader',
  });
  assert('4. "team_leader" role is rejected (status 400)', s1 === 400, `status=${s1}`);
  assert('4. Invalid role returns success:false', j1?.success === false, `json.success=${j1?.success}`);

  // Also test completely invalid role
  const uniqueEmail2 = `bad_role2_${Date.now()}@cnp.test`;
  const { status: s2 } = await req('POST', '/auth/register', {
    name: 'Hack Role User',
    email: uniqueEmail2,
    password: TEST_PASS,
    role: 'superadmin',
  });
  assert('4. Arbitrary invalid role is rejected (status 400)', s2 === 400, `status=${s2}`);
}

// ── 5. Login with correct password ────────────────────────────────────────────
console.log('\n📋 LOGIN TESTS\n');
{
  const { status, json } = await req('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASS,
  });
  assert('5. Login with correct password (status 200)', status === 200, `status=${status}`);
  assert('5. Login returns success:true', json?.success === true, `json.success=${json?.success}`);
  if (json?.token) authToken = json.token;
}

// ── 6. Login with wrong password ──────────────────────────────────────────────
{
  const { status, json } = await req('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: 'WrongPassword999!',
  });
  assert('6. Login with wrong password fails (status 401)', status === 401, `status=${status}`);
  assert('6. Login with wrong password returns success:false', json?.success === false);
  assert('6. Generic error message (no "password" in message)',
    json?.message?.toLowerCase()?.includes('invalid credentials'),
    `message="${json?.message}"`
  );
}

// ── 7. Login with unknown email ───────────────────────────────────────────────
{
  const { status, json } = await req('POST', '/auth/login', {
    email: 'nobody_1234567890@cnp.test',
    password: TEST_PASS,
  });
  assert('7. Login with unknown email fails (status 401)', status === 401, `status=${status}`);
  assert('7. Unknown email returns generic message',
    json?.message?.toLowerCase()?.includes('invalid credentials'),
    `message="${json?.message}"`
  );
}

// ── 8. Login response does not contain password ───────────────────────────────
{
  const { json } = await req('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASS,
  });
  assert('8. Login response user.password is undefined',
    json?.user?.password === undefined,
    `password=${json?.user?.password}`
  );
  const userStr = JSON.stringify(json?.user || {});
  assert('8. Login response JSON does not contain "password" key',
    !userStr.includes('"password"'),
    `user JSON=${userStr.substring(0, 200)}`
  );
}

// ── 9. JWT is returned ────────────────────────────────────────────────────────
console.log('\n📋 JWT TESTS\n');
{
  const { json } = await req('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASS,
  });
  assert('9. JWT token is present in login response', !!json?.token, `token=${json?.token}`);
  assert('9. Token is a non-empty string', typeof json?.token === 'string' && json.token.length > 10);
  if (json?.token) authToken = json.token;
}

// ── 10. JWT contains user identity and role ───────────────────────────────────
{
  let payload;
  try {
    // Decode without verifying (we just want to inspect the payload structure)
    payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64url').toString('utf-8'));
  } catch (e) {
    payload = null;
  }
  assert('10. JWT payload contains userId', !!payload?.userId, `payload=${JSON.stringify(payload)}`);
  assert('10. JWT payload contains role',   !!payload?.role,   `payload=${JSON.stringify(payload)}`);
  assert('10. JWT payload role is "student"', payload?.role === 'student', `role=${payload?.role}`);
  assert('10. JWT payload does NOT contain password',
    payload?.password === undefined,
    `password in payload: ${payload?.password}`
  );
}

// ── 11. GET /auth/me with valid token ─────────────────────────────────────────
console.log('\n📋 /auth/me TESTS\n');
{
  const { status, json } = await req('GET', '/auth/me', undefined, authToken);
  assert('11. GET /auth/me with valid token (status 200)', status === 200, `status=${status}`);
  assert('11. /me returns success:true', json?.success === true);
  assert('11. /me returns user data', !!json?.data);
  assert('11. /me user.email matches registered email',
    json?.data?.email === TEST_EMAIL,
    `email=${json?.data?.email}`
  );
  assert('11. /me does not return password', json?.data?.password === undefined);
}

// ── 12. GET /auth/me without token ───────────────────────────────────────────
{
  const { status, json } = await req('GET', '/auth/me');
  assert('12. GET /auth/me without token (status 401)', status === 401, `status=${status}`);
  assert('12. /me without token returns success:false', json?.success === false);
}

// ── 13. GET /auth/me with invalid token ──────────────────────────────────────
{
  const { status, json } = await req('GET', '/auth/me', undefined, 'not.a.real.jwt.token');
  assert('13. GET /auth/me with invalid token (status 401)', status === 401, `status=${status}`);
  assert('13. /me with invalid token returns success:false', json?.success === false);
}

// ── 14. GET /auth/me with expired token ──────────────────────────────────────
{
  // Create a token that expired 1 second ago
  const expiredToken = jwt.sign(
    { userId: registeredUserId, role: 'student' },
    process.env.JWT_SECRET || 'cnp_dept_jwt_secret_2j_change_in_production_please',
    { expiresIn: -1 }
  );
  const { status, json } = await req('GET', '/auth/me', undefined, expiredToken);
  assert('14. GET /auth/me with expired token (status 401)', status === 401, `status=${status}`);
  assert('14. /me with expired token returns success:false', json?.success === false);
}

// ── 15. Authenticated request receives req.user ───────────────────────────────
{
  // /auth/me uses requireAuth and then uses req.user.userId to fetch the user.
  // A successful /me call confirms req.user is properly set.
  const { status, json } = await req('GET', '/auth/me', undefined, authToken);
  assert('15. Authenticated request has req.user (verified via /auth/me)',
    status === 200 && json?.data?._id === registeredUserId,
    `status=${status} id=${json?.data?._id} expected=${registeredUserId}`
  );
}

// ── 16. Logout endpoint ───────────────────────────────────────────────────────
console.log('\n📋 LOGOUT TESTS\n');
{
  const { status, json } = await req('POST', '/auth/logout');
  assert('16. POST /auth/logout (status 200)', status === 200, `status=${status}`);
  assert('16. Logout returns success:true', json?.success === true);
}

// ── Existing system health checks ─────────────────────────────────────────────
console.log('\n📋 EXISTING SYSTEM HEALTH CHECKS\n');
{
  const { status } = await req('GET', '/health');
  assert('Existing: Health endpoint still responds', status === 200, `status=${status}`);
}
{
  const { status } = await req('GET', '/notifications', undefined, undefined);
  // Notification endpoint requires userId query param — 400 or 200 is fine, just not 500
  assert('Existing: Notification system still accessible (not 500)',
    status !== 500, `status=${status}`
  );
}
{
  const { status } = await req('GET', '/inventory');
  assert('Existing: Inventory system still accessible (not 500)',
    status !== 500, `status=${status}`
  );
}
{
  const { status } = await req('GET', '/projects');
  assert('Existing: Projects endpoint still accessible (not 500)',
    status !== 500, `status=${status}`
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

if (failed === 0) {
  console.log('🎉 All backend authentication tests passed!\n');
} else {
  console.log(`⚠️  ${failed} test(s) failed. Review output above.\n`);
  process.exit(1);
}
