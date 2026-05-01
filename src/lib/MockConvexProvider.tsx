import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type MockMessage = {
  _id: string;
  text: string;
  author: string;
  authorId: string;
  timestamp: number;
  avatarSeed: string;
};

type Ctx = {
  messages: MockMessage[];
  sendMessage: (
    text: string,
    author: string,
    authorId: string,
    avatarSeed: string
  ) => void;
};

const MockCtx = createContext<Ctx | null>(null);

export function MockConvexProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<MockMessage[]>([]);

  // Auto-purge messages older than 30 minutes
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      setMessages((prev) => prev.filter((m) => m.timestamp > cutoff));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const sendMessage = useCallback(
    (text: string, author: string, authorId: string, avatarSeed: string) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text,
          author,
          authorId,
          timestamp: Date.now(),
          avatarSeed,
        },
      ]);
    },
    []
  );

  return (
    <MockCtx.Provider value={{ messages, sendMessage }}>
      {children}
    </MockCtx.Provider>
  );
}

export function useMockConvex(): Ctx {
  const ctx = useContext(MockCtx);
  if (!ctx) throw new Error("useMockConvex must be inside MockConvexProvider");
  return ctx;
}
