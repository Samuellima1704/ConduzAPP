import { useEffect, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { getBytes, getMetadata, ref } from "firebase/storage";
import { storage } from "@/services/firebase";
export function StoredImage({
  path,
  style,
  fallback,
  label = "Imagem",
}: {
  path?: string | null;
  style: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
  label?: string;
}) {
  const [uri, setUri] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setUri("");
    setFailed(false);
    const timeout = setTimeout(() => {
      if (alive && path) setFailed(true);
    }, 15000);
    if (path) {
      const r = ref(storage, path);
      Promise.all([getBytes(r, 5 * 1024 * 1024), getMetadata(r)])
        .then(([data, meta]) => {
          let b = "";
          for (const n of new Uint8Array(data)) b += String.fromCharCode(n);
          if (alive) {
            setUri(`data:${meta.contentType};base64,${btoa(b)}`);
            setFailed(false);
          }
        })
        .catch(() => {
          // A falha aparece na própria tela (estado "failed"), sem log no console.
          if (alive) setFailed(true);
        })
        .finally(() => clearTimeout(timeout));
    }
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, [path, attempt]);
  return uri ? (
    <Image
      accessibilityLabel={label}
      source={{ uri }}
      style={style}
      onError={() => {
        setUri("");
        setFailed(true);
      }}
    />
  ) : failed ? (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Tentar carregar ${label.toLowerCase()} novamente`}
      onPress={() => setAttempt((v) => v + 1)}
      style={style}
    >
      {fallback || (
        <Text>Imagem indisponível. Toque para tentar novamente.</Text>
      )}
    </TouchableOpacity>
  ) : (
    <View style={style}>{fallback}</View>
  );
}
