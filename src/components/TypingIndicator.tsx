import { motion, AnimatePresence } from "framer-motion";

interface Props {
  typers: string[];
}

export function TypingIndicator({ typers }: Props) {
  if (typers.length === 0) return null;

  const label =
    typers.length === 1
      ? `${typers[0]} is typing`
      : typers.length === 2
      ? `${typers[0]} and ${typers[1]} are typing`
      : `${typers[0]} and ${typers.length - 1} others are typing`;

  return (
    <AnimatePresence>
      <motion.div
        key="typing"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="px-4 pb-1"
        data-testid="typing-indicator"
      >
        <span className="font-mono text-[10px] text-fire-smoke/50 flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-fire-glow/60 inline-block"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </span>
          {label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
