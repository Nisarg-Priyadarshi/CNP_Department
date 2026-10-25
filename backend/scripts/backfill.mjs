/**
 * Idempotent backfill for the fields added in the backend upgrade pass.
 *
 *   node scripts/backfill.mjs
 *
 * Safe to run more than once, and safe on an empty database.
 * It only touches documents that are missing the new field:
 *
 *   1. Notification.kind      — derived from the existing `type` (club/project/
 *                               event/request/inventory/system) so the inbox's
 *                               kind filter sees historical rows too.
 *   2. GuitarInventory.minimumStock — 0 for legacy items ("no threshold").
 *
 * `Club.foundedAt` is intentionally NOT backfilled: copying `createdAt` would
 * present a record-creation date as a founding date, which is exactly the bug
 * the new field exists to avoid.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Notification, { kindForNotificationType } from '../src/models/Notification.js';
import GuitarInventory from '../src/models/GuitarInventory.js';

async function run() {
  await connectDB();

  const missingKindFilter = { $or: [{ kind: { $exists: false } }, { kind: null }] };
  const types = await Notification.distinct('type', missingKindFilter);

  let notificationsUpdated = 0;
  for (const type of types) {
    const result = await Notification.updateMany(
      { type, ...missingKindFilter },
      { $set: { kind: kindForNotificationType(type) } }
    );
    notificationsUpdated += result.modifiedCount;
    console.log(`  notification type "${type}" → kind "${kindForNotificationType(type)}" (${result.modifiedCount})`);
  }

  const inventoryResult = await GuitarInventory.updateMany(
    { $or: [{ minimumStock: { $exists: false } }, { minimumStock: null }] },
    { $set: { minimumStock: 0 } }
  );

  console.log(`\n✅ Backfill complete`);
  console.log(`   notifications updated: ${notificationsUpdated}`);
  console.log(`   inventory items updated: ${inventoryResult.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('❌ Backfill failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
