import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession, dateTime } from "@/services/session";
import { ThemedText as Text } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { UI } from "@/constants/theme";
import { visibleNotifications } from "@/lib/presentation";

const DURATION_MS = 220;

// Gaveta de notificações à direita: desliza sobre o conteúdo, que continua visível
// atrás de um fundo escurecido leve. Fecha pelo ✕, tocando fora ou com Esc (web).
export function NotificationsDrawer({
  open,
  onClose,
  goBookings,
  goProfile,
}: {
  open: boolean;
  onClose: () => void;
  goBookings: () => void;
  goProfile: () => void;
}) {
  const { state, run, busy } = useSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(380, Math.round(width * 0.88));
  const progress = useRef(new Animated.Value(0)).current;
  // Mantém a gaveta montada até a animação de saída terminar.
  const [mounted, setMounted] = useState(open);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: DURATION_MS,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  // Limpeza diária: as lidas de dias anteriores saem da lista na virada da meia-noite.
  const { current, archived } = visibleNotifications(
    Object.values(state?.notifications || {}),
    state?.now ?? Date.now(),
  );
  const list = showArchived ? [...current, ...archived] : current;
  const unread = current.filter((n) => !n.readAt);

  // Abrir um aviso marca como lido e leva à tela relacionada.
  async function openItem(n: (typeof list)[number]) {
    if (!n.readAt) await run("readNotification", { notification: n.id });
    (n.event === "identity" ? goProfile : goBookings)();
  }
  async function readAll() {
    for (const n of unread) await run("readNotification", { notification: n.id });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View
        style={[s.backdrop, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar notificações"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel="Notificações"
        style={[
          s.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) },
            ],
          },
        ]}
      >
        <View style={s.header}>
          <View style={s.flex}>
            <Text style={s.title}>Notificações</Text>
            <Text style={s.subtitle}>
              {unread.length ? `${unread.length} não ${unread.length === 1 ? "lida" : "lidas"}` : "Tudo em dia"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar notificações"
            style={s.close}
            hitSlop={8}
          >
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        {unread.length > 0 && (
          <TouchableOpacity
            onPress={readAll}
            disabled={busy}
            accessibilityRole="button"
            style={s.readAll}
          >
            <Text style={s.link}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
        {/* Rolagem interna: a lista não empurra nem cobre o restante do app. */}
        <ScrollView style={s.flex} contentContainerStyle={s.list}>
          {!list.length && (
            <View style={s.empty}>
              <Icon name="bell" size={28} color={UI.color.textSecondary} />
              <Text style={s.subtitle}>Nenhuma notificação hoje.</Text>
            </View>
          )}
          {list.map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => openItem(n)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${n.readAt ? "" : "Nova: "}${n.title}`}
              style={[s.item, !n.readAt && s.itemUnread]}
            >
              <View style={[s.dot, !n.readAt && s.dotUnread]} />
              <View style={s.flex}>
                <Text style={[s.itemTitle, !n.readAt && s.itemTitleUnread]}>{n.title}</Text>
                <Text style={s.itemMeta}>
                  {dateTime(n.at)} · {n.event === "identity" ? "Ver perfil" : "Ver agendamentos"}
                </Text>
              </View>
              <Icon name="chevron" size={14} color={UI.color.textSecondary} />
            </TouchableOpacity>
          ))}
          {archived.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowArchived(!showArchived)}
              accessibilityRole="button"
              style={s.archivedToggle}
            >
              <Text style={s.link}>
                {showArchived
                  ? "Ocultar notificações anteriores"
                  : `Ver anteriores já lidas (${archived.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(11, 17, 32, 0.35)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI.color.surface,
    borderTopLeftRadius: UI.radius.large,
    borderBottomLeftRadius: UI.radius.large,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: "#0B1120",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: -6, height: 0 },
    elevation: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  title: { fontSize: UI.type.section, fontWeight: "800", color: UI.color.text },
  subtitle: { fontSize: UI.type.caption, color: UI.color.textSecondary },
  close: {
    width: 36,
    height: 36,
    borderRadius: UI.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.color.backgroundApp,
  },
  closeText: { fontSize: 16, color: UI.color.text, lineHeight: 20 },
  readAll: { alignSelf: "flex-start", paddingVertical: 4 },
  link: { color: UI.color.primary, fontSize: 13, fontWeight: "700" },
  list: { gap: 6, paddingBottom: 8 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 48 },
  archivedToggle: { alignSelf: "center", paddingVertical: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: UI.radius.control,
    borderWidth: 1,
    borderColor: UI.color.border,
  },
  itemUnread: { backgroundColor: UI.color.primarySoft, borderColor: UI.color.primaryLight },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "transparent" },
  dotUnread: { backgroundColor: UI.color.primary },
  itemTitle: { fontSize: 13, lineHeight: 18, color: UI.color.text },
  itemTitleUnread: { fontWeight: "700" },
  itemMeta: { fontSize: 11.5, color: UI.color.textSecondary, marginTop: 2 },
});
