/**
 * Task 2F — Comprehensive API Test Suite
 *
 * Run AFTER starting the backend:
 *   node server.js  (in backend/)
 *
 * Then run this script:
 *   node test_2f_api.mjs
 *
 * Covers:
 *   SUCCESS CASES  (1–7)
 *   FAILURE / SECURITY CASES  (8–17)
 */

const BASE = 'http://localhost:5000/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  return { status: res.status, body: json };
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` ${title}`);
  console.log('═'.repeat(60));
}

// ── Setup: create test fixtures ───────────────────────────────────────────────

section('SETUP — creating test users and project');

// Create 2 students, 1 mentor (assigned), 1 unassigned mentor, 1 admin
const ts = Date.now();
const studentA = (await req('POST', '/users/test', { name: 'Student A', email: `sA_${ts}@test.com`, role: 'student' })).body.data;
const studentB = (await req('POST', '/users/test', { name: 'Student B', email: `sB_${ts}@test.com`, role: 'student' })).body.data;
const mentorA  = (await req('POST', '/users/test', { name: 'Mentor A',  email: `mA_${ts}@test.com`, role: 'faculty_mentor' })).body.data;
const mentorB  = (await req('POST', '/users/test', { name: 'Mentor B',  email: `mB_${ts}@test.com`, role: 'faculty_mentor' })).body.data;
const admin    = (await req('POST', '/users/test', { name: 'Admin',     email: `ad_${ts}@test.com`, role: 'project_admin'  })).body.data;

check('Create Student A', studentA?._id);
check('Create Student B', studentB?._id);
check('Create Mentor A',  mentorA?._id);
check('Create Mentor B',  mentorB?._id);
check('Create Admin',     admin?._id);

// Create Project A and Project B
const projectA = (await req('POST', '/projects', { name: `Project A ${ts}`, description: 'Test project A', createdBy: admin._id })).body.data;
const projectB = (await req('POST', '/projects', { name: `Project B ${ts}`, description: 'Test project B', createdBy: admin._id })).body.data;
check('Create Project A', projectA?._id);
check('Create Project B', projectB?._id);

// Add Student A to Project A, Student B to Project B
await req('POST', `/projects/${projectA._id}/members`, { studentId: studentA._id });
await req('POST', `/projects/${projectB._id}/members`, { studentId: studentB._id });

// Assign Mentor A to Project A only
await req('POST', `/projects/${projectA._id}/mentors`, { mentorId: mentorA._id });

// ── SUCCESS CASES ─────────────────────────────────────────────────────────────

section('1. Student creates a project update');
const r1 = await req('POST', `/projects/${projectA._id}/updates`, {
  studentId: studentA._id,
  title: 'Initial prototype',
  description: 'Completed the first prototype of the project.',
  files: [{ name: 'report.pdf', url: 'https://example.com/report.pdf' }],
});
check('Status 201', r1.status === 201, `got ${r1.status}`);
check('Returns update data', r1.body.data?._id);
check('Title matches', r1.body.data?.title === 'Initial prototype');
check('Files stored', Array.isArray(r1.body.data?.files) && r1.body.data.files.length === 1);
const updateId = r1.body.data?._id;

section('2. Student views project updates');
const r2 = await req('GET', `/projects/${projectA._id}/updates?userId=${studentA._id}`);
check('Status 200', r2.status === 200, `got ${r2.status}`);
check('Returns array', Array.isArray(r2.body.data));
check('Contains created update', r2.body.data?.some(u => u._id === updateId));

section('3. Student views feedback (initially empty)');
const r3 = await req('GET', `/projects/${projectA._id}/feedback?userId=${studentA._id}`);
check('Status 200', r3.status === 200, `got ${r3.status}`);
check('Returns array', Array.isArray(r3.body.data));

section('4. Assigned mentor adds feedback');
const r4 = await req('POST', `/projects/${projectA._id}/feedback`, {
  mentorId: mentorA._id,
  feedbackText: 'Good progress. Improve the testing section.',
  updateId,
});
check('Status 201', r4.status === 201, `got ${r4.status}`);
check('Returns feedback data', r4.body.data?._id);
check('feedbackText correct', r4.body.data?.feedbackText === 'Good progress. Improve the testing section.');
check('updateId linked', r4.body.data?.updateId?._id === updateId || r4.body.data?.updateId === updateId);
const feedbackId = r4.body.data?._id;

section('4b. Mentor adds general feedback (no updateId)');
const r4b = await req('POST', `/projects/${projectA._id}/feedback`, {
  mentorId: mentorA._id,
  feedbackText: 'Overall project looks great.',
});
check('Status 201', r4b.status === 201, `got ${r4b.status}`);
check('updateId is null', r4b.body.data?.updateId === null);

section('5. Assigned mentor views project updates');
const r5 = await req('GET', `/projects/${projectA._id}/updates?userId=${mentorA._id}`);
check('Status 200', r5.status === 200, `got ${r5.status}`);
check('Returns updates', Array.isArray(r5.body.data));

section('6. Project Admin views updates');
const r6 = await req('GET', `/projects/${projectA._id}/updates?userId=${admin._id}`);
check('Status 200', r6.status === 200, `got ${r6.status}`);
check('Returns updates', Array.isArray(r6.body.data));

section('7. Project Admin views feedback');
const r7 = await req('GET', `/projects/${projectA._id}/feedback?userId=${admin._id}`);
check('Status 200', r7.status === 200, `got ${r7.status}`);
check('Returns feedback', Array.isArray(r7.body.data));
check('Feedback count >= 2', r7.body.data?.length >= 2);

section('7b. Feedback for specific update');
const r7b = await req('GET', `/projects/${projectA._id}/updates/${updateId}/feedback?userId=${admin._id}`);
check('Status 200', r7b.status === 200, `got ${r7b.status}`);
check('Contains the feedback', r7b.body.data?.some(f => f._id === feedbackId));

section('7c. Student edits own update');
const r7c = await req('PATCH', `/projects/${projectA._id}/updates/${updateId}`, {
  studentId: studentA._id,
  title: 'Prototype v2',
  description: 'Revised the prototype with mentor feedback.',
});
check('Status 200', r7c.status === 200, `got ${r7c.status}`);
check('Title updated', r7c.body.data?.title === 'Prototype v2');

// ── FAILURE / SECURITY CASES ──────────────────────────────────────────────────

section('8. Non-member student tries to create update (Project B)');
const r8 = await req('POST', `/projects/${projectB._id}/updates`, {
  studentId: studentA._id,
  title: 'Hack attempt',
  description: 'Should not work',
});
check('Status 403', r8.status === 403, `got ${r8.status}`);

section('9. Student tries to create update without title');
const r9 = await req('POST', `/projects/${projectA._id}/updates`, {
  studentId: studentA._id,
  description: 'Missing title',
});
check('Status 400', r9.status === 400, `got ${r9.status}`);

section('10. Student A tries to edit Student B\'s update (cross-student)');
// First create an update from Student B on Project B
const r10setup = await req('POST', `/projects/${projectB._id}/updates`, {
  studentId: studentB._id, title: 'Student B update', description: 'Student B desc',
});
const updateBId = r10setup.body.data?._id;
// Student A tries to edit update in Project B
const r10 = await req('PATCH', `/projects/${projectB._id}/updates/${updateBId}`, {
  studentId: studentA._id,
  title: 'Hacked',
});
check('Status 403', r10.status === 403, `got ${r10.status}`);

section('11. Student A tries to delete Student B\'s update');
const r11 = await req('DELETE', `/projects/${projectB._id}/updates/${updateBId}`, {
  studentId: studentA._id,
});
check('Status 403', r11.status === 403, `got ${r11.status}`);

section('12. Unassigned mentor tries to add feedback to Project A');
const r12 = await req('POST', `/projects/${projectA._id}/feedback`, {
  mentorId: mentorB._id,
  feedbackText: 'Should not work — Mentor B is not assigned to Project A',
});
check('Status 403', r12.status === 403, `got ${r12.status}`);

section('13. Mentor A tries to add feedback to Project B (not assigned)');
const r13 = await req('POST', `/projects/${projectB._id}/feedback`, {
  mentorId: mentorA._id,
  feedbackText: 'Cross-project feedback attempt',
});
check('Status 403', r13.status === 403, `got ${r13.status}`);

section('14. Student A tries to view feedback of Project B');
const r14 = await req('GET', `/projects/${projectB._id}/feedback?userId=${studentA._id}`);
check('Status 403', r14.status === 403, `got ${r14.status}`);

section('15. Student A tries to view updates of Project B');
const r15 = await req('GET', `/projects/${projectB._id}/updates?userId=${studentA._id}`);
check('Status 403', r15.status === 403, `got ${r15.status}`);

section('16. Invalid project ID');
const r16 = await req('GET', `/projects/INVALID_ID/updates?userId=${admin._id}`);
check('Status 400', r16.status === 400, `got ${r16.status}`);

section('17. Invalid update ID');
const r17 = await req('GET', `/projects/${projectA._id}/updates/INVALID_UPDATE_ID?userId=${admin._id}`);
check('Status 400', r17.status === 400, `got ${r17.status}`);

section('18. Feedback references update from another project');
const r18 = await req('POST', `/projects/${projectA._id}/feedback`, {
  mentorId: mentorA._id,
  feedbackText: 'Cross-project update ref attempt',
  updateId: updateBId,   // update belongs to Project B, not Project A
});
check('Status 400', r18.status === 400, `got ${r18.status}`);

section('19. Missing feedbackText');
const r19 = await req('POST', `/projects/${projectA._id}/feedback`, {
  mentorId: mentorA._id,
});
check('Status 400', r19.status === 400, `got ${r19.status}`);

section('20. Verify 2A–2E existing endpoints still work (regression)');
const regProjects = await req('GET', '/projects');
check('GET /api/projects works', regProjects.status === 200);
const regMembers = await req('GET', `/projects/${projectA._id}/members`);
check('GET /api/projects/:id/members works', regMembers.status === 200);
const regMentors = await req('GET', `/projects/${projectA._id}/mentors`);
check('GET /api/projects/:id/mentors works', regMentors.status === 200);

// ── Student deletes own update (cleanup check) ──────────────────────────────
section('21. Student deletes own update');
const r21 = await req('DELETE', `/projects/${projectA._id}/updates/${updateId}`, {
  studentId: studentA._id,
});
check('Status 200', r21.status === 200, `got ${r21.status}`);
// Verify update is gone
const r21v = await req('GET', `/projects/${projectA._id}/updates/${updateId}?userId=${admin._id}`);
check('Update is deleted (404)', r21v.status === 404, `got ${r21v.status}`);

// ── RESULTS ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));
if (failed === 0) console.log('\n🎉  All tests passed!\n');
else console.log(`\n⚠️  ${failed} test(s) failed — review above output.\n`);
