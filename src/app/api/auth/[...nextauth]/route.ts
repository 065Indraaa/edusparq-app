import { handlers } from "@/lib/auth";

// NextAuth touches MongoDB (bcrypt + user lookups) — force the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
