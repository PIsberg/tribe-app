import { useEffect, useRef } from "react";

const PUB_ID = import.meta.env.VITE_ADSENSE_PUB_ID ?? "ca-pub-XXXXXXXXXXXXXXXX";
const IS_REAL_PUB = !PUB_ID.includes("XXXX");

interface TribeAdProps {
  slot?: string;
  className?: string;
}

export function TribeAd({ slot = "auto", className = "" }: TribeAdProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_REAL_PUB || !ref.current) return;
    try {
      // @ts-expect-error adsbygoogle injected by AdSense script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // silently fail if AdSense not ready
    }
  }, []);

  return (
    <div
      className={`my-2 mx-1 rounded-xl border border-fire-ember/40 bg-[#0a1a0a] overflow-hidden ${className}`}
      style={{ boxShadow: "0 0 12px rgba(255,69,0,0.15), inset 0 0 20px rgba(0,0,0,0.4)" }}
    >
      {/* Label */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-fire-ember/20">
        <div className="w-1.5 h-1.5 rounded-full bg-fire-ember animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-fire-ember/70">
          Signal from the Outside
        </span>
      </div>

      {/* Ad unit */}
      <div ref={ref} className="px-3 py-3 min-h-[80px] flex items-center justify-center">
        {IS_REAL_PUB ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: 60 }}
            data-ad-client={PUB_ID}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          // Placeholder for development
          <div className="w-full text-center py-3">
            <p className="font-mono text-xs text-fire-char/60">
              [ AD PLACEHOLDER — configure VITE_ADSENSE_PUB_ID ]
            </p>
            <p className="font-mono text-[10px] text-fire-char/40 mt-1">
              Sponsored Beacon • {PUB_ID}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
