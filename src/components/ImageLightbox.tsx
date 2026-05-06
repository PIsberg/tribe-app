import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="Image lightbox"
        role="dialog"
        aria-modal="true"
      >
        <motion.img
          src={src}
          alt={alt ?? "shared image"}
          className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="lightbox-image"
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white text-lg hover:bg-black/80 transition-colors"
          aria-label="Close image"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
