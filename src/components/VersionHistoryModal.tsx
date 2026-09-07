import React, { useState, useMemo } from "react";
import { 
  History, 
  GitCommit, 
  RotateCcw, 
  X, 
  Clock, 
  User, 
  FileCode, 
  Check, 
  ArrowLeft,
  ChevronRight,
  Plus,
  Minus
} from "lucide-react";
import { VersionSnapshot, CodeFile } from "../types";

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionHistory: VersionSnapshot[];
  currentFiles: CodeFile[];
  activeFileId: string;
  onRestoreVersion: (versionId: string) => void;
  onCreateCommit: (commitMessage: string) => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// Simple fast line-by-line diff computation
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");
  const diff: DiffLine[] = [];

  // Simple Myers/LCS approximation for readable diffing
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({
        type: "unchanged",
        text: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
      });
      i++;
      j++;
    } else if (j < newLines.length && (!oldLines.includes(newLines[j]) || (i < oldLines.length && oldLines.indexOf(newLines[j]) > i + 3))) {
      diff.push({
        type: "added",
        text: newLines[j],
        newLineNumber: j + 1,
      });
      j++;
    } else if (i < oldLines.length) {
      diff.push({
        type: "removed",
        text: oldLines[i],
        oldLineNumber: i + 1,
      });
      i++;
    } else {
      diff.push({
        type: "added",
        text: newLines[j],
        newLineNumber: j + 1,
      });
      j++;
    }
  }

  return diff;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versionHistory,
  currentFiles,
  activeFileId,
  onRestoreVersion,
  onCreateCommit,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    versionHistory[versionHistory.length - 1]?.id || ""
  );
  const [selectedFileId, setSelectedFileId] = useState<string>(activeFileId);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [newCommitMessage, setNewCommitMessage] = useState("");

  const selectedSnapshot = useMemo(() => {
    return versionHistory.find((v) => v.id === selectedVersionId) || versionHistory[versionHistory.length - 1];
  }, [versionHistory, selectedVersionId]);

  const currentFile = useMemo(() => {
    return currentFiles.find((f) => f.id === selectedFileId) || currentFiles[0];
  }, [currentFiles, selectedFileId]);

  const snapshotContent = useMemo(() => {
    if (!selectedSnapshot || !currentFile) return "";
    return selectedSnapshot.filesSnapshot[currentFile.id] || "";
  }, [selectedSnapshot, currentFile]);

  // Compute diff between selected snapshot and current editor file content
  const diffLines = useMemo(() => {
    if (!currentFile) return [];
    return computeLineDiff(snapshotContent, currentFile.content);
  }, [snapshotContent, currentFile]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach((l) => {
      if (l.type === "added") added++;
      if (l.type === "removed") removed++;
    });
    return { added, removed };
  }, [diffLines]);

  if (!isOpen) return null;

  const handleCreateCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitMessage.trim()) return;
    onCreateCommit(newCommitMessage.trim());
    setNewCommitMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Version History & Synchronization State
                <span className="text-xs font-normal text-slate-400">({versionHistory.length} checkpoints)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Track room snapshots, review line-by-line diffs, and restore previous states.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Version Timeline */}
          <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950/50 shrink-0">
            {/* Quick Checkpoint Creation Form */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/50">
              <form onSubmit={handleCreateCommit} className="space-y-2">
                <label className="text-[11px] font-medium text-slate-300 block">
                  Create Checkpoint Snapshot
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Implement binary search"
                    value={newCommitMessage}
                    onChange={(e) => setNewCommitMessage(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!newCommitMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-1.5 rounded transition cursor-pointer"
                    title="Commit snapshot"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Checkpoint list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {[...versionHistory].reverse().map((snapshot) => {
                const isSelected = selectedSnapshot?.id === snapshot.id;
                const dateStr = new Date(snapshot.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div
                    key={snapshot.id}
                    onClick={() => {
                      setSelectedVersionId(snapshot.id);
                      setConfirmRestoreId(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/50 text-slate-100 shadow-sm"
                        : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          v{snapshot.versionNumber}
                        </span>
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: snapshot.authorColor }}
                        />
                        <span className="text-xs font-semibold truncate max-w-[110px]">
                          {snapshot.authorName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{dateStr}</span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium line-clamp-2">
                      {snapshot.commitMessage}
                    </p>

                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>{Object.keys(snapshot.filesSnapshot).length} files snapshot</span>
                      {isSelected && (
                        <span className="text-indigo-400 font-medium flex items-center gap-0.5">
                          Viewing diff <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Diff & Restore Inspector */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {/* Diff View Header */}
            {selectedSnapshot && currentFile && (
              <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-3">
                  {/* File dropdown for diff */}
                  <select
                    value={selectedFileId}
                    onChange={(e) => setSelectedFileId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs text-slate-200 font-mono rounded px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                  >
                    {currentFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  {/* Diff Stats Pill */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      +{stats.added}
                    </span>
                    <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      -{stats.removed}
                    </span>
                  </div>
                </div>

                {/* Restore / Rollback CTA */}
                <div className="flex items-center gap-2">
                  {confirmRestoreId === selectedSnapshot.id ? (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <span className="text-xs text-amber-300 font-medium mr-1">
                        Confirm rollback to v{selectedSnapshot.versionNumber}?
                      </span>
                      <button
                        onClick={() => {
                          onRestoreVersion(selectedSnapshot.id);
                          setConfirmRestoreId(null);
                          onClose();
                        }}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded transition"
                      >
                        Yes, Revert
                      </button>
                      <button
                        onClick={() => setConfirmRestoreId(null)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRestoreId(selectedSnapshot.id)}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Restore to v{selectedSnapshot.versionNumber}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Diff Content Viewer */}
            <div className="flex-1 overflow-auto font-mono text-xs p-3 bg-slate-950/80 leading-relaxed select-text">
              {diffLines.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  No differences found between current state and snapshot v{selectedSnapshot?.versionNumber}.
                </div>
              ) : (
                <div className="divide-y divide-slate-900">
                  {diffLines.map((line, idx) => {
                    const isAdded = line.type === "added";
                    const isRemoved = line.type === "removed";

                    return (
                      <div
                        key={idx}
                        className={`flex items-start py-0.5 px-2 ${
                          isAdded
                            ? "bg-emerald-950/30 text-emerald-300"
                            : isRemoved
                            ? "bg-red-950/30 text-red-300 line-through opacity-80"
                            : "text-slate-400"
                        }`}
                      >
                        {/* Line number indicators */}
                        <div className="w-12 text-slate-600 text-right pr-3 select-none shrink-0 font-mono text-[11px]">
                          {isRemoved ? line.oldLineNumber : isAdded ? line.newLineNumber : line.newLineNumber}
                        </div>

                        {/* Sign Indicator */}
                        <div className="w-4 select-none shrink-0 font-bold">
                          {isAdded ? "+" : isRemoved ? "-" : " "}
                        </div>

                        {/* Line content */}
                        <div className="whitespace-pre overflow-x-auto flex-1">
                          {line.text || " "}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
