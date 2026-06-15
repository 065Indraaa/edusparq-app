"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PenTool } from "lucide-react";
import { useSession } from "next-auth/react";
import DocumentStudio from "./DocumentStudio";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function WritingPage() {
  const { data: session } = useSession();
  const [universitas, setUniversitas] = useState("");
  const [prodi, setProdi] = useState("");

  // Load the user's real campus context so the outline follows their institution.
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUniversitas(data.user.universitas || "");
          setProdi(data.user.prodi || "");
        }
      })
      .catch(() => {});
  }, [session]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 h-full flex flex-col pb-10">

      {/* Header Minimalist */}
      <motion.div variants={itemVariants} className="flex justify-between items-end mb-4 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
            <PenTool size={14} /> Studio Menulis Pintar
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Asisten Menulis</h1>
        </div>
      </motion.div>

      {/* We pass the context to DocumentStudio, which will now handle the entire split-screen layout */}
      <motion.div variants={itemVariants} className="flex-1 w-full relative">
        <DocumentStudio universitas={universitas} prodi={prodi} />
      </motion.div>

    </motion.div>
  );
}
