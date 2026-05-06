import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Props {
  onSend: (text: string, storageId?: Id<"_storage">) => void;
  disabled?: boolean;
  tribeName: string;
  tribeId?: Id<"tribes">;
  userId?: string;
}

export function MessageInput({ onSend, disabled, tribeName, tribeId, userId }: Props) {
  const [value, setValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const setTypingMutation = useMutation(api.typing.setTyping);

  const sendTypingSignal = useCallback((isTyping: boolean) => {
    if (!tribeId || !userId) return;
    void setTypingMutation({ tribeId, userId, userName: tribeName, isTyping });
  }, [tribeId, userId, tribeName, setTypingMutation]);

  // Clear typing on unmount
  useEffect(() => {
    return () => {
      sendTypingSignal(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [sendTypingSignal]);

  const submit = useCallback(async () => {
    const text = value.trim();
    if ((!text && !imageFile) || disabled || uploading) return;
    setUploading(true);
    setError(null);
    try {
      let storageId: Id<"_storage"> | undefined;
      if (imageFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const json = (await res.json()) as { storageId?: Id<"_storage"> };
        if (!json.storageId) throw new Error("Upload returned no storageId");
        storageId = json.storageId;
      }
      const sendResult = onSend(text, storageId) as unknown;
      setValue("");
      setImageFile(null);
      setImagePreview(null);
      sendTypingSignal(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      inputRef.current?.focus();
      if (sendResult && typeof (sendResult as Promise<unknown>).then === "function") {
        (sendResult as Promise<unknown>).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to send");
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setUploading(false);
    }
  }, [value, imageFile, disabled, uploading, generateUploadUrl, onSend, sendTypingSignal]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    e.preventDefault();
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const canSend = Boolean(value.trim() || imageFile) && !uploading;

  return (
    <motion.form
      onSubmit={onSubmit}
      className="sticky bottom-0 flex flex-col gap-2 px-3 py-3 border-t border-fire-ember/15 bg-[#051a05]/90 backdrop-blur-md"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="text-[11px] text-fire-ember font-mono px-2 py-1 rounded-md bg-fire-ember/10 border border-fire-ember/30"
          >
            ⚠ {error}
          </motion.div>
        )}
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative w-fit"
          >
            <img
              src={imagePreview}
              alt="preview"
              className="max-h-[120px] max-w-[180px] rounded-lg object-cover border border-fire-char/30"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-fire-ash border border-fire-char/40 text-white text-[10px] flex items-center justify-center hover:bg-fire-ember/80 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-11 h-11 flex items-center justify-center rounded-xl border border-fire-char/30 text-fire-char/50 hover:text-fire-glow/70 hover:border-fire-char/50 transition-colors flex-shrink-0 disabled:opacity-30"
          aria-label="Attach image"
        >
          📷
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (e.target.value.trim()) {
                sendTypingSignal(true);
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => sendTypingSignal(false), 3000);
              } else {
                sendTypingSignal(false);
              }
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={`${tribeName} says...`}
            disabled={disabled || uploading}
            rows={1}
            aria-label="Message input"
            className="w-full bg-fire-ash/60 border border-fire-char/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-fire-char/40 font-mono resize-none outline-none focus:border-fire-ember/50 focus:ring-1 focus:ring-fire-ember/20 transition-all disabled:opacity-40"
            style={{ minHeight: 44, maxHeight: 120, lineHeight: "1.5" }}
          />
        </div>

        <motion.button
          type="submit"
          disabled={disabled || !canSend}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-fire-ember text-white text-lg disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 transition-opacity"
          style={{
            boxShadow: canSend ? "0 0 12px rgba(255,69,0,0.5)" : "none",
          }}
          aria-label="Send message"
        >
          {uploading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="text-sm"
            >
              ⏳
            </motion.span>
          ) : (
            "🔥"
          )}
        </motion.button>
      </div>
    </motion.form>
  );
}
