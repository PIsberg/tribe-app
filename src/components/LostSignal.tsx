import { motion } from "framer-motion";

export function LostSignal() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#051a05] px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="text-5xl mb-5 select-none"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.8, repeat: 3, ease: "easeInOut" }}
        >
          📡
        </motion.div>
        <h2 className="font-mono text-2xl font-bold text-fire-ember mb-3 uppercase tracking-widest">
          Lost the Signal
        </h2>
        <p className="text-fire-char text-sm max-w-xs">
          You wandered outside the inner circle. Walk back to rejoin the tribe.
        </p>
      </motion.div>

      {/* Static / interference lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0, 0.15, 0, 0.1, 0] }}
        transition={{ duration: 0.5, repeat: 5, ease: "linear" }}
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,69,0,0.1) 3px, rgba(255,69,0,0.1) 4px)",
        }}
      />
    </motion.div>
  );
}
