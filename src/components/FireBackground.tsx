import { motion } from "framer-motion";

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`;

export function FireBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#051a05]">
      {/* Film grain texture */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, backgroundSize: "200px 200px" }}
      />

      {/* Outer ambient glow */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[60vh] pointer-events-none"
        animate={{ opacity: [0.25, 0.45, 0.3, 0.5, 0.25] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,69,0,0.35) 0%, rgba(200,50,0,0.15) 50%, transparent 75%)",
        }}
      />

      {/* Inner fire core */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[40vh] pointer-events-none"
        animate={{ opacity: [0.4, 0.7, 0.5, 0.75, 0.4], scaleX: [1, 1.04, 0.97, 1.02, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{
          background:
            "radial-gradient(ellipse 50% 70% at 50% 100%, rgba(255,100,0,0.55) 0%, rgba(255,69,0,0.2) 45%, transparent 70%)",
        }}
      />

      {/* Left green vein */}
      <div
        className="absolute left-0 top-0 w-1/3 h-full pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(ellipse at 0% 40%, rgba(0,100,20,0.5) 0%, transparent 60%)",
        }}
      />
      {/* Right green vein */}
      <div
        className="absolute right-0 top-0 w-1/3 h-full pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(ellipse at 100% 60%, rgba(0,80,10,0.4) 0%, transparent 60%)",
        }}
      />

      {/* Sparks */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0 w-[2px] h-[2px] rounded-full bg-fire-glow pointer-events-none"
          style={{ left: `${20 + i * 15}%` }}
          animate={{
            y: [0, -(80 + i * 30), -(120 + i * 40)],
            x: [0, (i % 2 === 0 ? 1 : -1) * (10 + i * 5), (i % 2 === 0 ? -1 : 1) * 5],
            opacity: [0, 0.9, 0],
            scale: [1, 0.6, 0],
          }}
          transition={{
            duration: 2.5 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.7,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
