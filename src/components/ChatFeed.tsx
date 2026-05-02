import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble, type Message } from "./MessageBubble";
import { TribeAd } from "./TribeAd";

interface Props {
  messages: Message[];
  currentUserId: string;
  onLike: (messageId: string) => void;
}

const AD_INTERVAL = 7;

export function ChatFeed({ messages, currentUserId, onLike }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <motion.div
        className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="text-4xl mb-4"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.div>
        <p className="font-mono text-sm text-fire-char/60 uppercase tracking-widest">
          The fire is lit
        </p>
        <p className="font-mono text-xs text-fire-char/40 mt-1">
          Be the first to speak
        </p>
      </motion.div>
    );
  }

  const items: Array<{ type: "message"; data: Message } | { type: "ad"; key: string }> = [];
  messages.forEach((msg, i) => {
    items.push({ type: "message", data: msg });
    if ((i + 1) % AD_INTERVAL === 0 && i < messages.length - 1) {
      items.push({ type: "ad", key: `ad-${i}` });
    }
  });

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 overscroll-contain" data-testid="chat-feed">
      <AnimatePresence initial={false}>
        {items.map((item) =>
          item.type === "ad" ? (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <TribeAd />
            </motion.div>
          ) : (
            <MessageBubble
              key={item.data._id}
              message={item.data}
              isOwn={item.data.authorId === currentUserId}
              likedByMe={(item.data.likes ?? []).includes(currentUserId)}
              onLike={() => onLike(item.data._id)}
            />
          )
        )}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
