import { z } from "zod";

/**
 * Reusable Zod schemas for API request validation.
 * Required fields are strict; optional fields stay permissive with `.optional()`.
 */

// Accepts a year as string or number; numbers are coerced to string and must be non-empty.
const yearField = z.union([z.string().min(1), z.number()]).transform((v) => String(v));

export const citationSchema = z.object({
  author: z.string().min(1),
  title: z.string().min(1),
  year: yearField,
  journal: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  page: z.string().optional(),
});

export const courseSchema = z.object({
  name: z.string().min(1),
  semester: z.union([z.string().min(1), z.number()]).transform((v) => String(v)),
  lecturer: z.string().optional(),
  sks: z.union([z.string(), z.number()]).optional(),
});

export const flashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  courseName: z.string().optional(),
  category: z.string().optional(),
});
