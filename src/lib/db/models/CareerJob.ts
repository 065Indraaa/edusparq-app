import mongoose, { Schema, models, model } from "mongoose";

export type JobType = "internship" | "entry" | "part-time" | "contract";
export type WorkLocation = "remote" | "hybrid" | "onsite";

export interface ICareerJob {
  _id?: string;
  title: string;
  company: string;
  location: string;
  workLocation: WorkLocation;
  type: JobType;
  category: string;
  skills: string[];
  salaryRange?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  sourceUrl?: string;
  sourceName: string;
  postedAt: Date;
  closesAt?: Date;
  active: boolean;
}

const CareerJobSchema = new Schema<ICareerJob>(
  {
    title: { type: String, required: true, index: true },
    company: { type: String, required: true, index: true },
    location: { type: String, required: true, default: "Indonesia" },
    workLocation: {
      type: String,
      enum: ["remote", "hybrid", "onsite"],
      default: "onsite",
      index: true,
    },
    type: {
      type: String,
      enum: ["internship", "entry", "part-time", "contract"],
      required: true,
      index: true,
    },
    category: { type: String, required: true, index: true },
    skills: [{ type: String }],
    salaryRange: { type: String, default: "" },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    responsibilities: [{ type: String }],
    sourceUrl: { type: String, default: "" },
    sourceName: { type: String, required: true, default: "EduSparq Career" },
    postedAt: { type: Date, default: Date.now },
    closesAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const CareerJob = models.CareerJob || model("CareerJob", CareerJobSchema);
