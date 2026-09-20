import React, { useState, useEffect, useRef } from "react";
import { Send, X, Users, MessageSquare, Bot } from "lucide-react";
import { ChatMessage, UserPresence } from "../types";

interface CollaborationChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: UserPresence | null;
  typingUsers: string[];
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export const CollaborationChat: React.FC<CollaborationChatProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  typingUsers,
  onSendMessage,
  onTyping,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none z-20">
      {/* Header */}
      <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>Team Chat & Activity</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
        {messages.map((msg) => {
          const isSelf = currentUser && currentUser.id === msg.userId;
          const isSystem = msg.type === "system";

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="py-1 px-2.5 rounded bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                <span className="flex-1 font-mono">{msg.text}</span>
                <span className="text-[9px] text-slate-600 shrink-0">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {!isSelf && (
                  <div
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white uppercase"
                    style={{ backgroundColor: msg.userColor }}
                  >
                    {msg.username.slice(0, 1)}
                  </div>
                )}
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isSelf ? "#a5b4fc" : msg.userColor }}
                >
                  {isSelf ? "You" : msg.username}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed break-words ${isSelf
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none"
                  }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-indigo-400 italic bg-slate-950/50 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
          <span>
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </span>
        </div>
      )}

      {/* Input box */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 focus-within:border-indigo-500 rounded-lg px-3 py-2 transition">
          <input
            type="text"
            placeholder="Message collaborators..."
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition p-0.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
