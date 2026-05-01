import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type MockTribe = {
  _id: string;
  name: string;
  creatorId: string;
  lat: number;
  lng: number;
  createdAt: number;
};

export type MockMessage = {
  _id: string;
  tribeId: string;
  text: string;
  author: string;
  authorId: string;
  timestamp: number;
  avatarSeed: string;
};

type Ctx = {
  tribes: MockTribe[];
  createTribe: (name: string, creatorId: string, lat: number, lng: number) => MockTribe;
  getMessages: (tribeId: string) => MockMessage[];
  sendMessage: (
    tribeId: string,
    text: string,
    author: string,
    authorId: string,
    avatarSeed: string
  ) => void;
};

const MockCtx = createContext<Ctx | null>(null);

const TRIBES_KEY = "tribe:mock:tribes";
const TRIBE_TTL = 24 * 60 * 60 * 1000;
const MSG_TTL = 30 * 60 * 1000;

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function loadTribes(): MockTribe[] {
  try {
    const raw = localStorage.getItem(TRIBES_KEY);
    if (!raw) return [];
    const parsed: MockTribe[] = JSON.parse(raw);
    const cutoff = Date.now() - TRIBE_TTL;
    return parsed.filter((t) => t.createdAt > cutoff);
  } catch {
    return [];
  }
}

function saveTribes(tribes: MockTribe[]) {
  try {
    localStorage.setItem(TRIBES_KEY, JSON.stringify(tribes));
  } catch {
    // quota exceeded — non-fatal
  }
}

export function MockConvexProvider({ children }: { children: ReactNode }) {
  const [tribes, setTribes] = useState<MockTribe[]>(loadTribes);
  const [messages, setMessages] = useState<MockMessage[]>([]);

  // Persist tribes to localStorage whenever they change
  useEffect(() => {
    saveTribes(tribes);
  }, [tribes]);

  // Purge expired records periodically
  useEffect(() => {
    const id = setInterval(() => {
      const msgCutoff = Date.now() - MSG_TTL;
      const tribeCutoff = Date.now() - TRIBE_TTL;
      setMessages((prev) => prev.filter((m) => m.timestamp > msgCutoff));
      setTribes((prev) => prev.filter((t) => t.createdAt > tribeCutoff));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const createTribe = useCallback(
    (name: string, creatorId: string, lat: number, lng: number): MockTribe => {
      const tribe: MockTribe = {
        _id: makeId(),
        name: name.trim(),
        creatorId,
        lat,
        lng,
        createdAt: Date.now(),
      };
      setTribes((prev) => [...prev, tribe]);
      return tribe;
    },
    []
  );

  const getMessages = useCallback(
    (tribeId: string) => {
      const cutoff = Date.now() - MSG_TTL;
      return messages.filter((m) => m.tribeId === tribeId && m.timestamp > cutoff);
    },
    [messages]
  );

  const sendMessage = useCallback(
    (
      tribeId: string,
      text: string,
      author: string,
      authorId: string,
      avatarSeed: string
    ) => {
      setMessages((prev) => [
        ...prev,
        { _id: makeId(), tribeId, text, author, authorId, timestamp: Date.now(), avatarSeed },
      ]);
    },
    []
  );

  return (
    <MockCtx.Provider value={{ tribes, createTribe, getMessages, sendMessage }}>
      {children}
    </MockCtx.Provider>
  );
}

export function useMockConvex(): Ctx {
  const ctx = useContext(MockCtx);
  if (!ctx) throw new Error("useMockConvex must be inside MockConvexProvider");
  return ctx;
}
