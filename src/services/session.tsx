import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, cloudDemo } from "./firebase";
import { friendlyError } from "@/lib/presentation";
export type Profile = {
  id: string;
  name: string;
  role: "aluno" | "instrutor" | "admin";
  region?: string;
  price?: number;
  car?: string;
  transmission?: string;
  bio?: string;
  specialty?: string;
  approval?: string;
  credential?: string;
  credentialExpires?: number;
  suspendedUntil?: number;
  periods?: { day: number; from: number; to: number }[];
  blocks?: string[];
  favorites?: string[];
  slots?: number[];
  adminAlert?: boolean;
  cancellations?: number;
  absences?: number;
  approvalReason?: string;
  photoPath?: string | null;
  eligible?: boolean;
  featured?: boolean;
  // Fim da aula em andamento do instrutor (null quando livre).
  busyUntil?: number | null;
  identity?: {
    status: string;
    photoPath?: string;
    documentPath?: string;
    submittedAt?: number;
    reviewedAt?: number;
    reviewedBy?: string;
    reason?: string;
  };
};
export type Booking = {
  id: string;
  student: string;
  instructor: string;
  start: number;
  duration: number;
  price: number;
  commission: number;
  status: string;
  paid: boolean;
  location: string;
  address?: {
    cep: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    uf: string;
  };
  groupId?: string;
  lessonNumber?: number;
  lessonCount?: number;
  groupPrice?: number;
  startCodeRequired?: boolean;
  startConfirmation?: {
    status: string;
    code?: string;
    attempts?: number;
    availableAt: number;
    expiresAt: number;
    confirmedAt?: number;
    confirmedBy?: string;
  };
  payoutEligible: boolean;
  studentConfirmed?: boolean;
  ratings?: Record<string, number>;
  proposal?: { start: number; by: string };
  disputeOpen?: boolean;
  refund?: number;
  refundStatus?: string;
  cancelledBy?: string;
  // instructor_timeout | payment_timeout | instructor | student
  cancelReason?: string;
  // Calculado pelo servidor: pago, início validado e antes do término.
  inProgress?: boolean;
};
export type Review = {
  id: string;
  booking?: string;
  from?: string;
  to: string;
  rating: number;
  comment: string;
};
export type Ticket = {
  id: string;
  booking?: string;
  owner: string;
  kind: string;
  reason: string;
  status: string;
  decision?: string;
};
export type State = {
  demo?: { scope: string; clockOffset?: number };
  demoClockActive?: boolean;
  operationError?: string;
  unreadCount?: number;
  me: Profile | null;
  users: Record<string, Profile>;
  bookings: Record<string, Booking>;
  reviews: Record<string, Review>;
  notifications: Record<
    string,
    {
      id: string;
      recipient: string;
      booking: string;
      event: string;
      title: string;
      at: number;
      readAt: number | null;
    }
  >;
  conversations: Record<
    string,
    {
      id: string;
      student: string;
      instructor: string;
      tag: "AGENDADO" | "SEM AGENDAMENTO";
    }
  >;
  messages: {
    id: string;
    from: string;
    to: string;
    text: string;
    at: number;
    readAt?: number;
  }[];
  tickets: Record<string, Ticket>;
  audit: { id: string; by: string; op: string; at: number }[];
  now: number;
};
const invoke = httpsCallable<{ op: string; input: unknown }, State>(
  functions,
  "conduz",
);
type API = {
  user: User | null;
  state: State | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  clear: () => void;
  run: (op: string, input?: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
};
const Context = createContext<API>(null!);
export function Session({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  // seq: só a resposta da chamada mais recente atualiza a tela (polling não sobrescreve ação nova).
  // inFlight: trava síncrona contra toque duplo, antes de o estado `busy` renderizar.
  const seq = useRef(0),
    inFlight = useRef(false);
  async function refresh() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const mine = ++seq.current;
    try {
      const r = await invoke({ op: "state", input: {} });
      if (auth.currentUser?.uid !== uid || mine !== seq.current) return;
      setState(r.data);
      setError("");
    } catch {
      if (auth.currentUser?.uid !== uid || mine !== seq.current) return;
      setError(
        cloudDemo
          ? "Não foi possível acessar sua conta agora. Confira a conexão e tente novamente."
          : "Não foi possível conectar ao servidor. Confira a conexão e tente novamente em instantes.",
      );
    }
  }
  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setState(null);
        setNotice("");
        setError("");
        setLoading(true);
        if (u) await refresh();
        setLoading(false);
      }),
    [],
  );
  // Tempo real: o servidor grava signals/<ambiente> = { version } a cada alteração
  // (functions/index.js). O app escuta esse documento e, quando ele muda, busca o
  // estado pela Function, que filtra o que cada usuário pode ver. O estado em si
  // continua inacessível ao cliente pelas regras do Firestore.
  useEffect(() => {
    if (!user) return;
    let cancelled = false,
      unsubscribe = () => {},
      debounce: ReturnType<typeof setTimeout> | undefined;
    void user.getIdTokenResult().then((token) => {
      if (cancelled) return;
      const scope =
        typeof token.claims.stateScope === "string"
          ? token.claims.stateScope
          : "state";
      let first = true;
      unsubscribe = onSnapshot(
        doc(db, "signals", scope),
        () => {
          // O primeiro evento é o valor atual: o estado já foi carregado no login.
          if (first) {
            first = false;
            return;
          }
          clearTimeout(debounce);
          debounce = setTimeout(() => void refresh(), 150);
        },
        // Sem conexão com o listener: a verificação periódica abaixo cobre.
        () => {},
      );
    });
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      unsubscribe();
    };
  }, [user]);
  // Rede de segurança: verificação a cada 30 s e ao voltar para o app
  // (outra aba, celular desbloqueado), caso o listener tenha caído.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (!busy) void refresh();
    }, 30000);
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [user, busy]);
  async function run(op: string, input: unknown = {}) {
    if (inFlight.current) return false;
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    inFlight.current = true;
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await invoke({ op, input });
      if (auth.currentUser?.uid !== uid) return false;
      if (mine === seq.current) setState(r.data);
      // Marcar como lido não é uma "alteração" para o usuário: sem aviso de confirmação.
      setNotice(
        ["readMessages", "readNotification"].includes(op) ? "" : "Alteração salva.",
      );
      if (r.data.operationError) {
        setNotice("");
        setError(r.data.operationError);
        return false;
      }
      return true;
    } catch (e: unknown) {
      if (auth.currentUser?.uid !== uid) return false;
      setError(friendlyError(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        user,
        state,
        loading,
        busy,
        error,
        notice,
        clear: () => {
          setError("");
          setNotice("");
        },
        run,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
export const money = (cents = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const dateTime = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(ms);
