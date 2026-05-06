import { Avatar } from "./Avatar";
import { avatarDataUrl } from "../utils/avatar";

// Keep in sync with convex/bots.ts
const BOT_LEADER = { userId: "bot_tribe_leader", name: "tribe-leader", avatarSeed: "bot-leader-fixed-seed" };
const BOT_BOUNCER = { userId: "bot_tribe_bouncer", name: "tribe-bouncer", avatarSeed: "bot-bouncer-fixed-seed" };

type Member = {
  userId: string;
  userName: string;
  avatarSeed: string;
};

interface Props {
  members: Member[];
  currentUserId: string;
}

function MemberEntry({
  userId,
  name,
  avatarSeed,
  isBot,
  isMe,
}: {
  userId: string;
  name: string;
  avatarSeed: string;
  isBot?: boolean;
  isMe?: boolean;
}) {
  const label = name.length > 6 ? name.slice(0, 5) + "…" : name;
  return (
    <div
      key={userId}
      className="flex flex-col items-center gap-0.5 px-1 py-1"
      title={name}
    >
      <div className={`rounded-lg p-0.5 ${isBot ? "ring-1 ring-fire-ember/60" : isMe ? "ring-1 ring-fire-glow/60" : ""}`}>
        <Avatar url={avatarDataUrl(avatarSeed)} name={name} size={30} />
      </div>
      <span
        className={`font-mono text-[8px] leading-tight text-center truncate w-full ${
          isBot ? "text-fire-ember/80" : isMe ? "text-fire-glow/80" : "text-fire-char/50"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function MemberList({ members, currentUserId }: Props) {
  const sorted = [...members].sort((a, b) => a.userName.localeCompare(b.userName));

  return (
    <div className="w-14 shrink-0 flex flex-col bg-[#020802] border-r border-fire-ash/15 overflow-y-auto overflow-x-hidden">
      <p className="font-mono text-[7px] text-fire-char/30 uppercase tracking-widest text-center pt-2 pb-1 shrink-0">
        Here
      </p>

      {/* Bot users always shown first */}
      <MemberEntry {...BOT_LEADER} name={BOT_LEADER.name} isBot />
      <MemberEntry {...BOT_BOUNCER} name={BOT_BOUNCER.name} isBot />

      {sorted.length > 0 && (
        <div className="mx-2 border-t border-fire-ash/15 my-1 shrink-0" />
      )}

      {/* Real members sorted alphabetically */}
      {sorted.map((m) => (
        <MemberEntry
          key={m.userId}
          userId={m.userId}
          name={m.userName}
          avatarSeed={m.avatarSeed}
          isMe={m.userId === currentUserId}
        />
      ))}
    </div>
  );
}
