// Keep in sync with convex/bots.ts
const BOT_NAMES = ["tribe-leader", "tribe-bouncer"];

type Member = {
  userId: string;
  userName: string;
};

interface Props {
  members: Member[];
  currentUserId: string;
}

export function MemberList({ members, currentUserId }: Props) {
  const sorted = [...members].sort((a, b) => a.userName.localeCompare(b.userName));

  return (
    <div className="w-28 shrink-0 flex flex-col bg-[#020802] border-r border-fire-ash/15 overflow-y-auto overflow-x-hidden py-2">
      <p className="font-mono text-[7px] text-fire-char/30 uppercase tracking-widest text-center pb-1 shrink-0">
        Here
      </p>

      {/* Bot users — always present */}
      {BOT_NAMES.map((name) => (
        <div
          key={name}
          className="px-2 py-0.5"
          title={`@${name}`}
        >
          <span className="font-mono text-[9px] text-fire-ember/70 truncate block leading-snug">
            @{name}
          </span>
        </div>
      ))}

      {sorted.length > 0 && (
        <div className="mx-2 border-t border-fire-ash/15 my-1 shrink-0" />
      )}

      {/* Real members */}
      {sorted.map((m) => (
        <div key={m.userId} className="px-2 py-0.5" title={m.userName}>
          <span
            className={`font-mono text-[9px] truncate block leading-snug ${
              m.userId === currentUserId ? "text-fire-glow/80" : "text-fire-char/50"
            }`}
          >
            {m.userName}
          </span>
        </div>
      ))}
    </div>
  );
}
