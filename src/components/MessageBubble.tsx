import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { avatarDataUrl } from "../utils/avatar";
import { ImageLightbox } from "./ImageLightbox";

export type Message = {
  _id: string;
  text: string;
  author: string;
  authorId: string;
  timestamp: number;
  avatarSeed: string;
  likes: string[];
  parentId?: string;
  replyCount?: number;
  imageUrl?: string | null;
};

interface Props {
  message: Message;
  isOwn: boolean;
  likedByMe: boolean;
  onLike: () => void;
  onThreadReply?: () => void;
  onDelete?: () => void;
  /** True when same author sent the previous message within 5 min — hides avatar/name */
  grouped?: boolean;
  currentUserName?: string;
}

function getHeat(timestamp: number): "hot" | "warm" | "cold" {
  const age = Date.now() - timestamp;
  if (age < 2.5 * 60 * 1000) return "hot";
  if (age < 5 * 60 * 1000) return "warm";
  return "cold";
}

function formatAge(timestamp: number): string {
  const secs = Math.floor((Date.now() - timestamp) / 1000);
  if (secs < 30) return "just now";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string }
  | { type: "mention"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

function tokenize(text: string): TextPart[] {
  const parts: TextPart[] = [];
  // Order: code first (to avoid bold/italic inside code), then URLs, then mentions, then bold/italic
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]|@[\w\-]+/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    if (match.index! > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    const full = match[0];
    if (match[1] !== undefined) parts.push({ type: "code", value: match[1] });
    else if (match[2] !== undefined) parts.push({ type: "bold", value: match[2] });
    else if (match[3] !== undefined) parts.push({ type: "italic", value: match[3] });
    else if (full.startsWith("@")) parts.push({ type: "mention", value: full });
    else parts.push({ type: "link", value: full });
    last = match.index! + full.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

function MessageText({ text, textColor, currentUserName }: { text: string; textColor: string; currentUserName?: string }) {
  const parts = tokenize(text);
  return (
    <span className={`text-[13px] ${textColor} break-words`}>
      {parts.map((p, i) => {
        if (p.type === "link") {
          return (
            <a
              key={i}
              href={p.value}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-amber-300/50 text-amber-300 hover:text-amber-200 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {p.value}
            </a>
          );
        }
        if (p.type === "mention") {
          const isMe = currentUserName && p.value.slice(1).toLowerCase() === currentUserName.toLowerCase();
          return (
            <span
              key={i}
              className={`font-bold rounded px-0.5 ${isMe ? "text-fire-ember bg-fire-ember/15" : "text-fire-glow/90"}`}
            >
              {p.value}
            </span>
          );
        }
        if (p.type === "bold") return <strong key={i} className="font-bold">{p.value}</strong>;
        if (p.type === "italic") return <em key={i} className="italic">{p.value}</em>;
        if (p.type === "code") {
          return (
            <code key={i} className="font-mono text-[12px] bg-fire-ash/60 text-fire-smoke px-1 py-0.5 rounded">
              {p.value}
            </code>
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </span>
  );
}

export function MessageBubble({ message, isOwn, likedByMe, onLike, onThreadReply, onDelete, grouped, currentUserName }: Props) {
  const heat = getHeat(message.timestamp);
  const avatarUrl = avatarDataUrl(message.avatarSeed);
  const ageStr = formatAge(message.timestamp);
  const [lightbox, setLightbox] = useState(false);

  const nameColor =
    heat === "hot" ? "text-fire-ember" : heat === "warm" ? "text-fire-glow/85" : "text-fire-smoke/70";
  const textColor = heat === "cold" ? "text-white/55" : "text-white/90";
  const borderColor =
    heat === "hot" ? "border-l-fire-ember/60" : isOwn ? "border-l-fire-glow/20" : "border-l-transparent";

  const hasLikes = message.likes.length > 0;
  const hasReplies = (message.replyCount ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: heat === "cold" ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`flex items-start gap-2 px-2 rounded-sm group hover:bg-fire-ash/10 border-l-2 transition-colors ${borderColor} ${isOwn ? "bg-fire-ash/5" : ""} ${grouped ? "py-[1px]" : "py-[3px]"}`}
      data-testid="message-bubble"
    >
      {/* Avatar: hidden for grouped messages, replaced by spacer */}
      {grouped ? (
        <div className="w-4 flex-shrink-0" />
      ) : (
        <Avatar url={avatarUrl} name={message.author} size={16} className="mt-[3px] flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0 leading-snug">
        {/* Author line: hidden when grouped */}
        {!grouped && (
          <>
            <span className={`font-mono text-[10px] font-bold mr-1.5 ${nameColor}`}>
              {message.author}
            </span>
            <span className="font-mono text-[9px] text-fire-smoke/55 mr-1.5">{ageStr}</span>
            {heat === "hot" && (
              <motion.span
                className="text-[9px] mr-1"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                🔥
              </motion.span>
            )}
          </>
        )}
        {message.text && <MessageText text={message.text} textColor={textColor} currentUserName={currentUserName} />}
        {message.imageUrl && (
          <div className="mt-1.5">
            <img
              src={message.imageUrl}
              alt="shared image"
              onClick={() => setLightbox(true)}
              className={`max-w-[220px] max-h-[200px] rounded-lg object-cover border border-fire-char/20 cursor-zoom-in ${heat === "cold" ? "opacity-35" : "opacity-85"}`}
              data-testid="message-image"
            />
          </div>
        )}
        {lightbox && message.imageUrl && (
          <ImageLightbox src={message.imageUrl} onClose={() => setLightbox(false)} />
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <motion.button
          onClick={onLike}
          whileTap={{ scale: 0.8 }}
          aria-label="Like message"
          title="Like"
          className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono transition-all duration-150 ${
            likedByMe
              ? "text-fire-ember opacity-100"
              : hasLikes
              ? "text-fire-glow/90 hover:text-fire-ember opacity-100"
              : "text-fire-smoke/30 hover:text-fire-ember/80 group-hover:opacity-100 opacity-30"
          }`}
        >
          <span>{likedByMe ? "🔥" : "🕯️"}</span>
          {hasLikes && <span className="font-bold tabular-nums">{message.likes.length}</span>}
        </motion.button>

        {onThreadReply && (
          <motion.button
            onClick={onThreadReply}
            whileTap={{ scale: 0.8 }}
            aria-label="Reply in thread"
            title="Reply in thread"
            className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono transition-all duration-150 ${
              hasReplies
                ? "text-fire-glow/90 hover:text-fire-glow opacity-100"
                : "text-fire-smoke/30 hover:text-fire-glow/80 group-hover:opacity-100 opacity-30"
            }`}
          >
            <span>💬</span>
            {hasReplies && <span className="font-bold tabular-nums">{message.replyCount}</span>}
          </motion.button>
        )}

        {onDelete && (
          <motion.button
            onClick={onDelete}
            whileTap={{ scale: 0.8 }}
            aria-label="Delete message"
            title="Delete"
            className="flex items-center px-1 py-0.5 rounded text-[10px] font-mono text-fire-smoke/30 hover:text-fire-ember/80 opacity-0 group-hover:opacity-100 transition-all duration-150"
          >
            ✕
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
