import mongoose, { Schema, models, model } from "mongoose";

/**
 * Caches Indonesia University Data API search results (keyed by normalized
 * query) so we stay well under the free tier (3000 hits/month). Entries older
 * than the TTL (checked in lib/campus.ts) are treated as stale and refetched.
 */
const UniversityCacheSchema = new Schema({
  query: { type: String, required: true, unique: true, index: true },
  results: [
    {
      name: { type: String, default: "" },
      shortName: { type: String, default: "" },
      province: { type: String, default: "" },
      regency: { type: String, default: "" },
      type: { type: String, default: "" },
    },
  ],
  cachedAt: { type: Date, default: Date.now },
});

export const UniversityCache =
  models.UniversityCache || model("UniversityCache", UniversityCacheSchema);
