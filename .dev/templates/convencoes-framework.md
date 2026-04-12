# Convenções do Framework

Documento de referência com todas as convenções de nomenclatura, estrutura e documentação do framework Gondola AI.

---

## Dois Repositórios

| Repositório | Propósito |
|---|---|
| `gondola-ai` | Framework central: Orquestrador, Mission Control, scripts, contrato de plugin, docs |
| `gondola-plugins-catalog` | Catálogo oficial de plugins-processo da Avanço |

**O framework central não carrega nenhum processo de domínio.** Processos são plugins instalados via marketplace, não subpastas na raiz do framework.

---

## Nomenclatura

### Padrão geral: kebab-case

Todos os nomes de pastas, arquivos, subagentes e skills usam **kebab-case** (minúsculas, palavras separadas por hífen).

| Elemento | Padrão | Exemplo |
|---|---|---|
| Pasta do plugin | `{nome-do-processo}/` | `promocao/`, `compras/`, `gestao-estoque/` |
| Arquivo de subagente | `{papel}-{segmento}.md` | `analista-oportunidades.md`, `criativo-briefing.md` |
| Subpasta de skill | `{nome}/` | `oportunidade-promocional/`, `renderizar-pdf/` |
| Arquivo de skill | `SKILL.md` | Sempre este nome, dentro da subpasta |
| Arquivos de output | `{YYYY-MM-DD}_{descritivo}.json` | `2026-04-08_analise-vendas.json` |

### Prefixos e padrões

- Subagentes: prefixo de papel lógico (`analista-`, `criativo-`, `execucao-`)
- Skills: sem prefixo `skill-` — apenas o nome semântico da capacidade
- Fixtures de teste: `{plugin}-{descritivo}.json` em `gondola-plugins-catalog/.dev/fixtures/`

### Namespace de invocação

| Elemento | Namespace | Exemplo |
|---|---|---|
| Subagente | `{plugin}:{subagent-name}` | `promocao:analista-oportunidades` |
| Skill | `{plugin}:{skill-name}` | `promocao:oportunidade-promocional` |

O `name` no frontmatter do subagente **não inclui** o prefixo do plugin — é apenas o stem do filename: `analista-oportunidades`. O Claude Code resolve o namespace via `{plugin}:{name}` automaticamente (ex.: `promocao:analista-oportunidades`). Se o name incluísse o prefixo, o resultado seria `promocao:promocao-analista-oportunidades` (duplicação).

---

## Anatomia do Plugin de Processo

Todo plugin de processo deve conter esta estrutura:

```
{nome-do-processo}/                    ← pasta no gondola-plugins-catalog/
├── .claude-plugin/
│   └── plugin.json                    ← manifest obrigatório (só campos do Claude Code)
├── gondola.json                       ← metadados custom do framework (tipo, modo, deps)
├── processo.md                        ← definição do processo para o Orquestrador
├── commands/
│   └── {nome-do-processo}.md          ← slash command que aciona o processo
├── agents/                            ← subagentes nativos do Claude Code
│   └── {papel}-{segmento}.md          ← um arquivo por segmento de despacho
├── skills/                            ← skills específicas do processo
│   └── {nome-skill}/
│       └── SKILL.md                   ← frontmatter + instruções
├── templates/
│   └── config.template.json           ← esqueleto do config (valores "PREENCHER")
└── README.md
```

Nenhuma subpasta adicional deve ser criada sem justificativa documentada.

---

## Padrão do `plugin.json`

O schema do Claude Code é **estrito** — chaves desconhecidas causam erro de validação. Apenas campos reconhecidos:

```json
{
  "name": "{nome-do-processo}",
  "description": "{descrição em uma frase}",
  "version": "1.0.0"
}
```

| Campo | Descrição |
|---|---|
| `name` | Nome do plugin — deve ser igual ao nome da pasta e ao nome do slash command |
| `description` | Uma frase descrevendo o propósito |
| `version` | Semver |

## Padrão do `gondola.json`

Metadados custom do framework, na raiz do plugin (ao lado de `processo.md`). Separado do `plugin.json` para não conflitar com o schema do Claude Code:

```json
{
  "tipo": "processo",
  "modo": "auto | interativo | hibrido",
  "framework_min": "1.0",
  "dependencias": []
}
```

| Campo | Descrição |
|---|---|
| `tipo` | Sempre `"processo"` para plugins-processo |
| `modo` | `"auto"`, `"interativo"` ou `"hibrido"` |
| `framework_min` | Versão mínima do framework central compatível |
| `dependencias` | Lista de nomes de plugins pré-requisito, ou `[]` |

---

## Padrão do `processo.md`

O `processo.md` é lido pelo Orquestrador ao despachar o processo. Deve conter 6 seções obrigatórias:

1. **Identificação** — Nome, descrição, modo, versão.
2. **Fluxo de execução** — Fases ordenadas: subagente despachado, o que faz, se é checkpoint e qual pergunta ao lojista.
3. **Datasets consumidos** — Fontes de dados externas: nome lógico, propósito, campo em `config.json`.
4. **Texto guia de configuração** — Texto exato que o Orquestrador apresenta ao lojista para cada campo do `config.template.json`. Em linguagem de varejo.
5. **Dependências de outros processos** — Texto narrativo das dependências (declaração técnica em `plugin.json > gondola.dependencias`).
6. **Contratos dos subagentes** — Resumo de alto nível de cada subagente: o que faz, input esperado, o que retorna.

---

## Padrão de Subagente

Cada subagente é um arquivo `.md` em `{plugin}/agents/` com frontmatter YAML obrigatório:

```markdown
---
name: {papel}-{segmento}
description: {Uma frase descrevendo o que este subagente faz e quando é despachado.}
model: sonnet
tools: Read, Grep, Glob, Bash, Skill, Write
---

# {Nome Legível}

## Contexto
[...]

## Inputs esperados
- `caminho_config`: path para config.json em ${CLAUDE_PLUGIN_DATA}/{processo}/
- `caminhos_outputs_anteriores`: lista de paths para outputs de fases anteriores
- `instrucao_especifica`: instrução da fase atual do Orquestrador
- `resposta_lojista`: presente apenas quando este despacho é continuação após checkpoint

## Etapas de execução
[...]

## Contrato de retorno
[objeto JSON com status, narrativa_curta, paths_outputs, payload_relevante]
```

### Regras de subagentes

1. **Frontmatter obrigatório** — Sem frontmatter, o Claude Code não reconhece o arquivo como subagente.
2. **`name` = stem do filename, sem prefixo do plugin** — `name: papel-segmento` corresponde a `agents/papel-segmento.md`. O Claude Code resolve o namespace via `{plugin}:{name}` automaticamente.
3. **Contexto isolado** — Cada invocação recebe contexto fresco. A única bridge entre subagentes é o filesystem.
4. **Contrato de retorno JSON** — Todo subagente retorna objeto JSON estruturado (ver campo `status`).
5. **Sem `report-progress.sh`** — Hooks automáticos cuidam da telemetria no Mission Control.
6. **Sem `overrides.md`** — Não existe mecanismo de customização por loja.
7. **Sem referências cruzadas** — Subagentes não referenciam outros plugins diretamente.
8. **Skills via namespace** — `Skill("{plugin}:{skill}", ...)`.

---

## Padrão de Skill

Cada skill é uma subpasta em `{plugin}/skills/{nome}/` contendo `SKILL.md`:

```markdown
---
name: {nome-da-skill}
description: {Uma frase em português}
---

## Propósito
[...]

## Inputs
- {nome_semantico}: {tipo} — {descrição semântica, nunca nome de coluna}

## Outputs
- {nome}: {tipo} — {descrição}

## Implementação
[passos, API/MCP opcional, fallback obrigatório se consome API]
```

### Regras de skills

1. **Subpasta obrigatória** — `skills/{nome}/SKILL.md`, não arquivo solto.
2. **`name` = nome da subpasta** — `name: minha-skill` em `skills/minha-skill/SKILL.md`.
3. **Sem `report-progress`** — Skills não reportam telemetria.
4. **Sem referências a agentes ou plugins** — Skills são isoladas.
5. **API documentada** — Endpoint, parâmetros, resposta, fallback.
6. **Inputs semânticos** — Significado do dado, nunca nome de coluna específica do sistema do lojista.
7. **Auto-suficiência** — Cada plugin carrega suas próprias skills. Não há skills compartilhadas no framework central.

---

## Plano de Estado (State Plane)

| Variável | Conteúdo | Acesso |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Arquivos pristinos do plugin instalado (`processo.md`, `agents/`, `skills/`, etc.) | Read-only |
| `${CLAUDE_PLUGIN_DATA}/{processo}/` | Estado da loja: `config.json`, `outputs/` | Read-write |

**Nunca gravar outputs ou config dentro de `${CLAUDE_PLUGIN_ROOT}`.** O `/plugin update` sobrescreve tudo em `${CLAUDE_PLUGIN_ROOT}` sem aviso; o estado em `${CLAUDE_PLUGIN_DATA}` é preservado.

---

## Regras de Outputs

1. **Local** — Outputs vão para `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`.
2. **Formato do nome** — `{YYYY-MM-DD}_{descritivo}.json`.
3. **Formato do conteúdo** — JSON por padrão; outros formatos (ex.: PDF) quando justificado.
4. **Sem sobrescrita** — Cada execução gera um novo arquivo. Outputs anteriores são preservados.

---

## Regras de Dependências

1. **Declaração no plugin** — Dependências entre plugins são declaradas em `plugin.json > gondola.dependencias`.
2. **Descrição narrativa em `processo.md`** — Seção "Dependências de outros processos" descreve em linguagem natural.
3. **Resolução pelo Orquestrador** — O Orquestrador verifica se os outputs requeridos existem antes de executar o processo.
4. **Subagentes não resolvem dependências** — Subagentes assumem que os dados necessários já estão disponíveis no input recebido do Orquestrador.

---

## Contrato de Retorno dos Subagentes

Todo subagente retorna exatamente este objeto JSON:

```json
{
  "status": "done | waiting-user-input | error",
  "narrativa_curta": "Uma a três frases técnicas que o Orquestrador re-traduz para o lojista.",
  "paths_outputs": ["${CLAUDE_PLUGIN_DATA}/{processo}/outputs/{arquivo}.json"],
  "payload_relevante": {},
  "pergunta_ao_lojista": "Presente apenas se status = waiting-user-input.",
  "erro_detalhe": "Presente apenas se status = error."
}
```

O Orquestrador nunca copia `narrativa_curta` literalmente — é matéria-prima que ele re-traduz no tom do lojista (linguagem de varejo, foco em resultado, sem jargão técnico).

---

## Compatibilidade de Versão

- `gondola.framework_min` em `plugin.json` declara a versão mínima do framework central compatível.
- O Orquestrador recusa ativar plugins com `framework_min` maior que a versão corrente do framework, com aviso claro ao lojista.

---

## Estrutura de Desenvolvimento (`.dev/`)

A pasta `.dev/` existe **apenas no framework central** (`gondola-ai`) e serve ao desenvolvimento do próprio framework.

| Arquivo/Pasta | Propósito |
|---|---|
| `CLAUDE.dev.md` | Persona do Agente Desenvolvedor do framework central |
| `memory.dev.md` | Memória de sessão de desenvolvimento |
| `settings.dev.json` | Settings do Claude Code em modo dev |
| `settings.op.json` | Settings do Claude Code em modo operação |
| `templates/` | Templates canônicos do contrato de plugin |
| `modo.sh` | Script de troca de contexto dev ↔ operação |

**O catálogo de plugins** (`gondola-plugins-catalog`) tem seu próprio `.dev/`:

| Arquivo/Pasta | Propósito |
|---|---|
| `.dev/fixtures/` | Dados mock para testes de plugins (não copiado em `/plugin install`) |

**A pasta `.dev/` nunca é visível para o Orquestrador nem distribuída ao lojista.**

---

## O que o Framework Central NÃO contém

- Processos de domínio (`promocao/`, `compras/`, etc.) — ficam em plugins no catálogo.
- Skills compartilhadas (`.skills/`) — cada plugin carrega as próprias.
- Fixtures de teste de processos — ficam em `gondola-plugins-catalog/.dev/fixtures/`.
- Outputs de execução — ficam em `${CLAUDE_PLUGIN_DATA}` (fora do repositório).
- Mecanismo de customização por loja (`overrides.md`) — removido do design.
