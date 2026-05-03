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

export function MessageBubble({ message, isOwn, likedByMe, onLike, onThreadReply }: Props) {
  const heat = getHeat(message.timestamp);
  const avatarUrl = avatarDataUrl(message.avatarSeed);
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const nameColor =
    heat === "hot" ? "text-fire-ember" : heat === "warm" ? "text-fire-glow/70" : "text-fire-char/45";
  const textColor = heat === "cold" ? "text-white/35" : "text-white/85";
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
        <span className="font-mono text-[9px] text-fire-char/35 mr-1.5">{timeStr}</span>
        {heat === "hot" && (
          <motion.span
            className="text-[9px] mr-1"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            🔥
          </motion.span>
        )}
        <span className={`text-[13px] ${textColor} break-words`}>{message.text}</span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <motion.button
          onClick={onLike}
          whileTap={{ scale: 0.8 }}
          className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono transition-colors ${
            likedByMe
              ? "text-fire-ember"
              : hasLikes
              ? "text-fire-char/50 hover:text-fire-ember/70"
              : "opacity-0 group-hover:opacity-100 text-fire-char/35 hover:text-fire-ember/60"
          }`}
        >
          <span>{likedByMe ? "🔥" : "🕯️"}</span>
          {hasLikes && <span>{message.likes.length}</span>}
        </motion.button>

        {onThreadReply && (
          <motion.button
            onClick={onThreadReply}
            whileTap={{ scale: 0.8 }}
            className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono transition-colors ${
              hasReplies
                ? "text-fire-glow/60 hover:text-fire-glow"
                : "opacity-0 group-hover:opacity-100 text-fire-char/35 hover:text-fire-glow/60"
            }`}
          >
            <span>💬</span>
            {hasReplies && <span>{message.replyCount}</span>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
