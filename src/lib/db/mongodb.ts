import mongoose from "mongoose";

// Cache the connection to avoid creating multiple connections in development
const globalForMongoose = globalThis as unknown as {
  mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = { conn: null, promise: null };
}

const cached = globalForMongoose.mongoose;

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI belum diisi di .env.local");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      // Fail fast when the DB is unreachable from the host instead of hanging the
      // request until the platform gateway times out (which reads as a 502/504).
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next request retries a fresh connection rather than reusing a
    // permanently-rejected promise.
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

export default connectDB;
