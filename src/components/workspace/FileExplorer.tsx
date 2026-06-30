"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, FileType, File as FileIcon, Folder, FolderOpen,
  ChevronRight, ChevronDown, Upload, Search, Trash2, Sparkles, MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DocItem {
  _id: string;
  filename: string;
  originalName: string;
  courseName: string;
  fileUrl: string;
  fileType: string;
  fileSize: string;
  status: string;
  uploadedAt: string;
}

interface FileExplorerProps {
  onSelectFile?: (file: DocItem) => void;
  onUpload?: () => void;
  onDeleteFile?: (fileId: string) => void;
  selectedFileId?: string;
}

export function FileExplorer({ onSelectFile, onUpload, onDeleteFile, selectedFileId }: FileExplorerProps) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: DocItem } | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
        // Auto-expand first course
        if (data.length > 0 && data[0].courseName) {
          setExpandedCourses(new Set([data[0].courseName]));
        }
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [contextMenu]);

  const toggleCourse = (course: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  };

  const filtered = docs.filter((d) =>
    !search || d.originalName.toLowerCase().includes(search.toLowerCase()) ||
    d.courseName.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, doc) => {
    const course = doc.courseName || "Tanpa Mata Kuliah";
    if (!acc[course]) acc[course] = [];
    acc[course].push(doc);
    return acc;
  }, {} as Record<string, DocItem[]>);

  const getFileIcon = (type: string) => {
    if (type === "pdf") return FileType;
    if (type === "docx") return FileText;
    return FileIcon;
  };

  const handleContextMenu = (e: React.MouseEvent, file: DocItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Materi</h3>
        <button
          onClick={onUpload}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Upload"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-2 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari file..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              {search ? "Tidak ada file yang cocok." : "Belum ada materi. Upload file untuk mulai."}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([course, files]) => {
            const isExpanded = expandedCourses.has(course);
            return (
              <div key={course} className="mb-1">
                <button
                  onClick={() => toggleCourse(course)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> : <Folder className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="truncate">{course}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{files.length}</span>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden ml-3"
                    >
                      {files.map((file) => {
                        const Icon = getFileIcon(file.fileType);
                        const isSelected = selectedFileId === file._id;
                        return (
                          <button
                            key={file._id}
                            onClick={() => onSelectFile?.(file)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors group ${
                              isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate flex-1 text-left">{file.originalName}</span>
                            {file.fileSize && (
                              <span className="text-[10px] text-muted-foreground/60">{file.fileSize}</span>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onSelectFile?.(contextMenu.file); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-foreground"
          >
            <Sparkles className="w-3 h-3" /> Tanya AI tentang ini
          </button>
          {onDeleteFile && (
            <button
              onClick={() => { onDeleteFile(contextMenu.file._id); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-red-500"
            >
              <Trash2 className="w-3 h-3" /> Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}
