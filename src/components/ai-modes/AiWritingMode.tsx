"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PenTool } from "lucide-react";
import { useSession } from "next-auth/react";
import DocumentStudio from "../../app/(app)/writing/DocumentStudio";

export default function AiWritingMode() {
  const { data: session } = useSession();
  const [universitas, setUniversitas] = useState("");
  const [prodi, setProdi] = useState("");

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
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
            <PenTool size={14} /> Studio Menulis Pintar
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Asisten Menulis</h2>
        </div>
      </div>
      <div className="flex-1 w-full relative">
        <DocumentStudio universitas={universitas} prodi={prodi} />
      </div>
    </div>
  );
}
