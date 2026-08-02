/**
 * One-off data repair: finds every PriestProfile where isVerified does not
 * match (verificationStatus === 'approved') and corrects isVerified to match.
 * verificationStatus is treated as the source of truth (see the pre-save
 * sync hook in models/priestProfile.js). verificationDocuments[].status is
 * left untouched — that's a separate, per-document admin judgment.
 *
 * Uses updateOne (not .save()) so the newly-added findOneAndUpdate/updateOne
 * sync hook is exercised rather than the pre-save hook — this script IS the
 * kind of write that previously bypassed sync entirely.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PriestProfile = require('../models/priestProfile');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });

    const all = await PriestProfile.find({})
      .select('_id userId isVerified verificationStatus')
      .lean();

    const drifted = all.filter(
      (p) => p.isVerified !== (p.verificationStatus === 'approved')
    );

    for (const p of drifted) {
      const correctIsVerified = p.verificationStatus === 'approved';
      await PriestProfile.updateOne(
        { _id: p._id },
        { $set: { isVerified: correctIsVerified } }
      );
      console.log(
        `Fixed PriestProfile ${p._id} (userId ${p.userId}): ` +
        `isVerified ${p.isVerified} -> ${correctIsVerified} ` +
        `(verificationStatus: '${p.verificationStatus}')`
      );
    }

    console.log(`\nScanned ${all.length} priest profiles. Corrected ${drifted.length}.`);
  } catch (err) {
    console.error('Drift-fix failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
