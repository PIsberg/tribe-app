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
};

interface Props {
  message: Message;
  isOwn: boolean;
  likedByMe: boolean;
  onLike: () => void;
}

function getHeat(timestamp: number): "hot" | "warm" | "cold" {
  const age = Date.now() - timestamp;
  if (age < 2.5 * 60 * 1000) return "hot";
  if (age < 5 * 60 * 1000) return "warm";
  return "cold";
}

const HEAT_STYLES = {
  hot: {
    bubble: "bg-[#1a0a02] border-fire-ember/50 text-white",
    shadow: "0 0 12px rgba(255,69,0,0.35), 0 0 4px rgba(255,140,0,0.2)",
    name: "text-fire-glow",
  },
  warm: {
    bubble: "bg-[#110d0a] border-fire-char/40 text-white/80",
    shadow: "0 0 6px rgba(255,69,0,0.12)",
    name: "text-fire-char/80",
  },
  cold: {
    bubble: "bg-[#0d0d0d] border-fire-char/20 text-white/40",
    shadow: "none",
    name: "text-fire-char/40",
  },
};

export function MessageBubble({ message, isOwn, likedByMe, onLike }: Props) {
  const heat = getHeat(message.timestamp);
  const styles = HEAT_STYLES[heat];
  const avatarUrl = avatarDataUrl(message.avatarSeed);
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: heat === "cold" ? 0.5 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={`flex gap-2.5 items-end ${isOwn ? "flex-row-reverse" : ""}`}
      data-testid="message-bubble"
    >
      <Avatar url={avatarUrl} name={message.author} size={32} className="mb-0.5" />

      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[75%]`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wide ${styles.name}`}>
            {message.author}
          </span>
          <span className="font-mono text-[9px] text-fire-char/40">{timeStr}</span>
          {heat === "hot" && (
            <motion.span
              className="text-[10px]"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              🔥
            </motion.span>
          )}
        </div>
        <div
          className={`relative px-3.5 py-2 rounded-2xl border text-sm leading-relaxed ${styles.bubble}`}
          style={{ boxShadow: styles.shadow, borderRadius: isOwn ? "18px 4px 18px 18px" : "4px 18px 18px 18px" }}
        >
          {message.text}
        </div>

        {/* Like button */}
        <motion.button
          onClick={onLike}
          whileTap={{ scale: 0.8 }}
          className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
            likedByMe
              ? "bg-fire-ember/20 text-fire-ember border border-fire-ember/40"
              : "bg-fire-ash/20 text-fire-char/40 border border-fire-char/10 hover:text-fire-ember/60 hover:border-fire-ember/20"
          }`}
        >
          <span>{likedByMe ? "🔥" : "🕯️"}</span>
          {message.likes.length > 0 && <span>{message.likes.length}</span>}
        </motion.button>
      </div>
    </motion.div>
  );
}
