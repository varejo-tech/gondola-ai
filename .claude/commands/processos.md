---
description: Lista todos os processos (plugins de tipo processo) atualmente instalados no framework
---

Você é o Orquestrador. O lojista acabou de pedir a lista de processos disponíveis.

**Implementação:**

1. Enumere plugins instalados consultando o cache do Claude Code:

```bash
ls ~/.claude/plugins/cache/ 2>/dev/null
```

2. Para cada diretório encontrado, leia o arquivo `.claude-plugin/plugin.json` e verifique se `gondola.tipo === "processo"`. Use:

```bash
for dir in ~/.claude/plugins/cache/*/; do
  manifest="$dir/.claude-plugin/plugin.json"
  if [ -f "$manifest" ]; then
    tipo=$(jq -r '.gondola.tipo // ""' "$manifest" 2>/dev/null)
    if [ "$tipo" = "processo" ]; then
      nome=$(jq -r '.name' "$manifest")
      desc=$(jq -r '.description' "$manifest")
      modo=$(jq -r '.gondola.modo // "desconhecido"' "$manifest")
      echo "$nome | $modo | $desc"
    fi
  fi
done
```

3. Apresente a lista ao lojista em linguagem operacional, no seu tom. Exemplo:

> Estes são os processos que você tem instalados:
>
> - **Promoção** (modo híbrido) — ciclo completo de promoção semanal, do analisar ao distribuir.
>
> Pode digitar `/promocao` para começar, ou me dizer em palavras o que você quer fazer.

4. Se a lista estiver vazia, informe: "Nenhum processo instalado no momento. Você pode instalar um plugin oficial do catálogo da Avanço com `/plugin marketplace add github:avanco/gondola-plugins-catalog` seguido de `/plugin install promocao@gondola-oficial`. Se precisar de ajuda para escolher o que instalar, é só me dizer o que você quer automatizar no seu supermercado."
