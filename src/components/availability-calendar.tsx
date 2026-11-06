import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText as Text } from "@/components/themed-text";
import { UI } from "@/constants/theme";
import {
  availabilityMonth,
  currentMonth,
  type CalendarDay,
} from "@/lib/presentation";

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_AHEAD = 5; // navegação: mês atual + 5

// Calendário do instrutor: mostra, com datas reais, quais dias têm horário,
// quais são folga e quais já têm aulas. Tocar num dia alterna "Disponível"/"Folga".
export function AvailabilityCalendar({
  periods,
  blocks,
  bookings,
  now,
  onToggle,
}: {
  periods: { day: number }[];
  blocks: string[];
  bookings: { start: number; status: string }[];
  now: number;
  onToggle: (date: string) => void;
}) {
  const start = currentMonth(now);
  const [offset, setOffset] = useState(0);
  const [hint, setHint] = useState("");
  const month0 = (start.month0 + offset) % 12;
  const year = start.year + Math.floor((start.month0 + offset) / 12);
  const days = availabilityMonth(year, month0, { periods, blocks, bookings, now });

  function press(d: CalendarDay) {
    if (d.past) return;
    if (!d.workday && !d.blocked) {
      setHint("Sem expediente neste dia da semana. Adicione um período na grade semanal acima.");
      return;
    }
    setHint(
      !d.blocked && d.lessons
        ? `Folga marcada. Este dia tem ${d.lessons} ${d.lessons === 1 ? "aula" : "aulas"}: a folga impede novas reservas, mas não cancela as já marcadas.`
        : "",
    );
    onToggle(d.date);
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => setOffset(Math.max(0, offset - 1))}
          disabled={offset === 0}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          style={[s.nav, offset === 0 && s.navDisabled]}
        >
          <Text style={s.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.month}>
          {MONTHS[month0]} de {year}
        </Text>
        <TouchableOpacity
          onPress={() => setOffset(Math.min(MONTHS_AHEAD, offset + 1))}
          disabled={offset === MONTHS_AHEAD}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          style={[s.nav, offset === MONTHS_AHEAD && s.navDisabled]}
        >
          <Text style={s.navText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={s.grid}>
        {WEEK.map((w, i) => (
          <View key={`w${i}`} style={s.cell}>
            <Text style={s.weekday}>{w}</Text>
          </View>
        ))}
        {days.map((d) => {
          const state = d.past
            ? "past"
            : d.blocked
              ? "blocked"
              : d.workday
                ? "open"
                : "closed";
          return (
            <View key={d.date} style={s.cell}>
              {d.inMonth && (
                <TouchableOpacity
                  onPress={() => press(d)}
                  disabled={d.past}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.day} de ${MONTHS[month0]}: ${
                    { past: "passado", blocked: "folga", open: "disponível", closed: "sem expediente" }[state]
                  }${d.lessons ? `, ${d.lessons} ${d.lessons === 1 ? "aula" : "aulas"}` : ""}`}
                  accessibilityState={{ selected: d.blocked, disabled: d.past }}
                  style={[s.day, s[state]]}
                >
                  <Text style={[s.dayText, state === "blocked" && s.blockedText, state === "past" && s.pastText]}>
                    {d.day}
                  </Text>
                  {state === "blocked" ? (
                    <Text style={s.tag}>folga</Text>
                  ) : d.lessons ? (
                    <View style={s.lessonDot} />
                  ) : null}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
      <View style={s.legend}>
        <Legend style={s.open} label="Disponível" />
        <Legend style={s.blocked} label="Folga" />
        <Legend style={s.closed} label="Sem expediente" />
        <View style={s.legendItem}>
          <View style={s.lessonDotLegend} />
          <Text style={s.legendText}>Com aulas</Text>
        </View>
      </View>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

function Legend({ style, label }: { style: object; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.swatch, style]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  nav: {
    width: 36,
    height: 36,
    borderRadius: UI.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.color.primarySoft,
  },
  navDisabled: { opacity: 0.35 },
  navText: { fontSize: 20, lineHeight: 22, color: UI.color.primary, fontWeight: "700" },
  month: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: UI.color.text },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // 7 colunas que se ajustam à largura (celular e desktop).
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2, maxHeight: 56 },
  weekday: { textAlign: "center", fontSize: 12, fontWeight: "700", color: UI.color.textSecondary, marginTop: 8 },
  day: {
    flex: 1,
    borderRadius: UI.radius.small,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  open: { backgroundColor: UI.color.successSoft, borderColor: "#B9E3CF" },
  blocked: { backgroundColor: UI.color.dangerSoft, borderColor: "#F2B8BF" },
  closed: { backgroundColor: UI.color.backgroundApp, borderColor: UI.color.border },
  past: { backgroundColor: "transparent", borderColor: "transparent" },
  dayText: { fontSize: 14, fontWeight: "700", color: UI.color.text },
  blockedText: { color: UI.color.dangerText },
  pastText: { color: UI.color.textSecondary, opacity: 0.5, fontWeight: "400" },
  tag: { fontSize: 9, lineHeight: 11, color: UI.color.dangerText, fontWeight: "700" },
  lessonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: UI.color.primary, marginTop: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  lessonDotLegend: { width: 8, height: 8, borderRadius: 4, backgroundColor: UI.color.primary },
  legendText: { fontSize: 12, color: UI.color.textSecondary },
  hint: { fontSize: 12.5, color: UI.color.warningText, backgroundColor: UI.color.warningSoft, padding: 10, borderRadius: UI.radius.small },
});
