"use client";

import React from "react";
import { CheckCircle2, Clock, MoreHorizontal } from "lucide-react";

export interface KanbanTask {
  _id: string;
  title: string;
  courseName: string;
  status: "pending" | "progress" | "done";
  dueDate: string;
}

export function KanbanBoard({ 
  tasks, 
  onMove 
}: { 
  tasks: KanbanTask[], 
  onMove: (id: string, status: KanbanTask["status"]) => void 
}) {
  const columns = [
    { id: "pending", title: "To Do", icon: <Clock size={16} className="text-amber-500" /> },
    { id: "progress", title: "In Progress", icon: <MoreHorizontal size={16} className="text-blue-500" /> },
    { id: "done", title: "Done", icon: <CheckCircle2 size={16} className="text-green-500" /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map(col => {
        const colTasks = tasks.filter(t => 
          (col.id === "pending" && (!t.status || t.status === "pending")) ||
          (t.status === col.id)
        );
        
        return (
          <div key={col.id} className="bg-card border rounded-xl flex flex-col h-full max-h-[600px]">
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2 font-semibold">
                {col.icon}
                {col.title}
              </div>
              <span className="text-xs bg-background border px-2 py-1 rounded-full font-medium">
                {colTasks.length}
              </span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {colTasks.map(t => (
                <div key={t._id} className="bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm leading-tight">{t.title}</h4>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{t.courseName} • {t.dueDate}</div>
                  
                  <div className="flex gap-2">
                    {col.id !== "pending" && (
                      <button onClick={() => onMove(t._id, "pending")} className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-1 rounded">To Do</button>
                    )}
                    {col.id !== "progress" && (
                      <button onClick={() => onMove(t._id, "progress")} className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-1 rounded">Progress</button>
                    )}
                    {col.id !== "done" && (
                      <button onClick={() => onMove(t._id, "done")} className="text-[10px] bg-green-500/10 text-green-600 px-2 py-1 rounded">Done</button>
                    )}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg opacity-50">
                  Tidak ada tugas
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
