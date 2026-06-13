import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduSparq — Asisten Akademik AI",
    short_name: "EduSparq",
    description:
      "Satu ruang kerja untuk tugas, materi, tutor AI, riset, dan persiapan ujian mahasiswa Indonesia.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1A3A5C",
    lang: "id",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      // Uses the existing app/icon route (favicon) as a baseline. Replace with
      // dedicated 192/512 maskable PNGs in /public for full installability.
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
