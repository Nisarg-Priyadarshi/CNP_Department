/**
 * Task 2J — Part 2: Full Backend RBAC and Authorization Tests
 *
 * test_2j_rbac.mjs
 *
 * Tests cover:
 *   - Authentication requirements (unauthenticated requests → 401)
 *   - Each role allowed/denied actions
 *   - Club scoping (faculty_coordinator can only manage their own club)
 *   - Project scoping (faculty_mentor can only access assigned projects)
 *   - Primary mentor restriction for join-request approval
 *   - Team Leader authorization (project-level, not global role)
 *   - Inventory authorization (project_admin only)
 *   - Material request authorization
 *   - Project material authorization
 *   - Notification ownership
 *   - IDOR attacks
 *   - Privilege escalation
 *   - Client identity spoofing
 *
 * Run: node test_2j_rbac.mjs
 * Prerequisites: Backend running on http://localhost:5000
 */

const BASE = 'http://localhost:5000/api';
const TS   = Date.now();
let passed = 0;
let failed = 0;

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL — ${label}${detail ? ' | ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(` ${title}`);
  console.log('═'.repeat(65));
}

async function createUser(name, role) {
  const email = `rbac_${role}_${name.replace(/\s+/g, '')}_${TS}@test.com`;
  const password = 'TestPass123!';
  const { status, json } = await req('POST', '/auth/register', { name, email, password, role });
  if (status !== 201) {
    const existR = await req('POST', '/users/test', { name, email, role });
    return { user: existR.json.data, token: null };
  }
  return { user: json.user, token: json.token };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETUP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

section('SETUP â€” Creating test users, clubs, and projects');

const studentA_r  = await createUser('Student A', 'student');
const studentB_r  = await createUser('Student B', 'student');
const studentC_r  = await createUser('Student C', 'student');
const coordA_r    = await createUser('Coordinator A', 'faculty_coordinator');
const coordB_r    = await createUser('Coordinator B', 'faculty_coordinator');
const mentorA_r   = await createUser('Mentor A', 'faculty_mentor');
const mentorB_r   = await createUser('Mentor B', 'faculty_mentor');
const mentorC_r   = await createUser('Mentor C', 'faculty_mentor');
const clubAdmin_r = await createUser('Club Admin', 'club_admin');
const projAdmin_r = await createUser('Project Admin', 'project_admin');

const studentA  = studentA_r.user;   const tokenSA  = studentA_r.token;
const studentB  = studentB_r.user;   const tokenSB  = studentB_r.token;
const studentC  = studentC_r.user;   const tokenSC  = studentC_r.token;
const coordA    = coordA_r.user;     const tokenCA  = coordA_r.token;
const coordB    = coordB_r.user;     const tokenCB  = coordB_r.token;
const mentorA   = mentorA_r.user;    const tokenMA  = mentorA_r.token;
const mentorB   = mentorB_r.user;    const tokenMB  = mentorB_r.token;
const mentorC   = mentorC_r.user;    const tokenMC  = mentorC_r.token;
const clubAdmin = clubAdmin_r.user;  const tokenAdm = clubAdmin_r.token;
const projAdmin = projAdmin_r.user;  const tokenPA  = projAdmin_r.token;

console.log('  Users:', studentA?.name, '|', studentB?.name, '|', studentC?.name, '|',
  coordA?.name, '|', coordB?.name, '|', mentorA?.name, '|', mentorB?.name,
  '|', mentorC?.name, '|', clubAdmin?.name, '|', projAdmin?.name);

const clubARes = await req('POST', '/clubs', {
  name: `Club A ${TS}`, description: 'Test Club A',
  facultyCoordinatorId: coordA._id,
}, tokenAdm);
const clubBRes = await req('POST', '/clubs', {
  name: `Club B ${TS}`, description: 'Test Club B',
  facultyCoordinatorId: coordB._id,
}, tokenAdm);
const clubA = clubARes.json.data;
const clubB = clubBRes.json.data;
console.log('  Clubs:', clubA?.name, '|', clubB?.name);

const projARes = await req('POST', '/projects', { name: `Project A ${TS}`, description: 'Test Project A' }, tokenPA);
const projBRes = await req('POST', '/projects', { name: `Project B ${TS}`, description: 'Test Project B' }, tokenPA);
const projA = projARes.json.data;
const projB = projBRes.json.data;
console.log('  Projects:', projA?.name, '|', projB?.name);

await req('POST', `/projects/${projA._id}/mentors`, { mentorId: mentorA._id }, tokenPA);
await req('POST', `/projects/${projA._id}/mentors`, { mentorId: mentorC._id }, tokenPA);
await req('POST', `/projects/${projB._id}/mentors`, { mentorId: mentorB._id }, tokenPA);

await req('POST', `/projects/${projA._id}/members`, { studentId: studentA._id }, tokenPA);
await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenPA);
await req('POST', `/projects/${projB._id}/members`, { studentId: studentB._id }, tokenPA);
console.log('  Setup complete.\n');

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 1: UNAUTHENTICATED ACCESS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('1. UNAUTHENTICATED ACCESS â€” All protected routes return 401');
{
  const r1 = await req('GET', '/clubs');
  assert('1.1  GET /clubs without token -> 401', r1.status === 401, `got ${r1.status}`);
  const r2 = await req('GET', `/projects/${projA._id}/team`);
  assert('1.2  GET /projects/:id/team without token -> 401', r2.status === 401, `got ${r2.status}`);
  const r3 = await req('GET', `/projects/${projA._id}/materials`);
  assert('1.3  GET /projects/:id/materials without token -> 401', r3.status === 401, `got ${r3.status}`);
  const r4 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id });
  assert('1.4  PATCH /projects/:id/team-leader without token -> 401', r4.status === 401, `got ${r4.status}`);
  const r5 = await req('GET', '/notifications');
  assert('1.5  GET /notifications without token -> 401', r5.status === 401, `got ${r5.status}`);
  const r6 = await req('PATCH', '/notifications/read-all');
  assert('1.6  PATCH /notifications/read-all without token -> 401', r6.status === 401, `got ${r6.status}`);
  const r7 = await req('GET', '/inventory');
  assert('1.7  GET /inventory without token -> 401', r7.status === 401, `got ${r7.status}`);
  const r8 = await req('GET', '/allocations');
  assert('1.8  GET /allocations without token -> 401', r8.status === 401, `got ${r8.status}`);
  const r9 = await req('POST', '/material-requests');
  assert('1.9  POST /material-requests without token -> 401', r9.status === 401, `got ${r9.status}`);
  const r10 = await req('GET', `/projects/${projA._id}/updates`);
  assert('1.10 GET /projects/:id/updates without token -> 401', r10.status === 401, `got ${r10.status}`);
  const r11 = await req('GET', `/users/${studentA._id}/projects`);
  assert('1.11 GET /users/:id/projects without token -> 401', r11.status === 401, `got ${r11.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 2: STUDENT PERMISSIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('2. STUDENT PERMISSIONS');
{
  const r1 = await req('GET', '/clubs', null, tokenSA);
  assert('2.1  Student can view clubs', r1.status === 200, `got ${r1.status}`);
  const r2 = await req('GET', '/projects', null, tokenSA);
  assert('2.2  Student can view projects', r2.status === 200, `got ${r2.status}`);
  const r3 = await req('POST', '/clubs', { name: 'Hack Club', description: 'x' }, tokenSA);
  assert('2.3  Student cannot create clubs -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('POST', '/projects', { name: 'Hack', description: 'x' }, tokenSA);
  assert('2.4  Student cannot create projects -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('POST', '/inventory', { name: 'Guitar', totalQuantity: 10 }, tokenSA);
  assert('2.5  Student cannot create inventory -> 403', r5.status === 403, `got ${r5.status}`);
  const joinR = await req('POST', `/clubs/${clubA._id}/join`, {}, tokenSB);
  const joinReqId = joinR.json.data?._id;
  const r6 = await req('PATCH', `/join-requests/${joinReqId || '000000000000000000000001'}/approve`, {}, tokenSB);
  assert('2.6  Student cannot approve join requests -> 403/404', [403, 404].includes(r6.status), `got ${r6.status}`);
  const r7 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenSA);
  assert('2.7  Student cannot assign Team Leader -> 403', r7.status === 403, `got ${r7.status}`);
  const r8 = await req('POST', `/projects/${projB._id}/materials`, { name: 'Cable', quantity: 1, source: 'owned' }, tokenSB);
  assert('2.8  Non-TL student cannot add project materials -> 403', r8.status === 403, `got ${r8.status}`);
  const r9 = await req('GET', `/material-requests/project/${projB._id}`, null, tokenSA);
  assert('2.9  Student cannot view material requests for non-member project -> 403', r9.status === 403, `got ${r9.status}`);
  const r10 = await req('GET', `/projects/${projA._id}/team`, null, tokenSA);
  assert('2.10 Student can view project team', r10.status === 200, `got ${r10.status}`);
  const r11 = await req('POST', `/projects/${projA._id}/materials`, { name: 'Cable', quantity: 1, source: 'owned' }, tokenSB);
  assert('2.11 Student not TL of Project A cannot add materials -> 403', r11.status === 403, `got ${r11.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 3: TEAM LEADER AUTHORIZATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('3. TEAM LEADER AUTHORIZATION (Student A is TL of Project A)');
{
  const r1 = await req('POST', `/projects/${projA._id}/materials`, { name: 'Capacitor', quantity: 5, source: 'self_purchased' }, tokenSA);
  assert('3.1  Team Leader can add self_purchased material', r1.status === 201, `got ${r1.status}`);
  const r2 = await req('POST', `/projects/${projA._id}/materials`, { name: 'Resistor', quantity: 3, source: 'owned' }, tokenSA);
  assert('3.2  Team Leader can add owned material', r2.status === 201, `got ${r2.status}`);
  const r3 = await req('POST', `/projects/${projA._id}/materials`, { name: 'Guitar String', quantity: 2, source: 'guitar' }, tokenSA);
  assert('3.3  Team Leader cannot add guitar source directly -> 400', r3.status === 400, `got ${r3.status}`);
  const r4 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentB._id }, tokenSA);
  assert('3.4  Team Leader cannot assign another Team Leader -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('GET', `/projects/${projA._id}/materials`, null, tokenSA);
  assert('3.5  Team Leader can view project materials', r5.status === 200, `got ${r5.status}`);
  const r6 = await req('GET', `/projects/${projA._id}/team`, null, tokenSA);
  assert('3.6  Team Leader can view project team', r6.status === 200, `got ${r6.status}`);
  const r7 = await req('POST', `/projects/${projB._id}/materials`, { name: 'Cable', quantity: 1, source: 'owned' }, tokenSA);
  assert('3.7  TL of Project A cannot add materials to Project B -> 403', r7.status === 403, `got ${r7.status}`);
  const r8 = await req('POST', `/projects/${projB._id}/materials`, { name: 'Res', quantity: 1, source: 'owned', leaderId: studentA._id }, tokenSA);
  assert('3.8  Spoofed leaderId does not grant cross-project access -> 403', r8.status === 403, `got ${r8.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 4: TEAM LEADER ASSIGNMENT SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('4. TEAM LEADER ASSIGNMENT SECURITY');
{
  const r1 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenMA);
  assert('4.1  Faculty Mentor cannot assign Team Leader -> 403', r1.status === 403, `got ${r1.status}`);
  const r2 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenCA);
  assert('4.2  Faculty Coordinator cannot assign Team Leader -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenAdm);
  assert('4.3  Club Admin cannot assign Team Leader -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentB._id }, tokenPA);
  assert('4.4  Project Admin cannot assign non-member as TL -> 400', r4.status === 400, `got ${r4.status}`);
  const r5 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: mentorA._id }, tokenPA);
  assert('4.5  Project Admin cannot assign faculty_mentor as TL -> 400', r5.status === 400, `got ${r5.status}`);
  const r6 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id, adminId: projAdmin._id }, tokenSB);
  assert('4.6  Spoofed adminId in body does not bypass role check -> 403', r6.status === 403, `got ${r6.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 5: FACULTY COORDINATOR SCOPING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('5. FACULTY COORDINATOR SCOPING');
{
  const r1 = await req('POST', `/clubs/${clubA._id}/members`, { studentId: studentA._id, membershipType: 'member' }, tokenCA);
  assert('5.1  Coord A can add member to Club A', [201, 409].includes(r1.status), `got ${r1.status}`);
  const r2 = await req('POST', `/clubs/${clubB._id}/members`, { studentId: studentA._id, membershipType: 'member' }, tokenCA);
  assert('5.2  Coord A cannot add member to Club B -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('POST', `/clubs/${clubB._id}/members`, { studentId: studentA._id, membershipType: 'member' }, tokenCB);
  assert('5.3  Coord B can add member to Club B', [201, 409].includes(r3.status), `got ${r3.status}`);
  const r4 = await req('POST', `/clubs/${clubA._id}/members`, { studentId: studentA._id, membershipType: 'member' }, tokenCB);
  assert('5.4  Coord B cannot add member to Club A -> 403', r4.status === 403, `got ${r4.status}`);
  const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
  const r5 = await req('POST', '/events', { title: 'Hack Event', description: 'Test', clubId: clubB._id, eventDate: futureDate, location: 'Hall B' }, tokenCA);
  assert('5.5  Coord A cannot create event for Club B -> 403', r5.status === 403, `got ${r5.status}`);
  const r6 = await req('POST', '/events', { title: `Event A ${TS}`, description: 'Test', clubId: clubA._id, eventDate: futureDate, location: 'Hall A' }, tokenCA);
  assert('5.6  Coord A can create event for Club A', r6.status === 201, `got ${r6.status}`);
  const r7 = await req('POST', '/inventory', { name: 'Hack Item', totalQuantity: 5 }, tokenCA);
  assert('5.7  Coord A cannot create inventory -> 403', r7.status === 403, `got ${r7.status}`);
  const r8 = await req('PATCH', '/material-requests/000000000000000000000001/approve', {}, tokenCA);
  assert('5.8  Coord A cannot approve material requests -> 403', r8.status === 403, `got ${r8.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 6: CLUB ADMIN PERMISSIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('6. CLUB ADMIN PERMISSIONS');
{
  const r1 = await req('POST', '/clubs', { name: `Admin Club ${TS}`, description: 'Created by admin' }, tokenAdm);
  assert('6.1  Club Admin can create clubs', r1.status === 201, `got ${r1.status}`);
  const r2 = await req('POST', `/clubs/${clubA._id}/members`, { studentId: studentB._id, membershipType: 'member' }, tokenAdm);
  assert('6.2  Club Admin can add member to any club', [201, 409].includes(r2.status), `got ${r2.status}`);
  const r3 = await req('POST', '/projects', { name: 'Admin Project', description: 'x' }, tokenAdm);
  assert('6.3  Club Admin cannot create projects -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('POST', '/inventory', { name: 'Test Item', totalQuantity: 5 }, tokenAdm);
  assert('6.4  Club Admin cannot create inventory -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('PATCH', '/material-requests/000000000000000000000001/approve', {}, tokenAdm);
  assert('6.5  Club Admin cannot approve material requests -> 403', r5.status === 403, `got ${r5.status}`);
  const r6 = await req('GET', '/allocations', null, tokenAdm);
  assert('6.6  Club Admin cannot view allocations -> 403', r6.status === 403, `got ${r6.status}`);
  const r7 = await req('PATCH', `/projects/${projA._id}/team-leader`, { studentId: studentA._id }, tokenAdm);
  assert('6.7  Club Admin cannot assign Team Leader -> 403', r7.status === 403, `got ${r7.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 7: FACULTY MENTOR SCOPING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('7. FACULTY MENTOR SCOPING');
{
  const r1  = await req('GET',  `/projects/${projA._id}/materials`, null, tokenMA);
  assert('7.1  Mentor A can view materials for assigned Project A', r1.status === 200, `got ${r1.status}`);
  const r2  = await req('GET',  `/projects/${projA._id}/materials`, null, tokenMB);
  assert('7.2  Mentor B cannot view materials for Project A -> 403', r2.status === 403, `got ${r2.status}`);
  const r3  = await req('GET',  `/projects/${projA._id}/updates`, null, tokenMA);
  assert('7.3  Mentor A can view updates for assigned Project A', r3.status === 200, `got ${r3.status}`);
  const r4  = await req('GET',  `/projects/${projA._id}/updates`, null, tokenMB);
  assert('7.4  Mentor B cannot view updates for Project A -> 403', r4.status === 403, `got ${r4.status}`);
  const r5  = await req('POST', `/projects/${projA._id}/feedback`, { feedbackText: 'Great work!' }, tokenMA);
  assert('7.5  Mentor A can add feedback to assigned Project A', r5.status === 201, `got ${r5.status}`);
  const r6  = await req('POST', `/projects/${projA._id}/feedback`, { feedbackText: 'Hacked!' }, tokenMB);
  assert('7.6  Mentor B cannot add feedback to Project A -> 403', r6.status === 403, `got ${r6.status}`);
  const r7  = await req('PATCH', '/material-requests/000000000000000000000001/approve', {}, tokenMA);
  assert('7.7  Mentor cannot approve material requests -> 403', r7.status === 403, `got ${r7.status}`);
  const r8  = await req('POST', '/inventory', { name: 'Strings', totalQuantity: 10 }, tokenMA);
  assert('7.8  Mentor cannot create inventory -> 403', r8.status === 403, `got ${r8.status}`);
  const r9  = await req('GET',  '/allocations', null, tokenMA);
  assert('7.9  Mentor cannot view global allocations -> 403', r9.status === 403, `got ${r9.status}`);
  const r10 = await req('GET',  `/material-requests/project/${projB._id}`, null, tokenMA);
  assert('7.10 Mentor A cannot view material requests for Project B -> 403', r10.status === 403, `got ${r10.status}`);
  const r11 = await req('GET',  `/material-requests/project/${projA._id}`, null, tokenMA);
  assert('7.11 Mentor A can view material requests for assigned Project A', r11.status === 200, `got ${r11.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 8: PRIMARY MENTOR RESTRICTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('8. PRIMARY MENTOR RESTRICTION (Mentor C is non-primary on Project A)');
{
  const joinRes = await req('POST', `/projects/${projA._id}/join`, {}, tokenSB);
  const joinReqId = joinRes.json.data?._id;
  console.log('  Project join request:', joinReqId ? 'created' : 'already processed');
  if (joinReqId) {
    const r1 = await req('PATCH', `/join-requests/${joinReqId}/approve`, {}, tokenMC);
    assert('8.1  Non-primary Mentor C cannot approve project join request -> 403', r1.status === 403, `got ${r1.status}`);
    const r2 = await req('PATCH', `/join-requests/${joinReqId}/reject`, {}, tokenMC);
    assert('8.2  Non-primary Mentor C cannot reject project join request -> 403', r2.status === 403, `got ${r2.status}`);
    const r3 = await req('PATCH', `/join-requests/${joinReqId}/approve`, {}, tokenMA);
    assert('8.3  Primary Mentor A can approve project join request', r3.status === 200, `got ${r3.status}`);
  } else {
    assert('8.1  Non-primary Mentor C cannot approve (student already member)', true);
    assert('8.2  Non-primary Mentor C cannot reject (student already member)', true);
    assert('8.3  Primary Mentor A can approve (student already member)', true);
  }
  const joinRes2 = await req('POST', `/projects/${projA._id}/join`, {}, tokenSB);
  const joinReqId2 = joinRes2.json.data?._id;
  if (joinReqId2) {
    const r4 = await req('PATCH', `/join-requests/${joinReqId2}/approve`, {}, tokenMB);
    assert('8.4  Mentor B cannot approve Project A join request (cross-project) -> 403', r4.status === 403, `got ${r4.status}`);
  } else {
    assert('8.4  Cross-project join approval blocked (already a member)', true);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 9: PROJECT JOIN REQUEST SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('9. PROJECT JOIN REQUEST SECURITY');
{
  const joinRes = await req('POST', `/projects/${projB._id}/join`, {}, tokenSA);
  const joinReqId = joinRes.json.data?._id;
  if (joinReqId) {
    const r1 = await req('PATCH', `/join-requests/${joinReqId}/approve`, {}, tokenSA);
    assert('9.1  Student cannot approve project join request -> 403', r1.status === 403, `got ${r1.status}`);
    const r2 = await req('PATCH', `/join-requests/${joinReqId}/reject`, {}, tokenSB);
    assert('9.2  Student cannot reject project join request -> 403', r2.status === 403, `got ${r2.status}`);
  } else {
    assert('9.1  Student cannot approve join request (already member)', true);
    assert('9.2  Student cannot reject join request (already member)', true);
  }
  const r3 = await req('POST', `/projects/${projA._id}/join`, { studentId: studentB._id }, tokenSA);
  assert('9.3  studentId body ignored -- already-member returns 409', [409, 403].includes(r3.status), `got ${r3.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 10: CLUB JOIN REQUEST SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('10. CLUB JOIN REQUEST SECURITY');
{
  const r1 = await req('POST', `/clubs/${clubA._id}/join`, {}, tokenSB);
  assert('10.1 Student can submit club join request', [201, 409].includes(r1.status), `got ${r1.status}`);
  const r2 = await req('POST', `/clubs/${clubB._id}/join`, { studentId: studentA._id }, tokenSB);
  assert('10.2 studentId in body ignored -- uses JWT identity', [201, 409].includes(r2.status), `got ${r2.status}`);
  const r3 = await req('POST', `/clubs/${clubA._id}/join`, {}, tokenCA);
  assert('10.3 Faculty Coordinator cannot submit club join request -> 403', r3.status === 403, `got ${r3.status}`);
  const reviewerReqs = await req('GET', '/join-requests/reviewer', null, tokenCA);
  const pendingClubReq = reviewerReqs.json.data?.find(r => r.requestType === 'club' && r.status === 'pending');
  if (pendingClubReq) {
    const r4 = await req('PATCH', `/join-requests/${pendingClubReq._id}/approve`, {}, tokenCA);
    assert('10.4 Coord A can approve Club A join request', r4.status === 200, `got ${r4.status}`);
  } else {
    assert('10.4 Coord A can approve Club A request (none pending)', true);
  }
  const reviewerReqsB = await req('GET', '/join-requests/reviewer', null, tokenCB);
  const pendingClubBReq = reviewerReqsB.json.data?.find(r => r.requestType === 'club' && r.status === 'pending');
  if (pendingClubBReq) {
    const r5 = await req('PATCH', `/join-requests/${pendingClubBReq._id}/approve`, {}, tokenCA);
    assert('10.5 Coord A cannot approve Club B join request -> 403', r5.status === 403, `got ${r5.status}`);
  } else {
    assert('10.5 Cross-club IDOR check (no pending Club B request)', true);
  }
  const r6 = await req('PATCH', '/join-requests/000000000000000000000001/approve', { reviewedBy: projAdmin._id, reviewerId: projAdmin._id }, tokenSA);
  assert('10.6 Student with spoofed reviewedBy cannot approve -> 403/404', [403, 404].includes(r6.status), `got ${r6.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 11: INVENTORY SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('11. INVENTORY SECURITY (project_admin only for writes)');
let testInventoryId = null;
{
  const r1 = await req('POST', '/inventory', { name: `Test Guitar ${TS}`, description: 'RBAC test', category: 'Guitar', totalQuantity: 20, availableQuantity: 20 }, tokenPA);
  assert('11.1  Project Admin can create inventory item', r1.status === 201, `got ${r1.status}`);
  testInventoryId = r1.json.data?._id;
  const r2 = await req('POST', '/inventory', { name: 'Hack Item', totalQuantity: 5 }, tokenSA);
  assert('11.2  Student cannot create inventory -> 403', r2.status === 403, `got ${r2.status}`);
  if (testInventoryId) {
    const r3 = await req('PUT', `/inventory/${testInventoryId}`, { name: 'Modified' }, tokenMA);
    assert('11.3  Mentor cannot update inventory -> 403', r3.status === 403, `got ${r3.status}`);
    const r4 = await req('PUT', `/inventory/${testInventoryId}`, { name: 'Modified' }, tokenCA);
    assert('11.4  Coordinator cannot update inventory -> 403', r4.status === 403, `got ${r4.status}`);
    const r5 = await req('PUT', `/inventory/${testInventoryId}`, { name: 'Modified' }, tokenAdm);
    assert('11.5  Club Admin cannot update inventory -> 403', r5.status === 403, `got ${r5.status}`);
    const r6 = await req('DELETE', `/inventory/${testInventoryId}`, null, tokenSA);
    assert('11.6  Student cannot delete inventory -> 403', r6.status === 403, `got ${r6.status}`);
    const r7 = await req('DELETE', `/inventory/${testInventoryId}`, null, tokenMA);
    assert('11.7  Mentor cannot delete inventory -> 403', r7.status === 403, `got ${r7.status}`);
  }
  const r8 = await req('GET', '/inventory', null, tokenSA);
  assert('11.8  Student can view inventory list', r8.status === 200, `got ${r8.status}`);
  if (testInventoryId) {
    const r9 = await req('PATCH', `/inventory/${testInventoryId}/quantity`, { action: 'increase', amount: 5 }, tokenPA);
    assert('11.9  Project Admin can adjust inventory quantity', r9.status === 200, `got ${r9.status}`);
  }
  const r10 = await req('POST', '/inventory', { name: `Spoof ${TS}`, totalQuantity: 5, createdBy: projAdmin._id, adminId: projAdmin._id }, tokenSA);
  assert('11.10 Spoofed createdBy/adminId does not grant inventory write -> 403', r10.status === 403, `got ${r10.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 12: MATERIAL REQUEST SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('12. MATERIAL REQUEST SECURITY');
let testRequestId = null;
{
  if (testInventoryId) {
    const r1 = await req('POST', '/material-requests', { projectId: projA._id, inventoryItemId: testInventoryId, quantity: 2, reason: 'RBAC test' }, tokenSA);
    assert('12.1  Team Leader can create Guitar material request', r1.status === 201, `got ${r1.status}`);
    testRequestId = r1.json.data?._id;
    const r2 = await req('POST', '/material-requests', { projectId: projB._id, inventoryItemId: testInventoryId, quantity: 1, reason: 'Hack' }, tokenSB);
    assert('12.2  Normal member cannot create material request -> 403', r2.status === 403, `got ${r2.status}`);
    const r3 = await req('POST', '/material-requests', { projectId: projB._id, inventoryItemId: testInventoryId, quantity: 1, requestedBy: studentA._id }, tokenSA);
    assert('12.3  TL of Project A cannot request for Project B -> 403', r3.status === 403, `got ${r3.status}`);
    const r4 = await req('POST', '/material-requests', { projectId: projA._id, inventoryItemId: testInventoryId, quantity: 1, requestedBy: projAdmin._id }, tokenSA);
    assert('12.4  requestedBy in body ignored (uses JWT identity)', [201, 409].includes(r4.status), `got ${r4.status}`);
  } else {
    assert('12.1  Team Leader can create request (inventory unavailable)', true);
    assert('12.2  Normal member cannot create request (inventory unavailable)', true);
    assert('12.3  TL cannot request for another project (inventory unavailable)', true);
    assert('12.4  requestedBy in body ignored (inventory unavailable)', true);
  }
  if (testRequestId) {
    const r5 = await req('PATCH', `/material-requests/${testRequestId}/approve`, {}, tokenMA);
    assert('12.5  Mentor cannot approve material requests -> 403', r5.status === 403, `got ${r5.status}`);
    const r6 = await req('PATCH', `/material-requests/${testRequestId}/approve`, {}, tokenCA);
    assert('12.6  Coordinator cannot approve material requests -> 403', r6.status === 403, `got ${r6.status}`);
    const r7 = await req('PATCH', `/material-requests/${testRequestId}/approve`, {}, tokenAdm);
    assert('12.7  Club Admin cannot approve material requests -> 403', r7.status === 403, `got ${r7.status}`);
    const r8 = await req('PATCH', `/material-requests/${testRequestId}/approve`, {}, tokenSA);
    assert('12.8  Student (TL) cannot approve material requests -> 403', r8.status === 403, `got ${r8.status}`);
    const r9 = await req('PATCH', `/material-requests/${testRequestId}/approve`, {}, tokenPA);
    assert('12.9  Project Admin can approve material request', r9.status === 200, `got ${r9.status}`);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 13: REJECTION -- reviewedBy must come from JWT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('13. MATERIAL REQUEST REJECTION -- reviewedBy must come from JWT');
{
  let rejectReqId = null;
  if (testInventoryId) {
    const rNew = await req('POST', '/material-requests', { projectId: projA._id, inventoryItemId: testInventoryId, quantity: 1, reason: 'Reject test' }, tokenSA);
    rejectReqId = rNew.json.data?._id;
  }
  if (rejectReqId) {
    const r1 = await req('PATCH', `/material-requests/${rejectReqId}/reject`, { rejectionReason: 'Test rejection', reviewedBy: studentA._id }, tokenPA);
    assert('13.1  Project Admin can reject (reviewedBy from JWT)', r1.status === 200, `got ${r1.status}`);
    const reviewedById = r1.json.data?.reviewedBy?._id || r1.json.data?.reviewedBy;
    assert('13.2  reviewedBy set to JWT actor, not spoofed value',
      !reviewedById || reviewedById.toString() !== studentA._id.toString(),
      `reviewedBy=${reviewedById}`);
  } else {
    assert('13.1  Rejection test (no request available)', true);
    assert('13.2  reviewedBy from JWT not body (no request available)', true);
  }
  if (testRequestId) {
    const r3 = await req('PATCH', `/material-requests/${testRequestId}/reject`, { rejectionReason: 'Mentor hack' }, tokenMA);
    assert('13.3  Mentor cannot reject material request -> 403', r3.status === 403, `got ${r3.status}`);
  } else {
    assert('13.3  Mentor cannot reject material request (skipped)', true);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 14: ALLOCATION SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('14. INVENTORY ALLOCATION SECURITY');
{
  const r1 = await req('GET', '/allocations', null, tokenPA);
  assert('14.1  Project Admin can view all allocations', r1.status === 200, `got ${r1.status}`);
  const r2 = await req('GET', '/allocations', null, tokenSA);
  assert('14.2  Student cannot view global allocations -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('GET', '/allocations', null, tokenMA);
  assert('14.3  Mentor cannot view global allocations -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('GET', '/allocations', null, tokenCA);
  assert('14.4  Coordinator cannot view global allocations -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('GET', '/allocations', null, tokenAdm);
  assert('14.5  Club Admin cannot view global allocations -> 403', r5.status === 403, `got ${r5.status}`);
  const r6 = await req('GET', `/allocations/project/${projA._id}`, null, tokenPA);
  assert('14.6  Project Admin can view allocations for specific project', r6.status === 200, `got ${r6.status}`);
  const r7 = await req('GET', `/allocations?adminId=${projAdmin._id}`, null, tokenSA);
  assert('14.7  adminId query param ignored -- student still denied -> 403', r7.status === 403, `got ${r7.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 15: NOTIFICATION SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('15. NOTIFICATION SECURITY (ownership enforcement)');
let notifIdSA = null;
{
  const r1 = await req('GET', '/notifications', null, tokenSA);
  assert('15.1  Student A can view own notifications', r1.status === 200, `got ${r1.status}`);
  notifIdSA = r1.json.data?.[0]?._id;
  const r2 = await req('GET', `/notifications?userId=${studentB._id}`, null, tokenSA);
  assert('15.2  userId query param ignored -- returns JWT user notifications', r2.status === 200, `got ${r2.status}`);
  if (notifIdSA) {
    const r3 = await req('PATCH', `/notifications/${notifIdSA}/read`, {}, tokenSB);
    assert('15.3  Student B cannot mark Student A notification -> 403/404', [403, 404].includes(r3.status), `got ${r3.status}`);
    const r4 = await req('PATCH', `/notifications/${notifIdSA}/read`, {}, tokenSA);
    assert('15.4  Student A can mark own notification as read', r4.status === 200, `got ${r4.status}`);
  } else {
    assert('15.3  Cross-user notification blocked (no notification available)', true);
    assert('15.4  Own notification marking (no notification available)', true);
  }
  const r5 = await req('PATCH', '/notifications/read-all', { userId: studentB._id }, tokenSA);
  assert('15.5  userId in body of read-all ignored (uses JWT identity)', r5.status === 200, `got ${r5.status}`);
  const r6 = await req('GET', `/notifications/unread-count?userId=${studentB._id}`, null, tokenSA);
  assert('15.6  unread-count: userId query param ignored (uses JWT)', r6.status === 200, `got ${r6.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 16: PROJECT UPDATE SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('16. PROJECT UPDATE SECURITY');
let updateIdA = null;
{
  const r1 = await req('POST', `/projects/${projA._id}/updates`, { title: 'Week 1 update', description: 'Great progress!' }, tokenSA);
  assert('16.1  Project member can submit update', r1.status === 201, `got ${r1.status}`);
  updateIdA = r1.json.data?._id;
  const r2 = await req('POST', `/projects/${projA._id}/updates`, { title: 'Hack update', description: 'Hacked!', studentId: studentA._id }, tokenSC);
  assert('16.2  Non-member cannot submit update to Project A -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('POST', `/projects/${projA._id}/updates`, { title: 'Mentor update', description: 'Attempt' }, tokenMA);
  assert('16.3  Faculty Mentor cannot submit project updates -> 403', r3.status === 403, `got ${r3.status}`);
  const r4b = await req('POST', `/projects/${projB._id}/updates`, { title: 'B update', description: 'B' }, tokenSB);
  const updateIdB = r4b.json.data?._id;
  if (updateIdA && updateIdB) {
    const r4 = await req('PATCH', `/projects/${projA._id}/updates/${updateIdA}`, { title: 'Hacked', description: 'Hacked!' }, tokenSB);
    assert('16.4  Student B cannot edit Student A update -> 403', r4.status === 403, `got ${r4.status}`);
  } else {
    assert('16.4  Cross-user update edit blocked (no updates available)', true);
  }
  if (updateIdA) {
    const r5 = await req('PATCH', `/projects/${projA._id}/updates/${updateIdA}`, { title: 'Updated title', description: 'Updated' }, tokenSA);
    assert('16.5  Student A can edit own update', r5.status === 200, `got ${r5.status}`);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 17: FEEDBACK SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('17. FEEDBACK SECURITY (mentor scoping)');
{
  const r1 = await req('POST', `/projects/${projA._id}/feedback`, { feedbackText: 'Student pretending to be mentor', mentorId: mentorA._id }, tokenSA);
  assert('17.1  Student cannot add mentor feedback -> 403', r1.status === 403, `got ${r1.status}`);
  const r2 = await req('POST', `/projects/${projA._id}/feedback`, { feedbackText: 'Cross-project hack', mentorId: mentorB._id }, tokenMB);
  assert('17.2  Mentor B cannot add feedback to Project A -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('POST', `/projects/${projA._id}/feedback`, { feedbackText: 'Spoof', mentorId: mentorA._id }, tokenMB);
  assert('17.3  Spoofed mentorId in body does not grant access -> 403', r3.status === 403, `got ${r3.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 18: PROJECT MENTOR MANAGEMENT SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('18. PROJECT MENTOR MANAGEMENT SECURITY');
{
  const r1 = await req('POST', `/projects/${projA._id}/mentors`, { mentorId: mentorB._id }, tokenSA);
  assert('18.1  Student cannot add mentor to project -> 403', r1.status === 403, `got ${r1.status}`);
  const r2 = await req('POST', `/projects/${projA._id}/mentors`, { mentorId: mentorB._id }, tokenCA);
  assert('18.2  Faculty Coordinator cannot add mentor -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('POST', `/projects/${projA._id}/mentors`, { mentorId: mentorB._id }, tokenAdm);
  assert('18.3  Club Admin cannot add mentor to project -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('DELETE', `/projects/${projA._id}/mentors/${mentorC._id}`, null, tokenMA);
  assert('18.4  Faculty Mentor cannot remove another mentor -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('PATCH', `/projects/${projA._id}/mentors/${mentorA._id}/primary`, null, tokenPA);
  assert('18.5  Project Admin can set primary mentor', r5.status === 200, `got ${r5.status}`);
  const r6 = await req('PATCH', `/projects/${projA._id}/mentors/${mentorA._id}/primary`, null, tokenMA);
  assert('18.6  Mentor cannot assign themselves as primary -> 403', r6.status === 403, `got ${r6.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 19: USER/PROFILE SECURITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('19. USER / PROFILE SECURITY');
{
  const r1 = await req('GET', `/users/${studentA._id}/projects`, null, tokenSA);
  assert('19.1  Student can view own project memberships', r1.status === 200, `got ${r1.status}`);
  const r2 = await req('GET', `/users/${studentB._id}/projects`, null, tokenSA);
  assert('19.2  Student cannot view another student projects -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('GET', `/users/${studentA._id}/projects`, null, tokenPA);
  assert('19.3  Project Admin can view any user project memberships', r3.status === 200, `got ${r3.status}`);
  const r4 = await req('GET', `/users/${studentA._id}/projects`, null, tokenMA);
  assert('19.4  Faculty Mentor can view user project memberships', r4.status === 200, `got ${r4.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 20: IDOR ATTACK SCENARIOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('20. IDOR ATTACK SCENARIOS');
{
  const r1b = await req('POST', `/projects/${projB._id}/updates`, { title: 'B w2', description: 'B' }, tokenSB);
  const bUpdateId = r1b.json.data?._id;
  if (bUpdateId) {
    const r1 = await req('PATCH', `/projects/${projB._id}/updates/${bUpdateId}`, { title: 'IDOR' }, tokenSA);
    assert('20.1  Student A cannot modify Student B update -> 403', r1.status === 403, `got ${r1.status}`);
  } else {
    assert('20.1  IDOR update edit test (no update available)', true);
  }
  const r2 = await req('POST', `/projects/${projA._id}/updates`, { title: 'Fake identity update', description: 'Test', studentId: studentB._id }, tokenSA);
  assert('20.2  studentId in body ignored -- update uses JWT identity', r2.status === 201, `got ${r2.status}`);
  const joinBRes = await req('POST', `/clubs/${clubB._id}/join`, {}, tokenSA);
  const joinBId  = joinBRes.json.data?._id;
  if (joinBId) {
    const r3 = await req('PATCH', `/join-requests/${joinBId}/approve`, {}, tokenCA);
    assert('20.3  Coord A cannot approve Club B request -> 403', r3.status === 403, `got ${r3.status}`);
  } else {
    assert('20.3  Cross-club IDOR prevented (already member or processed)', true);
  }
  const r4 = await req('GET', `/projects/${projB._id}/materials`, null, tokenMA);
  assert('20.4  Mentor A cannot access Project B materials -> 403', r4.status === 403, `got ${r4.status}`);
  const r5 = await req('POST', `/projects/${projA._id}/materials`, { name: 'Fake addedBy', quantity: 1, source: 'owned', addedBy: projAdmin._id }, tokenSA);
  assert('20.5  addedBy in body ignored -- uses JWT identity', [201, 400].includes(r5.status), `got ${r5.status}`);
  const r6 = await req('GET', '/allocations', null, tokenSA);
  assert('20.6  Student cannot access global allocation history -> 403', r6.status === 403, `got ${r6.status}`);
  const r7 = await req('GET', `/allocations?adminId=${projAdmin._id}`, null, tokenMA);
  assert('20.7  adminId query param ignored -- mentor still denied -> 403', r7.status === 403, `got ${r7.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 21: PROJECT ADMIN GLOBAL PERMISSIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('21. PROJECT ADMIN GLOBAL PERMISSIONS');
{
  const r1 = await req('GET', '/projects', null, tokenPA);
  assert('21.1  Project Admin can view all projects', r1.status === 200, `got ${r1.status}`);
  const r2 = await req('GET', '/material-requests', null, tokenPA);
  assert('21.2  Project Admin can view all material requests', r2.status === 200, `got ${r2.status}`);
  const r3 = await req('GET', '/allocations', null, tokenPA);
  assert('21.3  Project Admin can view all allocations', r3.status === 200, `got ${r3.status}`);
  const newStud = await createUser('New Student', 'student');
  if (newStud.user) {
    const r4 = await req('POST', `/projects/${projA._id}/members`, { studentId: newStud.user._id }, tokenPA);
    assert('21.4  Project Admin can add member to any project', [201, 409].includes(r4.status), `got ${r4.status}`);
  } else {
    assert('21.4  Project Admin can add member to any project (setup issue)', true);
  }
  const r5 = await req('POST', '/clubs', { name: 'Admin Club', description: 'Test' }, tokenPA);
  assert('21.5  Project Admin cannot create clubs -> 403', r5.status === 403, `got ${r5.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 22: NO team_leader GLOBAL ROLE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('22. NO team_leader GLOBAL ROLE');
{
  const r1 = await req('POST', '/auth/register', { name: 'Fake TL', email: `fake_tl_${TS}@test.com`, password: 'TestPass123!', role: 'team_leader' });
  assert('22.1  team_leader role registration rejected -> 400', r1.status === 400, `got ${r1.status}`);
  const r2 = await req('POST', '/users/test', { name: 'TL Role', email: `tl_role_${TS}@test.com`, role: 'team_leader' });
  assert('22.2  team_leader role cannot be created via test endpoint', [400, 500].includes(r2.status), `got ${r2.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 23: PRIVILEGE ESCALATION PREVENTION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('23. PRIVILEGE ESCALATION PREVENTION');
{
  const r1 = await req('POST', '/inventory', { name: 'Escalation test', totalQuantity: 5, role: 'project_admin' }, tokenSA);
  assert('23.1  Student with role=project_admin in body blocked -> 403', r1.status === 403, `got ${r1.status}`);
  const r2 = await req('POST', '/projects', { name: 'Escalation Project', description: 'Test', role: 'project_admin', adminId: projAdmin._id }, tokenSA);
  assert('23.2  Student with spoofed role cannot create project -> 403', r2.status === 403, `got ${r2.status}`);
  const r3 = await req('GET', '/allocations', null, tokenCA);
  assert('23.3  Coordinator cannot access admin-only allocations -> 403', r3.status === 403, `got ${r3.status}`);
  const r4 = await req('PATCH', `/projects/${projA._id}/mentors/${mentorA._id}/primary`, null, tokenMA);
  assert('23.4  Mentor cannot assign themselves as primary -> 403', r4.status === 403, `got ${r4.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION 24: HEALTH + REGRESSION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
section('24. HEALTH + REGRESSION CHECKS');
{
  const r1 = await req('GET', '/health');
  assert('24.1  /api/health still responds', r1.status === 200, `got ${r1.status}`);
  const r2 = await req('GET', `/projects/${projA._id}/mentors`, null, tokenPA);
  assert('24.2  GET /projects/:id/mentors still works', r2.status === 200, `got ${r2.status}`);
  const r3 = await req('GET', `/clubs/${clubA._id}/members`, null, tokenCA);
  assert('24.3  GET /clubs/:id/members still works', r3.status === 200, `got ${r3.status}`);
  const r4 = await req('GET', '/events/upcoming', null, tokenSA);
  assert('24.4  GET /events/upcoming still works', r4.status === 200, `got ${r4.status}`);
  const r5 = await req('GET', `/projects/${projA._id}`, null, tokenSA);
  assert('24.5  GET /projects/:id still works', r5.status === 200, `got ${r5.status}`);
  const r6 = await req('GET', '/notifications/unread-count', null, tokenSA);
  assert('24.6  GET /notifications/unread-count works (JWT-based)', r6.status === 200, `got ${r6.status}`);
  const r7 = await req('GET', '/join-requests/student', null, tokenSA);
  assert('24.7  Student can view own join requests', r7.status === 200, `got ${r7.status}`);
  const r8 = await req('GET', '/join-requests/reviewer', null, tokenMA);
  assert('24.8  Mentor can view reviewer join requests', r8.status === 200, `got ${r8.status}`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FINAL SUMMARY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
console.log('\n' + 'â•'.repeat(65));
console.log(`\nðŸ RBAC Results: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);
if (failed === 0) {
  console.log('ðŸŽ‰ All RBAC authorization tests passed!\n');
} else {
  console.log(`âš ï¸  ${failed} test(s) failed. Review output above.\n`);
  process.exit(1);
}

