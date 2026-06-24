import { createContext, useContext } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

// Type coming from the backend
/**
 * You are automatically deriving the TypeScript type from your backend tRPC router:

AppRouter → your full API
"voices" → voices router
"getAll" → query
"custom" → custom voices array
[number] → a single voice item inside that array
So TTSVoiceItem is:

👉 the shape of one custom voice returned by:

voices.getAll

Example:

{
  "id": "abc",
  "name": "Narrator",
  "description": "Calm voice",
  "category": "GENERAL",
  "language": "en-US",
  "variant": "CUSTOM"
}
 */
type TTSVoiceItem =
  inferRouterOutputs<AppRouter>["voices"]["getAll"]["custom"][number] |
  inferRouterOutputs<AppRouter>["voices"]["getAll"]["system"][number];


// Context type definition
interface TTSVoicesContextValue {
  customVoices: TTSVoiceItem[];
  systemVoices: TTSVoiceItem[];
  allVoices: TTSVoiceItem[];
}

// Creating the context
const TTSVoicesContext = createContext<TTSVoicesContextValue | null>(null);

// Provider Component: The wrapper to put around our app
// This makes the VOICE CONTEXT available anywhere in the component tree
export function TTSVoicesProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TTSVoicesContextValue;
}) {
  return (
    <TTSVoicesContext.Provider value={value}>
      {children}
    </TTSVoicesContext.Provider>
  );
}


// Consuming the context
export function useTTSVoices() {
  const context = useContext(TTSVoicesContext);

  if (!context) {
    throw new Error("useTTSVoices must be used within a TTSVoicesProvider");
  }

  return context;
}

// Anywhere in my app i can do: 
//      - const { customVoices, systemVoices, allVoices } = useTTSVoices();