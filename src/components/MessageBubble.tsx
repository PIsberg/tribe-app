import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { avatarDataUrl } from "../utils/avatar";

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

function MessageText({ text, textColor }: { text: string; textColor: string }) {
  const parts: Array<{ type: "text" | "link"; value: string }> = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/g)) {
    if (match.index! > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "link", value: match[0] });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });

  return (
    <span className={`text-[13px] ${textColor} break-words`}>
      {parts.map((p, i) =>
        p.type === "link" ? (
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
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  );
}

export function MessageBubble({ message, isOwn, likedByMe, onLike, onThreadReply }: Props) {
  const heat = getHeat(message.timestamp);
  const avatarUrl = avatarDataUrl(message.avatarSeed);
  const ageStr = formatAge(message.timestamp);

  const nameColor =
    heat === "hot" ? "text-fire-ember" : heat === "warm" ? "text-fire-glow/85" : "text-fire-smoke/70";
  const textColor = heat === "cold" ? "text-white/55" : "text-white/90";
  const borderColor =
    heat === "hot" ? "border-l-fire-ember/60" : isOwn ? "border-l-fire-glow/20" : "border-l-transparent";

  const hasLikes = message.likes.length > 0;
  const hasReplies = (message.replyCount ?? 0) > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: heat === "cold" ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`flex items-start gap-2 px-2 py-[3px] rounded-sm group hover:bg-fire-ash/10 border-l-2 transition-colors ${borderColor} ${isOwn ? "bg-fire-ash/5" : ""}`}
      data-testid="message-bubble"
    >
      <Avatar url={avatarUrl} name={message.author} size={16} className="mt-[3px] flex-shrink-0" />

      <div className="flex-1 min-w-0 leading-snug">
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
        {message.text && <MessageText text={message.text} textColor={textColor} />}
        {message.imageUrl && (
          <div className="mt-1.5">
            <img
              src={message.imageUrl}
              alt="shared image"
              className={`max-w-[220px] max-h-[200px] rounded-lg object-cover border border-fire-char/20 ${heat === "cold" ? "opacity-35" : "opacity-85"}`}
            />
          </div>
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
              : "text-fire-smoke/70 hover:text-fire-ember/80 opacity-0 group-hover:opacity-100"
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
                : "text-fire-smoke/70 hover:text-fire-glow/80 opacity-0 group-hover:opacity-100"
            }`}
          >
            <span>💬</span>
            {hasReplies && <span className="font-bold tabular-nums">{message.replyCount}</span>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
