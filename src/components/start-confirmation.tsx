import { useState } from "react";
import { View } from "react-native";
import { useSession, dateTime, type Booking } from "@/services/session";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ThemedText as Text } from "./themed-text";
import { panelStyles as s } from "@/constants/panel-styles";
export function StartConfirmation({ booking: b }: { booking: Booking }) {
  const { state, run, refresh, busy } = useSession();
  const me = state!.me!;
  const [code, setCode] = useState("");
  const c = b.startConfirmation;
  if (me.role === "admin")
    return state?.demo ? (
      <View style={s.gap}>
        <Text style={s.small}>
          Relógio exclusivo deste cenário fictício. Não altera o computador.
        </Text>
        {(
          [
            ["start", "Ensaio: horário de início"],
            ["expired", "Ensaio: após dez minutos"],
            ["end", "Ensaio: término da aula"],
          ] as const
        ).map(([stage, title]) => (
          <Button
            key={stage}
            title={title}
            variant="secondary"
            disabled={busy}
            onPress={async () => {
              if (await run("setDemoClock", { booking: b.id, stage }))
                await refresh();
            }}
          />
        ))}
      </View>
    ) : null;
  if (!b.startCodeRequired)
    return (
      <Text style={s.small}>
        Aula anterior à confirmação por código; histórico preservado.
      </Text>
    );
  if (!b.paid || !["confirmado", "concluido"].includes(b.status)) return null;
  return (
    <View style={s.gap}>
      <Text style={s.cardTitle}>Confirmar início da aula</Text>
      <Text>
        Prazo: {dateTime(b.start)} até {dateTime(b.start + 10 * 60000)}
      </Text>
      <Text>
        Situação:{" "}
        {(
          {
            aguardando: "Código gerado · validação a partir do início",
            disponivel: "Disponível",
            confirmado: "Confirmado",
            expirado: "Expirado",
            bloqueado: "Bloqueado",
          } as Record<string, string>
        )[c?.status || ""] || "Aguardando horário"}
      </Text>
      {c?.code && me.id === b.student && (
        <>
          <Text style={s.number}>{c.code}</Text>
          <Text>
            Compartilhe este código somente com seu instrutor no início desta
            aula.
          </Text>
        </>
      )}
      {c?.status === "disponivel" && me.id === b.instructor && (
        <>
          <Input
            label="Código informado pelo aluno"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={8}
          />
          <Button
            title="Validar código de início"
            disabled={busy || code.length !== 8}
            onPress={async () => {
              if (await run("confirmStart", { booking: b.id, code }))
                setCode("");
            }}
          />
        </>
      )}
      {c?.confirmedAt && (
        <Text>Início confirmado em {dateTime(c.confirmedAt)}</Text>
      )}
      {["expirado", "bloqueado"].includes(c?.status || "") && (
        <>
          <Text style={s.error}>
            Confirmação não realizada no prazo ou limite de tentativas atingido.
            Nenhuma falta, multa ou cancelamento foi aplicado. Elegibilidade
            bloqueada para análise.
          </Text>
          <Button
            title="Encaminhar início ao suporte"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run("support", {
                reason: `Solicito análise da confirmação de início da aula ${b.id}. Situação: ${c?.status}.`,
              })
            }
          />
        </>
      )}
      <Text style={s.small}>
        A confirmação de início não conclui a aula. A tolerância de 20 minutos
        para falta do aluno é uma regra separada, com análise administrativa.
      </Text>
    </View>
  );
}
