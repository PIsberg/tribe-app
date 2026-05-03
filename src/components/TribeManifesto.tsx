import { TribeAd } from "./TribeAd";

export function TribeManifesto() {
  return (
    <section
      className="px-6 py-10 mt-8 border-t border-fire-ember/10 max-w-2xl mx-auto text-left"
      aria-label="Tribe Manifesto"
    >
      <h2 className="font-mono text-sm uppercase tracking-widest text-fire-ember/60 mb-4">
        The Tribe Manifesto
      </h2>
      <div className="space-y-4 text-sm text-fire-char/70 leading-relaxed font-mono">
        <p>
          <strong className="text-fire-glow">tribe</strong> is not an app. It is a
          fire. It exists only when people gather, only for those close enough to
          feel the heat, and only for as long as they stay.
        </p>
        <p>
          No accounts. No history. No algorithm. The moment you step outside the
          circle, the fire forgets you existed. Every message burns away within
          thirty minutes. What is said around this fire stays here — and then it
          is gone.
        </p>
        <p>
          You are given a name by the tribe. It is yours for tonight: a pairing
          of electricity and instinct, of the digital and the primal. Wear it
          well.
        </p>
        <p>
          This is hyper-local by design. The geofence is not a bug — it is the
          point. To be here, you had to{" "}
          <em className="text-fire-glow">physically show up</em>. That matters.
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-fire-char/10">
        <h3 className="font-mono text-xs uppercase tracking-widest text-fire-char/40 mb-3">
          About this Location
        </h3>
        <p className="text-xs text-fire-char/40 font-mono leading-relaxed">
          This campfire is anchored to a real-world coordinate. Within 300 meters
          of that point, the inner circle opens. The conversation is live,
          ephemeral, and belongs entirely to the people in this physical space.
          All messages self-destruct. No logs are kept.
        </p>
      </div>

      <div className="mt-8">
        <TribeAd slot={import.meta.env.VITE_ADSENSE_SLOT_MANIFESTO} />
      </div>
    </section>
  );
}
