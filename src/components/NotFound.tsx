import { motion } from "framer-motion";

export function NotFound() {
  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#051a05] px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <div className="text-5xl mb-5 select-none">🌫️</div>
        <h2 className="font-mono text-2xl font-bold text-fire-ember mb-3 uppercase tracking-widest">
          Lost in the Smoke
        </h2>
        <p className="text-fire-char/70 text-sm max-w-xs font-mono mb-8">
          There's no fire here. This path leads nowhere.
        </p>
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-fire-ember/80 hover:text-fire-ember transition-colors border border-fire-ember/40 hover:border-fire-ember px-5 py-2.5 rounded-xl"
        >
          Back to the fire
        </a>
      </motion.div>
    </motion.div>
  );
}
