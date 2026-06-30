import mongoose, { Schema, models, model, Types } from "mongoose";

const DocumentChunkSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Types.ObjectId, ref: "Document", required: true, index: true },
  courseName: { type: String, default: "" },
  content: { type: String, required: true },
  chunkIndex: { type: Number, default: 0 },
  embedding: { type: [Number], default: [] }, // Tambahan untuk Vector Search
  createdAt: { type: Date, default: Date.now },
});

// Full-text index for keyword retrieval (RAG fallback).
DocumentChunkSchema.index({ content: "text" });

export const DocumentChunk =
  models.DocumentChunk || model("DocumentChunk", DocumentChunkSchema);
