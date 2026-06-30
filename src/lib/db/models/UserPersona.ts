import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUserPersona extends Document {
  userId: string;
  academicProfile?: string;
  writingStyle?: string;
  currentFocus?: string;
  language?: string;
  learnedFacts: string[];
  activityLog?: {
    mostUsedFeatures: string[];
    avgSessionLength?: number;
    peakHour?: number;
    subjectFrequency?: Map<string, number>;
  };
  learningStyle?: {
    prefersStepByStep?: boolean;
    prefersExamples?: boolean;
    prefersVisual?: boolean;
    responseLength?: string;
  };
  contentHistory?: {
    uploadedCourses: string[];
    lastActiveTopics: string[];
  };
  uploadPreferences: {
    preferredCourseIds: string[];
    autoCreateDeadlines: boolean;
    learningStyle: string;
  };
  lastExtractedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserPersonaSchema = new Schema<IUserPersona>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    academicProfile: { type: String, default: "" },
    writingStyle: { type: String, default: "" },
    currentFocus: { type: String, default: "" },
    language: { type: String, default: "id-informal" },
    learnedFacts: { type: [String], default: [] },
    activityLog: {
      mostUsedFeatures: { type: [String], default: [] },
      avgSessionLength: { type: Number, default: 0 },
      peakHour: { type: Number, default: 0 },
      subjectFrequency: { type: Map, of: Number, default: {} },
    },
    learningStyle: {
      prefersStepByStep: { type: Boolean, default: true },
      prefersExamples: { type: Boolean, default: true },
      prefersVisual: { type: Boolean, default: false },
      responseLength: { type: String, default: "medium" },
    },
    contentHistory: {
      uploadedCourses: { type: [String], default: [] },
      lastActiveTopics: { type: [String], default: [] },
    },
    uploadPreferences: {
      preferredCourseIds: { type: [String], default: [] },
      autoCreateDeadlines: { type: Boolean, default: false },
      learningStyle: { type: String, default: "" },
    },
    lastExtractedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const UserPersona: Model<IUserPersona> =
  mongoose.models.UserPersona || mongoose.model<IUserPersona>("UserPersona", UserPersonaSchema);
