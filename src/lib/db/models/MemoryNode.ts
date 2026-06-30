import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * MemoryNode — a single concept/fact/topic in the user's knowledge graph.
 *
 * Like an Obsidian note: each node is one atomic piece of knowledge
 * the AI learned about this specific user. Nodes are connected via
 * MemoryEdge relationships, forming a per-user knowledge graph.
 */

export type MemoryNodeType =
  | "concept" // an academic concept the user learned/asked about
  | "fact" // a specific fact about the user (preferences, background)
  | "topic" // a topic/theme the user is interested in
  | "task" // a task/project the user is working on
  | "preference" // user's learning/writing preference
  | "event"; // something that happened (deadline, exam, submission)

export type MemorySource =
  | "chat" // extracted from chat conversation
  | "document" // extracted from uploaded material
  | "krs" // from KRS import
  | "deadline" // from deadline creation
  | "explicit" // user explicitly told the AI
  | "inferred"; // AI inferred from patterns

export interface IMemoryNode extends Document {
  userId: Types.ObjectId;
  type: MemoryNodeType;
  title: string;
  content: string;
  source: MemorySource;
  sourceId?: string;
  tags: string[];
  embedding?: number[];
  strength: number;
  accessCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MemoryNodeSchema = new Schema<IMemoryNode>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["concept", "fact", "topic", "task", "preference", "event"],
      default: "concept",
      index: true,
    },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    source: {
      type: String,
      enum: ["chat", "document", "krs", "deadline", "explicit", "inferred"],
      default: "chat",
    },
    sourceId: { type: String, default: "" },
    tags: { type: [String], default: [], index: true },
    embedding: { type: [Number], default: [] },
    strength: { type: Number, default: 1.0, min: 0, max: 10 },
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date },
  },
  { timestamps: true }
);

MemoryNodeSchema.index({ userId: 1, title: 1 }, { unique: true });
MemoryNodeSchema.index({ content: "text" });
MemoryNodeSchema.index({ userId: 1, type: 1, strength: -1 });

export const MemoryNode: Model<IMemoryNode> =
  mongoose.models.MemoryNode ||
  mongoose.model<IMemoryNode>("MemoryNode", MemoryNodeSchema);
