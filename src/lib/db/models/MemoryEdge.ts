import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * MemoryEdge — a connection between two MemoryNodes in the user's knowledge graph.
 *
 * Like Obsidian's wiki-links: nodes are connected when they relate to each other.
 * This allows the AI to traverse the user's knowledge graph — e.g. finding
 * all concepts related to "algoritma sorting" that the user has asked about.
 */

export type MemoryEdgeType =
  | "related" // general relationship (both mentioned together)
  | "prerequisite" // source is prerequisite for target
  | "part_of" // source is a sub-topic of target
  | "contradicts" // source contradicts target (user changed their mind)
  | "extends" // source extends/builds upon target
  | "applied_in"; // source concept is applied in target context

export interface IMemoryEdge extends Document {
  userId: Types.ObjectId;
  sourceNodeId: Types.ObjectId;
  targetNodeId: Types.ObjectId;
  type: MemoryEdgeType;
  weight: number;
  createdAt: Date;
}

const MemoryEdgeSchema = new Schema<IMemoryEdge>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    sourceNodeId: {
      type: Types.ObjectId,
      ref: "MemoryNode",
      required: true,
    },
    targetNodeId: {
      type: Types.ObjectId,
      ref: "MemoryNode",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "related",
        "prerequisite",
        "part_of",
        "contradicts",
        "extends",
        "applied_in",
      ],
      default: "related",
    },
    weight: { type: Number, default: 1.0, min: 0, max: 10 },
  },
  { timestamps: true }
);

MemoryEdgeSchema.index({ sourceNodeId: 1, targetNodeId: 1 }, { unique: true });
MemoryEdgeSchema.index({ userId: 1, type: 1 });

export const MemoryEdge: Model<IMemoryEdge> =
  mongoose.models.MemoryEdge ||
  mongoose.model<IMemoryEdge>("MemoryEdge", MemoryEdgeSchema);
