import bcrypt from 'bcryptjs';

import User from '../../src/models/User.js';
import Club from '../../src/models/Club.js';
import ClubMembership from '../../src/models/ClubMembership.js';
import Project from '../../src/models/Project.js';
import ProjectMembership from '../../src/models/ProjectMembership.js';
import ProjectMentor from '../../src/models/ProjectMentor.js';
import JoinRequest from '../../src/models/JoinRequest.js';
import Event from '../../src/models/Event.js';
import GuitarInventory from '../../src/models/GuitarInventory.js';
import MaterialRequest from '../../src/models/MaterialRequest.js';
import InventoryAllocation from '../../src/models/InventoryAllocation.js';
import Notification from '../../src/models/Notification.js';
import ProjectUpdate from '../../src/models/ProjectUpdate.js';
import ProjectFeedback from '../../src/models/ProjectFeedback.js';
import ProjectMaterial from '../../src/models/ProjectMaterial.js';

/**
 * Fixture builders.
 *
 * Rules:
 *  - Always go through the model (validation + defaults + indexes behave
 *    like production). Users are bulk-inserted with a pre-computed bcrypt
 *    hash so the suite does not pay bcrypt cost per fixture; `insertMany`
 *    skips the pre-save hook, exactly like a seeded database.
 *  - Every builder accepts overrides and fills in sensible related records,
 *    so a test reads as intent (`makeClub({ facultyCoordinatorId: coord._id })`)
 *    rather than plumbing.
 *  - Defaults describe a COMPLETE profile: incomplete-profile behaviour is
 *    opted into explicitly (`makeIncompleteStudent()`).
 */

export const PASSWORD = 'Password123!';

// One hash for every fixture user (cost 10 keeps fixture-heavy files fast).
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

let sequence = 0;
const nextSequence = () => {
  sequence += 1;
  return sequence;
};

const email = (role) => `fixture${nextSequence()}.${role}@example.test`;

/** Accept either a document or an id. */
export const idOf = (value) => (value && value._id ? value._id : value);

const DEFAULT_PROFILE = {
  department: 'Computer Engineering',
  phone: '9876500000',
};

async function insertUsers(docs) {
  const inserted = await User.insertMany(docs, { ordered: true });
  return inserted;
}

export async function makeUser(overrides = {}) {
  const role = overrides.role || 'student';
  const n = nextSequence();

  const doc = {
    name: `Test ${role} ${n}`,
    email: email(role),
    password: PASSWORD_HASH,
    role,
    ...DEFAULT_PROFILE,
    ...(role === 'student'
      ? { universityId: `UID${String(n).padStart(4, '0')}`, semester: 3 }
      : {}),
    ...overrides,
  };
  if (doc.email === undefined) doc.email = email(role);

  const [user] = await insertUsers([doc]);
  return user;
}

export const makeStudent = (overrides = {}) => makeUser({ role: 'student', ...overrides });
export const makeClubAdmin = (overrides = {}) => makeUser({ role: 'club_admin', ...overrides });
export const makeCoordinator = (overrides = {}) =>
  makeUser({ role: 'faculty_coordinator', ...overrides });
export const makeMentor = (overrides = {}) => makeUser({ role: 'faculty_mentor', ...overrides });
export const makeProjectAdmin = (overrides = {}) =>
  makeUser({ role: 'project_admin', ...overrides });

/**
 * A student who has not filled in universityId / semester — the state
 * `isProfileComplete()` treats as incomplete (mutations must be blocked).
 */
export function makeIncompleteStudent(overrides = {}) {
  return makeStudent({ universityId: null, semester: null, ...overrides });
}

/** One actor per role, keyed by `User.role`, for the authorization matrix. */
export async function makeAllRoles() {
  const [student, coordinator, mentor, clubAdmin, projectAdmin] = await Promise.all([
    makeStudent(),
    makeCoordinator(),
    makeMentor(),
    makeClubAdmin(),
    makeProjectAdmin(),
  ]);
  return {
    student,
    faculty_coordinator: coordinator,
    faculty_mentor: mentor,
    club_admin: clubAdmin,
    project_admin: projectAdmin,
    // Friendly aliases for tests that read better with names.
    coordinator,
    mentor,
    clubAdmin,
    projectAdmin,
  };
}

export async function makeClub(overrides = {}) {
  let createdBy = idOf(overrides.createdBy);
  if (!createdBy) createdBy = (await makeClubAdmin())._id;

  const n = nextSequence();
  const doc = {
    name: `Club ${n}`,
    description: `Club ${n} description`,
    createdBy,
    facultyCoordinatorId: null,
    ...overrides,
    createdBy,
  };
  if (doc.facultyCoordinatorId) doc.facultyCoordinatorId = idOf(doc.facultyCoordinatorId);

  return Club.create(doc);
}

export async function makeProject(overrides = {}) {
  let createdBy = idOf(overrides.createdBy);
  if (!createdBy) createdBy = (await makeProjectAdmin())._id;

  const n = nextSequence();
  const doc = {
    name: `Project ${n}`,
    description: `Project ${n} description`,
    status: 'active',
    createdBy,
    teamLeaderId: null,
    ...overrides,
    createdBy,
  };
  if (doc.teamLeaderId) doc.teamLeaderId = idOf(doc.teamLeaderId);

  return Project.create(doc);
}

export async function makeClubMembership(overrides = {}) {
  const studentId = idOf(overrides.studentId) || (await makeStudent())._id;
  const clubId = idOf(overrides.clubId) || (await makeClub())._id;

  return ClubMembership.create({
    membershipType: 'member',
    position: null,
    ...overrides,
    studentId,
    clubId,
  });
}

export async function makeProjectMembership(overrides = {}) {
  const studentId = idOf(overrides.studentId) || (await makeStudent())._id;
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;

  return ProjectMembership.create({ ...overrides, studentId, projectId });
}

export async function makeProjectMentor(overrides = {}) {
  const mentorId = idOf(overrides.mentorId) || (await makeMentor())._id;
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;

  return ProjectMentor.create({
    isPrimary: false,
    ...overrides,
    mentorId,
    projectId,
  });
}

export async function makeJoinRequest(overrides = {}) {
  const requestType = overrides.requestType || 'club';
  const studentId = idOf(overrides.studentId) || (await makeStudent())._id;

  if (requestType === 'club') {
    const clubId = idOf(overrides.clubId) || (await makeClub())._id;
    const reviewerId = idOf(overrides.reviewerId) || (await makeCoordinator())._id;
    return JoinRequest.create({
      status: 'pending',
      ...overrides,
      requestType,
      studentId,
      clubId,
      reviewerId,
    });
  }

  const projectId = idOf(overrides.projectId) || (await makeProject())._id;
  const reviewerId = idOf(overrides.reviewerId) || (await makeMentor())._id;
  return JoinRequest.create({
    status: 'pending',
    ...overrides,
    requestType,
    studentId,
    projectId,
    reviewerId,
  });
}

export async function makeEvent(overrides = {}) {
  const n = nextSequence();
  const clubId = idOf(overrides.clubId) || (await makeClub())._id;
  const createdBy = idOf(overrides.createdBy) || (await makeClubAdmin())._id;

  return Event.create({
    title: `Event ${n}`,
    description: `Event ${n} description`,
    location: 'Main Auditorium',
    eventDate: new Date(Date.now() + n * 60 * 60 * 1000),
    ...overrides,
    clubId,
    createdBy,
  });
}

export async function makeInventoryItem(overrides = {}) {
  const n = nextSequence();
  const createdBy = idOf(overrides.createdBy) || (await makeProjectAdmin())._id;
  const totalQuantity = overrides.totalQuantity ?? 10;

  return GuitarInventory.create({
    name: `Inventory Item ${n}`,
    description: `Inventory item ${n}`,
    category: 'Component',
    availableQuantity: overrides.availableQuantity ?? totalQuantity,
    location: 'Guitar Lab',
    ...overrides,
    totalQuantity,
    createdBy,
  });
}

/**
 * A project with a Team Leader, one extra member, an assigned primary mentor
 * and (unless overridden) an inventory item — the shape the material-request
 * workflow needs.
 */
export async function makeTeamScenario(overrides = {}) {
  const projectAdmin = overrides.projectAdmin || (await makeProjectAdmin());
  const mentor = overrides.mentor || (await makeMentor());
  const teamLeader = overrides.teamLeader || (await makeStudent());
  const member = overrides.member || (await makeStudent());

  const project = await makeProject({
    createdBy: projectAdmin._id,
    teamLeaderId: teamLeader._id,
    ...overrides.project,
  });
  const mentorAssignment = await makeProjectMentor({
    projectId: project._id,
    mentorId: mentor._id,
    isPrimary: true,
  });
  await makeProjectMembership({ projectId: project._id, studentId: teamLeader._id });
  await makeProjectMembership({ projectId: project._id, studentId: member._id });

  const inventoryItem =
    overrides.inventoryItem || (await makeInventoryItem({ createdBy: projectAdmin._id, totalQuantity: 10 }));

  return { projectAdmin, mentor, mentorAssignment, teamLeader, member, project, inventoryItem };
}

export async function makeMaterialRequest(overrides = {}) {
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;
  const inventoryItemId = idOf(overrides.inventoryItemId) || (await makeInventoryItem())._id;
  const requestedBy = idOf(overrides.requestedBy) || (await makeStudent())._id;

  return MaterialRequest.create({
    materialName: 'Fixture material',
    quantity: 2,
    reason: 'Needed for the prototype',
    status: 'pending',
    ...overrides,
    projectId,
    inventoryItemId,
    requestedBy,
  });
}

export async function makeAllocation(overrides = {}) {
  return InventoryAllocation.create({
    quantity: 1,
    ...overrides,
    inventoryItemId: idOf(overrides.inventoryItemId),
    projectId: idOf(overrides.projectId),
    materialRequestId: idOf(overrides.materialRequestId),
    allocatedBy: idOf(overrides.allocatedBy),
  });
}

export async function makeNotification(overrides = {}) {
  const userId = idOf(overrides.userId) || (await makeStudent())._id;

  return Notification.create({
    type: 'event_created',
    title: 'Fixture notification',
    message: 'Fixture notification message',
    isRead: false,
    ...overrides,
    userId,
  });
}

export async function makeProjectUpdate(overrides = {}) {
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;
  const studentId = idOf(overrides.studentId) || (await makeStudent())._id;

  return ProjectUpdate.create({
    title: 'Weekly update',
    description: 'We made progress this week.',
    files: [],
    ...overrides,
    projectId,
    studentId,
  });
}

export async function makeProjectFeedback(overrides = {}) {
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;
  const mentorId = idOf(overrides.mentorId) || (await makeMentor())._id;

  return ProjectFeedback.create({
    feedbackText: 'Good progress, keep going.',
    updateId: null,
    ...overrides,
    projectId,
    mentorId,
  });
}

export async function makeProjectMaterial(overrides = {}) {
  const projectId = idOf(overrides.projectId) || (await makeProject())._id;
  const addedBy = idOf(overrides.addedBy) || (await makeStudent())._id;

  return ProjectMaterial.create({
    name: 'Fixture material',
    quantity: 1,
    source: 'owned',
    ...overrides,
    projectId,
    addedBy,
  });
}

export {
  User,
  Club,
  ClubMembership,
  Project,
  ProjectMembership,
  ProjectMentor,
  JoinRequest,
  Event,
  GuitarInventory,
  MaterialRequest,
  InventoryAllocation,
  Notification,
  ProjectUpdate,
  ProjectFeedback,
  ProjectMaterial,
};
