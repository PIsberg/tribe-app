import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble, type Message } from "./MessageBubble";
import { TribeAd } from "./TribeAd";

interface Props {
  messages: Message[];
  currentUserId: string;
  onLike: (messageId: string) => void;
  onThreadReply: (messageId: string) => void;
}

const AD_INTERVAL = 7;

export function ChatFeed({ messages, currentUserId, onLike, onThreadReply }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only show top-level messages (no parentId) in the main feed
  const topLevel = messages.filter((m) => !m.parentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [topLevel.length]);

  if (topLevel.length === 0) {
    return (
      <motion.div
        data-testid="chat-feed"
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
        <p className="font-mono text-xs text-fire-char/40 mt-1">Be the first to speak</p>
      </motion.div>
    );
  }

  const items: Array<{ type: "message"; data: Message } | { type: "ad"; key: string }> = [];
  topLevel.forEach((msg, i) => {
    items.push({ type: "message", data: msg });
    if ((i + 1) % AD_INTERVAL === 0 && i < topLevel.length - 1) {
      items.push({ type: "ad", key: `ad-${i}` });
    }
  });

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto px-1 py-2 overscroll-contain"
      data-testid="chat-feed"
    >
      <div className="flex-1" />
      <div className="space-y-0.5">
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
              onThreadReply={() => onThreadReply(item.data._id)}
            />
          )
        )}
      </AnimatePresence>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
