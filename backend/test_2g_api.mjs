/**
 * Task 2G — Events Management API Test
 *
 * Tests all success and failure cases for the Events API.
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5000
 *   - At least one Club exists in MongoDB
 *   - At least one faculty_coordinator user assigned to a club
 *   - At least one club_admin user
 *   - At least one student user
 *
 * Run: node test_2g_api.mjs
 */

const BASE = 'http://localhost:5000/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

function log(label, data, expectSuccess = true) {
  const ok = data.success === expectSuccess;
  const icon = ok ? '✅' : '❌';
  console.log(`\n${icon} ${label}`);
  if (!ok) {
    console.log('   Expected success:', expectSuccess, '| Got success:', data.success);
    console.log('   Message:', data.message || '(none)');
  } else {
    if (data.data && data.data._id) console.log('   ID:', data.data._id);
    if (data.count !== undefined) console.log('   Count:', data.count);
    if (data.message) console.log('   Message:', data.message);
  }
  return data;
}

// ── Step 0: Setup — create test users and a club ─────────────────────────────
async function setup() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('SETUP: Creating test users and club for 2G tests...');
  console.log('═══════════════════════════════════════════════════');

  const admin = await req('POST', '/users/test', { name: '2G Club Admin', email: 'clubadmin2g@test.com', role: 'club_admin' });
  const coordinator = await req('POST', '/users/test', { name: '2G Coordinator A', email: 'coord2ga@test.com', role: 'faculty_coordinator' });
  const coordinatorB = await req('POST', '/users/test', { name: '2G Coordinator B', email: 'coord2gb@test.com', role: 'faculty_coordinator' });
  const student = await req('POST', '/users/test', { name: '2G Student', email: 'student2g@test.com', role: 'student' });
  const mentor = await req('POST', '/users/test', { name: '2G Mentor', email: 'mentor2g@test.com', role: 'faculty_mentor' });
  const projAdmin = await req('POST', '/users/test', { name: '2G Project Admin', email: 'projadmin2g@test.com', role: 'project_admin' });

  const adminId = admin.data._id;
  const coordAId = coordinator.data._id;
  const coordBId = coordinatorB.data._id;
  const studentId = student.data._id;
  const mentorId = mentor.data._id;
  const projAdminId = projAdmin.data._id;

  console.log('Admin ID:', adminId);
  console.log('Coord A ID:', coordAId);
  console.log('Coord B ID:', coordBId);
  console.log('Student ID:', studentId);

  // Create two clubs — assign Coord A to Club A, leave Club B unassigned to Coord A
  const clubA = await req('POST', '/clubs', {
    name: '2G Music Club',
    description: 'Test music club for 2G',
    facultyCoordinatorId: coordAId,
    createdBy: adminId,
  });
  const clubB = await req('POST', '/clubs', {
    name: '2G Dance Club',
    description: 'Test dance club for 2G',
    facultyCoordinatorId: coordBId,
    createdBy: adminId,
  });

  console.log('Club A (Music) ID:', clubA.data._id);
  console.log('Club B (Dance) ID:', clubB.data._id);

  return { adminId, coordAId, coordBId, studentId, mentorId, projAdminId, clubAId: clubA.data._id, clubBId: clubB.data._id };
}

// ════════════════════════════════════════════════════════════════════════════════
async function runTests() {
  const ids = await setup();
  const { adminId, coordAId, coordBId, studentId, mentorId, projAdminId, clubAId, clubBId } = ids;

  let createdEventId = '';

  // ── A. SUCCESS CASES ─────────────────────────────────────────────────────────

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('SUCCESS CASES');
  console.log('═══════════════════════════════════════════════════');

  // 1. Club Admin creates event for Club A
  let r = log('1. Club Admin creates event for Club A',
    await req('POST', '/events', {
      userId: adminId,
      title: 'Annual Music Night',
      description: 'Annual event organized by the Music Club.',
      clubId: clubAId,
      eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // +10 days
      location: 'University Auditorium',
    })
  );
  createdEventId = r.data?._id || '';

  // 2. Club Admin creates event for Club B
  log('2. Club Admin creates event for Club B',
    await req('POST', '/events', {
      userId: adminId,
      title: 'Dance Showcase',
      description: 'Annual dance showcase by the Dance Club.',
      clubId: clubBId,
      eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // +5 days
      location: 'Open Air Theatre',
    })
  );

  // 3. Faculty Coordinator A creates event for assigned Club A
  log('3. Faculty Coordinator A creates event for assigned Club A',
    await req('POST', '/events', {
      userId: coordAId,
      title: 'Music Workshop',
      description: 'Workshop organized by coord A for music club.',
      clubId: clubAId,
      eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // +3 days
      location: 'Music Room 101',
    })
  );

  // 4. Create a PAST event (eventDate in the past)
  let pastEvent = log('4. Club Admin creates PAST event (should appear in all-events but not upcoming)',
    await req('POST', '/events', {
      userId: adminId,
      title: 'Old Seminar',
      description: 'A past event for testing.',
      clubId: clubAId,
      eventDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // -5 days
      location: 'Seminar Hall',
    })
  );
  const pastEventId = pastEvent.data?._id || '';

  // 5. Student retrieves upcoming events
  log('5. Student retrieves upcoming events',
    await req('GET', '/events/upcoming')
  );

  // 6. Verify past event NOT in upcoming events
  const upcomingCheck = await req('GET', '/events/upcoming');
  const pastInUpcoming = (upcomingCheck.data || []).find((e) => e._id === pastEventId);
  console.log('\n✅ 6. Past event excluded from upcoming events:', !pastInUpcoming ? 'YES (correct)' : '❌ NO (BUG)');

  // 7. All events (past event should be here)
  let allEvts = log('7. Get all events (includes past events)',
    await req('GET', '/events')
  );
  const pastInAll = (allEvts.data || []).find((e) => e._id === pastEventId);
  console.log('   Past event in all-events DB:', pastInAll ? '✅ YES (correct)' : '❌ NO (BUG)');

  // 8. Student retrieves single event detail
  if (createdEventId) {
    log('8. Student retrieves single event detail',
      await req('GET', `/events/${createdEventId}`)
    );
  }

  // 9. Student retrieves events for Club A
  log('9. Student retrieves events for Club A',
    await req('GET', `/clubs/${clubAId}/events`)
  );

  // 10. Faculty Coordinator A updates their Club A event
  if (createdEventId) {
    log('10. Faculty Coordinator A updates Club A event',
      await req('PUT', `/events/${createdEventId}`, {
        userId: coordAId,
        title: 'Annual Music Night (Updated)',
        location: 'Main Auditorium',
      })
    );
  }

  // 11. Club Admin updates any club event
  if (createdEventId) {
    log('11. Club Admin updates Club A event',
      await req('PUT', `/events/${createdEventId}`, {
        userId: adminId,
        description: 'Updated description by club admin.',
      })
    );
  }

  // ── B. SECURITY / FAILURE CASES ──────────────────────────────────────────────

  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('SECURITY / FAILURE CASES (all should fail)');
  console.log('═══════════════════════════════════════════════════');

  // 1. Faculty Coordinator A creates event for Club B (NOT assigned)
  log('1. Coord A creates event for Club B (should fail)',
    await req('POST', '/events', {
      userId: coordAId,
      title: 'Unauthorized Dance Event',
      description: 'Coord A trying to create for Club B.',
      clubId: clubBId,
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Dance Hall',
    }),
    false
  );

  // 2. Student attempts to create an event
  log('2. Student tries to create event (should fail)',
    await req('POST', '/events', {
      userId: studentId,
      title: 'Student Event',
      description: 'Student trying to create.',
      clubId: clubAId,
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Anywhere',
    }),
    false
  );

  // 3. Faculty Mentor attempts to create event
  log('3. Faculty Mentor tries to create event (should fail)',
    await req('POST', '/events', {
      userId: mentorId,
      title: 'Mentor Event',
      description: 'Mentor trying to create.',
      clubId: clubAId,
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Anywhere',
    }),
    false
  );

  // 4. Project Admin attempts to create club event
  log('4. Project Admin tries to create club event (should fail)',
    await req('POST', '/events', {
      userId: projAdminId,
      title: 'Project Admin Club Event',
      description: 'Project admin trying to create club event.',
      clubId: clubAId,
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Anywhere',
    }),
    false
  );

  // 5. Student attempts to update an event
  if (createdEventId) {
    log('5. Student tries to update event (should fail)',
      await req('PUT', `/events/${createdEventId}`, {
        userId: studentId, title: 'Hacked Title',
      }),
      false
    );
  }

  // 6. Student attempts to delete an event
  if (createdEventId) {
    log('6. Student tries to delete event (should fail)',
      await req('DELETE', `/events/${createdEventId}`, { userId: studentId }),
      false
    );
  }

  // 7. Faculty Coordinator A updates Club B event (should fail)
  // First find a Club B event
  const clubBEvents = await req('GET', `/clubs/${clubBId}/events`);
  const clubBEventId = clubBEvents.data?.[0]?._id;
  if (clubBEventId) {
    log('7. Coord A tries to update Club B event (should fail)',
      await req('PUT', `/events/${clubBEventId}`, {
        userId: coordAId, title: 'Unauthorized Update',
      }),
      false
    );

    // 8. Faculty Coordinator A deletes Club B event (should fail)
    log('8. Coord A tries to delete Club B event (should fail)',
      await req('DELETE', `/events/${clubBEventId}`, { userId: coordAId }),
      false
    );
  }

  // 9. Invalid club ID
  log('9. Invalid club ID format (should fail)',
    await req('POST', '/events', {
      userId: adminId, title: 'Test', description: 'Test', clubId: 'not-an-id',
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), location: 'Test',
    }),
    false
  );

  // 10. Non-existent club
  log('10. Non-existent club (should fail)',
    await req('POST', '/events', {
      userId: adminId, title: 'Test', description: 'Test',
      clubId: '000000000000000000000000',
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), location: 'Test',
    }),
    false
  );

  // 11. Invalid event ID
  log('11. Invalid event ID format (should fail)',
    await req('GET', '/events/not-a-valid-id'),
    false
  );

  // 12. Non-existent event
  log('12. Non-existent event (should fail)',
    await req('GET', '/events/000000000000000000000000'),
    false
  );

  // 13. Missing required fields
  log('13. Missing title (should fail)',
    await req('POST', '/events', {
      userId: adminId, description: 'No title', clubId: clubAId,
      eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), location: 'Test',
    }),
    false
  );

  log('14. Missing eventDate (should fail)',
    await req('POST', '/events', {
      userId: adminId, title: 'Test', description: 'No date', clubId: clubAId, location: 'Test',
    }),
    false
  );

  log('15. Invalid eventDate string (should fail)',
    await req('POST', '/events', {
      userId: adminId, title: 'Test', description: 'Invalid date', clubId: clubAId,
      eventDate: 'not-a-date', location: 'Test',
    }),
    false
  );

  // ── C. CLEANUP: Delete created events ────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('CLEANUP: Club Admin deletes test events');
  console.log('═══════════════════════════════════════════════════');

  if (createdEventId) {
    log('Faculty Coordinator A deletes Club A event (their own club)',
      await req('DELETE', `/events/${createdEventId}`, { userId: coordAId })
    );
  }

  console.log('\n\n✅✅✅ All Task 2G API tests complete! ✅✅✅\n');
}

runTests().catch(console.error);
