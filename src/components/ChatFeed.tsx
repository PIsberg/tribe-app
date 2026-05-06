import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble, type Message } from "./MessageBubble";
import { TribeAd } from "./TribeAd";

interface Props {
  messages: Message[];
  currentUserId: string;
  currentUserName?: string;
  onLike: (messageId: string) => void;
  onThreadReply: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

const AD_INTERVAL = 7;
const SCROLL_THRESHOLD = 120;

export function ChatFeed({ messages, currentUserId, currentUserName, onLike, onThreadReply, onDeleteMessage }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevLengthRef = useRef(0);

  // Only show top-level messages (no parentId) in the main feed
  const topLevel = messages.filter((m) => !m.parentId);

  const isNearBottom = useCallback(() => {
    const el = feedRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
  }, []);

  // Track scroll position to show/hide the button
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = isNearBottom();
      setShowScrollBtn(!atBottom);
      if (atBottom) setUnreadCount(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  // Auto-scroll when new messages arrive — but only if already near bottom
  useEffect(() => {
    const newCount = topLevel.length - prevLengthRef.current;
    if (newCount > 0) {
      if (isNearBottom()) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setUnreadCount(0);
      } else {
        setUnreadCount((c) => c + newCount);
        setShowScrollBtn(true);
      }
    }
    prevLengthRef.current = topLevel.length;
  }, [topLevel.length, isNearBottom]);

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

  const GROUP_GAP_MS = 5 * 60 * 1000;
  const items: Array<{ type: "message"; data: Message; grouped: boolean } | { type: "ad"; key: string }> = [];
  topLevel.forEach((msg, i) => {
    const prev = topLevel[i - 1];
    const grouped =
      !!prev &&
      prev.authorId === msg.authorId &&
      msg.timestamp - prev.timestamp < GROUP_GAP_MS;
    items.push({ type: "message", data: msg, grouped });
    if ((i + 1) % AD_INTERVAL === 0 && i < topLevel.length - 1) {
      items.push({ type: "ad", key: `ad-${i}` });
    }
  });

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden">
      <div
        ref={feedRef}
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
                  <TribeAd
                    slot={import.meta.env.VITE_ADSENSE_SLOT_CHAT}
                    layoutKey="-gw-3+1f-3d+2z"
                  />
                </motion.div>
              ) : (
                <MessageBubble
                  key={item.data._id}
                  message={item.data}
                  isOwn={item.data.authorId === currentUserId}
                  likedByMe={(item.data.likes ?? []).includes(currentUserId)}
                  onLike={() => onLike(item.data._id)}
                  onThreadReply={() => onThreadReply(item.data._id)}
                  onDelete={
                    onDeleteMessage && item.data.authorId === currentUserId
                      ? () => onDeleteMessage(item.data._id)
                      : undefined
                  }
                  grouped={item.grouped}
                  currentUserName={currentUserName}
                />
              )
            )}
          </AnimatePresence>
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fire-ash border border-fire-ember/40 text-white font-mono text-xs shadow-lg hover:bg-fire-ash/80 transition-colors"
            data-testid="scroll-to-bottom"
          >
            {unreadCount > 0 && (
              <span className="bg-fire-ember text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
            <span>↓</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
