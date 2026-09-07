import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Folder, 
  Check, 
  X,
  Search,
  Pencil,
  FileCode,
  FileCode2,
  FileTerminal,
  FileJson,
  FileText,
  Globe,
  Palette,
  File
} from "lucide-react";
import { CodeFile, UserPresence, SupportedLanguage } from "../types";
import { FileLanguageIcon } from "./FileLanguageIcon";

/**
 * Returns a language-specific icon component based on the language property of each file.
 */
export const getLanguageFileIcon = (
  language: SupportedLanguage | string,
  className = "w-4 h-4"
): React.ReactElement => {
  const lang = (language || "").toLowerCase().trim();
  switch (lang) {
    case "javascript":
      return <FileCode className={`${className} text-amber-400 shrink-0`} />;
    case "typescript":
      return <FileCode2 className={`${className} text-blue-400 shrink-0`} />;
    case "python":
      return <FileTerminal className={`${className} text-emerald-400 shrink-0`} />;
    case "html":
      return <Globe className={`${className} text-orange-400 shrink-0`} />;
    case "css":
      return <Palette className={`${className} text-sky-400 shrink-0`} />;
    case "json":
      return <FileJson className={`${className} text-yellow-400 shrink-0`} />;
    case "markdown":
      return <FileText className={`${className} text-purple-400 shrink-0`} />;
    default:
      return <File className={`${className} text-slate-400 shrink-0`} />;
  }
};

interface FileExplorerProps {
  files: CodeFile[];
  activeFileId: string;
  users: UserPresence[];
  currentUser: UserPresence | null;
  unsavedFileIds?: Set<string>;
  recentRemoteEdits?: Record<string, { username: string; color: string; timestamp: number }>;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (name: string, language: SupportedLanguage) => void;
  onDeleteFile: (fileId: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  users,
  currentUser,
  unsavedFileIds,
  recentRemoteEdits,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase().trim();
    return files.filter((file) => file.name.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const detectLanguage = (name: string): SupportedLanguage => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
    if (lower.endsWith(".py") || lower.endsWith(".pyw")) return "python";
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
    if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass")) return "css";
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
    return "javascript";
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    const language = detectLanguage(name);
    onCreateFile(name, language);
    setNewFileName("");
    setIsCreating(false);
  };

  return (
    <aside className="w-56 bg-slate-900/95 border-r border-slate-800 flex flex-col select-none shrink-0 h-full">
      {/* Explorer Header */}
      <header
        id="file-explorer-header"
        className="border-b border-slate-800/80 bg-slate-900/95 flex flex-col shrink-0"
      >
        {/* Header Top Bar */}
        <div className="h-10 px-3 flex items-center justify-between text-xs font-semibold text-slate-400 tracking-wider uppercase">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Files</span>
            <span
              id="file-count-badge"
              className="text-[10px] font-mono font-normal lowercase tracking-normal text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60"
              title={
                searchQuery.trim()
                  ? `Showing ${filteredFiles.length} of ${files.length} files`
                  : `${files.length} files in project`
              }
            >
              {searchQuery.trim() ? `${filteredFiles.length}/${files.length}` : files.length}
            </span>
          </div>
          <button
            id="new-file-btn"
            onClick={() => setIsCreating(true)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Create new file"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time File Search Input Field */}
        <div className="px-2.5 pb-2.5">
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 rounded-md px-2 py-1 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              id="file-search-input"
              name="fileSearch"
              type="text"
              aria-label="Filter files by name"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
            />
            {searchQuery && (
              <button
                id="clear-file-search-btn"
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer transition"
                title="Clear search (Esc)"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* New File Inline Form */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-indigo-500/50 rounded px-2 py-1">
            <span className="shrink-0 flex items-center justify-center">
              {getLanguageFileIcon(detectLanguage(newFileName.trim()), "w-3.5 h-3.5")}
            </span>
            <input
              type="text"
              autoFocus
              placeholder="e.g. script.js, utils.ts"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
              title="Confirm file name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-slate-300 p-0.5 cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[10px] text-slate-500 mt-1.5 pl-0.5 font-mono flex items-center gap-1 flex-wrap">
            <span className="text-slate-400 mr-0.5">Quick:</span>
            {[
              { ext: ".ts", lang: "typescript" },
              { ext: ".js", lang: "javascript" },
              { ext: ".py", lang: "python" },
              { ext: ".css", lang: "css" },
              { ext: ".json", lang: "json" },
              { ext: ".html", lang: "html" },
              { ext: ".md", lang: "markdown" },
            ].map((item) => (
              <button
                key={item.ext}
                type="button"
                onClick={() => {
                  const base = newFileName.includes(".")
                    ? newFileName.substring(0, newFileName.lastIndexOf("."))
                    : (newFileName.trim() || "file");
                  setNewFileName(base + item.ext);
                }}
                className="hover:scale-110 transition-transform cursor-pointer p-0.5 rounded hover:bg-slate-800/80"
                title={`Quick select ${item.ext} (${item.lang})`}
              >
                {getLanguageFileIcon(item.lang, "w-3.5 h-3.5")}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {filteredFiles.length === 0 ? (
          <div className="py-6 px-3 text-center text-xs text-slate-500">
            {searchQuery.trim() ? (
              <div className="space-y-1.5">
                <Search className="w-4 h-4 mx-auto text-slate-600 opacity-60" />
                <p className="text-slate-400">No matching files</p>
                <button
                  id="clear-filter-btn"
                  onClick={() => setSearchQuery("")}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer transition"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <p>No files in project</p>
            )}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isActive = file.id === activeFileId;
            const isUnsaved = Boolean(unsavedFileIds?.has(file.id));

            // Other users (excluding current user) active in this file
            const otherUsersInFile = users.filter(
              (u) =>
                u.activeFileId === file.id &&
                (!currentUser || (u.id !== currentUser.id && u.socketId !== currentUser.socketId))
            );

            // Recent remote edit within 12 seconds
            const recentEdit = recentRemoteEdits?.[file.id];
            const hasRecentRemoteEdit = Boolean(
              recentEdit && Date.now() - recentEdit.timestamp < 12000
            );

            // Active collaborators editing or moving cursor in this file
            const activeCollaborators = otherUsersInFile.filter(
              (u) => u.cursor !== null || (Date.now() - (u.lastActive || 0) < 15000)
            );

            const isBeingEdited = hasRecentRemoteEdit || activeCollaborators.length > 0;
            const editorName = recentEdit?.username || activeCollaborators[0]?.username || "Collaborator";
            const editorColor = recentEdit?.color || activeCollaborators[0]?.color || "#10B981";

            const viewingUsers = users.filter((u) => u.activeFileId === file.id);

            return (
              <div
                key={file.id}
                id={`file-item-${file.id}`}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/15 text-slate-100 border border-indigo-500/30 font-medium"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
                onClick={() => onSelectFile(file.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    id={`file-language-icon-${file.id}`}
                    className="shrink-0 flex items-center justify-center"
                    title={`${file.language} file (${file.name})`}
                    aria-label={`${file.language} file`}
                  >
                    {getLanguageFileIcon(file.language, "w-4 h-4")}
                  </span>
                  <span className="font-mono truncate">{file.name}</span>

                  {/* Unsaved changes indicator (amber bullet dot) */}
                  {isUnsaved && (
                    <span
                      id={`unsaved-dot-${file.id}`}
                      className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-xs shadow-amber-400/80 ring-2 ring-amber-400/20"
                      title="Unsaved changes (modified since last checkpoint)"
                    />
                  )}
                </div>

                {/* Right Side: Active User Dots & Delete Action */}
                <div className="flex items-center gap-1.5 ml-2">
                  {/* Remote user currently editing indicator */}
                  {isBeingEdited && (
                    <div
                      id={`editing-indicator-${file.id}`}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] animate-pulse shrink-0"
                      style={{
                        backgroundColor: `${editorColor}15`,
                        borderColor: `${editorColor}50`,
                        color: editorColor,
                      }}
                      title={`Currently being edited by ${editorName}`}
                    >
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: editorColor }}
                        />
                        <span
                          className="relative inline-flex rounded-full h-1.5 w-1.5"
                          style={{ backgroundColor: editorColor }}
                        />
                      </span>
                      <Pencil className="w-2.5 h-2.5 shrink-0" />
                      <span className="font-sans font-medium text-[9px] uppercase tracking-wider hidden sm:inline max-w-[55px] truncate">
                        {editorName}
                      </span>
                    </div>
                  )}

                  {/* Viewing users badges */}
                  {viewingUsers.length > 0 && (
                    <div className="flex items-center -space-x-1" title={`${viewingUsers.map(u => u.username).join(', ')} currently viewing`}>
                      {viewingUsers.slice(0, 3).map((u) => (
                        <div
                          key={u.id || u.socketId}
                          className="w-2.5 h-2.5 rounded-full border border-slate-900"
                          style={{ backgroundColor: u.color }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Delete button (if more than 1 file) */}
                  {files.length > 1 && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {deleteConfirmId === file.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onDeleteFile(file.id);
                              setDeleteConfirmId(null);
                            }}
                            className="text-red-400 hover:text-red-300 p-0.5 rounded cursor-pointer"
                            title="Confirm Delete"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-slate-400 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(file.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>
            {searchQuery.trim()
              ? `${filteredFiles.length} of ${files.length} ${files.length === 1 ? 'file' : 'files'}`
              : `${files.length} ${files.length === 1 ? 'file' : 'files'}`}
          </span>
          {unsavedFileIds && unsavedFileIds.size > 0 && (
            <span
              id="unsaved-files-badge"
              className="flex items-center gap-1 text-amber-400/90 font-medium"
              title={`${unsavedFileIds.size} file(s) have unsaved changes`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {unsavedFileIds.size} unsaved
            </span>
          )}
        </div>
        <span className="text-slate-400 font-mono">v{files.find(f => f.id === activeFileId)?.version || 1}</span>
      </div>
    </aside>
  );
};
