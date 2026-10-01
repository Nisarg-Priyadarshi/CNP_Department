// Quick import check script — no DB connection required
import mongoose from 'mongoose';
console.log('Mongoose loaded, version:', mongoose.version);

const { default: ProjectUpdate } = await import('./src/models/ProjectUpdate.js');
console.log('✅ ProjectUpdate model loaded:', ProjectUpdate.modelName);

const { default: ProjectFeedback } = await import('./src/models/ProjectFeedback.js');
console.log('✅ ProjectFeedback model loaded:', ProjectFeedback.modelName);

const { default: projectUpdateRoutes } = await import('./src/routes/projectUpdateRoutes.js');
console.log('✅ projectUpdateRoutes router loaded:', typeof projectUpdateRoutes);

console.log('\nAll 2F modules load without errors.');
