# Skill: Renderizar PDF

## Propósito

Receber markdown bem redigido + variáveis estruturais (cabeçalho, rodapé, customizações visuais) e gerar um arquivo PDF formatado. Domain-agnostic: não conhece nenhum conceito de domínio do framework — só sabe que recebe markdown e devolve PDF.

Esta é uma **skill compartilhada do framework** (`.skills/`). Qualquer processo pode invocá-la quando precisar transformar texto narrativo em documento PDF para distribuição ou arquivo.

## Inputs

- **caminho_markdown**: string — Path absoluto ou relativo para o arquivo `.md` que será renderizado.
- **caminho_pdf_saida**: string — Path para onde o PDF gerado deve ser gravado. O diretório pai precisa existir.
- **variaveis**: object — Bag de variáveis estruturais. Todos os campos são opcionais:
  - `titulo`: string — Título do documento (vai pra metadata do PDF).
  - `titulo_curto`: string — Título compacto que aparece no cabeçalho de cada página.
  - `loja`: string — Nome da loja/contexto, aparece no cabeçalho à direita.
  - `processo`: string — Nome do processo de origem, aparece no rodapé à esquerda.
  - `data`: string — Data de geração (formato livre, recomendado `YYYY-MM-DD` ou `DD/MM/YYYY`).
  - `css`: object — Mapa de variáveis CSS a sobrescrever. Cada chave vira uma `--<chave>` no `:root`. Exemplo: `{ "color-accent": "#C8102E", "font-serif": "Montserrat" }`. Veja `.skills/_lib/pdf-renderer/styles/default.css` para a lista completa de variáveis disponíveis.

## Outputs

- **registro_geracao**: object — Resultado:
  - `ok`: boolean — `true` se gerou com sucesso.
  - `path`: string — Path do PDF gerado.
  - `tamanho_bytes`: number — Tamanho do arquivo gerado.

## Implementação

### Pré-requisito (bootstrap)

Antes de invocar o renderizador, o agente deve garantir que as dependências Node estão instaladas. O script de bootstrap é idempotente — pode ser chamado em toda execução sem custo se já estiver instalado:

```bash
.skills/_lib/pdf-renderer/bootstrap.sh
```

Na primeira execução em uma máquina nova, isso baixa o Chromium do Puppeteer (~170 MB) e pode levar alguns minutos. Em execuções subsequentes é instantâneo.

### Passos

1. Garantir que o diretório de saída do `caminho_pdf_saida` existe (`mkdir -p`).
2. Rodar o bootstrap (idempotente).
3. Invocar o renderizador via shell:

```bash
node .skills/_lib/pdf-renderer/render.mjs \
  --in "{caminho_markdown}" \
  --out "{caminho_pdf_saida}" \
  --variables '{json com as variaveis}'
```

4. Capturar a saída JSON do stdout. Se exit code ≠ 0 ou `JSON.ok` ≠ `true`, tratar como falha.
5. Retornar o registro.

### Exemplo de invocação completa

```bash
.skills/_lib/pdf-renderer/bootstrap.sh && \
node .skills/_lib/pdf-renderer/render.mjs \
  --in "promocao/outputs/2026-04-10_relatorio-x.md" \
  --out "promocao/outputs/2026-04-10_relatorio-x.pdf" \
  --variables '{"titulo":"Relatório X","titulo_curto":"Relatório X","loja":"Loja Acme","processo":"promocao","data":"2026-04-10"}'
```

Saída esperada (stdout):

```json
{"ok":true,"path":"promocao/outputs/2026-04-10_relatorio-x.pdf","tamanho_bytes":234567}
```

### Customização visual via overrides da loja

A skill aceita customizações visuais através do parâmetro `variaveis.css`. **O agente que invoca a skill é responsável por extrair essas customizações do `{processo}/overrides.md`** (já é responsabilidade padrão do agente carregar overrides — ver contrato em `.dev/CLAUDE.dev.md`) e traduzir para o formato esperado.

A skill em si **não lê o overrides.md** — ela apenas recebe o objeto `css` já traduzido. Isso mantém a skill domain-agnostic.

Exemplo de customizações vindas de overrides:

```js
variaveis.css = {
  "color-accent": "#C8102E",
  "font-serif": "Montserrat",
  "color-text": "#222"
}
```

### Templates e estilos disponíveis

O renderizador usa por default:
- Template estrutural: `.skills/_lib/pdf-renderer/templates/report-default.html`
- Estilos: `.skills/_lib/pdf-renderer/styles/default.css`

Para v1, há apenas um template default. Templates alternativos podem ser passados via `--template` no futuro.

### Fallback

- **Bootstrap falha** (`npm install` retorna erro): a skill não tem como prosseguir. Retornar `ok: false` com mensagem indicando problema de instalação. O agente reporta erro para o Orquestrador.
- **render.mjs retorna exit ≠ 0**: capturar stderr, retornar `ok: false` com a mensagem de erro. O agente reporta erro.
- **PDF gerado mas vazio (≤ 1 KB)**: tratar como falha. Markdown ou template provavelmente está malformado. Retornar `ok: false`.

## Notas

- **Domain-agnostic estrito**: esta skill não conhece "promoção", "concorrentes", "estoque" ou qualquer conceito de domínio. Se precisar mencionar isso aqui, é sinal de que algum conceito vazou e precisa ser movido pra skill de processo.
- **Reutilizável**: qualquer processo do framework pode invocar. Compras, gestão de estoque, financeiro, etc.
- **Bootstrap é responsabilidade do agente**: a skill assume que o bootstrap pode ter sido rodado por outra invocação anterior. Sempre seguro chamar antes — é idempotente.
