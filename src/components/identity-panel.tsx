import { useState } from "react";
import { Image, Platform, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getIdTokenResult } from "firebase/auth";
import { ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/services/firebase";
import { useSession, dateTime, type Profile } from "@/services/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedText as Text } from "@/components/themed-text";
import { StoredImage } from "./stored-image";
import { identityStatusLabel } from "@/lib/presentation";
import { panelStyles as s } from "@/constants/panel-styles";
export function useImageUpload(document = false) {
  const { run, busy } = useSession();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(""),
    [sending, setSending] = useState(false);
  async function choose() {
    setMessage("");
    try {
      // No navegador, abrir o seletor diretamente no gesto do usuário.
      // Permissão da galeria pertence ao fluxo nativo; na web ela é desnecessária.
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setMessage("Autorize o acesso à galeria para selecionar a imagem.");
          return;
        }
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        allowsEditing: !document,
      });
      if (!r.canceled && r.assets[0]) {
        setAsset(r.assets[0]);
      }
    } catch {
      setMessage("Não foi possível abrir a galeria. Tente novamente.");
    }
  }
  async function send() {
    if (!asset) return;
    const user = auth.currentUser;
    if (!user) {
      setMessage("Sua sessão terminou. Entre novamente para salvar a foto.");
      return;
    }
    setSending(true);
    setMessage("");
    setProgress("Preparando imagem…");
    try {
      // ImagePicker web fornece o File original; blob: é somente a prévia.
      const blob = asset.file || (await (await fetch(asset.uri)).blob());
      const type = asset.mimeType || blob.type;
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(type) ||
        blob.size === 0 ||
        blob.size >= 5 * 1024 * 1024
      )
        throw Error("Use JPEG, PNG ou WebP menor que 5 MB.");
      const token = await getIdTokenResult(user);
      const scope = String(token.claims.stateScope || "state");
      const prefix = document ? "identityDocuments" : "profilePhotos";
      const path = `${prefix}/${scope}/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.image`;
      const upload = uploadBytesResumable(ref(storage, path), blob, {
        contentType: type,
      });
      let timedOut = false;
      // O retry padrão do SDK pode aguardar minutos quando o servidor de arquivos não responde.
      const timeout = setTimeout(() => {
        timedOut = true;
        upload.cancel();
      }, 30000);
      const unsubscribe = upload.on(
        "state_changed",
        (snapshot) => {
          setProgress(
            `Enviando imagem: ${Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)}%`,
          );
        },
        () => {},
      );
      try {
        await upload;
      } catch (error) {
        if (timedOut)
          throw Error(
            "O envio demorou mais que o esperado. Confira sua conexão e tente novamente.",
          );
        throw error;
      } finally {
        clearTimeout(timeout);
        unsubscribe();
      }
      if (auth.currentUser?.uid !== user.uid)
        throw Error(
          "Sua sessão mudou. Entre novamente antes de salvar a foto.",
        );
      setProgress("Imagem enviada. Validando e salvando no perfil…");
      if (await run(document ? "submitIdentity" : "setPhoto", { path })) {
        setAsset(null);
        setMessage(
          document
            ? "Documento enviado para análise manual."
            : "Foto atualizada e salva.",
        );
      } else {
        setMessage(
          "A imagem foi enviada, mas o perfil não foi atualizado. Confira o aviso no topo da tela e tente novamente.",
        );
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMessage(
        code === "storage/unauthorized"
          ? "Envio não autorizado. Entre novamente e confira se o arquivo pertence ao seu perfil."
          : code === "storage/unauthenticated"
            ? "Sua sessão terminou. Entre novamente para enviar a imagem."
            : e instanceof Error && !/firebase|storage|error/i.test(e.message)
              ? e.message
              : "Não foi possível enviar a imagem. Confira sua conexão e tente novamente.",
      );
    } finally {
      setSending(false);
      setProgress("");
    }
  }
  return {
    asset,
    message,
    progress,
    sending,
    busy,
    choose,
    send,
    discard: () => setAsset(null),
  };
}
type ImageUpload = ReturnType<typeof useImageUpload>;
function UploadImage({
  upload,
  document = false,
}: {
  upload: ImageUpload;
  document?: boolean;
}) {
  const { asset, message, progress, sending, busy, choose, send, discard } =
    upload;
  return (
    <View style={s.gap}>
      <Button
        title={
          document ? "Selecionar documento" : "Escolher foto de perfil"
        }
        variant="secondary"
        onPress={choose}
        disabled={sending || busy}
      />
      {asset && (
        <>
          <Text style={s.small}>
            {asset.fileName || "Imagem selecionada"} ·{" "}
            {asset.mimeType || "imagem"}
            {asset.fileSize
              ? ` · ${(asset.fileSize / 1024 / 1024).toFixed(2)} MB`
              : ""}
          </Text>
          <Image
            accessibilityLabel="Prévia da imagem selecionada"
            source={{ uri: asset.uri }}
            style={{ width: "100%", height: 180, resizeMode: "contain" }}
          />
          <Button
            title={
              document ? "Enviar documento" : "Salvar foto de perfil"
            }
            onPress={send}
            loading={sending}
            disabled={busy}
          />
          <Button
            title="Descartar prévia"
            variant="secondary"
            onPress={discard}
            disabled={sending}
          />
        </>
      )}
      {!!progress && <Text accessibilityLiveRegion="polite">{progress}</Text>}
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
    </View>
  );
}
function DocumentUpload() {
  const upload = useImageUpload(true);
  return <UploadImage upload={upload} document />;
}
export function IdentityPanel({
  photoOnly = false,
  photoUpload,
}: {
  photoOnly?: boolean;
  photoUpload: ImageUpload;
}) {
  const { state, run, busy } = useSession(),
    me = state!.me!;
  const identity = me.identity;
  return (
    <Card style={s.gap}>
      <Text style={s.cardTitle}>
        {photoOnly ? "Foto de perfil" : "Foto e verificação de identidade"}
      </Text>
      <Text style={s.muted}>
        Envie uma foto do seu documento com foto. Ele fica privado: só você e a
        administração podem vê-lo, e a análise é manual.
      </Text>
      <Text>Identidade: {identityStatusLabel(identity?.status)}</Text>
      <StoredImage
        path={me.photoPath}
        label="Foto de perfil atual"
        style={{ width: 96, height: 96, borderRadius: 48 }}
      />
      {!!me.photoPath && (
        <Text style={s.small}>
          Você pode substituir a foto. Uma nova comparação manual será
          necessária.
        </Text>
      )}
      <UploadImage upload={photoUpload} />
      {!!me.photoPath && (
        <Button
          title="Remover foto"
          variant="secondary"
          disabled={busy}
          onPress={() => run("removePhoto")}
        />
      )}
      {!photoOnly && !!identity?.submittedAt && (
        <Text>Enviado em {dateTime(identity.submittedAt)}</Text>
      )}
      {!photoOnly && identity?.documentPath && (
        <StoredImage
          path={identity.documentPath}
          label="Documento privado enviado"
          style={{ width: "100%", height: 180, resizeMode: "contain" }}
        />
      )}
      {!photoOnly && identity?.reason && (
        <Text>Parecer: {identity.reason}</Text>
      )}
      {!photoOnly && identity?.reviewedAt && (
        <Text style={s.small}>
          Decisão registrada em {dateTime(identity.reviewedAt)}
        </Text>
      )}
      {!photoOnly && <DocumentUpload />}
    </Card>
  );
}
export function IdentityAdmin({ profile: u }: { profile: Profile }) {
  const { run, busy, state } = useSession();
  const [reason, setReason] = useState("");
  const i = u.identity!;
  return (
    <Card style={s.gap}>
      <Text style={s.cardTitle}>Identidade · {u.name}</Text>
      <Text>
        Análise visual manual · {identityStatusLabel(i.status)}
      </Text>
      <StoredImage
        path={i.photoPath}
        label="Foto para comparação manual"
        style={{ width: 100, height: 100 }}
      />
      <StoredImage
        path={i.documentPath}
        label="Documento privado para análise"
        style={{ width: "100%", height: 210, resizeMode: "contain" }}
      />
      {i.submittedAt && <Text>{dateTime(i.submittedAt)}</Text>}
      {i.reason && <Text>Parecer: {i.reason}</Text>}
      {i.reviewedAt && (
        <Text style={s.small}>
          Decisão por {state?.users[i.reviewedBy || ""]?.name || "administração"}{" "}
          em {dateTime(i.reviewedAt)}
        </Text>
      )}
      {i.status === "pendente" && (
        <>
          <Input
            label="Parecer da verificação de identidade"
            value={reason}
            onChangeText={setReason}
          />
          {["aprovado", "rejeitado"].map((decision) => (
            <Button
              key={decision}
              title={
                decision === "aprovado"
                  ? "Aprovar identidade"
                  : "Rejeitar identidade"
              }
              variant="secondary"
              disabled={busy}
              onPress={() =>
                run("reviewIdentity", {
                  user: u.id,
                  decision,
                  reason,
                  documentPath: i.documentPath,
                  photoPath: i.photoPath,
                })
              }
            />
          ))}
        </>
      )}
    </Card>
  );
}
