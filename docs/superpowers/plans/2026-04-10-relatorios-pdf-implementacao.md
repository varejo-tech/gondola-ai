# Relatórios PDF da Promoção — Plano de Implementação

> **For agentic workers:** Use **superpowers:executing-plans** para executar este plano. Steps usam checkbox (`- [ ]`) syntax para tracking. Verificações ao fim de cada fase são feitas pelo próprio agente executor — Leonardo não intervém entre fases.

**Goal:** Implementar a geração de dois relatórios PDF (Relatório de Concorrentes + Resumo da Promoção) no processo de Promoção, com distribuição via webhook n8n e fallback local quando o webhook não estiver configurado.

**Architecture:** Skill compartilhada do framework (`.skills/skill-renderizar-pdf`) que renderiza markdown→PDF via `md-to-pdf` (Puppeteer). Duas skills de redação process-specific produzem o markdown narrativo a partir dos outputs estruturados das fases anteriores. O `agente-execucao` orquestra: redação → renderização → distribuição. A `skill-distribuicao` ganha suporte a anexo PDF via base64 no payload e fallback local quando o webhook não estiver configurado.

**Tech Stack:** Node 18+ (já presente no projeto via Mission Control), `md-to-pdf` (npm), Puppeteer/Chromium (auto-baixado pelo md-to-pdf), bash, markdown.

**Spec:** [`docs/superpowers/specs/2026-04-10-relatorios-pdf-design.md`](../specs/2026-04-10-relatorios-pdf-design.md) — leia antes de começar.

**Pré-requisito:** o conceito de skills compartilhadas do framework (`.skills/`) já está formalizado nos templates de dev (`.dev/CLAUDE.dev.md`, `.dev/templates/criar-skill.md`, `.dev/templates/convencoes-framework.md`). O contrato de overrides nos agentes também já está em vigor. Esta implementação se apoia nesses padrões.

---

## File Structure

### Novos arquivos

| Path | Responsabilidade | Fase |
|---|---|---|
| `.gitignore` (raiz, **modificar**) | Adicionar regra para `node_modules/` em `.skills/_lib/` | 1 |
| `.skills/_lib/pdf-renderer/.gitignore` | Ignora `node_modules/` e saída de teste | 1 |
| `.skills/_lib/pdf-renderer/package.json` | Manifesto npm + dependência `md-to-pdf` | 1 |
| `.skills/_lib/pdf-renderer/bootstrap.sh` | Detecta ausência de `node_modules` e roda `npm install` (idempotente) | 1 |
| `.skills/_lib/pdf-renderer/render.mjs` | Script wrapper que recebe CLI args e chama `md-to-pdf` | 1 |
| `.skills/_lib/pdf-renderer/templates/report-default.html` | Template estrutural genérico (header + footer com placeholders `{{var}}`) | 1 |
| `.skills/_lib/pdf-renderer/styles/default.css` | CSS sóbrio com variáveis CSS no topo | 1 |
| `.skills/_lib/pdf-renderer/test/sample-input.md` | Markdown de smoke test (capa + seções + tabela) | 1 |
| `.skills/_lib/pdf-renderer/test/run-smoke.sh` | Script de smoke test que roda render.mjs e valida o PDF | 1 |
| `.skills/skill-renderizar-pdf.md` | Definição declarativa da skill compartilhada | 2 |
| `promocao/skills/skill-redacao-relatorio-concorrentes.md` | Skill de redação do relatório de concorrentes | 3 |
| `promocao/skills/skill-redacao-resumo-promocao.md` | Skill de redação do resumo da promoção | 3 |

### Arquivos modificados

| Path | Mudança | Fase |
|---|---|---|
| `promocao/skills/skill-distribuicao.md` | Adicionar suporte a anexo PDF (base64) + fallback local quando webhook ausente | 4 |
| `promocao/agents/agente-execucao.md` | Reescrita: 4 → 6 etapas (etapas 3 e 4 novas; etapa 5 é a antiga 3; etapa 6 é a antiga 4) | 4 |
| `promocao/CLAUDE.md` | Atualizar descrição da Fase 3 para refletir as 6 etapas | 4 |

### Fixtures de teste (criados/verificados na Fase 5)

| Path | Conteúdo |
|---|---|
| `.dev/fixtures/fixture-promocao-relatorio-concorrentes.json` | Mock do output da `skill-pesquisa-concorrente` |
| `.dev/fixtures/fixture-promocao-analise-promocional.json` | Mock do output do `agente-analista` |
| `.dev/fixtures/fixture-promocao-criacao-publicacao.json` | Mock do output do `agente-criativo` |

---

## Phase 1: Bootstrap da infraestrutura PDF compartilhada

**Goal:** Criar `.skills/_lib/pdf-renderer/` com um renderizador funcional capaz de gerar um PDF de teste a partir de markdown via CLI. Sem dependências de outras fases.

### Task 1.1: Atualizar .gitignore raiz

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Inspecionar .gitignore atual**

```bash
cat .gitignore
```

Verifique se já existe alguma regra mencionando `.skills/`. Se sim, ajuste a regra do Step 2 para não duplicar.

- [ ] **Step 2: Adicionar regra para node_modules de skills compartilhadas**

Adicionar ao final do `.gitignore` (se ainda não existir):

```
# Skills compartilhadas — node_modules locais por ferramenta
.skills/_lib/*/node_modules/
.skills/_lib/*/test/output/
```

- [ ] **Step 3: Confirmar a adição**

```bash
grep -A 1 "Skills compartilhadas" .gitignore
```

Expected: imprime a linha do comentário e a regra abaixo.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(.gitignore): ignora node_modules de skills compartilhadas"
```

### Task 1.2: Criar package.json e instalar md-to-pdf

**Files:**
- Create: `.skills/_lib/pdf-renderer/package.json`
- Create: `.skills/_lib/pdf-renderer/.gitignore`

- [ ] **Step 1: Criar a estrutura de pastas**

```bash
mkdir -p .skills/_lib/pdf-renderer/templates .skills/_lib/pdf-renderer/styles .skills/_lib/pdf-renderer/test
```

- [ ] **Step 2: Criar o .gitignore local**

Criar `.skills/_lib/pdf-renderer/.gitignore`:

```
node_modules/
test/output/
*.log
```

- [ ] **Step 3: Criar package.json**

Criar `.skills/_lib/pdf-renderer/package.json`:

```json
{
  "name": "pdf-renderer",
  "version": "1.0.0",
  "description": "Markdown to PDF rendering for the gondola.ai framework. Domain-agnostic shared skill runtime.",
  "type": "module",
  "private": true,
  "main": "render.mjs",
  "scripts": {
    "render": "node render.mjs",
    "smoke": "bash test/run-smoke.sh"
  },
  "dependencies": {
    "md-to-pdf": "^5.2.4"
  }
}
```

- [ ] **Step 4: Instalar dependências**

```bash
cd .skills/_lib/pdf-renderer && npm install
```

Expected: `node_modules/` é criado, o `md-to-pdf` é instalado e baixa o Chromium do Puppeteer (~170 MB). Pode demorar alguns minutos. O comando termina com exit code 0.

- [ ] **Step 5: Verificar instalação**

```bash
test -f .skills/_lib/pdf-renderer/node_modules/md-to-pdf/package.json && echo "md-to-pdf instalado"
```

Expected: imprime `md-to-pdf instalado`.

- [ ] **Step 6: Commit (sem node_modules)**

```bash
git add .skills/_lib/pdf-renderer/package.json .skills/_lib/pdf-renderer/.gitignore
git commit -m "feat(.skills/pdf-renderer): bootstrap npm — package.json + dependência md-to-pdf"
```

### Task 1.3: Bootstrap script

**Files:**
- Create: `.skills/_lib/pdf-renderer/bootstrap.sh`

- [ ] **Step 1: Criar bootstrap.sh**

Criar `.skills/_lib/pdf-renderer/bootstrap.sh`:

```bash
#!/usr/bin/env bash
# Bootstrap idempotente do pdf-renderer.
# Roda npm install se node_modules ausente. Seguro chamar em toda execução.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$SCRIPT_DIR/node_modules/md-to-pdf" ]; then
  echo "[pdf-renderer] node_modules ausente — instalando dependências (pode levar alguns minutos na primeira vez)..."
  (cd "$SCRIPT_DIR" && npm install --silent)
  echo "[pdf-renderer] dependências instaladas."
fi
```

- [ ] **Step 2: Tornar executável**

```bash
chmod +x .skills/_lib/pdf-renderer/bootstrap.sh
```

- [ ] **Step 3: Testar idempotência**

```bash
.skills/_lib/pdf-renderer/bootstrap.sh
echo "exit code: $?"
```

Expected: termina silenciosamente (sem nenhuma saída — pois `node_modules` já existe), imprime `exit code: 0`.

- [ ] **Step 4: Commit**

```bash
git add .skills/_lib/pdf-renderer/bootstrap.sh
git commit -m "feat(.skills/pdf-renderer): bootstrap script idempotente"
```

### Task 1.4: Template HTML estrutural

**Files:**
- Create: `.skills/_lib/pdf-renderer/templates/report-default.html`

- [ ] **Step 1: Criar template**

Criar `.skills/_lib/pdf-renderer/templates/report-default.html`:

```html
<!--
  Template estrutural genérico para o pdf-renderer.
  Domain-agnostic: não menciona conceito de domínio nenhum.

  As tags <header> e <footer> abaixo são extraídas pelo render.mjs e
  injetadas como headerTemplate/footerTemplate do md-to-pdf (que internamente
  vão para as opções correspondentes do Puppeteer).

  Variáveis no formato {{nome}} são substituídas em tempo de geração com base
  no objeto `variables` recebido pelo render.mjs.
-->

<header>
  <div class="report-header">
    <span class="report-header-title">{{titulo_curto}}</span>
    <span class="report-header-meta">{{loja}}</span>
  </div>
</header>

<footer>
  <div class="report-footer">
    <span class="report-footer-meta">{{processo}} • {{data}}</span>
    <span class="report-footer-page">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add .skills/_lib/pdf-renderer/templates/report-default.html
git commit -m "feat(.skills/pdf-renderer): template HTML estrutural genérico"
```

### Task 1.5: CSS default

**Files:**
- Create: `.skills/_lib/pdf-renderer/styles/default.css`

- [ ] **Step 1: Criar default.css**

Criar `.skills/_lib/pdf-renderer/styles/default.css`:

```css
/*
  CSS default do pdf-renderer.
  Domain-agnostic. Variáveis CSS no topo permitem customização rápida —
  o render.mjs injeta sobrescritas vindas do parâmetro `variables.css`.
*/

:root {
  --color-text: #1a1a1a;
  --color-text-soft: #555;
  --color-accent: #0a3d62;
  --color-rule: #e0e0e0;
  --color-table-stripe: #f6f6f6;
  --color-tag-bg: #eef3f8;
  --color-tag-text: #0a3d62;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-serif: Georgia, "Times New Roman", Times, serif;
  --font-size-body: 11pt;
  --line-height-body: 1.55;
  --space-section: 1.2em;
}

@page {
  size: A4;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-text);
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  color: var(--color-accent);
  font-weight: 600;
  margin-top: var(--space-section);
  margin-bottom: 0.4em;
  line-height: 1.25;
  page-break-after: avoid;
}

h1 { font-size: 22pt; border-bottom: 2px solid var(--color-accent); padding-bottom: 0.2em; }
h2 { font-size: 16pt; }
h3 { font-size: 13pt; }
h4 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-soft); }

p {
  margin: 0 0 0.7em;
  text-align: justify;
  hyphens: auto;
}

a { color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-rule); }

ul, ol { margin: 0 0 0.8em 1.4em; padding: 0; }
li { margin-bottom: 0.25em; }

blockquote {
  border-left: 3px solid var(--color-accent);
  margin: 0.8em 0;
  padding: 0.4em 1em;
  background: var(--color-table-stripe);
  color: var(--color-text-soft);
  font-style: italic;
}

code {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--color-table-stripe);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0 1.2em;
  font-size: 10pt;
  page-break-inside: avoid;
}

th {
  background: var(--color-accent);
  color: #fff;
  text-align: left;
  padding: 0.5em 0.7em;
  font-weight: 600;
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

td {
  padding: 0.45em 0.7em;
  border-bottom: 1px solid var(--color-rule);
  vertical-align: top;
}

tr:nth-child(even) td { background: var(--color-table-stripe); }

.cover-page {
  page-break-after: always;
  padding-top: 30%;
  text-align: center;
}

.cover-page h1 {
  font-size: 32pt;
  border: 0;
  margin-bottom: 0.5em;
}

.cover-page .cover-meta {
  color: var(--color-text-soft);
  font-size: 11pt;
  max-width: 70%;
  margin: 1em auto;
  font-style: italic;
}

.tag {
  display: inline-block;
  background: var(--color-tag-bg);
  color: var(--color-tag-text);
  padding: 0.1em 0.6em;
  border-radius: 10px;
  font-size: 9pt;
  font-weight: 600;
}

.tag-warn { background: #fff4e5; color: #b25500; }
.tag-low { background: #fbeaea; color: #a01b1b; }

.report-header,
.report-footer {
  font-family: var(--font-sans);
  font-size: 8pt;
  color: var(--color-text-soft);
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 0 18mm;
}
```

- [ ] **Step 2: Commit**

```bash
git add .skills/_lib/pdf-renderer/styles/default.css
git commit -m "feat(.skills/pdf-renderer): CSS default sóbrio com variáveis CSS"
```

### Task 1.6: render.mjs script

**Files:**
- Create: `.skills/_lib/pdf-renderer/render.mjs`

- [ ] **Step 1: Criar render.mjs**

Criar `.skills/_lib/pdf-renderer/render.mjs`:

```javascript
#!/usr/bin/env node
/**
 * pdf-renderer / render.mjs
 *
 * Recebe markdown + template HTML + CSS + variáveis e gera PDF.
 * Domain-agnostic — não conhece nenhum conceito de processo do framework.
 *
 * Uso:
 *   node render.mjs --in <md> --out <pdf> [--template <html>] [--styles <css>] [--variables <json>]
 *
 * Exit codes:
 *   0 — sucesso
 *   1 — erro de uso (args inválidos, arquivo não encontrado)
 *   2 — falha na geração do PDF
 */

import { mdToPdf } from 'md-to-pdf';
import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI args
const argv = process.argv.slice(2);
function arg(name, fallback = null) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
}

const inputPath = arg('in');
const outputPath = arg('out');
const templatePath = arg('template', resolve(__dirname, 'templates/report-default.html'));
const stylesPath = arg('styles', resolve(__dirname, 'styles/default.css'));
const variablesJson = arg('variables', '{}');

if (!inputPath || !outputPath) {
  console.error('Uso: node render.mjs --in <md> --out <pdf> [--template <html>] [--styles <css>] [--variables <json>]');
  process.exit(1);
}

let variables;
try {
  variables = JSON.parse(variablesJson);
} catch (e) {
  console.error(`--variables JSON inválido: ${e.message}`);
  process.exit(1);
}

// Carrega template HTML e extrai <header> e <footer>
let templateHtml;
try {
  templateHtml = readFileSync(templatePath, 'utf-8');
} catch (e) {
  console.error(`Não foi possível ler template em ${templatePath}: ${e.message}`);
  process.exit(1);
}

function extractTag(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = html.match(re);
  return match ? match[1].trim() : '';
}

function applyVars(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

const headerHtml = applyVars(extractTag(templateHtml, 'header'), variables);
const footerHtml = applyVars(extractTag(templateHtml, 'footer'), variables);

// Carrega CSS e injeta variáveis CSS customizadas
let baseCss;
try {
  baseCss = readFileSync(stylesPath, 'utf-8');
} catch (e) {
  console.error(`Não foi possível ler CSS em ${stylesPath}: ${e.message}`);
  process.exit(1);
}

function injectCssVars(css, customVars) {
  if (!customVars || typeof customVars !== 'object' || Object.keys(customVars).length === 0) {
    return css;
  }
  const decls = Object.entries(customVars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  if (css.includes(':root {')) {
    return css.replace(':root {', `:root {\n${decls}`);
  }
  return `:root {\n${decls}\n}\n${css}`;
}

const finalCss = injectCssVars(baseCss, variables.css);

// Renderiza
try {
  const pdf = await mdToPdf(
    { path: inputPath },
    {
      dest: outputPath,
      css: finalCss,
      document_title: variables.titulo ?? variables.titulo_curto ?? 'Relatório',
      pdf_options: {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: headerHtml || '<span></span>',
        footerTemplate: footerHtml || '<span></span>',
        margin: { top: '25mm', bottom: '20mm', left: '18mm', right: '18mm' },
      },
    }
  );

  if (!pdf) {
    console.error('Geração de PDF retornou null');
    process.exit(2);
  }

  const stats = statSync(outputPath);
  console.log(JSON.stringify({ ok: true, path: outputPath, tamanho_bytes: stats.size }));
} catch (e) {
  console.error(`Falha na geração do PDF: ${e.message}`);
  process.exit(2);
}
```

- [ ] **Step 2: Tornar executável**

```bash
chmod +x .skills/_lib/pdf-renderer/render.mjs
```

- [ ] **Step 3: Commit**

```bash
git add .skills/_lib/pdf-renderer/render.mjs
git commit -m "feat(.skills/pdf-renderer): render.mjs script wrapper"
```

### Task 1.7: Smoke test

**Files:**
- Create: `.skills/_lib/pdf-renderer/test/sample-input.md`
- Create: `.skills/_lib/pdf-renderer/test/run-smoke.sh`

- [ ] **Step 1: Criar markdown de teste**

Criar `.skills/_lib/pdf-renderer/test/sample-input.md`:

```markdown
<div class="cover-page">

# Relatório de Teste

**Período:** janeiro de 2026
**Para:** equipe de testes

<p class="cover-meta">Documento gerado automaticamente pelo pdf-renderer para verificação do pipeline de geração.</p>

</div>

# Resumo Executivo

Este é um documento de **teste** para validar que o pipeline de geração de PDF está funcionando. Inclui exemplos de tipografia, listas, tabelas, citações e tags de status.

## Tipografia e estilos

Texto em parágrafo com **negrito**, *itálico*, e [link de exemplo](https://example.com). Tipografia serif para títulos, sans para corpo. Justificação ativa nos parágrafos.

> Citação em destaque para validar o estilo de blockquote. Deve aparecer com fundo cinza claro e borda lateral em accent color.

## Lista de itens

- Item simples
- Outro item, com **destaque**
- Terceiro item, com `código inline`

## Tabela exemplo

| Produto | Marca | Preço | Status |
|---|---|---|---|
| Item A | Marca X | R$ 24,90 | <span class="tag">alta</span> |
| Item B | Marca Y | R$ 8,50 | <span class="tag tag-warn">média</span> |
| Item C | Marca Z | R$ 4,20 | <span class="tag tag-low">baixa</span> |

## Conclusão

Se este documento foi renderizado corretamente — com capa, cabeçalho, rodapé com paginação, tipografia, tabela com listras e tags coloridas — o pipeline está funcional.
```

- [ ] **Step 2: Criar script de smoke test**

Criar `.skills/_lib/pdf-renderer/test/run-smoke.sh`:

```bash
#!/usr/bin/env bash
# Smoke test do pdf-renderer.
# Renderiza sample-input.md e valida que o PDF foi gerado e tem tamanho razoável.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$SCRIPT_DIR/output"

mkdir -p "$OUT_DIR"

# Bootstrap (idempotente)
"$RENDERER_DIR/bootstrap.sh"

# Roda render.mjs
node "$RENDERER_DIR/render.mjs" \
  --in "$SCRIPT_DIR/sample-input.md" \
  --out "$OUT_DIR/sample-output.pdf" \
  --variables '{"titulo":"Relatório de Teste","titulo_curto":"Teste","loja":"Loja Acme","processo":"smoke-test","data":"2026-04-10"}'

# Verifica que o PDF foi gerado
PDF="$OUT_DIR/sample-output.pdf"
if [ ! -f "$PDF" ]; then
  echo "[smoke] FALHA: PDF não foi gerado em $PDF"
  exit 1
fi

SIZE=$(wc -c < "$PDF" | tr -d ' ')
if [ "$SIZE" -lt 10000 ]; then
  echo "[smoke] FALHA: PDF muito pequeno ($SIZE bytes) — provavelmente vazio ou corrompido"
  exit 1
fi

echo "[smoke] OK: PDF gerado em $PDF ($SIZE bytes)"
```

- [ ] **Step 3: Tornar executável**

```bash
chmod +x .skills/_lib/pdf-renderer/test/run-smoke.sh
```

- [ ] **Step 4: Commit**

```bash
git add .skills/_lib/pdf-renderer/test/sample-input.md .skills/_lib/pdf-renderer/test/run-smoke.sh
git commit -m "test(.skills/pdf-renderer): smoke test"
```

### Verificação da Phase 1

- [ ] **Step 1: Rodar smoke test**

```bash
.skills/_lib/pdf-renderer/test/run-smoke.sh
```

Expected:
- Bootstrap roda silenciosamente (já instalado).
- `render.mjs` imprime no stdout: `{"ok":true,"path":"...","tamanho_bytes":NNNNN}`
- Smoke test imprime: `[smoke] OK: PDF gerado em ... (XXXXX bytes)`
- Exit code 0.

- [ ] **Step 2: Inspeção visual do PDF**

```bash
open .skills/_lib/pdf-renderer/test/output/sample-output.pdf
```

Verificar visualmente:
- Capa com título grande e meta em itálico
- Cabeçalho com "Teste" à esquerda e "Loja Acme" à direita em todas as páginas após a capa
- Rodapé com "smoke-test • 2026-04-10" e "Página X de Y"
- Tipografia serif nos títulos, sans no corpo
- Tabela com header em accent color (azul escuro), listras alternadas
- Tags coloridas: azul para "alta", laranja para "média", vermelho para "baixa"

- [ ] **Step 3: Limpar saída de teste**

```bash
rm -rf .skills/_lib/pdf-renderer/test/output/
```

(O `.gitignore` local já ignora `test/output/`, mas removemos para deixar o tree limpo.)

**Phase 1 completa quando:** smoke test passa e a inspeção visual confirma que o PDF está bem formatado.

---

## Phase 2: Skill compartilhada `skill-renderizar-pdf`

**Goal:** Criar a definição declarativa em `.skills/skill-renderizar-pdf.md` que descreve a interface da skill compartilhada para que agentes de qualquer processo possam invocá-la.

### Task 2.1: Criar `.skills/skill-renderizar-pdf.md`

**Files:**
- Create: `.skills/skill-renderizar-pdf.md`

- [ ] **Step 1: Criar a skill markdown**

Criar `.skills/skill-renderizar-pdf.md`:

```markdown
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
```

- [ ] **Step 2: Verificar regra domain-agnostic**

```bash
grep -iE "concorrent|sku|venda|hortifruti|frigorif" .skills/skill-renderizar-pdf.md && echo "VIOLAÇÃO" || echo "OK"
```

Expected: imprime `OK`. (Note: "promoção" aparece no path do exemplo `promocao/outputs/...` — isso é tolerável pois é só ilustração de path, não conceito de domínio embutido na skill.)

- [ ] **Step 3: Commit**

```bash
git add .skills/skill-renderizar-pdf.md
git commit -m "feat(.skills): skill-renderizar-pdf — definição declarativa"
```

### Verificação da Phase 2

- [ ] **Step 1: Verificar arquivo e estrutura**

```bash
test -f .skills/skill-renderizar-pdf.md && echo "skill OK"
grep -c "^## " .skills/skill-renderizar-pdf.md
```

Expected: imprime `skill OK` e contagem de seções principais ≥ 4 (Propósito, Inputs, Outputs, Implementação, Notas).

- [ ] **Step 2: Sanidade do exemplo**

A skill referencia comandos shell. Confirme que os caminhos `.skills/_lib/pdf-renderer/bootstrap.sh` e `.skills/_lib/pdf-renderer/render.mjs` mencionados na skill batem com os arquivos reais criados na Phase 1:

```bash
test -x .skills/_lib/pdf-renderer/bootstrap.sh && test -x .skills/_lib/pdf-renderer/render.mjs && echo "paths OK"
```

Expected: imprime `paths OK`.

**Phase 2 completa quando:** o markdown da skill segue convenções, é domain-agnostic, e os paths que ele cita batem com a infra da Phase 1.

---

## Phase 3: Skills de redação do processo Promoção

**Goal:** Criar as duas skills que produzem markdown narrativo a partir dos outputs estruturados do processo. Estas skills são process-specific (vivem em `promocao/skills/`) porque conhecem a estrutura dos dados de entrada e o vocabulário do domínio.

### Task 3.1: Criar `skill-redacao-relatorio-concorrentes`

**Files:**
- Create: `promocao/skills/skill-redacao-relatorio-concorrentes.md`

- [ ] **Step 1: Criar o arquivo**

Criar `promocao/skills/skill-redacao-relatorio-concorrentes.md`:

```markdown
# Skill: Redação do Relatório de Concorrentes

## Propósito

Receber o output estruturado da `skill-pesquisa-concorrente` (objeto `relatorio_concorrentes`) e produzir um **markdown narrativo bem redigido** voltado para a equipe comercial. O markdown gerado é depois renderizado em PDF via `skill-renderizar-pdf` (skill compartilhada do framework) para distribuição.

A redação não é descrição neutra dos dados ("foram encontradas X promoções"); é interpretação estratégica ("o concorrente está sustentando guerra de preço em proteínas — três SKUs abaixo de R$30/kg, todos com prazo curto, sinal de queima de estoque").

## Inputs

- **relatorio_concorrentes**: object — Output da `skill-pesquisa-concorrente`. Estrutura:
  - `data_analise`: string
  - `concorrentes`: array de objetos `{ perfil, posts_analisados, promocoes_encontradas[], posts_sem_promocao }`
    - `promocoes_encontradas[]`: `{ data_post, produto, marca, variacao, preco, prazo, condicoes, tipo_midia, link, confianca }`
    - `confianca`: `"alta"` | `"media"` | `"baixa"`
  - `comparativo`: array de `{ concorrente, produto, marca, variacao, preco, prazo }`
- **identificacao_loja**: string — Nome da loja onde o relatório está sendo gerado (vai no cabeçalho do documento).
- **periodo_referencia**: string (opcional) — Período de referência da análise. Default: usa `data_analise` do input.

## Outputs

- **caminho_markdown**: string — Path do arquivo `.md` gravado em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md`.
- **markdown_relatorio**: string — Conteúdo markdown completo (também retornado em memória para conveniência).

## Implementação

### Estrutura do markdown produzido

A skill produz um markdown com a seguinte estrutura. **Use estritamente esta ordem de seções** para manter consistência entre execuções:

```markdown
<div class="cover-page">

# Relatório de Concorrentes

**Período:** {periodo_referencia ou data_analise formatada em pt-BR}
**Para:** Equipe Comercial — {identificacao_loja}
**Perfis monitorados:** {N} ({lista compacta dos usernames separados por vírgula})

<p class="cover-meta">Análise estratégica das promoções identificadas em perfis de concorrentes via Instagram. Documento gerado automaticamente pelo processo de Promoção.</p>

</div>

# Resumo Executivo

{Parágrafo único de 3-5 frases. Tom de consultor reportando para diretor — direto, com números, com posição. Cobre: principais movimentações observadas, contagem total de promoções e perfis, e a oportunidade ou ameaça mais relevante do período.}

# Panorama por Concorrente

## {perfil}

**Posts analisados:** {posts_analisados} ({posts_sem_promocao} sem conteúdo promocional)

{Parágrafo curto de 2-3 frases interpretando o perfil deste concorrente: foco de categoria, frequência de comunicação, tom da comunicação, eventual padrão observado.}

| Produto | Marca | Variação | Preço | Prazo | Confiança |
|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco formatado pt-BR} | {prazo} | <span class="tag tag-{confianca-classe}">{confianca}</span> |

*Posts originais: [post 1]({link1}), [post 2]({link2}), ...*

{Repete a subseção `## {perfil}` para cada concorrente em concorrentes[].}

# Comparativo Consolidado

{Se houver sobreposição entre concorrentes (mesmo produto em 2+ perfis), gerar tabela cruzada com base no array `comparativo`. Caso contrário, escrever um parágrafo curto: "Não foram identificadas sobreposições diretas de SKU entre os concorrentes monitorados neste período."}

| Produto | Marca | Variação | {concorrente_1} | {concorrente_2} | {concorrente_N} | Observação |
|---|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco_1} | R$ {preco_2} | R$ {preco_N} | {comentário se for guerra de preço} |

# Conclusões e Recomendações

{Análise estratégica em prosa, NÃO em bullets. 2-4 parágrafos cobrindo:}

- Categorias mais aquecidas no período
- Faixas de preço praticadas, comparadas ao patamar habitual quando possível
- Oportunidades concretas para a loja
- Ameaças que exigem reação
- Sugestões de ação para a equipe comercial

# Notas de Confiança

A análise classifica cada extração em três níveis de confiança:

- **Alta** ({contagem}): preço e produto claramente legíveis na fonte
- **Média** ({contagem}): produto identificado mas preço incerto ou parcial
- **Baixa** ({contagem}): conteúdo aparenta ser promocional mas dados são ambíguos

Itens marcados como **baixa** devem ser validados manualmente antes de ações estratégicas baseadas neles.

---

*Relatório gerado pelo processo de Promoção em {data_analise}. Dados brutos disponíveis em `promocao/outputs/`.*
```

### Mapeamento de classes CSS de confiança

Use as seguintes classes ao formatar a coluna `Confiança` da tabela:

| Valor de `confianca` | Classe CSS |
|---|---|
| `"alta"` | `tag` (default azul) |
| `"media"` | `tag tag-warn` (laranja) |
| `"baixa"` | `tag tag-low` (vermelho) |

### Regras de redação

1. **Não invente dados.** Se um campo do input está vazio ou null, omita-o ou diga "não identificado". Nunca preencha com placeholder fictício.
2. **Tom de interpretação, não descrição.** Em vez de "foram encontradas 7 promoções no perfil X", escreva "o perfil X concentrou esforço em {categoria}, com 7 promoções, foco em {observação}".
3. **Use os números.** Sempre que um número for relevante (preço, contagem, percentual), inclua-o no texto.
4. **Formate preços em pt-BR.** Sempre `R$ XX,YY` (espaço, vírgula decimal, sem moeda em sigla).
5. **Datas em pt-BR.** `DD/MM/YYYY` no corpo do texto. ISO `YYYY-MM-DD` apenas em metadata.
6. **Aplique customizações da loja.** Esta skill é process-specific. O agente que invoca esta skill deve injetar instruções relevantes do `promocao/overrides.md` no contexto da redação (ex: "evitar mencionar marca X", "sempre destacar a categoria de hortifruti").

### Saída

A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md` (formato `YYYY-MM-DD` baseado em `data_analise`) e retorna o path. O agente que invoca a skill então passa esse path para a `skill-renderizar-pdf`.

## Notas

- **Process-specific**: vive em `promocao/skills/` porque conhece a estrutura específica do output da `skill-pesquisa-concorrente` e o vocabulário do domínio.
- **Inputs semânticos**: declara o input pelo significado, não pela estrutura interna do JSON.
- **Não chama `report-progress`**: quem reporta é o agente que a invoca.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-redacao-relatorio-concorrentes.md
git commit -m "feat(promocao/skills): skill-redacao-relatorio-concorrentes"
```

### Task 3.2: Criar `skill-redacao-resumo-promocao`

**Files:**
- Create: `promocao/skills/skill-redacao-resumo-promocao.md`

- [ ] **Step 1: Criar o arquivo**

Criar `promocao/skills/skill-redacao-resumo-promocao.md`:

```markdown
# Skill: Redação do Resumo da Promoção

## Propósito

Receber os outputs estruturados do `agente-analista` (análise promocional consolidada) e do `agente-criativo` (briefings, peças geradas e publicações realizadas) e produzir um **markdown narrativo bem redigido** voltado para os gerentes de loja. O markdown gerado é depois renderizado em PDF via `skill-renderizar-pdf` (skill compartilhada do framework).

O público-alvo são gerentes de loja que precisam **agir** — ajustar preço no PDV, preparar exposição, treinar equipe, monitorar estoque. O documento equilibra "o que está acontecendo" com "o que cabe a você fazer".

**Timing:** este resumo é gerado em Fase 3 do processo, depois que o analista e o criativo já rodaram. Quando o gerente recebe, **a peça já está publicada**. É um memorando do que está rolando + plano de ação operacional, não um plano hipotético.

## Inputs

- **analise_promocional**: object — Output do `agente-analista`. Estrutura esperada (ver agente-analista para detalhes):
  - `produtos_recomendados`: array de `{ produto, marca, variacao, preco_normal, preco_promocional, prazo, justificativa, score, panorama_concorrentes }`
  - `sugestoes_cross_selling`: array de `{ produto_ancora, produtos_correlacionados[], observacao }`
  - `recomendacao_final`: string — síntese estratégica do analista
- **registro_publicacao**: object — Output do `agente-criativo`. Estrutura:
  - `briefings`: array
  - `pecas`: array de `{ tipo, arquivo, briefing }`
  - `publicacoes`: array de `{ canal, link, data, post_id }`
- **identificacao_loja**: string — Nome da loja.
- **periodo_promocao**: string — Período em que a promoção fica ativa (ex.: "10/04 a 16/04").

## Outputs

- **caminho_markdown**: string — Path do arquivo `.md` gravado em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md`.
- **markdown_resumo**: string — Conteúdo markdown completo.

## Implementação

### Estrutura do markdown produzido

```markdown
<div class="cover-page">

# Promoção da Semana

**Período:** {periodo_promocao}
**Para:** Gerentes de Loja — {identificacao_loja}
**SKUs envolvidos:** {N} produtos

<p class="cover-meta">Resumo estratégico e plano de ação para a promoção em vigor. Documento gerado automaticamente pelo processo de Promoção.</p>

</div>

# Resumo Executivo

{Um parágrafo único de 3-5 frases. O que está sendo promovido, a razão estratégica em uma frase, e o que se espera. Tom de gerente sênior falando com outro gerente. Use linguagem do varejo.}

# Justificativa Estratégica

{Análise em prosa, 2-3 parágrafos. Cobre o **porquê** desta promoção:}

- Oportunidades observadas (estoque em pico, sazonalidade, margem disponível)
- Posicionamento competitivo (panorama de concorrentes — sem repetir o relatório de concorrentes; só o que justifica esta seleção específica)
- Sinergias com cross-selling (puxar categoria adjacente)
- Risco gerenciado (o que pode dar errado e o que está sendo monitorado)

{Use os campos `justificativa`, `score` e `panorama_concorrentes` de cada produto recomendado, mas **agregue em narrativa**, não em lista de SKUs.}

# Produtos Promovidos

{Tabela com todos os SKUs do `produtos_recomendados`. Uma linha por produto.}

| Produto | Marca | Variação | De | Por | Desconto | Prazo | Score |
|---|---|---|---|---|---|---|---|
| {produto} | {marca} | {variacao} | R$ {preco_normal} | **R$ {preco_promocional}** | -{percentual}% | {prazo} | {score}/10 |

{Para cada produto que tenha justificativa específica notável, adicionar logo abaixo da tabela um bloco curto:}

**{produto}** — {1-2 frases interpretando a justificativa específica deste SKU}

# Cross-selling Sugerido

{Para cada item em `sugestoes_cross_selling`:}

## {produto_ancora}

{Parágrafo curto explicando o cross-selling — por que estes produtos correlacionados, qual a sugestão de exposição conjunta na loja, qual o argumento de venda.}

- {produto_correlacionado_1}
- {produto_correlacionado_2}
- ...

{Repete para cada produto-âncora.}

# Comunicação Programada

{Listar as publicações em ordem cronológica.}

| Canal | Data/Hora | Tipo | Link |
|---|---|---|---|
| Instagram Feed | {data_publicacao} | Post promocional | [ver publicação]({link}) |

{Se houver mais peças programadas mas ainda não publicadas, indicar em parágrafo curto após a tabela.}

# Ações Operacionais

{Checklist do que o gerente precisa fazer. Use bullet list. Itens devem ser concretos e acionáveis.}

- [ ] Ajustar preços no sistema/PDV para todos os SKUs promovidos antes do início do prazo
- [ ] Preparar exposição em ponta de gôndola dos produtos-âncora
- [ ] Garantir reposição contínua durante o período (alta probabilidade de ruptura nos top 3)
- [ ] Briefar a equipe de frente sobre o argumento de venda de cada produto
- [ ] Monitorar diariamente: vendas dos SKUs promovidos, ruptura, ticket médio
- [ ] Acompanhar concorrentes durante a vigência (próximo relatório sai em {próxima data})

{Heurísticas para popular este checklist — use os dados do input para personalizar:}
- Se algum produto for perecível: adicionar item "checar validade da reposição"
- Se o `score` indicar alta rotatividade: reforçar a recomendação de reposição
- Se houver cross-selling: adicionar "garantir disponibilidade dos itens correlacionados"

---

*Resumo gerado pelo processo de Promoção em {data}. Dados completos da análise e da publicação disponíveis em `promocao/outputs/`.*
```

### Regras de redação

1. **Não invente dados.** Se um campo do input está vazio ou null, omita-o ou diga "não disponível". Nunca crie informação fictícia.
2. **Tom de gerente sênior.** Direto, com o porquê embutido. Linguagem do varejo, não da TI. Diga "ponta de gôndola", "reposição", "ruptura", "frente de loja".
3. **Use números sempre que possível.** Score, percentual de desconto, contagem de SKUs, datas. Números dão credibilidade.
4. **Formate preços em pt-BR.** Sempre `R$ XX,YY`.
5. **Datas em pt-BR.** `DD/MM/YYYY` no corpo do texto.
6. **Aplique customizações da loja.** O agente que invoca esta skill deve injetar instruções relevantes do `promocao/overrides.md`. Customizações comuns: omitir seção de Ações Operacionais (loja com processo próprio), adicionar instruções padrão (ex: "sempre avisar a equipe da gôndola fria às 6h"), tom de comunicação ("se referir aos clientes como 'fregueses'").
7. **Não duplique o relatório de concorrentes.** Mencione concorrentes só onde isso justifica uma decisão deste resumo. O panorama detalhado vai em outro documento.

### Saída

A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md` (formato `YYYY-MM-DD` baseado na data de execução) e retorna o path.

## Notas

- **Process-specific**: vive em `promocao/skills/` porque conhece o vocabulário e a estrutura dos outputs do analista e do criativo.
- **Inputs semânticos**: declara o input pelo significado.
- **Não chama `report-progress`**: quem reporta é o agente que a invoca.
- **Customizável via overrides**: especialmente a seção "Ações Operacionais", que tem heurísticas defaults mas pode ser sobrescrita pela loja.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-redacao-resumo-promocao.md
git commit -m "feat(promocao/skills): skill-redacao-resumo-promocao"
```

### Verificação da Phase 3

- [ ] **Step 1: Verificar arquivos criados**

```bash
test -f promocao/skills/skill-redacao-relatorio-concorrentes.md && \
test -f promocao/skills/skill-redacao-resumo-promocao.md && \
echo "skills OK"
```

Expected: imprime `skills OK`.

- [ ] **Step 2: Verificar seções obrigatórias em cada skill**

```bash
for f in promocao/skills/skill-redacao-relatorio-concorrentes.md promocao/skills/skill-redacao-resumo-promocao.md; do
  echo "--- $f"
  grep -E "^(## Propósito|## Inputs|## Outputs|## Implementação)" "$f"
done
```

Expected: cada arquivo lista as 4 seções.

- [ ] **Step 3: Confirmar que ambas declaram outputs em `promocao/outputs/`**

```bash
grep -l "promocao/outputs/" promocao/skills/skill-redacao-relatorio-concorrentes.md promocao/skills/skill-redacao-resumo-promocao.md
```

Expected: ambos os arquivos aparecem na saída.

**Phase 3 completa quando:** as duas skills existem, têm a estrutura esperada, e descrevem corretamente seus inputs/outputs.

---

## Phase 4: Adaptação da `skill-distribuicao` + `agente-execucao` + `promocao/CLAUDE.md`

**Goal:** Adaptar a skill de distribuição para suportar anexo PDF e fallback local; reescrever o agente-execução com 6 etapas (era 4); atualizar a definição do processo.

### Task 4.1: Adaptar `skill-distribuicao`

**Files:**
- Modify: `promocao/skills/skill-distribuicao.md`

- [ ] **Step 1: Reescrever skill-distribuicao do zero**

Substituir o conteúdo de `promocao/skills/skill-distribuicao.md` por:

```markdown
# Skill: Distribuição

## Propósito

Distribuir relatórios e comunicações da promoção para uma lista de contatos via WhatsApp. O envio é delegado a um workflow no n8n via webhook (recebe payload JSON com texto e/ou anexo PDF em base64). Suporta dois caminhos:

- **Caminho com anexo PDF** — payload inclui o PDF em base64; n8n converte e anexa como documento na mensagem WhatsApp.
- **Caminho só-texto** — payload sem anexo; n8n envia mensagem de texto.

Quando o webhook do n8n não estiver configurado, ativa **fallback local**: abre o PDF no visualizador padrão do sistema, ou imprime o texto no stdout. O fallback é sucesso, não erro — permite o lojista validar o processo end-to-end antes de configurar o n8n.

## Inputs

- **conteudo**: object — Conteúdo a distribuir:
  - `tipo`: string — Tipo do relatório (`"relatorio-concorrentes"` | `"resumo-promocao"` | `"confirmacao-publicacao"`)
  - `titulo`: string — Título da comunicação
  - `corpo`: string — Texto que acompanha (caption do anexo, ou mensagem só-texto)
- **destinatarios**: array — Lista de contatos: `{ nome, whatsapp, loja }` (lido de `config.json` → `contatos.equipe_comercial` ou `contatos.gerentes`)
- **arquivo_pdf**: string (opcional) — Path para PDF a anexar. Quando presente, ativa o caminho com anexo. Quando ausente, ativa o caminho só-texto.
- **webhook_url**: string — URL do webhook n8n (lido de `config.json` → `whatsapp.url_distribuicao`). Pode estar vazio, ausente ou `"PREENCHER"` — nesse caso a skill ativa o fallback local.

## Outputs

- **registro_envio**: object — Resultado da distribuição:
  - `data_envio`: string — Timestamp ISO
  - `conteudo_titulo`: string
  - `modo`: string — `"webhook"` | `"local"`
  - `webhook_status`: number ou null — HTTP status code (null se modo local)
  - `webhook_response`: object ou null — resposta do n8n (null se modo local)
  - `arquivo_aberto`: string ou null — path do arquivo aberto localmente (apenas no fallback com PDF)

## Implementação

### Detecção de modo

Antes de qualquer ação, a skill avalia o `webhook_url`:

```bash
if [ -z "${webhook_url:-}" ] || [ "$webhook_url" = "PREENCHER" ]; then
  modo="local"
else
  modo="webhook"
fi
```

### Modo webhook

1. Se `arquivo_pdf` está presente: ler o arquivo, codificar em base64.
2. Montar payload JSON:

```json
{
  "relatorio": {
    "tipo": "{conteudo.tipo}",
    "data": "{YYYY-MM-DD}",
    "conteudo": "{conteudo.corpo}"
  },
  "destinatarios": [
    { "nome": "...", "whatsapp": "+55...", "loja": "..." }
  ],
  "arquivo": {
    "nome": "{basename do arquivo_pdf}",
    "mime": "application/pdf",
    "base64": "{conteúdo base64 do PDF}"
  }
}
```

Quando `arquivo_pdf` está ausente, o bloco `"arquivo"` é omitido do payload.

3. POST para `webhook_url` com `Content-Type: application/json`.
4. Capturar status code e response body.
5. Retornar `registro_envio` com `modo: "webhook"`.

### Modo local (fallback)

1. Reportar ao operador (via mensagem ao agente que invocou): "n8n não configurado — abrindo o relatório localmente. Configure `whatsapp.url_distribuicao` para distribuição automática via WhatsApp."

2. Detectar SO:

```bash
case "$(uname -s)" in
  Darwin*)  open_cmd="open" ;;
  Linux*)   open_cmd="xdg-open" ;;
  CYGWIN*|MINGW*|MSYS*) open_cmd="start" ;;
  *) open_cmd="open" ;;
esac
```

3. Se `arquivo_pdf` está presente: abrir o arquivo no visualizador padrão:

```bash
$open_cmd "$arquivo_pdf"
```

(Em Windows: `start "" "$arquivo_pdf"` — string vazia entre `start` e o path.)

4. Se `arquivo_pdf` está ausente (modo só-texto): imprimir o conteúdo no stdout com cabeçalho:

```
=== DISTRIBUIÇÃO LOCAL (n8n não configurado) ===
Tipo: {conteudo.tipo}
Para: {lista de destinatarios}
Título: {conteudo.titulo}

{conteudo.corpo}
=================================================
```

5. Retornar `registro_envio` com `modo: "local"`, `webhook_status: null`, e `arquivo_aberto: {path}` (ou null se só-texto).

### Importante: fallback é sucesso

O fallback local termina com **status de sucesso**, não erro. A intenção é exatamente permitir validação sem dependência externa. O agente que invocou a skill deve tratar `modo: "local"` como conclusão normal e prosseguir com o fluxo.

### Fallback técnico (erros reais)

- **Webhook indisponível** (timeout, erro de conexão): retornar `registro_envio` com `webhook_status: null`, `erro: "webhook_indisponivel"`. O agente reporta erro ao Orquestrador.
- **Webhook retorna ≥ 400**: registrar status e response. Retornar `registro_envio` com erro. O agente reporta.
- **Falha ao abrir PDF localmente** (comando `open`/`xdg-open` retorna erro): tratar como erro real, retornar `registro_envio` com `erro: "abertura_local_falhou"`.

### Exemplo de invocação (modo webhook + PDF)

```bash
# Após gerar o PDF e ter o webhook_url configurado
PDF_BASE64=$(base64 -i "$pdf_path")
PAYLOAD=$(jq -n \
  --arg tipo "relatorio-concorrentes" \
  --arg data "2026-04-10" \
  --arg corpo "Segue o relatório semanal de concorrentes." \
  --arg nome_arquivo "$(basename "$pdf_path")" \
  --arg b64 "$PDF_BASE64" \
  --argjson destinatarios "$destinatarios_json" \
  '{relatorio:{tipo:$tipo,data:$data,conteudo:$corpo},destinatarios:$destinatarios,arquivo:{nome:$nome_arquivo,mime:"application/pdf",base64:$b64}}')

curl -s -X POST "$webhook_url" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

### Mudanças no workflow n8n (dependência externa)

O workflow n8n precisa ser atualizado para:
1. Detectar a presença de `body.arquivo`.
2. Usar nó "Move Binary Data" para converter `body.arquivo.base64` em binário.
3. Enviar mensagem WhatsApp com o documento anexado e o `body.relatorio.conteudo` como caption.

Esta mudança é responsabilidade do administrador do framework, não desta implementação.

## Notas

- **Compatibilidade com versão anterior preservada**: chamadas sem `arquivo_pdf` continuam funcionando exatamente como antes.
- **Skill não chama `report-progress`**: quem reporta é o agente.
- **Não conhece outros agentes nem outras skills**: recebe inputs semânticos (`conteudo`, `destinatarios`, `arquivo_pdf`, `webhook_url`) e pronto.
```

- [ ] **Step 2: Commit**

```bash
git add promocao/skills/skill-distribuicao.md
git commit -m "feat(promocao/skills): skill-distribuicao — anexo PDF + fallback local"
```

### Task 4.2: Reescrever `agente-execucao`

**Files:**
- Modify: `promocao/agents/agente-execucao.md`

- [ ] **Step 1: Reescrever o arquivo do zero**

Substituir o conteúdo de `promocao/agents/agente-execucao.md` por:

```markdown
# Agente Execução

## Escopo

**Faz:**
- ~~Dispara checklist de execução para gerentes de loja via WhatsApp~~ **[DESATIVADO]**
- ~~Coleta evidências fotográficas e confirmações~~ **[DESATIVADO]**
- ~~Escala itens não confirmados~~ **[DESATIVADO]**
- Gera relatório de concorrentes em PDF e distribui para a equipe comercial
- Gera resumo da promoção em PDF e distribui para os gerentes
- Distribui confirmação de publicação (texto) para a equipe de marketing

**Não faz:**
- Não analisa dados de vendas nem estoque (responsabilidade do agente-analista)
- Não cria materiais de comunicação para Instagram (responsabilidade do agente-criativo)
- Não publica em redes sociais
- Não define quais promoções executar — apenas reporta e distribui

## Skills utilizadas

- skill-redacao-relatorio-concorrentes: Para transformar o output da pesquisa de concorrentes em markdown narrativo bem redigido
- skill-redacao-resumo-promocao: Para transformar os outputs do analista e do criativo em markdown narrativo do resumo da promoção
- skill-renderizar-pdf (compartilhada do framework, em `.skills/`): Para converter os markdowns gerados em PDFs formatados
- skill-checklist-loja: **[DESATIVADO]** Para cobrar execução da promoção no chão de loja via WhatsApp (requer webhook)
- skill-distribuicao: Para enviar os PDFs como anexo via webhook n8n (com fallback local quando o webhook não estiver configurado) e para enviar comunicações só-texto

## Customizações da loja

Antes de executar as etapas abaixo, leia `promocao/overrides.md` se existir. Esse arquivo contém customizações operacionais que o lojista pediu ao Orquestrador para *esta* loja.

Aplique essas instruções durante toda a execução, sobrescrevendo o comportamento "de fábrica" sempre que fizer sentido. Em particular, observe customizações que podem afetar:

- A redação dos relatórios (tom, ênfases, omissões)
- As variáveis visuais dos PDFs (cor de destaque, logo, fontes — repassadas para `skill-renderizar-pdf` via `variaveis.css`)
- A seção "Ações Operacionais" do resumo da promoção
- Quem recebe cada tipo de relatório

Se o arquivo não existir, prossiga no padrão.

Não emita `report-progress` para esta leitura — é bootstrap do agente, não fase de trabalho.

## Etapas de execução

1. **Carregar promoções ativas**
   - Execute: `./report-progress.sh promocao agente-execucao preparacao started 1 6 "Carregando promoções ativas"`
   - Ler outputs do agente-analista (`promocao/outputs/*_analise-promocional.json`) e do agente-criativo (`promocao/outputs/*_criacao-publicacao.json`).
   - Extrair: lista de promoções ativas com produtos, preços, datas, peças publicadas.
   - Carregar `promocao/config.json` para obter `whatsapp.url_distribuicao`, `contatos.equipe_comercial`, `contatos.gerentes` e `assets_visuais` (logo, etc.).
   - Carregar `relatorio_concorrentes` (output da skill-pesquisa-concorrente, gravado pelo agente-analista junto da análise consolidada).

2. **Checklist de loja [DESATIVADO]**
   - Execute: `./report-progress.sh promocao agente-execucao checklist-loja disabled 2 6 "Checklist de loja desativado — funcionalidade futura"`
   - **Não executar.** Esta etapa está desativada (requer infraestrutura de webhook para coleta de respostas via WhatsApp).
   - Prosseguir direto para a próxima etapa.

3. **Preparar e distribuir relatório de concorrentes**
   - Execute: `./report-progress.sh promocao agente-execucao relatorio-concorrentes running 3 6 "Gerando relatório de concorrentes em PDF"`
   - Invocar `skill-redacao-relatorio-concorrentes` com:
     - `relatorio_concorrentes`: do output do analista
     - `identificacao_loja`: nome da loja (do config)
     - `periodo_referencia`: período da análise
   - A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.md`.
   - Bootstrap do PDF renderer: `.skills/_lib/pdf-renderer/bootstrap.sh`
   - Invocar `skill-renderizar-pdf` (compartilhada) com:
     - `caminho_markdown`: path do markdown gerado
     - `caminho_pdf_saida`: `promocao/outputs/{YYYY-MM-DD}_relatorio-concorrentes.pdf`
     - `variaveis`: `{ titulo: "Relatório de Concorrentes", titulo_curto: "Concorrentes", loja: <nome>, processo: "promocao", data: <data>, css: <customizações da loja se houver> }`
   - Invocar `skill-distribuicao` com:
     - `conteudo`: `{ tipo: "relatorio-concorrentes", titulo: "Relatório semanal de concorrentes", corpo: <texto curto introduzindo o anexo> }`
     - `destinatarios`: `config.contatos.equipe_comercial`
     - `arquivo_pdf`: path do PDF gerado
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Se `skill-distribuicao` retornar `modo: "local"`, registrar isso no log do agente — a etapa é sucesso, não erro.
   - Se retornar erro real (webhook indisponível, falha de envio): reportar `error` ao Orquestrador antes de prosseguir.

4. **Preparar e distribuir resumo da promoção**
   - Execute: `./report-progress.sh promocao agente-execucao resumo-promocao running 4 6 "Gerando resumo da promoção em PDF"`
   - Invocar `skill-redacao-resumo-promocao` com:
     - `analise_promocional`: do output do analista
     - `registro_publicacao`: do output do criativo
     - `identificacao_loja`: nome da loja
     - `periodo_promocao`: período em que a promoção fica ativa (calcular a partir dos prazos dos produtos)
   - A skill grava o markdown em `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.md`.
   - Invocar `skill-renderizar-pdf` com:
     - `caminho_markdown`: path do markdown gerado
     - `caminho_pdf_saida`: `promocao/outputs/{YYYY-MM-DD}_resumo-promocao.pdf`
     - `variaveis`: `{ titulo: "Promoção da Semana", titulo_curto: "Promoção", loja: <nome>, processo: "promocao", data: <data>, css: <customizações se houver> }`
   - Invocar `skill-distribuicao` com:
     - `conteudo`: `{ tipo: "resumo-promocao", titulo: "Resumo da promoção da semana", corpo: <texto curto> }`
     - `destinatarios`: `config.contatos.gerentes`
     - `arquivo_pdf`: path do PDF
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Tratamento de modo local e erros idêntico ao da etapa 3.

5. **Distribuir confirmação de publicação (condicional)**
   - Execute: `./report-progress.sh promocao agente-execucao confirmacao-publicacao running 5 6 "Distribuindo confirmação de publicação"`
   - Verificar se `config.contatos.marketing` existe e tem ao menos um item válido (não placeholder). Se **não** existir ou estiver vazio: pular esta etapa silenciosamente, registrando no log do agente "marketing não configurado, etapa pulada — não é erro". Considerar a etapa como **completed** mesmo assim.
   - Se houver destinatários, invocar `skill-distribuicao` (sem PDF, só texto) com:
     - `conteudo`: `{ tipo: "confirmacao-publicacao", titulo: "Promoção publicada", corpo: <texto com produtos promovidos, link da publicação no Instagram, data/hora> }`
     - `destinatarios`: `config.contatos.marketing`
     - `arquivo_pdf`: ausente
     - `webhook_url`: `config.whatsapp.url_distribuicao`
   - Esta etapa é considerada **completed** independente de ter enviado ou pulado por ausência de destinatário. Pulo por config ausente não é erro — é decisão operacional da loja.

6. **Consolidar e gravar status final**
   - Execute: `./report-progress.sh promocao agente-execucao consolidacao completed 6 6 "Distribuição concluída"`
   - Montar registro consolidado em JSON com:
     - Markdown e PDF gerados de cada relatório (paths)
     - Resultado de cada chamada de `skill-distribuicao` (modo: webhook ou local, sucesso/erro)
     - Pendências (se algo falhou e está em fallback ou erro)
   - Gravar em `promocao/outputs/{YYYY-MM-DD}_execucao-loja.json`
```

- [ ] **Step 2: Commit**

```bash
git add promocao/agents/agente-execucao.md
git commit -m "feat(promocao/agents): agente-execucao — 6 etapas com geração e distribuição de PDFs"
```

### Task 4.3: Atualizar `promocao/CLAUDE.md`

**Files:**
- Modify: `promocao/CLAUDE.md`

- [ ] **Step 1: Localizar a seção de fluxo**

```bash
grep -n "Fluxo de execução" promocao/CLAUDE.md
```

Verifique a linha onde começa a seção.

- [ ] **Step 2: Atualizar a descrição da Fase 3**

Editar `promocao/CLAUDE.md` substituindo a descrição da Fase 3 atual por:

```markdown
3. **Fase 3 — Coordenar** — agente-execucao consolida resultados, gera dois relatórios em PDF (relatório de concorrentes para a equipe comercial; resumo da promoção para os gerentes) e distribui via WhatsApp através de webhook n8n. Quando o webhook não estiver configurado, abre os PDFs localmente como fallback (a etapa segue como sucesso, não erro). Distribui também a confirmação de publicação (texto) para a equipe de marketing. Grava status consolidado em `outputs/`.
   - Checkpoint (modo híbrido): nenhum — a Fase 3 é integralmente automática.
```

(Substituir a Fase 3 anterior por inteiro.)

- [ ] **Step 3: Atualizar a linha do agente-execução na seção `## Agentes`**

Substituir a descrição atual de `agente-execucao` por:

```markdown
- agente-execucao: Garante a comunicação dos resultados — gera relatório de concorrentes e resumo da promoção em PDF, distribui via WhatsApp aos públicos certos (com fallback local), e envia confirmação de publicação para marketing.
```

- [ ] **Step 4: Commit**

```bash
git add promocao/CLAUDE.md
git commit -m "docs(promocao): atualiza Fase 3 — geração e distribuição de PDFs"
```

### Verificação da Phase 4

- [ ] **Step 1: Verificar arquivos modificados**

```bash
git log --oneline -5
```

Expected: ver os 3 commits desta fase no topo.

- [ ] **Step 2: Verificar coerência do agente-execução**

```bash
grep -c "report-progress.sh promocao agente-execucao" promocao/agents/agente-execucao.md
```

Expected: 6 chamadas de report-progress (uma por etapa).

- [ ] **Step 3: Verificar que o agente referencia as 3 skills novas**

```bash
grep -E "skill-redacao-relatorio-concorrentes|skill-redacao-resumo-promocao|skill-renderizar-pdf" promocao/agents/agente-execucao.md | wc -l
```

Expected: número ≥ 3 (cada skill mencionada pelo menos uma vez).

- [ ] **Step 4: Verificar que skill-distribuicao tem o fallback documentado**

```bash
grep -c "fallback\|local\|PREENCHER" promocao/skills/skill-distribuicao.md
```

Expected: vários matches (fallback é documentado).

**Phase 4 completa quando:** os 3 arquivos foram atualizados, o agente tem 6 etapas com report-progress correto, e a skill-distribuicao documenta o fallback local.

---

## Phase 5: Teste sandbox end-to-end

**Goal:** Rodar o processo de promoção em modo sandbox usando fixtures, gerar os PDFs reais e validar o fluxo completo (incluindo o fallback local de distribuição). Esta fase **não** muda código de produção — só roda os fluxos com dados mock para validar.

### Task 5.1: Verificar e criar fixtures necessários

**Files:**
- Verificar: `.dev/fixtures/`
- Criar (se não existir): fixtures faltantes

- [ ] **Step 1: Listar fixtures existentes**

```bash
ls .dev/fixtures/ 2>/dev/null || echo "diretório não existe"
```

Anote quais fixtures já existem.

- [ ] **Step 2: Criar fixture do output da skill-pesquisa-concorrente (se não existir)**

Se `.dev/fixtures/fixture-promocao-relatorio-concorrentes.json` não existir, criar com:

```json
{
  "data_analise": "2026-04-10",
  "concorrentes": [
    {
      "perfil": "atacadao_oficial",
      "posts_analisados": 18,
      "promocoes_encontradas": [
        {
          "data_post": "2026-04-08",
          "produto": "Picanha bovina",
          "marca": "Friboi",
          "variacao": "1kg",
          "preco": 49.90,
          "prazo": "até 12/04",
          "condicoes": "no PIX",
          "tipo_midia": "IMAGE",
          "link": "https://www.instagram.com/p/exemplo1/",
          "confianca": "alta"
        },
        {
          "data_post": "2026-04-07",
          "produto": "Arroz",
          "marca": "Tio João",
          "variacao": "5kg",
          "preco": 24.90,
          "prazo": "fim de semana",
          "condicoes": "",
          "tipo_midia": "CAROUSEL_ALBUM",
          "link": "https://www.instagram.com/p/exemplo2/",
          "confianca": "alta"
        },
        {
          "data_post": "2026-04-06",
          "produto": "Detergente",
          "marca": "Ypê",
          "variacao": "500ml",
          "preco": 2.49,
          "prazo": "validade não identificada",
          "condicoes": "leve 3 pague 2",
          "tipo_midia": "IMAGE",
          "link": "https://www.instagram.com/p/exemplo3/",
          "confianca": "media"
        }
      ],
      "posts_sem_promocao": 15
    },
    {
      "perfil": "fortatacadista",
      "posts_analisados": 12,
      "promocoes_encontradas": [
        {
          "data_post": "2026-04-09",
          "produto": "Picanha bovina",
          "marca": "Friboi",
          "variacao": "1kg",
          "preco": 52.00,
          "prazo": "até 13/04",
          "condicoes": "",
          "tipo_midia": "VIDEO",
          "link": "https://www.instagram.com/p/exemplo4/",
          "confianca": "alta"
        },
        {
          "data_post": "2026-04-08",
          "produto": "Frango congelado",
          "marca": "Sadia",
          "variacao": "kg",
          "preco": 9.99,
          "prazo": "até 14/04",
          "condicoes": "",
          "tipo_midia": "IMAGE",
          "link": "https://www.instagram.com/p/exemplo5/",
          "confianca": "alta"
        }
      ],
      "posts_sem_promocao": 10
    }
  ],
  "comparativo": [
    { "concorrente": "atacadao_oficial", "produto": "Picanha bovina", "marca": "Friboi", "variacao": "1kg", "preco": 49.90, "prazo": "até 12/04" },
    { "concorrente": "fortatacadista", "produto": "Picanha bovina", "marca": "Friboi", "variacao": "1kg", "preco": 52.00, "prazo": "até 13/04" }
  ]
}
```

- [ ] **Step 3: Criar fixture do output do agente-analista (se não existir)**

Se `.dev/fixtures/fixture-promocao-analise-promocional.json` não existir, criar com:

```json
{
  "data_analise": "2026-04-10",
  "produtos_recomendados": [
    {
      "produto": "Picanha bovina",
      "marca": "Friboi",
      "variacao": "1kg",
      "preco_normal": 69.90,
      "preco_promocional": 49.90,
      "prazo": "10/04 a 16/04",
      "justificativa": "Estoque acumulou em 430kg (28 dias de cobertura, acima do alvo de 14). Atacadão e Forte Atacadista também estão promovendo a SKU, com preços entre R$ 49,90 e R$ 52,00 — ficar nessa faixa garante competitividade.",
      "score": 9
    },
    {
      "produto": "Arroz",
      "marca": "Tio João",
      "variacao": "5kg",
      "preco_normal": 28.90,
      "preco_promocional": 23.90,
      "prazo": "10/04 a 16/04",
      "justificativa": "Item de alta rotatividade. Atacadão está com a mesma SKU a R$ 24,90 — descer um real abre vantagem perceptível. Margem permite.",
      "score": 8
    }
  ],
  "sugestoes_cross_selling": [
    {
      "produto_ancora": "Picanha bovina Friboi 1kg",
      "produtos_correlacionados": ["Sal grosso 1kg", "Carvão vegetal 5kg", "Cerveja long neck"],
      "observacao": "Trio clássico de churrasco. Expor junto à frente da loja."
    },
    {
      "produto_ancora": "Arroz Tio João 5kg",
      "produtos_correlacionados": ["Feijão carioca 1kg", "Óleo de soja 900ml"],
      "observacao": "Cesta básica completa. Posicionar lado a lado."
    }
  ],
  "recomendacao_final": "Esta semana puxar proteína (picanha) e mercearia básica (arroz). A picanha é defesa contra a guerra de preço dos concorrentes; o arroz é ataque com vantagem mínima de R$ 1,00 sobre o Atacadão."
}
```

- [ ] **Step 4: Criar fixture do output do agente-criativo (se não existir)**

Se `.dev/fixtures/fixture-promocao-criacao-publicacao.json` não existir, criar com:

```json
{
  "briefings": [
    {
      "produto": "Picanha bovina Friboi 1kg",
      "headline": "Picanha Friboi por R$ 49,90 — só nesta semana",
      "copy": "Pegue agora a melhor picanha pelo melhor preço da região. Estoque limitado.",
      "cronograma": "Publicar 10/04 às 08h"
    }
  ],
  "pecas": [
    {
      "tipo": "instagram_feed",
      "arquivo": ".dev/test-outputs/promocao/peca-picanha-mock.png",
      "briefing_ref": 0
    }
  ],
  "publicacoes": [
    {
      "canal": "instagram_feed",
      "link": "https://www.instagram.com/p/mock-publicacao-1/",
      "data": "2026-04-10T08:00:00-03:00",
      "post_id": "mock-post-id-12345"
    }
  ]
}
```

- [ ] **Step 5: Commit dos novos fixtures (se .dev/ for trackeado)**

```bash
git status .dev/fixtures/
```

Verifique se os fixtures aparecem como modificados/novos. **Se `.dev/` estiver no .gitignore** (provável — ver `.gitignore` raiz), pular o commit. **Se estiver versionado**, commitar:

```bash
git add .dev/fixtures/fixture-promocao-relatorio-concorrentes.json \
        .dev/fixtures/fixture-promocao-analise-promocional.json \
        .dev/fixtures/fixture-promocao-criacao-publicacao.json
git commit -m "test(fixtures): mock outputs para validação dos relatórios PDF"
```

### Task 5.2: Rodar a Fase 3 do processo em sandbox

**Files:**
- Generate: `.dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.md` e `.pdf`
- Generate: `.dev/test-outputs/promocao/2026-04-10_resumo-promocao.md` e `.pdf`

- [ ] **Step 1: Garantir que a pasta de test-outputs existe**

```bash
mkdir -p .dev/test-outputs/promocao
```

- [ ] **Step 2: Executar a Fase 3 em modo sandbox**

Seguir as instruções de "Teste de Processos" do `.dev/CLAUDE.dev.md`. As substituições principais para esta execução:
- APIs/MCPs indisponíveis → usar os fixtures criados na Task 5.1.
- `report-progress.sh` → não executar; logar local o que seria enviado.
- Outputs → gravar em `.dev/test-outputs/promocao/` em vez de `promocao/outputs/`.
- Webhook do n8n → simular vazio (`webhook_url = ""`) para forçar o caminho de fallback local.

Execute as etapas 3 e 4 do agente-execução manualmente, na ordem:

1. Carregar os fixtures como se fossem outputs do analista, criativo e pesquisa-concorrente.
2. Invocar `skill-redacao-relatorio-concorrentes` (seguindo a estrutura de markdown definida) — gravar em `.dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.md`.
3. Invocar `skill-renderizar-pdf` para o markdown acima:
   ```bash
   .skills/_lib/pdf-renderer/bootstrap.sh && \
   node .skills/_lib/pdf-renderer/render.mjs \
     --in ".dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.md" \
     --out ".dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.pdf" \
     --variables '{"titulo":"Relatório de Concorrentes","titulo_curto":"Concorrentes","loja":"Loja Acme (sandbox)","processo":"promocao","data":"2026-04-10"}'
   ```
4. Verificar que o PDF foi gerado:
   ```bash
   test -f .dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.pdf && \
     wc -c < .dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.pdf
   ```
5. Repetir 2-4 para o resumo da promoção (`skill-redacao-resumo-promocao` → markdown → renderizar-pdf).
6. Simular `skill-distribuicao` em modo fallback local: para cada PDF, usar o comando `open` (ou equivalente do SO) para abrir o arquivo.

- [ ] **Step 3: Inspeção visual dos PDFs**

```bash
open .dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.pdf
open .dev/test-outputs/promocao/2026-04-10_resumo-promocao.pdf
```

Verificar visualmente em cada PDF:

**Relatório de Concorrentes:**
- Capa com título "Relatório de Concorrentes" e período
- Resumo Executivo em parágrafo único
- Seção "Panorama por Concorrente" com uma subseção por concorrente do fixture (atacadao_oficial e fortatacadista)
- Tabelas formatadas, com tags coloridas de confiança
- Seção "Comparativo Consolidado" mostrando a sobreposição na picanha
- Conclusões em prosa
- Notas de Confiança ao final
- Cabeçalho e rodapé corretos

**Resumo da Promoção:**
- Capa com título "Promoção da Semana"
- Resumo Executivo
- Justificativa Estratégica em prosa
- Tabela de Produtos Promovidos com colunas De/Por/Desconto
- Cross-selling Sugerido (uma subseção por produto-âncora)
- Comunicação Programada com link para o post mock
- Ações Operacionais com checkboxes
- Cabeçalho e rodapé corretos

### Task 5.3: Documentar resultados

**Files:**
- Create: `.dev/test-outputs/promocao/RELATORIO-TESTE.md`

- [ ] **Step 1: Criar relatório de teste**

Criar `.dev/test-outputs/promocao/RELATORIO-TESTE.md` com:

```markdown
# Relatório de Teste — Relatórios PDF da Promoção

**Data do teste:** 2026-04-10
**Plano executado:** docs/superpowers/plans/2026-04-10-relatorios-pdf-implementacao.md
**Spec:** docs/superpowers/specs/2026-04-10-relatorios-pdf-design.md

## Resultados

| Item | Resultado | Observação |
|---|---|---|
| Phase 1 — bootstrap pdf-renderer | ✓ | smoke test passou, inspeção visual OK |
| Phase 2 — skill-renderizar-pdf | ✓ | domain-agnostic confirmado |
| Phase 3 — skills de redação | ✓ | duas skills criadas |
| Phase 4 — agente-execução | ✓ | 6 etapas, fallback local na distribuição |
| Phase 5 — sandbox end-to-end | (preencher) | (preencher) |

## Outputs gerados

- `.dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.md`
- `.dev/test-outputs/promocao/2026-04-10_relatorio-concorrentes.pdf`
- `.dev/test-outputs/promocao/2026-04-10_resumo-promocao.md`
- `.dev/test-outputs/promocao/2026-04-10_resumo-promocao.pdf`

## Observações da inspeção visual

(Preencher conforme inspeção: layout, tipografia, capa, header/footer, tabelas, cores das tags, fluidez da redação.)

## Pendências e ajustes sugeridos

(Preencher se algo não saiu conforme esperado. Em caso de ajustes pequenos, pode aplicar inline antes de fechar a fase. Em caso de ajustes grandes, criar issue.)
```

- [ ] **Step 2: Preencher o relatório com base no teste real**

Após rodar a Task 5.2, preencher as seções "Resultados", "Observações" e "Pendências".

### Verificação da Phase 5

- [ ] **Step 1: Verificar artefatos gerados**

```bash
ls -la .dev/test-outputs/promocao/
```

Expected: ver os 4 arquivos (2 .md + 2 .pdf) + o RELATORIO-TESTE.md.

- [ ] **Step 2: Verificar tamanho dos PDFs**

```bash
for f in .dev/test-outputs/promocao/*.pdf; do
  size=$(wc -c < "$f")
  echo "$f: $size bytes"
done
```

Expected: cada PDF tem ≥ 30 KB (relatórios completos com tabelas e múltiplas páginas).

- [ ] **Step 3: Confirmar inspeção visual no relatório de teste**

```bash
cat .dev/test-outputs/promocao/RELATORIO-TESTE.md
```

Expected: relatório preenchido com observações reais, sem placeholders.

**Phase 5 completa quando:** os 4 arquivos foram gerados, têm tamanho razoável, a inspeção visual confirma layout correto, e o RELATORIO-TESTE.md foi preenchido.

---

## Encerramento

Após a Phase 5 estar completa:

- [ ] **Sumário final**

Verificar:
1. `git log --oneline` mostra os commits de todas as 4 primeiras fases (Phase 5 não commita por padrão pois usa fixtures sandbox).
2. `git status` mostra working tree limpo (excluindo `.dev/test-outputs/` se versionado).
3. O `.dev/memory.dev.md` deve ganhar uma nova sessão registrando a implementação concluída — fazer isso como último passo.

- [ ] **Atualizar memory.dev.md com o fim da implementação**

Adicionar uma nova "Sessão N" em `.dev/memory.dev.md` registrando: o que foi implementado, decisões de design seguidas do spec, qualquer ajuste feito durante a execução, e o que ficou pendente para v2 (workflow n8n para anexar PDF, customização visual via overrides, etc.).

---

## Notas de execução

- **Verificação mínima entre fases:** ao final de cada fase, rode os comandos da seção "Verificação da Phase X" antes de seguir. Se algo falhar, pare e investigue — não acumule problemas.
- **Commits frequentes:** cada task tem seus próprios commits. Não junte mudanças de tasks diferentes em um único commit.
- **Nada de placeholders:** se uma instrução do plano for ambígua durante a execução, reconsulte o spec. Se ainda houver dúvida, registre como nota no relatório de teste e siga.
- **Domain-agnostic é regra dura:** ao escrever qualquer arquivo dentro de `.skills/`, não use vocabulário de domínio (promoção, concorrente, estoque, SKU). Se precisar mencionar isso, está no lugar errado.
- **Bootstrap idempotente:** o `.skills/_lib/pdf-renderer/bootstrap.sh` é seguro chamar em toda execução — se as dependências já estão instaladas, ele termina silenciosamente.
