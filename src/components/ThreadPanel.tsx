import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MessageBubble, type Message } from "./MessageBubble";
import { Avatar } from "./Avatar";
import { avatarDataUrl } from "../utils/avatar";

function formatAge(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 30) return "just now";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

interface Props {
  parentMessage: Message;
  tribeId: Id<"tribes">;
  currentUserId: string;
  currentUserName: string;
  avatarSeed: string;
  onClose: () => void;
  onLike: (messageId: string) => void;
}

export function ThreadPanel({
  parentMessage,
  tribeId,
  currentUserId,
  currentUserName,
  avatarSeed,
  onClose,
  onLike,
}: Props) {
  const replies = useQuery(api.messages.listThread, {
    parentId: parentMessage._id as Id<"messages">,
  });
  const sendMutation = useMutation(api.messages.send);
  const [value, setValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const parentAvatarUrl = avatarDataUrl(parentMessage.avatarSeed);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies?.length]);

  const submit = async () => {
    const text = value.trim();
    if (!text) return;
    setValue("");
    await sendMutation({
      tribeId,
      text,
      author: currentUserName,
      authorId: currentUserId,
      avatarSeed,
      parentId: parentMessage._id as Id<"messages">,
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col bg-[#050f05]/97 backdrop-blur-sm"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-fire-ember/20 bg-[#051a05]/80 backdrop-blur-md">
        <button
          onClick={onClose}
          className="font-mono text-xs text-fire-char/50 hover:text-fire-ember/80 transition-colors px-2 py-1 rounded-lg hover:bg-fire-ash/40"
        >
          ← Back
        </button>
        <span className="font-mono text-sm font-bold text-white flex-1">Thread</span>
        <span className="font-mono text-[10px] text-fire-char/40">
          {replies?.length ?? 0} {replies?.length === 1 ? "reply" : "replies"}
        </span>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-fire-char/10 bg-fire-ash/15">
        <div className="flex items-start gap-2">
          <Avatar
            url={parentAvatarUrl}
            name={parentMessage.author}
            size={20}
            className="mt-0.5 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] font-bold text-fire-glow mr-1.5">
              {parentMessage.author}
            </span>
            <span className="font-mono text-[9px] text-fire-char/40">{formatAge(parentMessage.timestamp)}</span>
            <div className="text-[13px] text-white/85 mt-0.5 leading-snug break-words">
              {parentMessage.text}
            </div>
            {parentMessage.imageUrl && (
              <img
                src={parentMessage.imageUrl}
                alt="shared image"
                className="mt-1.5 max-w-[200px] max-h-[160px] rounded-lg object-cover border border-fire-char/20 opacity-85"
              />
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-0.5 overscroll-contain">
        {(replies ?? []).length === 0 ? (
          <div className="text-center py-10 font-mono text-xs text-fire-char/40 uppercase tracking-widest">
            No replies yet
          </div>
        ) : (
          (replies ?? []).map((reply) => (
            <MessageBubble
              key={reply._id}
              message={reply as unknown as Message}
              isOwn={reply.authorId === currentUserId}
              likedByMe={(reply.likes ?? []).includes(currentUserId)}
              onLike={() => onLike(reply._id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 items-end px-3 py-3 border-t border-fire-ember/15 bg-[#051a05]/90 backdrop-blur-md"
      >
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Reply to thread..."
            rows={1}
            className="w-full bg-fire-ash/60 border border-fire-char/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-fire-char/40 font-mono resize-none outline-none focus:border-fire-ember/50 focus:ring-1 focus:ring-fire-ember/20 transition-all"
            style={{ minHeight: 44, maxHeight: 120, lineHeight: "1.5" }}
          />
        </div>
        <motion.button
          type="submit"
          disabled={!value.trim()}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-fire-ember text-white text-lg disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 transition-opacity"
          style={{ boxShadow: value.trim() ? "0 0 12px rgba(255,69,0,0.5)" : "none" }}
          aria-label="Send reply"
        >
          🔥
        </motion.button>
      </form>
    </motion.div>
  );
}
