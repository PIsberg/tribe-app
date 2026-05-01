import { motion } from "framer-motion";
import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  tribeName: string;
}

export function MessageInput({ onSend, disabled, tribeName }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      className="sticky bottom-0 flex gap-2 items-end px-3 py-3 border-t border-fire-ember/15 bg-[#051a05]/90 backdrop-blur-md"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`${tribeName} says...`}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
          className="w-full bg-fire-ash/60 border border-fire-char/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-fire-char/40 font-mono resize-none outline-none focus:border-fire-ember/50 focus:ring-1 focus:ring-fire-ember/20 transition-all disabled:opacity-40"
          style={{ minHeight: 44, maxHeight: 120, lineHeight: "1.5" }}
        />
      </div>
      <motion.button
        type="submit"
        disabled={disabled || !value.trim()}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="w-11 h-11 flex items-center justify-center rounded-xl bg-fire-ember text-white text-lg disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 transition-opacity"
        style={{
          boxShadow: value.trim() ? "0 0 12px rgba(255,69,0,0.5)" : "none",
        }}
        aria-label="Send message"
      >
        🔥
      </motion.button>
    </motion.form>
  );
}
