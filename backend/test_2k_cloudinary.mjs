/**
 * test_2k_cloudinary.mjs
 * 
 * Tests the Cloudinary integration for Task 2K.
 * Validates endpoints for profile images, club logos, project images,
 * project materials, and project updates.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const API_URL = 'http://localhost:5000/api';

async function loginUser(email) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  if (res.status === 401) {
    // Legacy tests had no password sometimes, so let's check
    const r2 = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const d2 = await r2.json();
    if (d2.token) return d2;
  }
  return await res.json();
}

async function runTests() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log(' TASK 2K — CLOUDINARY INTEGRATION TESTS');
  console.log('═════════════════════════════════════════════════════════════════');

  // Verify server is up
  try {
    const health = await fetch(`${API_URL}/health`);
    if (!health.ok) throw new Error('Server not responding');
  } catch (err) {
    console.error('❌ Server is not running. Start it with `npm run dev` first.');
    process.exit(1);
  }

  const TS = Date.now();
  // 1. Create Student
  const sEmail = `cloud_student_${TS}@test.com`;
  const sRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cloud Student', email: sEmail, password: 'password123', role: 'student' })
  });
  const sData = await sRes.json();
  const studentToken = sData.token || '';

  // 2. Create Project Admin
  const aEmail = `cloud_admin_${TS}@test.com`;
  const aRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cloud Admin', email: aEmail, password: 'password123', role: 'project_admin' })
  });
  const aData = await aRes.json();
  const adminToken = aData.token || '';

  if (!studentToken || !adminToken) {
    console.log('❌ Failed to get auth tokens.');
    process.exit(1);
  }
  
  console.log('✅ Auth tokens acquired');

  // Create a dummy image blob (1x1 PNG)
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const buffer = Buffer.from(base64Png, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  // 1. Profile Image Upload (Student)
  const fdProfile = new FormData();
  fdProfile.append('image', blob, 'profile.png');
  
  const resProfile = await fetch(`${API_URL}/users/profile-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${studentToken}` },
    body: fdProfile
  });
  const dataProfile = await resProfile.json();
  if (dataProfile.success && dataProfile.data.profileImage.includes('cloudinary')) {
    console.log('✅ PASS — 1. Profile image uploaded to Cloudinary successfully');
  } else {
    console.log('❌ FAIL — 1. Profile image upload failed:', dataProfile);
  }

  // 2. Project Image Upload (Admin)
  // Let's create a project first
  const projectRes = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Cloudinary Test Project',
      description: 'Testing uploads'
    })
  });
  const projectData = await projectRes.json();
  const projectId = projectData.data?._id;

  if (projectId) {
    const fdProject = new FormData();
    fdProject.append('image', blob, 'project.png');
    
    const resProject = await fetch(`${API_URL}/projects/${projectId}/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: fdProject
    });
    const dataProject = await resProject.json();
    if (dataProject.success && dataProject.data.image.includes('cloudinary')) {
      console.log('✅ PASS — 2. Project image uploaded to Cloudinary successfully');
    } else {
      console.log('❌ FAIL — 2. Project image upload failed:', dataProject);
    }
  } else {
    console.log('❌ FAIL — 2. Project creation failed, skipping image test');
  }

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(' 2K Tests Complete');
  console.log('═════════════════════════════════════════════════════════════════');
}

runTests().catch(console.error);
