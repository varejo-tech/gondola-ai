# Template: Criar Plugin de Processo

Checklist e template para criação de um novo plugin de processo no catálogo (`gondola-plugins-catalog`) ou em um repositório de plugin caseiro.

> Este template é a documentação canônica do contrato de plugin mantida pelo Agente Desenvolvedor do framework central. A criação efetiva do plugin acontece no repositório do catálogo, não no framework central.

---

## Checklist

### 1. Criar estrutura de pastas

```bash
mkdir -p {nome-do-processo}/.claude-plugin
mkdir -p {nome-do-processo}/commands
mkdir -p {nome-do-processo}/agents
mkdir -p {nome-do-processo}/skills
mkdir -p {nome-do-processo}/templates
```

### 2. Criar `plugin.json`

Preencher o manifest em `.claude-plugin/plugin.json` com todos os campos obrigatórios do namespace `gondola`.

### 3. Criar `processo.md`

Usar as 6 seções obrigatórias do Apêndice A. Este arquivo é lido pelo Orquestrador ao despachar o processo.

### 4. Criar `commands/{nome-do-processo}.md`

Slash command que o lojista invoca. O Claude Code descobre este arquivo automaticamente.

### 5. Criar subagentes

Para cada segmento de despacho declarado em `processo.md`, criar um arquivo em `agents/` com frontmatter YAML obrigatório. Seguir o template em `criar-agente.md`.

### 6. Criar skills

Para cada skill necessária, criar uma subpasta em `skills/` contendo `SKILL.md`. Seguir o template em `criar-skill.md`.

### 7. Criar `templates/config.template.json`

Esqueleto do arquivo de configuração que o lojista vai preencher. Todos os valores devem ser `"PREENCHER"` ou `null`. O Orquestrador usa o `processo.md` (seção "Texto guia de configuração") para guiar o lojista campo a campo.

### 8. Criar `README.md`

Documentação humana do plugin: propósito, pré-requisitos, lista de subagentes, list de skills, instruções de instalação.

### 9. Criar fixtures de desenvolvimento (se aplicável)

Se o plugin consome APIs externas, criar fixtures mock em `gondola-plugins-catalog/.dev/fixtures/`:

```
.dev/fixtures/{processo}-{descritivo}.json
```

Fixtures ficam fora do diretório do plugin e não são copiadas em `/plugin install`.

### 10. Validar

- [ ] `plugin.json` tem todos os campos obrigatórios (`name`, `description`, `version`, `gondola.tipo`, `gondola.modo`, `gondola.framework_min`)?
- [ ] `gondola.tipo` é `"processo"`?
- [ ] Nome do plugin em `plugin.json > name` corresponde ao nome da pasta?
- [ ] `processo.md` tem as 6 seções obrigatórias?
- [ ] Cada subagente tem frontmatter YAML válido (`name`, `description`, `model`, `tools`)?
- [ ] `name` de cada subagente corresponde ao stem do filename?
- [ ] Cada skill tem `skills/{nome}/SKILL.md` com frontmatter (`name`, `description`)?
- [ ] `name` de cada skill corresponde ao nome da subpasta?
- [ ] `config.template.json` tem todos os campos necessários com `"PREENCHER"` como valor?
- [ ] Subagentes não referenciam `overrides.md` (mecanismo removido)?
- [ ] Subagentes não chamam `report-progress.sh` diretamente (hooks cuidam da telemetria)?
- [ ] Outputs dos subagentes vão para `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/` (nunca para dentro do plugin)?
- [ ] Config da loja vai para `${CLAUDE_PLUGIN_DATA}/{processo}/config.json`?

---

## Template: `plugin.json`

O schema do Claude Code é **estrito** — chaves desconhecidas causam erro de validação. Só campos reconhecidos pelo Claude Code:

```json
{
  "name": "{nome-do-processo}",
  "description": "{Descrição em uma frase do que o processo faz}",
  "version": "1.0.0"
}
```

## Template: `gondola.json`

Metadados custom do framework, na raiz do plugin (ao lado de `processo.md`):

```json
{
  "tipo": "processo",
  "modo": "{auto | interativo | hibrido}",
  "framework_min": "1.0",
  "dependencias": []
}
```

**Campos:**

| Campo | Obrigatório | Valores |
|---|---|---|
| `tipo` | Sim | `"processo"` — distingue plugins-processo. Só esses aparecem em `/processos`. |
| `modo` | Sim | `"auto"` (sem interação), `"interativo"` (pede confirmação), `"hibrido"` (auto com checkpoints) |
| `framework_min` | Sim | Versão mínima do framework central compatível (ex.: `"1.0"`) |
| `dependencias` | Não | Lista de nomes de plugins cujos outputs são pré-requisito. Omitir ou `[]` para nenhuma. |

---

## Template: `processo.md`

O `processo.md` é lido pelo Orquestrador ao iniciar o processo. Deve conter as seguintes seções obrigatórias, nesta ordem:

```markdown
# Processo: {Nome}

**Modo:** {auto | interativo | hibrido}
**Versão:** {x.y.z}
**Descrição:** {Uma frase descrevendo o propósito do processo}

## 1. Fluxo de execução

Lista ordenada de fases do processo. Para cada fase:
- Nome da fase
- Subagente despachado (`{plugin}:{subagente}`)
- O que a fase faz
- Se é um checkpoint: qual pergunta é feita ao lojista

### Fase 1 — {Nome}

**Subagente:** `{plugin}:{subagente}`
**Termina em:** `done` | `waiting-user-input`

{Descrição do que esta fase faz.}

{Se checkpoint:} **Pergunta ao lojista:** "{Texto da pergunta em linguagem de varejo}"

### Fase N — ...

## 2. Datasets consumidos

Para cada fonte de dados externa:

| Nome lógico | Propósito | Campo em `config.json` |
|---|---|---|
| {nome} | {para que serve} | `{chave.no.config}` |

## 3. Texto guia de configuração

Para cada campo de `config.template.json`, o texto exato que o Orquestrador apresenta ao lojista.
Escrever em linguagem de varejo, nunca técnica.

**`{campo}`:** "{Pergunta ou instrução para o lojista, em linguagem natural de supermercado}"

## 4. Dependências de outros processos

{Texto narrativo. Ex.: "Este processo consome o relatório de análise de estoque gerado pelo processo de compras."}

{Ou: "Nenhuma dependência de outros processos."}

## 5. Contratos dos subagentes

Resumo de alto nível de cada subagente em `agents/`.

### {plugin}:{subagente}

**Faz:** {descrição}
**Input esperado:** {campos principais}
**Retorna:** `done` | `waiting-user-input` com {campos do payload}
```

---

## Template: `commands/{nome-do-processo}.md`

```markdown
---
description: Executa o processo de {nome do processo em linguagem natural}
---

O lojista acabou de invocar o processo de {nome}. Você é o Orquestrador do framework Gondola. Execute o protocolo padrão de despacho de processo:

1. Leia `${CLAUDE_PLUGIN_ROOT}/processo.md` para entender o fluxo deste processo.
2. Aplique o protocolo de configuração: se o config em `${CLAUDE_PLUGIN_DATA}/{nome-do-processo}/config.json` não existir ou tiver campos pendentes, guie a configuração primeiro.
3. Aplique o protocolo de dependências.
4. Inicie a execução do Mission Control (`./start-process.sh {nome-do-processo}`).
5. Despache os subagentes em ordem, seguindo o protocolo padrão de despacho (background, retorno estruturado, narrativa no tom do lojista).
```

---

## Template: `templates/config.template.json`

```json
{
  "{campo-1}": "PREENCHER",
  "{campo-2}": "PREENCHER",
  "{campo-objeto}": {
    "{subcampo}": "PREENCHER"
  }
}
```

Todos os valores devem ser `"PREENCHER"` ou `null`. Nunca incluir valores reais. O lojista preenche os valores guiado pelo Orquestrador, que usa o texto de `processo.md > Texto guia de configuração`.

---

## Lembretes

- Nome do plugin = nome da pasta = nome do slash command = `name` em `plugin.json`.
- Seguir convenções de nomenclatura: kebab-case para tudo.
- Outputs nomeados como `{YYYY-MM-DD}_{descritivo}.json`.
- Outputs vão para `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`, nunca para dentro do plugin.
- Sem `overrides.md` — não existe mecanismo de customização por loja.
- Subagentes não chamam `report-progress.sh` — hooks de projeto cuidam da telemetria.
