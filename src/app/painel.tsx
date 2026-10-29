import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, listAll, getBytes } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { auth, storage } from "@/services/firebase";
import {
  useSession,
  money,
  dateTime,
  type Profile,
  type Booking,
  type Ticket,
} from "@/services/session";
import { ThemedText as Text } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { MenuRow } from "@/components/ui/menu-row";
import { UI } from "@/constants/theme";
import { panelStyles as s } from "@/constants/panel-styles";
import {
  IdentityPanel,
  IdentityAdmin,
  useImageUpload,
} from "@/components/identity-panel";
import { AddressForm } from "@/components/address-form";
import { StartConfirmation } from "@/components/start-confirmation";
import { emptyAddress } from "@/lib/cep";
import {
  homeTab,
  bookingFilters,
  matchesBooking,
  canReviewPeer,
  instructorList,
  instructorDashboard,
} from "@/lib/presentation";
const labels: Record<string, string> = {
  solicitado: "Solicitação enviada",
  aguardando_pagamento: "Aguardando pagamento",
  confirmado: "Aula confirmada",
  cancelado: "Cancelada",
  concluido: "Concluída",
  falta_aluno: "Falta do aluno",
  falta_instrutor: "Falta do instrutor",
};
const refundLabels: Record<string, string> = {
  pendente_simulado: "pendente (simulado)",
  concluido_simulado: "concluído (simulado)",
  nao_aplicavel: "não aplicável",
};
const tabIcons: Record<string, IconName> = {
  Início: "home",
  Agendamentos: "calendar",
  Mensagens: "message",
  Ocorrências: "shield",
  Perfil: "user",
};
const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const end = (b: Booking) => b.start + b.duration * 60000;
function Action({
  title,
  onPress,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { busy } = useSession();
  return (
    <Button
      title={title}
      disabled={busy}
      variant={danger ? "danger" : "secondary"}
      onPress={onPress}
      style={s.action}
    />
  );
}
function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.heading}>
      <Text style={s.title}>{title}</Text>
      {sub && <Text style={s.muted}>{sub}</Text>}
    </View>
  );
}
function RatingSummary({ uid }: { uid: string }) {
  const { state } = useSession();
  const reviews = Object.values(state?.reviews || {}).filter(
    (r) => r.to === uid,
  );
  return (
    <Text style={s.muted}>
      {reviews.length
        ? `★ ${(reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? "avaliação" : "avaliações"}`
        : "Ainda sem avaliações"}
    </Text>
  );
}
export default function Painel() {
  const api = useSession(),
    router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    instructor?: string;
    to?: string;
  }>();
  const [tab, setTab] = useState(params.tab || "Início");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [messageTo, setMessageTo] = useState(params.to);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    params.instructor || null,
  );
  const scrollRef = useRef<ScrollView>(null);
  const [searchKey, setSearchKey] = useState(0);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [
    tab,
    selected,
    participantId,
    showNotifications,
    api.state?.me?.identity?.status,
  ]);
  useEffect(() => setParticipantId(null), [api.user?.uid]);
  const openChat = (to: string) => {
    setParticipantId(null);
    setMessageTo(to);
    setTab("Mensagens");
  };
  const me = api.state?.me;
  if (api.loading)
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text>Conectando ao ConduzAPP…</Text>
      </View>
    );
  if (!api.user)
    return (
      <View style={s.center}>
        <Text>Entre para acessar sua conta.</Text>
        <Button title="Ir ao login" onPress={() => router.replace("/")} />
      </View>
    );
  if (!me)
    return (
      <SafeAreaView style={s.page}>
        <ScrollView contentContainerStyle={s.content}>
          <Heading
            title="Preparar perfil"
            sub={api.error || "Sua conta ainda não possui um perfil."}
          />
          <CompleteProfile />
          <Button title="Tentar novamente" onPress={api.refresh} />
          <Button title="Sair" onPress={() => signOut(auth)} />
        </ScrollView>
      </SafeAreaView>
    );
  const identityPending =
    me.role !== "admin" && me.identity?.status !== "aprovado";
  const tabs = identityPending
    ? ["Perfil"]
    : me.role === "admin"
      ? ["Início", "Ocorrências", "Agendamentos", "Perfil"]
      : ["Início", "Agendamentos", "Mensagens", "Perfil"];
  return (
    <SafeAreaView style={s.page}>
      <View style={s.top}>
        <View style={s.topInner}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="ConduzAPP — início"
            onPress={() => {
              api.clear();
              setTab(homeTab(me.role, identityPending));
              setSelected(null);
              setFavoritesOnly(false);
              setMessageTo(undefined);
              setParticipantId(null);
              setShowNotifications(false);
              setSearchKey((k) => k + 1);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          >
            <Text style={s.brand}>
              CONDUZ<Text style={s.brandAccent}> APP</Text>
            </Text>
          </TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Atualizar"
              onPress={api.refresh}
              style={s.iconButton}
            >
              <Icon name="refresh" color="white" size={20} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                "Notificações (" +
                Object.values(api.state!.notifications || {}).filter(
                  (n) => !n.readAt,
                ).length +
                ")"
              }
              accessibilityState={{ expanded: showNotifications }}
              onPress={() => setShowNotifications(!showNotifications)}
              style={s.iconButton}
            >
              <Icon name="bell" color="white" size={22} />
              {Object.values(api.state!.notifications || {}).some(
                (n) => !n.readAt,
              ) && <View style={s.notificationDot} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {!!api.error && (
        <View style={s.errorBox}>
          <Text style={s.error}>{api.error}</Text>
        </View>
      )}
      {api.state?.demoClockActive && (
        <View style={s.notice}>
          <Text>
            Relógio de ensaio ativo (administração) · {dateTime(api.state.now)}
          </Text>
          {me.role === "admin" && (
            <Button
              title="Restaurar relógio do ensaio"
              variant="secondary"
              onPress={async () => {
                if (await api.run("setDemoClock", { stage: "reset" }))
                  await api.refresh();
              }}
            />
          )}
        </View>
      )}
      {!!api.notice && (
        <TouchableOpacity onPress={api.clear} style={s.notice}>
          <Text style={s.link}>{api.notice}</Text>
        </TouchableOpacity>
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {showNotifications && (
          <Notifications
            goProfile={() => {
              setParticipantId(null);
              setTab("Perfil");
              setShowNotifications(false);
            }}
            goBookings={() => {
              setParticipantId(null);
              setTab("Agendamentos");
              setShowNotifications(false);
            }}
          />
        )}
        {identityPending ? (
          <View style={s.gap}>
            <Heading
              title="Seu cadastro está aguardando análise."
              sub="Complete a foto e a verificação de identidade. Reservas anteriores não foram canceladas; use o suporte para acompanhar ocorrências."
            />
            <Profile />
          </View>
        ) : me.role === "admin" ? (
          <Admin tab={tab} />
        ) : participantId ? (
          <ParticipantProfile
            uid={participantId}
            goBack={() => setParticipantId(null)}
            onChat={openChat}
          />
        ) : (
          <>
            {tab === "Início" &&
              (me.role === "aluno" ? (
                <Search
                  key={searchKey}
                  initialFavorites={favoritesOnly}
                  selected={selected}
                  select={setSelected}
                  onChat={openChat}
                  onProfile={setParticipantId}
                />
              ) : (
                <InstructorHome
                  goBookings={() => setTab("Agendamentos")}
                  onProfile={setParticipantId}
                />
              ))}
            {tab === "Agendamentos" && (
              <Bookings onProfile={setParticipantId} />
            )}
            {tab === "Avaliações" && (
              <ReviewsPage goBack={() => setTab("Perfil")} />
            )}
            {tab === "Mensagens" && (
              <Messages
                key={`${me.id}:${messageTo || ""}`}
                initialTo={messageTo}
                onProfile={(id) => {
                  setMessageTo(id);
                  setParticipantId(id);
                }}
                onOpen={() =>
                  scrollRef.current?.scrollTo({ y: 0, animated: false })
                }
              />
            )}
            {tab === "Perfil" && (
              <Profile
                navigate={(target) => {
                  if (target === "Notificações") {
                    setShowNotifications(true);
                    return;
                  }
                  setFavoritesOnly(target === "Favoritos");
                  setSelected(null);
                  setTab(target === "Favoritos" ? "Início" : target);
                }}
              />
            )}
          </>
        )}
      </ScrollView>
      <View style={s.tabs}>
        <View style={s.tabsInner}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t}
              accessibilityLabel={
                t === "Mensagens"
                  ? `Mensagens (${api.state?.unreadCount || 0} não lidas)`
                  : t
              }
              accessibilityRole="tab"
              accessibilityState={{
                selected:
                  (identityPending && t === "Perfil") ||
                  tab === t ||
                  (tab === "Avaliações" && t === "Perfil"),
              }}
              onPress={() => {
                api.clear();
                setTab(t);
                setSelected(null);
                setParticipantId(null);
                setFavoritesOnly(false);
                setShowNotifications(false);
              }}
              style={[
                s.tab,
                ((identityPending && t === "Perfil") ||
                  tab === t ||
                  (tab === "Avaliações" && t === "Perfil")) &&
                  s.tabActive,
              ]}
            >
              <View
                style={[
                  s.navIcon,
                  ((identityPending && t === "Perfil") ||
                    tab === t ||
                    (tab === "Avaliações" && t === "Perfil")) &&
                    s.navIconActive,
                ]}
              >
                <Icon
                  name={tabIcons[t]}
                  color={
                    (identityPending && t === "Perfil") ||
                    tab === t ||
                    (tab === "Avaliações" && t === "Perfil")
                      ? UI.color.primary
                      : UI.color.textSecondary
                  }
                  size={22}
                />
                {t === "Mensagens" && !!api.state?.unreadCount && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadText}>
                      {api.state.unreadCount > 99
                        ? "99+"
                        : api.state.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  s.tabLabel,
                  ((identityPending && t === "Perfil") ||
                    tab === t ||
                    (tab === "Avaliações" && t === "Perfil")) &&
                    s.tabLabelActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
function Notifications({
  goBookings,
  goProfile,
}: {
  goBookings: () => void;
  goProfile: () => void;
}) {
  const { state, run } = useSession();
  const list = Object.values(state!.notifications || {}).sort(
    (a, b) => b.at - a.at,
  );
  return (
    <View style={s.gap}>
      <Heading title="Notificações" sub="Avisos internos sobre suas aulas." />
      {!list.length && (
        <Text style={s.muted}>Nenhuma notificação por enquanto.</Text>
      )}
      {list.map((n) => (
        <Card key={n.id} style={s.gap}>
          <View style={s.sectionHeading}>
            <Icon name="bell" size={20} />
            <Text style={[s.cardTitle, s.flex]}>{n.title}</Text>
            <Badge
              title={n.readAt ? "Lida" : "Nova"}
              tone={n.readAt ? "neutral" : "primary"}
            />
          </View>
          <Text style={s.small}>
            {dateTime(n.at)} · {n.readAt ? "Lida" : "Não lida"}
          </Text>
          <Action
            title={n.event === "identity" ? "Ver perfil" : "Ver agendamentos"}
            onPress={n.event === "identity" ? goProfile : goBookings}
          />
          {!n.readAt && (
            <Action
              title="Marcar como lida"
              onPress={() => run("readNotification", { notification: n.id })}
            />
          )}
        </Card>
      ))}
    </View>
  );
}
function CompleteProfile() {
  const { run } = useSession();
  const [name, setName] = useState(""),
    [role, setRole] = useState<"aluno" | "instrutor">("aluno");
  return (
    <Card style={s.gap}>
      <Input label="Nome completo" value={name} onChangeText={setName} />
      <View style={s.row}>
        <Action title="Sou aluno" onPress={() => setRole("aluno")} />
        <Action title="Sou instrutor" onPress={() => setRole("instrutor")} />
      </View>
      <Button
        title={`Criar perfil de ${role}`}
        onPress={() => run("register", { name, role })}
      />
    </Card>
  );
}
const datePart = (time: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options,
  }).format(time);
const dayKey = (time: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
function Search({
  selected,
  select,
  onChat,
  onProfile,
  initialFavorites = false,
}: {
  selected: string | null;
  select: (id: string | null) => void;
  onChat: (id: string) => void;
  onProfile: (id: string) => void;
  initialFavorites?: boolean;
}) {
  const { state, run, busy } = useSession();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState(initialFavorites ? "favoritos" : "avulsas");
  const onlyFavorites = mode === "favoritos";
  const setOnlyFavorites = (value: boolean) =>
    setMode(value ? "favoritos" : "avulsas");
  const [lessonCount, setLessonCount] = useState(1);
  const [slot, setSlot] = useState<number | null>(null);
  const [chosenDay, setChosenDay] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [meetingAddress, setMeetingAddress] = useState({ ...emptyAddress });
  const me = state!.me!;
  const instructors = Object.values(state!.users).filter(
    (u) => u.role === "instrutor" && u.eligible,
  );
  const visible = instructorList(
    Object.values(state!.users),
    mode,
    search,
    me.favorites,
  );
  const u = selected ? state!.users[selected] : null;
  const availableSlots = (u?.slots || []).filter(
    (t) =>
      lessonCount === 1 ||
      ((u?.slots || []).includes(t + 3600000) &&
        dayKey(t) === dayKey(t + 3600000)),
  );
  const days = Array.from({ length: 7 }, (_, i) => state!.now + i * 86400000);
  const activeDay = days.some((d) => dayKey(d) === chosenDay)
    ? chosenDay
    : dayKey(u?.slots?.[0] || days[0]);
  const activeSlot =
    slot && availableSlots.includes(slot) && dayKey(slot) === activeDay
      ? slot
      : null;
  if (u)
    return (
      <View style={s.gap}>
        <View style={s.sectionHeading}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Voltar à busca"
            onPress={() => {
              select(null);
              setSlot(null);
              setChosenDay("");
              setShowDetails(false);
            }}
            style={s.iconButton}
          >
            <Icon name="back" size={22} />
          </TouchableOpacity>
          <Heading title="Novo agendamento" />
        </View>
        <Card style={s.gap}>
          <View style={s.instructor}>
            <Avatar foto={u.photoPath} nome={u.name} size={64} />
            <View style={s.flex}>
              <Text style={s.cardTitle}>{u.name}</Text>
              <Text style={s.muted}>
                {u.car || "Veículo não informado"} ·{" "}
                {u.transmission || "Câmbio não informado"}
              </Text>
              <RatingSummary uid={u.id} />
            </View>
          </View>
          <View style={s.row}>
            <Badge title="Credenciamento aprovado" tone="success" />
            <Text style={s.price}>
              {money(u.price)} <Text style={s.small}>/ 50 min</Text>
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails(!showDetails)}
            style={s.detailsToggle}
          >
            <Text style={s.link}>Perfil profissional</Text>
            <Icon name="chevron" size={15} />
          </TouchableOpacity>
          {showDetails && (
            <View style={s.gap}>
              <Text style={s.muted}>
                {u.region || "Região não informada"} ·{" "}
                {u.bio || "Perfil profissional de instrutor."}
              </Text>
              <Text style={s.small}>
                Autorização profissional analisada manualmente.
              </Text>
            </View>
          )}
          <View style={s.row}>
            <Action
              title="Conversar com o instrutor"
              onPress={async () => {
                if (await run("openConversation", { to: u.id })) onChat(u.id);
              }}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                (me.favorites || []).includes(u.id)
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"
              }
              onPress={() => run("favorite", { instructor: u.id })}
              style={s.favorite}
            >
              <Icon
                name="heart"
                color={
                  (me.favorites || []).includes(u.id)
                    ? UI.color.dangerText
                    : UI.color.primary
                }
              />
              <Text style={s.link}>
                {(me.favorites || []).includes(u.id)
                  ? "Favoritado"
                  : "Favoritar"}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
        <Button
          title="Perfil e avaliações do instrutor"
          variant="secondary"
          onPress={() => onProfile(u.id)}
        />
        <Card style={s.sectionCard}>
          <View style={s.row}>
            {[1, 2].map((count) => (
              <Button
                key={count}
                title={count === 1 ? "1 aula · 50 min" : "2 aulas · 2 × 50 min"}
                variant={lessonCount === count ? "primary" : "secondary"}
                onPress={() => {
                  setLessonCount(count);
                  setSlot(null);
                }}
              />
            ))}
          </View>
          <View style={s.sectionHeading}>
            <Icon name="calendar" />
            <Text style={s.cardTitle}>Selecionar data</Text>
          </View>
          <Text style={s.small}>Próximos sete dias · horário de Brasília</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dateStrip}
          >
            {days.map((day) => {
              const key = dayKey(day),
                available = availableSlots.some((time) => dayKey(time) === key);
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={
                    datePart(day, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }) + (available ? "" : ", sem horários")
                  }
                  accessibilityState={{
                    selected: key === activeDay,
                    disabled: !available,
                  }}
                  disabled={!available}
                  style={[
                    s.dateChip,
                    key === activeDay && s.slotActive,
                    !available && s.unavailable,
                  ]}
                  onPress={() => {
                    setChosenDay(key);
                    setSlot(null);
                  }}
                >
                  <Text style={[s.small, key === activeDay && s.white]}>
                    {datePart(day, { weekday: "short" }).replace(".", "")}
                  </Text>
                  <Text style={[s.dateNumber, key === activeDay && s.white]}>
                    {datePart(day, { day: "2-digit" })}
                  </Text>
                  <Text style={[s.small, key === activeDay && s.white]}>
                    {datePart(day, { month: "short" }).replace(".", "")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={s.divider} />
          <View style={s.sectionHeading}>
            <Icon name="clock" />
            <Text style={s.cardTitle}>Selecionar horário</Text>
          </View>
          <View style={s.row}>
            {availableSlots
              .filter((time) => dayKey(time) === activeDay)
              .map((time) => (
                <TouchableOpacity
                  key={time}
                  accessibilityRole="button"
                  accessibilityLabel={datePart(time, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  accessibilityState={{ selected: activeSlot === time }}
                  onPress={() => setSlot(time)}
                  style={[s.slot, activeSlot === time && s.slotActive]}
                >
                  <Text style={activeSlot === time ? s.white : s.link}>
                    {datePart(time, { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
          {!u.slots?.length && (
            <Text style={s.muted}>
              Nenhum horário disponível. O instrutor precisa configurar sua
              agenda.
            </Text>
          )}
          <View style={s.divider} />
          <AddressForm value={meetingAddress} onChange={setMeetingAddress} />
          <View style={s.summary}>
            <View style={s.flex}>
              <Text style={s.small}>
                {lessonCount}{" "}
                {lessonCount === 1 ? "aula" : "aulas consecutivas"} ·{" "}
                {lessonCount * 60} minutos
              </Text>
              <Text style={s.cardTitle}>
                {activeSlot ? dateTime(activeSlot) : "Selecione data e horário"}
              </Text>
            </View>
            <Text style={s.price}>{money((u.price || 0) * lessonCount)}</Text>
          </View>
          <Button
            title={
              activeSlot
                ? "Solicitar " +
                  lessonCount +
                  (lessonCount === 1 ? " aula · " : " aulas · ") +
                  money((u.price || 0) * lessonCount)
                : "Selecione um horário"
            }
            disabled={!activeSlot || busy}
            onPress={async () => {
              if (
                await run("book", {
                  instructor: u.id,
                  start: activeSlot,
                  lessonCount,
                  address: meetingAddress,
                })
              ) {
                setSlot(null);
                setChosenDay("");
                select(null);
              }
            }}
          />
          <Text style={s.small}>
            A solicitação depende do aceite do instrutor. O pagamento simulado
            fica disponível depois do aceite. Duas aulas são acompanhadas
            individualmente, com as regras existentes para cada aula.
          </Text>
        </Card>
        <Reviews uid={u.id} />
      </View>
    );
  return (
    <View style={s.gap}>
      <View style={s.welcome}>
        <Text style={s.title}>Olá, {me.name.split(" ")[0]}!</Text>
        <Text style={s.welcomeText}>
          {mode === "instrutores"
            ? "Lista completa de profissionais aptos a receber reservas."
            : "Encontre o instrutor ideal para suas aulas."}
        </Text>
      </View>
      <Input
        leadingIcon="search"
        placeholder="Buscar instrutor ou região…"
        accessibilityLabel="Buscar por nome ou região"
        value={search}
        onChangeText={setSearch}
      />
      <View style={s.quickFilters}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: !onlyFavorites }}
          onPress={() => setOnlyFavorites(false)}
          style={s.quickFilter}
        >
          <View style={[s.quickIcon, !onlyFavorites && s.quickIconActive]}>
            <Icon
              name="car"
              color={!onlyFavorites ? "#fff" : UI.color.primary}
              size={25}
            />
          </View>
          <Text style={s.quickLabel}>Aulas avulsas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: onlyFavorites }}
          onPress={() => setOnlyFavorites(true)}
          style={s.quickFilter}
        >
          <View style={[s.quickIcon, onlyFavorites && s.quickIconActive]}>
            <Icon
              name="heart"
              color={onlyFavorites ? "#fff" : UI.color.primary}
              size={25}
            />
          </View>
          <Text style={s.quickLabel}>Favoritos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setMode("instrutores");
            setSearch("");
          }}
          style={s.quickFilter}
        >
          <View style={s.quickIcon}>
            <Icon name="user" size={25} />
          </View>
          <Text style={s.quickLabel}>Instrutores</Text>
        </TouchableOpacity>
      </View>
      <View style={s.sectionHeading}>
        <Text style={[s.cardTitle, s.flex]}>
          {mode === "instrutores"
            ? "Todos os instrutores aprovados"
            : onlyFavorites
              ? "Seus favoritos"
              : instructors.some((u) => u.featured)
                ? "Instrutores em destaque"
                : "Instrutores disponíveis"}
        </Text>
        <Text style={s.small}>
          {visible.length}{" "}
          {visible.length === 1 ? "profissional" : "profissionais"}
        </Text>
      </View>
      {visible.map((u) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={"Ver perfil de " + u.name}
          key={u.id}
          onPress={() => {
            setSlot(null);
            setChosenDay("");
            select(u.id);
          }}
          activeOpacity={0.75}
        >
          <Card style={s.gap}>
            <View style={s.instructor}>
              <Avatar foto={u.photoPath} nome={u.name} size={58} />
              <View style={s.flex}>
                <Text style={s.cardTitle}>{u.name}</Text>
                <Text style={s.small}>
                  {u.region || "Região não informada"}
                </Text>
                <RatingSummary uid={u.id} />
              </View>
              <Icon name="chevron" size={18} />
            </View>
            <View style={s.vehicleLine}>
              <Icon name="car" size={18} color={UI.color.textSecondary} />
              <Text style={s.muted}>
                {u.car || "Veículo não informado"} ·{" "}
                {u.transmission || "Câmbio não informado"}
              </Text>
            </View>
            <View style={s.cardFooter}>
              <Text style={s.price}>
                {money(u.price)} <Text style={s.small}>/ aula</Text>
              </Text>
              <Text style={s.link}>Ver perfil e horários</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      {!visible.length && (
        <Card style={s.empty}>
          <Icon name={onlyFavorites ? "heart" : "search"} size={30} />
          <Text style={s.cardTitle}>
            {onlyFavorites
              ? "Seus favoritos ficam aqui"
              : "Nenhum instrutor encontrado"}
          </Text>
          <Text style={s.muted}>
            {onlyFavorites
              ? "Toque em Favoritar no perfil de um instrutor."
              : "Tente buscar por outro nome ou região."}
          </Text>
        </Card>
      )}
      <View style={s.trustNote}>
        <Icon name="shield" size={18} color={UI.color.textSecondary} />
        <Text style={[s.small, s.flex]}>
          Profissionais com credenciamento analisado pela administração.
        </Text>
      </View>
    </View>
  );
}
function InstructorHome({
  goBookings,
  onProfile,
}: {
  goBookings: () => void;
  onProfile: (id: string) => void;
}) {
  const { state } = useSession();
  const me = state!.me!;
  const list = Object.values(state!.bookings);
  const [showCredential, setShowCredential] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  // Dashboard: métricas calculadas no cliente a partir das reservas já projetadas pelo servidor.
  const d = instructorDashboard(list, me.id, state!.now);
  const metrics: [string | number, string][] = [
    [d.today, "Aulas hoje"],
    [d.week, "Próximos 7 dias"],
    [d.requests, "Solicitações"],
    [d.awaitingPayment, "Aguardando pagamento"],
    [d.completed, "Concluídas"],
    [d.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " h", "Horas ministradas"],
  ];
  return (
    <View style={s.gap}>
      <View style={s.welcome}>
        <Text style={s.title}>Olá, {me.name.split(" ")[0]}.</Text>
        <Text style={s.muted}>
          Organize sua agenda e acompanhe seus alunos.
        </Text>
      </View>
      <View style={s.row}>
        {metrics.map(([value, label]) => (
          <Card key={label} style={s.dashboardMetric}>
            <Text style={s.number}>{value}</Text>
            <Text>{label}</Text>
          </Card>
        ))}
      </View>
      <Card style={s.gapSmall}>
        <Text style={s.cardTitle}>Resumo financeiro</Text>
        <View style={s.row}>
          <View style={s.flex}>
            <Text style={s.price}>{money(d.earned)}</Text>
            <Text style={s.muted}>Líquido das aulas concluídas</Text>
          </View>
          <View style={s.flex}>
            <Text style={s.price}>{money(d.forecast)}</Text>
            <Text style={s.muted}>Previsto nas aulas pagas futuras</Text>
          </View>
        </View>
        <Text style={s.small}>
          Valores após a taxa de 12% da plataforma e eventuais estornos. Nenhum valor real
          é movimentado.
        </Text>
      </Card>
      {d.toComplete > 0 && (
        <Text style={s.error}>
          {d.toComplete === 1
            ? "1 aula terminada aguarda conclusão."
            : `${d.toComplete} aulas terminadas aguardam conclusão.`}{" "}
          Conclua em Agendamentos para liberar a avaliação.
        </Text>
      )}
      <Button title="Ver solicitações e aulas" onPress={goBookings} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: showAvailability }}
        style={s.disclosure}
        onPress={() => setShowAvailability(!showAvailability)}
      >
        <Icon name="calendar" />
        <Text style={s.flex}>Sua disponibilidade</Text>
        <Text style={s.link}>{showAvailability ? "Recolher" : "Abrir"}</Text>
      </TouchableOpacity>
      <View style={!showAvailability && { display: "none" }}>
        <Availability />
      </View>
      <Card style={s.gap}>
        <Text style={s.cardTitle}>Próximas aulas confirmadas</Text>
        {d.upcoming.length ? (
          d.upcoming.slice(0, 3).map((b) => (
            <View key={b.id} style={s.gapSmall}>
              <Text>{state!.users[b.student]?.name || "Aluno"}</Text>
              <Text style={s.muted}>
                {dateTime(b.start)} · {b.duration} min
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>Nenhuma próxima aula confirmada.</Text>
        )}
      </Card>
      <Card style={s.gap}>
        <Text style={s.cardTitle}>Histórico recente</Text>
        {d.history.length ? (
          d.history.map((b) => (
            <View key={b.id} style={s.row}>
              <View style={s.flex}>
                <Text>{state!.users[b.student]?.name || "Aluno"}</Text>
                <Text style={s.muted}>
                  {dateTime(b.start)} · {b.duration} min
                </Text>
              </View>
              <Badge
                title={labels[b.status] || b.status}
                tone={
                  b.status === "concluido"
                    ? "success"
                    : b.status.startsWith("falta_")
                      ? "danger"
                      : "neutral"
                }
              />
            </View>
          ))
        ) : (
          <Text style={s.muted}>
            Aulas concluídas, canceladas ou com falta aparecerão aqui.
          </Text>
        )}
      </Card>
      <Card style={s.gap}>
        <Text style={s.cardTitle}>Meus alunos</Text>
        <Text style={s.small}>
          Abra um perfil para conversar ou avaliar uma aula concluída.
        </Text>
        {Object.values(state!.users)
          .filter((u) => u.role === "aluno")
          .map((u) => (
            <TouchableOpacity
              key={u.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${u.name}`}
              style={s.conversation}
              onPress={() => onProfile(u.id)}
            >
              <Avatar foto={u.photoPath} nome={u.name} size={44} />
              <View style={s.flex}>
                <Text style={s.cardTitle}>{u.name}</Text>
                <Text style={s.link}>Ver perfil</Text>
              </View>
              <Icon name="chevron" size={16} />
            </TouchableOpacity>
          ))}
        {!Object.values(state!.users).some((u) => u.role === "aluno") && (
          <Text style={s.muted}>
            Seus alunos aparecerão após uma solicitação ou conversa.
          </Text>
        )}
      </Card>
      <Card style={s.gapSmall}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: showCredential }}
          style={s.credentialToggle}
          onPress={() => setShowCredential(!showCredential)}
        >
          <Icon name="shield" size={20} />
          <Text style={s.flex}>Credenciamento: {me.approval}</Text>
          <Icon name="chevron" size={16} />
        </TouchableOpacity>
        {!!me.suspendedUntil && me.suspendedUntil > state!.now && (
          <Text style={s.error}>
            Suspenso até {dateTime(me.suspendedUntil)}
          </Text>
        )}
        {!!me.credentialExpires && me.credentialExpires <= state!.now && (
          <Text style={s.error}>
            Autorização vencida. Atualize na aba Perfil.
          </Text>
        )}
        {showCredential && (
          <>
            <Text style={s.muted}>
              {me.credentialExpires
                ? `Validade: ${dateTime(me.credentialExpires)}`
                : "Envie sua autorização na aba Perfil."}
            </Text>
            <Text style={s.small}>
              Análise manual. O ConduzAPP não consulta automaticamente o Detran.
            </Text>
            {me.approvalReason && <Text>{me.approvalReason}</Text>}
          </>
        )}
      </Card>
      <Reviews uid={me.id} />
    </View>
  );
}
function Availability() {
  const { state, run } = useSession();
  const me = state!.me!;
  const [periods, setPeriods] = useState(me.periods || []),
    [blocks, setBlocks] = useState((me.blocks || []).join(", "));
  const [day, setDay] = useState(1),
    [from, setFrom] = useState("8"),
    [to, setTo] = useState("12");
  return (
    <Card style={s.gap}>
      <Heading
        title="Sua disponibilidade"
        sub="Vários períodos por dia. Sem períodos, não há horários para reservas."
      />
      <View style={s.row}>
        {weekdays.map((d, i) => (
          <TouchableOpacity
            style={[s.chip, day === i && s.slotActive]}
            key={d}
            onPress={() => setDay(i)}
          >
            <Text style={day === i ? s.white : s.link}>{d.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.row}>
        <View style={s.flex}>
          <Input
            label="Início (0–23)"
            value={from}
            onChangeText={setFrom}
            keyboardType="numeric"
          />
        </View>
        <View style={s.flex}>
          <Input
            label="Fim (1–24)"
            value={to}
            onChangeText={setTo}
            keyboardType="numeric"
          />
        </View>
      </View>
      <Action
        title="Adicionar período"
        onPress={() =>
          setPeriods([...periods, { day, from: Number(from), to: Number(to) }])
        }
      />
      {periods.map((p, i) => (
        <View style={s.period} key={`${p.day}-${p.from}-${i}`}>
          <Text style={s.flex}>
            {weekdays[p.day]} · {p.from}:00–{p.to}:00
          </Text>
          <TouchableOpacity
            onPress={() => setPeriods(periods.filter((_, j) => j !== i))}
          >
            <Text style={s.error}>Remover</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Input
        label="Bloquear datas (AAAA-MM-DD, separadas por vírgula)"
        value={blocks}
        onChangeText={setBlocks}
      />
      <Button
        title="Salvar disponibilidade"
        onPress={() =>
          run("availability", {
            periods,
            blocks: blocks
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }
      />
    </Card>
  );
}
function Bookings({ onProfile }: { onProfile?: (id: string) => void }) {
  const { state } = useSession();
  const [filter, setFilter] = useState("Todas");
  const all = Object.values(state!.bookings).sort((a, b) => b.start - a.start);
  const list = all.filter((b) => matchesBooking(b, filter, state!.now));
  if (filter === "Códigos disponíveis") list.sort((a, b) => a.start - b.start);
  return (
    <View style={s.gap}>
      <Heading
        title="Seus agendamentos"
        sub="Solicitações, pagamentos e histórico em um só lugar."
      />
      <View style={s.row}>
        {bookingFilters.map((f) => (
          <TouchableOpacity
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            style={[s.chip, filter === f && s.slotActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? s.white : s.link}>
              {f} ({all.filter((b) => matchesBooking(b, f, state!.now)).length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {list.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          onProfile={onProfile}
          showCode={filter === "Códigos disponíveis"}
        />
      ))}
      {!list.length && (
        <Card>
          <Text>
            {filter === "Códigos disponíveis"
              ? "Nenhuma aula com código disponível agora. O código fica disponível do início da aula até dez minutos depois, enquanto aguarda confirmação."
              : all.length
                ? "Nenhuma aula neste filtro."
                : "Você ainda não tem aulas agendadas."}
          </Text>
        </Card>
      )}
    </View>
  );
}
function BookingCard({
  booking: b,
  onProfile,
  showCode = false,
}: {
  booking: Booking;
  onProfile?: (id: string) => void;
  showCode?: boolean;
}) {
  const router = useRouter();
  const { state, run } = useSession();
  const me = state!.me!;
  const student = me.id === b.student,
    teacher = me.id === b.instructor,
    admin = me.role === "admin";
  const now = state!.now;
  const groupPending = b.groupId
    ? Object.values(state!.bookings).filter(
        (x) =>
          x.groupId === b.groupId &&
          !x.paid &&
          ["solicitado", "aguardando_pagamento"].includes(x.status),
      )
    : [b];
  const paymentTotal = groupPending.reduce((sum, x) => sum + x.price, 0);
  const [expand, setExpand] = useState(showCode),
    [reason, setReason] = useState(""),
    [newStart, setNewStart] = useState("");
  const other = state!.users[student ? b.instructor : b.student];
  useEffect(() => {
    if (showCode) setExpand(true);
  }, [showCode]);
  return (
    <Card style={s.gap}>
      <View style={s.row}>
        <Avatar
          foto={other?.photoPath}
          nome={other?.name || "Aula"}
          size={48}
        />
        <View style={s.flex}>
          <Text style={s.cardTitle}>{other?.name || "Aula"}</Text>
          <Text style={s.muted}>
            {dateTime(b.start)} · {b.duration} min
          </Text>
        </View>
      </View>
      {!!other && !!onProfile && (
        <Button
          title={`Ver perfil de ${other.name}`}
          variant="secondary"
          onPress={() => onProfile(other.id)}
        />
      )}
      <Badge
        title={labels[b.status] || b.status}
        tone={
          b.status === "confirmado" || b.status === "concluido"
            ? "success"
            : b.status === "cancelado" || b.status.startsWith("falta")
              ? "danger"
              : "warning"
        }
      />
      <View style={s.row}>
        <Text style={s.price}>{money(b.price)}</Text>
        <Text style={s.small}>
          {me.role !== "aluno" && `Comissão ${money(b.commission)} · `}
          {b.paid ? "Pagamento simulado confirmado" : "Sem pagamento"}
        </Text>
      </View>
      {!!b.groupId && (
        <Text style={s.small}>
          Aula {b.lessonNumber}/2 · solicitação conjunta de 2 × {b.duration}{" "}
          min · total contratado {money(b.groupPrice)}. Gestão individual por
          aula.
        </Text>
      )}
      <View style={s.vehicleLine}>
        <Icon name="pin" size={17} color={UI.color.textSecondary} />
        <Text style={s.small}>
          {b.location || "Local a combinar"}
          {b.disputeOpen ? " · Em disputa" : ""}
        </Text>
      </View>
      {b.refundStatus && (
        <Text style={s.muted}>
          Estorno {money(b.refund)} ·{" "}
          {refundLabels[b.refundStatus] || b.refundStatus.replaceAll("_", " ")}
        </Text>
      )}
      <Action
        title={expand ? "Fechar detalhes" : "Gerenciar aula"}
        onPress={() => setExpand(!expand)}
      />
      {expand && (
        <View style={s.gap}>
          <StartConfirmation booking={b} />
          {teacher && b.status === "solicitado" && (
            <Action
              title="Aceitar solicitação"
              onPress={() => run("accept", { booking: b.id })}
            />
          )}
          {(student || teacher) &&
            (!state!.users[b.student]?.photoPath ||
              !state!.users[b.instructor]?.photoPath) && (
              <>
                <Text style={s.error}>
                  Ambos precisam de foto de perfil para confirmar. Aulas antigas
                  não foram canceladas.
                </Text>
                <Button
                  title="Adicionar foto no Perfil"
                  variant="secondary"
                  onPress={() => router.push("/perfil")}
                />
              </>
            )}
          {student && b.status === "aguardando_pagamento" && (
            <Button
              title={"Confirmar pagamento (simulado) · " + money(paymentTotal)}
              onPress={() => run("pay", { booking: b.id })}
            />
          )}
          {(student || teacher) &&
            ["solicitado", "aguardando_pagamento", "confirmado"].includes(
              b.status,
            ) &&
            now < b.start && (
              <>
                <Text style={s.small}>
                  Aluno: acima de 2h, reembolso integral; até 2h antes do
                  início, 50%. Instrutor: integral. Sem cobrança real.
                </Text>
                <Action
                  danger
                  title="Cancelar aula"
                  onPress={() => run("cancel", { booking: b.id })}
                />
              </>
            )}
          {(student || teacher) &&
            b.status === "confirmado" &&
            b.start - now >= 3 * 3600000 && (
              <>
                <Input
                  label="Propor nova data (AAAA-MM-DD HH:00, Brasília)"
                  placeholder="2026-10-23 14:00"
                  value={newStart}
                  onChangeText={setNewStart}
                />
                <Action
                  title="Enviar proposta de remarcação"
                  onPress={() =>
                    run("propose", {
                      booking: b.id,
                      start: Date.parse(
                        newStart.replace(" ", "T") + ":00-03:00",
                      ),
                    })
                  }
                />
              </>
            )}
          {b.proposal && (
            <Card style={s.gap}>
              <Text>
                Proposta: {dateTime(b.proposal.start)}. A reserva original
                continua válida até o aceite.
              </Text>
              {b.proposal.by !== me.id && (
                <>
                  <Action
                    title="Aceitar remarcação"
                    onPress={() =>
                      run("reschedule", { booking: b.id, accept: true })
                    }
                  />
                  <Action
                    title="Recusar remarcação"
                    onPress={() =>
                      run("reschedule", { booking: b.id, accept: false })
                    }
                  />
                </>
              )}
            </Card>
          )}
          {teacher && b.status === "confirmado" && (
            <Action
              title="Concluir aula após o término"
              onPress={() => run("complete", { booking: b.id })}
            />
          )}
          {student && b.status === "concluido" && !b.studentConfirmed && (
            <Action
              title="Confirmar realização da aula"
              onPress={() => run("confirm", { booking: b.id })}
            />
          )}
          {b.status === "concluido" &&
            (student || teacher) &&
            !b.ratings?.[me.id] && <ReviewForm booking={b} />}
          {b.ratings?.[me.id] && (
            <Text>Você avaliou esta aula com {b.ratings[me.id]} estrelas.</Text>
          )}
          {(student || teacher) &&
            b.paid &&
            [
              "confirmado",
              "concluido",
              "falta_aluno",
              "falta_instrutor",
            ].includes(b.status) &&
            now >= b.start &&
            now <= end(b) + 86400000 &&
            !b.disputeOpen && (
              <>
                <Input
                  label="Relatar problema (privado)"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Action
                  title="Abrir contestação"
                  onPress={() => run("dispute", { booking: b.id, reason })}
                />
              </>
            )}
          {(b.disputeOpen || admin) && <Evidence booking={b} />}
          {b.status === "concluido" && (student || teacher) && (
            <>
              <Text style={s.muted}>
                {b.payoutEligible
                  ? "Elegível para repasse — nenhum dinheiro transferido."
                  : "Elegibilidade depende da janela de 24h e da análise de disputas."}
              </Text>
              <Action
                title="Verificar elegibilidade (simulação)"
                onPress={() => run("eligibility", { booking: b.id })}
              />
            </>
          )}
          {admin && (
            <>
              <Input
                label="Motivo / evidência administrativa"
                value={reason}
                onChangeText={setReason}
              />
              <Action
                title="Confirmar falta do aluno (tolerância 20min)"
                onPress={() =>
                  run("absence", { booking: b.id, who: "aluno", reason })
                }
              />
              <Action
                title="Confirmar falta do instrutor"
                onPress={() =>
                  run("absence", { booking: b.id, who: "instrutor", reason })
                }
              />
              {b.refundStatus === "pendente_simulado" && (
                <Action
                  title="Registrar estorno (simulado)"
                  onPress={() => run("refund", { booking: b.id })}
                />
              )}
            </>
          )}
        </View>
      )}
    </Card>
  );
}
function Evidence({ booking: b }: { booking: Booking }) {
  const { state } = useSession();
  const [files, setFiles] = useState<string[]>([]),
    [photo, setPhoto] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    try {
      const results = await Promise.all(
        [b.student, b.instructor].map((id) =>
          listAll(ref(storage, `disputes/${b.id}/${id}`)),
        ),
      );
      setFiles(results.flatMap((r) => r.items.map((x) => x.fullPath)));
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function upload() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      await uploadBytes(
        ref(storage, `disputes/${b.id}/${state!.me!.id}/${Date.now()}.jpg`),
        blob,
        { contentType: asset.mimeType || "image/jpeg" },
      );
      setMessage("Foto privada anexada.");
      await load();
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function show(path: string) {
    try {
      const bytes = new Uint8Array(
        await getBytes(ref(storage, path), 5 * 1024 * 1024),
      );
      let binary = "";
      for (const value of bytes) binary += String.fromCharCode(value);
      setPhoto(`data:image/jpeg;base64,${btoa(binary)}`);
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <Card style={s.gap}>
      <Text style={s.cardTitle}>Evidências privadas</Text>
      <Text style={s.small}>
        Somente participantes e administração podem visualizar. Até 5 MB por
        imagem.
      </Text>
      {state!.me!.role !== "admin" && b.disputeOpen && (
        <Action title="Anexar foto" onPress={upload} />
      )}
      <Action title="Carregar anexos" onPress={load} />
      {files.map((f, i) => (
        <Action key={f} title={`Ver foto ${i + 1}`} onPress={() => show(f)} />
      ))}
      {!!message && <Text style={s.small}>{message}</Text>}
      {!!photo && (
        <Image
          source={{ uri: photo }}
          style={{ width: "100%", height: 240, resizeMode: "contain" }}
        />
      )}
    </Card>
  );
}
function Messages({
  initialTo,
  onOpen,
  onProfile,
}: {
  initialTo?: string;
  onOpen: () => void;
  onProfile: (id: string) => void;
}) {
  const { state, run, busy } = useSession();
  const me = state!.me!;
  const [search, setSearch] = useState("");
  const [to, setTo] = useState(initialTo || ""),
    [text, setText] = useState("");
  const pending = useRef<{
    to: string;
    text: string;
    requestId: string;
  } | null>(null);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const readAttempt = useRef("");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (v) =>
      setForeground(v === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (to) onOpen();
  }, [to]);
  useEffect(() => {
    if (!to || !foreground || busy) return;
    const ids = state!.messages
      .filter((m) => m.from === to && m.to === me.id && !m.readAt)
      .map((m) => m.id);
    const key = ids.join(",");
    if (!key || readAttempt.current === key) return;
    readAttempt.current = key;
    void run("readMessages", { to, messages: ids });
  }, [to, foreground, state?.messages, busy, me.id]);
  const participants = [
    ...new Set(
      Object.values(state!.conversations || {}).map((b) =>
        b.student === me.id ? b.instructor : b.student,
      ),
    ),
  ];
  return (
    <View style={s.gap}>
      <Heading
        title="Mensagens"
        sub="Converse sobre suas aulas e o ponto de encontro."
      />
      {!to && (
        <>
          <Input
            leadingIcon="search"
            placeholder="Buscar conversa…"
            accessibilityLabel="Buscar conversa"
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.gap}>
            {participants
              .filter((id) =>
                (state!.users[id]?.name || "Participante")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((id) => {
                const name = state!.users[id]?.name || "Participante";
                const tag =
                  Object.values(state!.conversations).find((c) =>
                    [c.student, c.instructor].includes(id),
                  )?.tag || "SEM AGENDAMENTO";
                const last = state!.messages
                  .filter((msg) => [msg.from, msg.to].includes(id))
                  .slice(-1)[0];
                return (
                  <View key={id} style={s.gapSmall}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={"Conversa com " + name}
                      accessibilityState={{ selected: to === id }}
                      style={[
                        s.conversation,
                        to === id && s.conversationActive,
                      ]}
                      onPress={() => setTo(id)}
                    >
                      <Avatar
                        foto={state!.users[id]?.photoPath}
                        nome={name}
                        size={48}
                      />
                      <View style={s.conversationInfo}>
                        <Text style={s.conversationName}>{name}</Text>
                        <Text numberOfLines={1} style={s.small}>
                          {last
                            ? (last.from === me.id ? "Você: " : "") + last.text
                            : "Comece a conversa sobre sua próxima aula."}
                        </Text>
                        <Badge
                          title={tag}
                          tone={tag === "AGENDADO" ? "success" : "neutral"}
                        />
                      </View>
                      <Icon name="chevron" size={16} />
                    </TouchableOpacity>
                    <Button
                      title={`Ver perfil de ${name}`}
                      variant="secondary"
                      onPress={() => onProfile(id)}
                    />
                  </View>
                );
              })}
          </View>
          {!!participants.length &&
            !participants.some((id) =>
              (state!.users[id]?.name || "Participante")
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <Text style={s.muted}>Nenhuma conversa encontrada.</Text>}
          {!participants.length && (
            <Card style={s.empty}>
              <Icon name="message" size={36} />
              <Text style={s.cardTitle}>
                Sua próxima aula começa com uma conversa
              </Text>
              <Text style={s.muted}>
                {me.role === "instrutor"
                  ? "Abra o perfil de um aluno vinculado às suas aulas para conversar. Alunos também podem iniciar uma conversa com você."
                  : "Abra o perfil de um instrutor aprovado e toque em Conversar com o instrutor."}
              </Text>
            </Card>
          )}
        </>
      )}
      {!!to && (
        <Card style={s.gap}>
          <Button
            title="Voltar às conversas"
            variant="secondary"
            onPress={() => setTo("")}
          />
          <View style={s.chatHeader}>
            <Avatar
              foto={state!.users[to]?.photoPath}
              nome={state!.users[to]?.name || "Participante"}
              size={40}
            />
            <View style={s.flex}>
              <Text style={s.cardTitle}>{state!.users[to]?.name}</Text>
              <Text style={s.small}>Conversa privada entre participantes</Text>
            </View>
          </View>
          <Button
            title={`Ver perfil de ${state!.users[to]?.name || "participante"}`}
            variant="secondary"
            onPress={() => onProfile(to)}
          />
          {state!.messages
            .filter((m) => [m.from, m.to].includes(to))
            .map((m) => (
              <View
                key={m.id}
                style={[s.bubble, m.from === me.id ? s.mine : s.theirs]}
              >
                <Text style={m.from === me.id ? s.white : undefined}>
                  {m.text}
                </Text>
                <Text style={[s.small, m.from === me.id && s.white]}>
                  {dateTime(m.at)}
                </Text>
              </View>
            ))}
          <Input
            label="Sua mensagem"
            placeholder="Escreva sua mensagem…"
            value={text}
            onChangeText={setText}
            multiline
          />
          <Button
            title="Enviar mensagem"
            disabled={!text.trim()}
            onPress={async () => {
              if (pending.current?.to !== to || pending.current.text !== text)
                pending.current = {
                  to,
                  text,
                  requestId: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                };
              if (await run("message", pending.current)) {
                setText("");
                pending.current = null;
              }
            }}
          />
        </Card>
      )}
    </View>
  );
}
function ParticipantProfile({
  uid,
  goBack,
  onChat,
}: {
  uid: string;
  goBack: () => void;
  onChat: (id: string) => void;
}) {
  const { state, run, busy } = useSession();
  const [selectedLesson, setSelectedLesson] = useState("");
  const me = state!.me!;
  // Only profiles already projected by the backend are available here.
  const peer = state!.users[uid];
  const pending = Object.values(state!.bookings)
    .filter((b) => canReviewPeer(b, me.id, uid, state!.now))
    .sort((a, b) => b.start - a.start);
  const lesson = pending.find((b) => b.id === selectedLesson) || pending[0];
  if (!peer || peer.id === me.id || !["aluno", "instrutor"].includes(peer.role))
    return (
      <View style={s.gap}>
        <Button title="Voltar" variant="secondary" onPress={goBack} />
        <Text>Perfil indisponível para sua conta.</Text>
      </View>
    );
  return (
    <View style={s.gap}>
      <Button title="Voltar" variant="secondary" onPress={goBack} />
      <Heading
        title={
          peer.role === "instrutor" ? "Perfil do instrutor" : "Perfil do aluno"
        }
      />
      <Card style={s.gap}>
        <View style={s.row}>
          <Avatar foto={peer.photoPath} nome={peer.name} size={72} />
          <View style={s.flex}>
            <Text style={s.cardTitle}>{peer.name}</Text>
            <Text style={s.muted}>
              {peer.role === "instrutor" ? "Instrutor" : "Aluno"}
              {peer.region ? ` · ${peer.region}` : ""}
            </Text>
          </View>
        </View>
        {!!peer.bio && <Text>{peer.bio}</Text>}
        {peer.role === "instrutor" && (
          <>
            {!!peer.specialty && <Text style={s.muted}>{peer.specialty}</Text>}
            {!!peer.car && (
              <Text style={s.muted}>
                {peer.car}
                {peer.transmission ? ` · ${peer.transmission}` : ""}
              </Text>
            )}
          </>
        )}
        <Button
          title="Enviar mensagem"
          disabled={busy}
          onPress={async () => {
            if (await run("openConversation", { to: uid })) onChat(uid);
          }}
        />
      </Card>
      <Card style={s.gap}>
        <Text style={s.cardTitle}>
          {peer.role === "instrutor" ? "Avaliar instrutor" : "Avaliar aluno"}
        </Text>
        <Text style={s.muted}>
          Uma avaliação por participante em cada aula concluída, paga e com
          horário final encerrado.
        </Text>
        {pending.length > 1 && (
          <View style={s.row}>
            {pending.map((b) => (
              <TouchableOpacity
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Avaliar aula de ${dateTime(b.start)}`}
                accessibilityState={{ selected: lesson?.id === b.id }}
                style={[s.chip, lesson?.id === b.id && s.slotActive]}
                onPress={() => setSelectedLesson(b.id)}
              >
                <Text style={lesson?.id === b.id ? s.white : s.link}>
                  {dateTime(b.start)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {lesson ? (
          <ReviewForm key={lesson.id} booking={lesson} />
        ) : (
          <Text style={s.muted}>
            Nenhuma aula pendente de avaliação com este participante.
          </Text>
        )}
      </Card>
      {peer.role === "aluno" && (
        <Text style={s.small}>
          As avaliações de alunos são privadas. Aqui você vê apenas as
          avaliações que você escreveu para este aluno.
        </Text>
      )}
      <Reviews
        uid={uid}
        title={
          peer.role === "aluno" ? "Suas avaliações deste aluno" : undefined
        }
      />
    </View>
  );
}
function ReviewForm({ booking: b }: { booking: Booking }) {
  const { state, run, busy } = useSession();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const student = state!.me!.id === b.student;
  return (
    <View style={s.reviewForm}>
      <Text style={s.reviewTitle}>
        {/* A avaliação do instrutor é o padrão esperado do aluno; a do aluno é opcional para o instrutor. */}
        {student ? "Avalie seu instrutor" : "Avalie seu aluno (opcional)"}
      </Text>
      <Text style={[s.small, { textAlign: "center" }]}>
        {state!.users[student ? b.instructor : b.student]?.name} ·{" "}
        {dateTime(b.start)}
      </Text>
      <StarRating nota={rating} onChange={setRating} size={36} showLabel />
      <Input
        label="Deixe seu comentário (opcional)"
        placeholder="Conte como foi sua experiência…"
        multiline
        value={comment}
        onChangeText={setComment}
      />
      <Button
        title="Enviar avaliação"
        disabled={busy}
        onPress={() => run("review", { booking: b.id, rating, comment })}
      />
    </View>
  );
}
function ReviewsPage({ goBack }: { goBack: () => void }) {
  const { state } = useSession();
  const me = state!.me!;
  const pending = Object.values(state!.bookings).filter(
    (b) =>
      b.status === "concluido" &&
      [b.student, b.instructor].includes(me.id) &&
      !b.ratings?.[me.id],
  );
  return (
    <View style={s.gap}>
      <View style={s.sectionHeading}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar ao perfil"
          onPress={goBack}
          style={s.iconButton}
        >
          <Icon name="back" size={22} />
        </TouchableOpacity>
        <Heading title="Avaliações" />
      </View>
      <Text style={s.muted}>
        Compartilhe sua experiência e veja os feedbacks recebidos.
      </Text>
      {pending.map((b) => (
        <ReviewForm key={b.id} booking={b} />
      ))}
      {!pending.length && (
        <Text style={s.muted}>
          Nenhuma aula pendente de avaliação. Você pode avaliar após a conclusão
          da aula.
        </Text>
      )}
      <Reviews uid={me.id} />
    </View>
  );
}
function Reviews({ uid, title }: { uid: string; title?: string }) {
  const { state } = useSession();
  const reviews = Object.values(state!.reviews).filter((r) => r.to === uid);
  return (
    <View style={s.gap}>
      <View style={s.sectionHeading}>
        <Icon name="star" />
        <Text style={s.cardTitle}>{title || "Avaliações recebidas"}</Text>
      </View>
      <RatingSummary uid={uid} />
      {!reviews.length && (
        <Card style={s.empty}>
          <Icon name="star" size={32} />
          <Text style={s.muted}>
            As avaliações aparecerão aqui após as aulas.
          </Text>
        </Card>
      )}
      {reviews.map((r) => {
        const author = r.from ? state!.users[r.from]?.name : undefined;
        return (
          <Card key={r.id} style={s.gap}>
            <View style={s.reviewHeader}>
              <Avatar
                foto={r.from ? state!.users[r.from]?.photoPath : undefined}
                nome={author || "Participante"}
                size={42}
              />
              <View style={s.flex}>
                <Text style={s.conversationName}>
                  {author || "Participante da aula"}
                </Text>
                <Text style={s.link}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)} · {r.rating.toFixed(1)}
                </Text>
              </View>
            </View>
            <Text style={s.reviewComment}>
              {r.comment || "Sem comentário."}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}
function Profile({ navigate }: { navigate?: (tab: string) => void }) {
  const { state, run } = useSession(),
    router = useRouter();
  const me = state!.me!;
  const photoUpload = useImageUpload();
  const [section, setSection] = useState<string | null>(null);
  const toggle = (key: string) => setSection(section === key ? null : key);
  const [name, setName] = useState(me.name),
    [region, setRegion] = useState(me.region || ""),
    [car, setCar] = useState(me.car || ""),
    [transmission, setTransmission] = useState(me.transmission || ""),
    [bio, setBio] = useState(me.bio || ""),
    [specialty, setSpecialty] = useState(me.specialty || ""),
    [price, setPrice] = useState(String((me.price || 8000) / 100)),
    [credential, setCredential] = useState(me.credential || ""),
    [expires, setExpires] = useState(""),
    [reason, setReason] = useState("");
  return (
    <View style={s.gap}>
      <View style={s.profileHero}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
          style={s.profileEdit}
          onPress={() => toggle("edit")}
        >
          <Icon name="edit" color="white" size={22} />
        </TouchableOpacity>
        <View style={s.avatarRing}>
          <Avatar foto={me.photoPath} nome={me.name} size={80} />
        </View>
        <Text style={s.profileName}>{me.name}</Text>
        <Text style={s.profileRole}>
          {me.role === "aluno"
            ? "Aluno"
            : me.role === "instrutor"
              ? "Instrutor"
              : "Administração"}
        </Text>
        {!!me.region && <Text style={s.profileRole}>{me.region}</Text>}
        {me.role !== "admin" && (
          <Button
            title="Alterar foto"
            variant="secondary"
            disabled={photoUpload.busy || photoUpload.sending}
            onPress={() => {
              setSection("identity");
              void photoUpload.choose();
            }}
          />
        )}
      </View>
      {me.role !== "admin" &&
        (["identity", "edit"].includes(section || "") ||
          me.identity?.status !== "aprovado") && (
          <IdentityPanel
            photoOnly={section === "edit" && me.identity?.status === "aprovado"}
            photoUpload={photoUpload}
          />
        )}
      {!section && (
        <Card style={s.menu}>
          {navigate && (
            <MenuRow
              icon="calendar"
              title="Meus agendamentos"
              onPress={() => navigate("Agendamentos")}
            />
          )}
          {navigate && me.role === "aluno" && (
            <MenuRow
              icon="heart"
              title="Favoritos"
              onPress={() => navigate("Favoritos")}
            />
          )}
          <MenuRow
            icon="edit"
            title="Editar perfil"
            expanded={section === "edit"}
            onPress={() => toggle("edit")}
          />
          {(me.role === "admin" || me.identity?.status === "aprovado") && (
            <MenuRow
              icon="star"
              title="Avaliações recebidas"
              expanded={navigate ? undefined : section === "reviews"}
              onPress={() =>
                navigate ? navigate("Avaliações") : toggle("reviews")
              }
            />
          )}
          {navigate && (
            <MenuRow
              icon="bell"
              title="Notificações"
              onPress={() => navigate("Notificações")}
            />
          )}
          {me.role === "instrutor" && (
            <MenuRow
              icon="shield"
              title="Autorização profissional"
              expanded={section === "credential"}
              onPress={() => toggle("credential")}
            />
          )}
          {me.role !== "admin" && (
            <MenuRow
              icon="shield"
              title="Foto e verificação de identidade"
              expanded={section === "identity"}
              onPress={() => toggle("identity")}
            />
          )}
          <MenuRow
            icon="help"
            title="Ajuda e suporte"
            expanded={section === "support"}
            onPress={() => toggle("support")}
          />
        </Card>
      )}
      {section && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setSection(null)}
          style={s.back}
        >
          <Icon name="back" size={20} />
          <Text style={s.link}>Voltar às opções do perfil</Text>
        </TouchableOpacity>
      )}
      {section === "edit" && (
        <Card style={s.gap}>
          <Heading
            title="Editar perfil"
            sub="Mantenha suas informações atualizadas."
          />
          <Input label="Nome" value={name} onChangeText={setName} />
          <Input label="Região" value={region} onChangeText={setRegion} />
          {me.role === "instrutor" && (
            <>
              <Input label="Veículo" value={car} onChangeText={setCar} />
              <Input
                label="Câmbio"
                value={transmission}
                onChangeText={setTransmission}
              />
              <Input
                label="Especialidade"
                value={specialty}
                onChangeText={setSpecialty}
              />
              <Input
                label="Sobre você"
                value={bio}
                onChangeText={setBio}
                multiline
              />
              <Input
                label="Preço da aula em R$"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </>
          )}
          <Button
            title="Salvar perfil"
            onPress={() =>
              run("profile", {
                name,
                region,
                car,
                transmission,
                bio,
                specialty,
                price: Math.round(Number(price.replace(",", ".")) * 100),
              })
            }
          />
        </Card>
      )}
      {me.role === "instrutor" && section === "credential" && (
        <Card style={s.gap}>
          <Heading
            title="Autorização profissional"
            sub={`Situação: ${me.approval}. Alterações exigem nova análise manual.`}
          />
          <Input
            label="Número da autorização"
            value={credential}
            onChangeText={setCredential}
          />
          <Input
            label="Validade (AAAA-MM-DD)"
            value={expires}
            onChangeText={setExpires}
          />
          <Button
            title="Enviar para análise"
            onPress={() =>
              run("credential", {
                credential,
                expires: Date.parse(expires + "T23:59:59-03:00"),
              })
            }
          />
        </Card>
      )}
      {section === "reviews" && <Reviews uid={me.id} />}
      {section === "support" && (
        <Card style={s.gap}>
          <Heading title="Ajuda e suporte" />
          <Input
            label="Descreva sua solicitação"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Button
            title="Enviar ao suporte"
            onPress={async () => {
              if (await run("support", { reason })) setReason("");
            }}
          />
          {Object.values(state!.tickets).map((t) => (
            <View key={t.id}>
              <Text>
                {t.kind} · {t.status}
              </Text>
              <Text style={s.muted}>{t.reason}</Text>
              {t.decision && <Text>Resposta: {t.decision}</Text>}
            </View>
          ))}
        </Card>
      )}
      <Button
        title="Sair da conta"
        variant="danger"
        onPress={async () => {
          await signOut(auth);
          router.replace("/");
        }}
      />
    </View>
  );
}
function Admin({ tab }: { tab: string }) {
  const { state } = useSession();
  const instructors = Object.values(state!.users).filter(
    (u) => u.role === "instrutor",
  );
  if (tab === "Perfil") return <Profile />;
  if (tab === "Agendamentos") return <Bookings />;
  if (tab === "Ocorrências")
    return (
      <View style={s.gap}>
        <Heading
          title="Suporte e disputas"
          sub="Decisões registradas, com acompanhamento dos estornos simulados."
        />
        {Object.values(state!.tickets).map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
        {!Object.keys(state!.tickets).length && <Text>Sem ocorrências.</Text>}
      </View>
    );
  return (
    <View style={s.gap}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>ADMINISTRAÇÃO</Text>
        <Text style={s.heroTitle}>Acompanhe o ConduzAPP.</Text>
        <Text style={s.white}>Análise manual e decisões com registro.</Text>
      </View>
      <View style={s.row}>
        <Card style={s.metric}>
          <Text style={s.number}>
            {instructors.filter((u) => u.approval === "pendente").length}
          </Text>
          <Text>Credenciamentos</Text>
        </Card>
        <Card style={s.metric}>
          <Text style={s.number}>
            {
              Object.values(state!.tickets).filter((t) => t.status === "aberto")
                .length
            }
          </Text>
          <Text>Ocorrências</Text>
        </Card>
      </View>
      <Heading
        title="Verificações de identidade"
        sub="Comparação visual manual entre foto e documento; sem biometria nem consulta a serviço oficial."
      />
      {Object.values(state!.bookings)
        .filter(
          (b) =>
            ["solicitado", "aguardando_pagamento", "confirmado"].includes(
              b.status,
            ) &&
            end(b) > state!.now &&
            (!state!.users[b.student]?.photoPath ||
              !state!.users[b.instructor]?.photoPath),
        )
        .map((b) => (
          <Card key={b.id}>
            <Text style={s.error}>
              Reserva com foto ausente: {b.id}. Regularize os perfis; nenhuma
              aula foi cancelada automaticamente.
            </Text>
          </Card>
        ))}
      {Object.values(state!.users)
        .filter((u) => u.identity?.documentPath)
        .map((u) => (
          <IdentityAdmin key={u.id} profile={u} />
        ))}
      <Heading
        title="Credenciamento de instrutores"
        sub="Confira autorização e validade. Esta análise não representa uma consulta automática ao Detran."
      />
      {instructors.map((u) => (
        <InstructorAdmin key={u.id} profile={u} />
      ))}
      <Heading title="Registro de operações" />
      {state!.audit
        .slice(-15)
        .reverse()
        .map((a) => (
          <Text style={s.small} key={a.id}>
            {dateTime(a.at)} · {a.op} · {state!.users[a.by]?.name}
          </Text>
        ))}
    </View>
  );
}
function InstructorAdmin({ profile: u }: { profile: Profile }) {
  const { run } = useSession();
  const [reason, setReason] = useState("");
  return (
    <Card style={s.gap}>
      <Text style={s.cardTitle}>
        {u.name} · {u.approval}
      </Text>
      <Text>Autorização: {u.credential || "Não enviada"}</Text>
      <Text style={s.muted}>
        Validade:{" "}
        {u.credentialExpires ? dateTime(u.credentialExpires) : "Não enviada"}
      </Text>
      <Text style={s.muted}>
        Cancelamentos: {u.cancellations || 0} · Faltas confirmadas:{" "}
        {u.absences || 0}
      </Text>
      {u.adminAlert && (
        <Text style={s.error}>Alerta: requer análise administrativa.</Text>
      )}
      {!!u.suspendedUntil && (
        <Text>Suspensão até {dateTime(u.suspendedUntil)}</Text>
      )}
      <Input
        label="Parecer da análise manual"
        value={reason}
        onChangeText={setReason}
      />
      <View style={s.row}>
        <Action
          title="Aprovar credenciamento"
          onPress={() =>
            run("approve", { instructor: u.id, decision: "aprovado", reason })
          }
        />
        <Action
          title="Rejeitar"
          onPress={() =>
            run("approve", { instructor: u.id, decision: "rejeitado", reason })
          }
        />
        <Action
          danger
          title="Suspender por 7 dias"
          onPress={() => run("suspend", { instructor: u.id, reason })}
        />
      </View>
    </Card>
  );
}
function TicketCard({ ticket: t }: { ticket: Ticket }) {
  const { state, run } = useSession();
  const [reason, setReason] = useState(""),
    [refund, setRefund] = useState("0");
  const b = t.booking ? state!.bookings[t.booking] : null;
  return (
    <Card style={s.gap}>
      <Text style={s.cardTitle}>
        {t.kind} · {t.status} · {state!.users[t.owner]?.name}
      </Text>
      <Text>{t.reason}</Text>
      {t.decision && <Text>Decisão: {t.decision}</Text>}
      {b && <Evidence booking={b} />}
      {t.status === "aberto" && (
        <>
          <Input
            label="Decisão administrativa"
            value={reason}
            onChangeText={setReason}
          />
          {b && (
            <Input
              label="Estorno simulado em R$"
              value={refund}
              onChangeText={setRefund}
              keyboardType="decimal-pad"
            />
          )}
          <Action
            title="Concluir análise"
            onPress={() =>
              run("resolve", {
                ticket: t.id,
                reason,
                refund: Math.round(Number(refund.replace(",", ".")) * 100),
              })
            }
          />
        </>
      )}
    </Card>
  );
}
