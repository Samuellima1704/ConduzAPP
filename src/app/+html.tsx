import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Documento HTML da versão web (só roda no build/servidor web, nunca no celular).
// Define o título da aba, o idioma e os metadados com a identidade do ConduzAPP.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>ConduzAPP</title>
        <meta
          name="description"
          content="ConduzAPP: aulas de direção de 50 minutos com instrutores credenciados, agenda, pagamento e avaliação."
        />
        <meta name="theme-color" content="#1E2A78" />
        <meta property="og:title" content="ConduzAPP" />
        <meta
          property="og:description"
          content="Aulas de direção com instrutores credenciados."
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
