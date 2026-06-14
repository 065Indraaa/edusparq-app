import mongoose, { Schema, models, model, Types } from "mongoose";

const OrganizationMemberSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  nama: { type: String, default: "" },
  role: {
    type: String,
    enum: ["ketua", "wakil", "sekretaris", "bendahara", "kadiv", "anggota"],
    default: "anggota",
  },
  sectionId: { type: Types.ObjectId },
  status: { type: String, enum: ["pending", "active"], default: "active" },
  joinedAt: { type: Date, default: Date.now },
});

export const OrganizationMember =
  models.OrganizationMember || model("OrganizationMember", OrganizationMemberSchema);
