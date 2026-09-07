import React from "react";
import {
  FileCode,
  FileCode2,
  FileTerminal,
  FileJson,
  FileText,
  Globe,
  Palette,
  Database,
  Terminal,
  File,
} from "lucide-react";

export interface FileLanguageIconProps {
  fileName?: string;
  language?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showTooltip?: boolean;
}

export interface LanguageIconConfig {
  language: string;
  fullName: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor?: string;
}

/**
 * Returns language-specific icon configuration based primarily on the language property.
 * Falls back to file extension inspection when language is not specified.
 */
export function getLanguageIconConfig(
  language?: string,
  fileName?: string
): LanguageIconConfig {
  const lang = (language || "").toLowerCase().trim();
  const name = (fileName || "").toLowerCase().trim();

  // JavaScript
  if (
    lang === "javascript" ||
    (!lang && (name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".cjs") || name.endsWith(".jsx")))
  ) {
    return {
      language: "javascript",
      fullName: "JavaScript",
      icon: FileCode,
      color: "text-amber-400",
    };
  }

  // TypeScript
  if (
    lang === "typescript" ||
    (!lang && (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".d.ts")))
  ) {
    return {
      language: "typescript",
      fullName: "TypeScript",
      icon: FileCode2,
      color: "text-blue-400",
    };
  }

  // Python
  if (lang === "python" || (!lang && (name.endsWith(".py") || name.endsWith(".pyw")))) {
    return {
      language: "python",
      fullName: "Python",
      icon: FileTerminal,
      color: "text-emerald-400",
    };
  }

  // HTML
  if (lang === "html" || (!lang && (name.endsWith(".html") || name.endsWith(".htm")))) {
    return {
      language: "html",
      fullName: "HTML",
      icon: Globe,
      color: "text-orange-400",
    };
  }

  // CSS / SCSS
  if (
    lang === "css" ||
    (!lang && (name.endsWith(".css") || name.endsWith(".scss") || name.endsWith(".sass")))
  ) {
    return {
      language: "css",
      fullName: "CSS Stylesheet",
      icon: Palette,
      color: "text-sky-400",
    };
  }

  // JSON
  if (lang === "json" || (!lang && name.endsWith(".json"))) {
    return {
      language: "json",
      fullName: "JSON",
      icon: FileJson,
      color: "text-yellow-400",
    };
  }

  // Markdown
  if (lang === "markdown" || (!lang && (name.endsWith(".md") || name.endsWith(".markdown")))) {
    return {
      language: "markdown",
      fullName: "Markdown",
      icon: FileText,
      color: "text-purple-400",
    };
  }

  // SQL
  if (lang === "sql" || (!lang && name.endsWith(".sql"))) {
    return {
      language: "sql",
      fullName: "SQL Database Script",
      icon: Database,
      color: "text-indigo-400",
    };
  }

  // Shell / Bash
  if (
    lang === "shell" ||
    lang === "bash" ||
    (!lang && (name.endsWith(".sh") || name.endsWith(".bash") || name.endsWith(".zsh")))
  ) {
    return {
      language: "shell",
      fullName: "Shell Script",
      icon: Terminal,
      color: "text-teal-400",
    };
  }

  // Default / Unknown Text File
  return {
    language: lang || "text",
    fullName: "Text File",
    icon: File,
    color: "text-slate-400",
  };
}

export const FileLanguageIcon: React.FC<FileLanguageIconProps> = ({
  fileName,
  language,
  size = "sm",
  className = "",
  showTooltip = true,
}) => {
  const config = getLanguageIconConfig(language, fileName);
  const IconComponent = config.icon;

  const sizeClass = {
    xs: "w-3.5 h-3.5",
    sm: "w-4 h-4",
    md: "w-4.5 h-4.5",
    lg: "w-5 h-5",
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      title={showTooltip ? `${config.fullName} (${language || fileName || "file"})` : undefined}
      aria-label={config.fullName}
    >
      <IconComponent className={`${sizeClass} ${config.color} shrink-0`} />
    </span>
  );
};

