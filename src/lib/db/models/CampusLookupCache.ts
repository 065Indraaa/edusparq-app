import mongoose, { Schema, models, model } from "mongoose";

/**
 * Generic key/value cache for keyless campus lookups (PDDIKTI university and
 * study-program search). Keeps us polite to the public PDDIKTI endpoint and
 * makes the autocomplete feel instant. `payload` holds whatever the loader
 * returned (an array of results); freshness is checked in lib/pddikti.ts.
 */
const CampusLookupCacheSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  payload: { type: Schema.Types.Mixed, default: null },
  cachedAt: { type: Date, default: Date.now },
});

export const CampusLookupCache =
  models.CampusLookupCache ||
  model("CampusLookupCache", CampusLookupCacheSchema);
