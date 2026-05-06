import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const EMOJIS = [
  "😀", "😂", "🤣", "😅", "😭", "😱", "🤔", "😤", "🥰", "😍",
  "😎", "🤩", "😴", "🤯", "🥳", "😏", "🫡", "🤗", "😬", "😶",
  "👍", "👎", "👏", "🙌", "💪", "🤝", "🫶", "✌️", "🤞", "🙏",
  "🔥", "💯", "❤️", "🎉", "💀", "🚀", "⭐", "🌟", "💎", "⚡",
  "🍕", "🎮", "🏆", "🎵", "👀", "💬", "💩", "🦄", "🐸", "🫠",
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 z-50 bg-[#0a1f0a] border border-fire-char/25 rounded-2xl p-2 shadow-xl"
      style={{ width: 240 }}
    >
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-[22px] h-[22px] flex items-center justify-center text-base rounded hover:bg-fire-ash/50 transition-colors leading-none"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
