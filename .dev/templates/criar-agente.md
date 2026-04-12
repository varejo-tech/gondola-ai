# Template: Criar Subagente de Plugin

Checklist e template para criação de um subagente dentro de um plugin de processo.

> Na arquitetura de plugins, um "agente" é um **Claude Code subagent nativo** — um arquivo `.md` com frontmatter YAML obrigatório que o Orquestrador despacha via `Task`. Cada subagente corresponde a um segmento de execução entre checkpoints.

---

## Checklist

### 1. Definir escopo do segmento

Antes de criar o arquivo, responder:
- Qual segmento de execução este subagente cobre (entre quais checkpoints)?
- O que este subagente faz?
- O que este subagente NÃO faz?
- Com qual status ele termina: `done` ou `waiting-user-input`?
- Quais skills ele invoca?
- Quais arquivos ele lê de `${CLAUDE_PLUGIN_ROOT}` (plugin) e `${CLAUDE_PLUGIN_DATA}` (dados da loja)?
- O que ele escreve em `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`?

### 2. Criar arquivo do subagente

```
{plugin}/agents/{papel}-{segmento}.md
```

**Convenção de nomenclatura:** prefixo de papel lógico + segmento descritivo.

Exemplos:
- `analista-oportunidades.md`
- `analista-consolidacao.md`
- `criativo-briefing.md`
- `criativo-geracao-publicacao.md`
- `execucao-distribuicao.md`

### 3. Preencher frontmatter YAML

Frontmatter é **obrigatório**. Sem ele, o Claude Code não reconhece o arquivo como subagente.

### 4. Redigir body como system prompt

O body do arquivo (após o frontmatter) é o system prompt do subagente. Deve incluir:
- Contexto (quem é este subagente, de onde vem)
- Inputs esperados (os 4 campos padrão)
- Etapas de execução
- Contrato de retorno (JSON obrigatório)

### 5. Referenciar skills existentes

No body, mencionar as skills que o subagente invoca via `Skill("{plugin}:{skill}", ...)`. Se a skill necessária não existe, criá-la primeiro.

### 6. Validar

- [ ] Frontmatter YAML válido (todos os campos obrigatórios presentes)?
- [ ] `name` no frontmatter corresponde ao stem do filename?
- [ ] `model: sonnet` definido?
- [ ] `tools` lista todos os que o subagente usa?
- [ ] Inputs esperados declarados com os 4 campos padrão?
- [ ] Etapas de execução cobrem o segmento declarado?
- [ ] Contrato de retorno documentado (objeto JSON com `status`, `narrativa_curta`, `paths_outputs`, `payload_relevante`)?
- [ ] Outputs vão para `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`?
- [ ] Sem referência a `overrides.md` ou `report-progress.sh` no body?
- [ ] Sem dependências hardcoded de outros plugins (a coordenação entre processos é via filesystem)?

---

## Template: Subagente

```markdown
---
name: {papel}-{segmento}
description: {Uma frase descrevendo o que este subagente faz e quando é despachado. Ex: "Identifica oportunidades promocionais cruzando estoque e vendas. Retorna lista candidata aguardando validação do lojista."}
model: sonnet
tools: Read, Grep, Glob, Bash, Skill, Write
---

# {Nome Legível do Subagente}

## Contexto

Você é um subagente despachado pelo Orquestrador do framework Gondola AI. Você executa **um único segmento** do processo de {nome do processo}: {descrição do segmento em uma frase}.

Você recebe contexto fresco a cada invocação. Nada do que subagentes anteriores "sabiam" está disponível aqui — apenas o que você lê do filesystem e o que o Orquestrador incluiu no seu input.

## Inputs esperados

O Orquestrador passa os seguintes campos no input deste despacho:

- `caminho_config`: path para `config.json` em `${CLAUDE_PLUGIN_DATA}/{processo}/`
- `caminhos_outputs_anteriores`: lista de paths para outputs de fases anteriores (leia o conteúdo desses arquivos para contexto)
- `instrucao_especifica`: instrução da fase atual do Orquestrador
- `resposta_lojista`: presente apenas quando este despacho é continuação após checkpoint — contém a resposta do lojista traduzida em instrução concreta pelo Orquestrador

## Etapas de execução

1. **{Nome da etapa}**
   {Instruções detalhadas}

2. **{Nome da etapa}**
   {Instruções detalhadas}

   Invoke: `Skill("{plugin-name}:{skill-name}", { ... })`

...

N. **Gravar output e retornar**
   Gravar resultado em `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/{YYYY-MM-DD}_{descritivo}.json`.
   Retornar o contrato de retorno conforme especificado abaixo.

## Contrato de retorno

Retorne **exatamente** este objeto JSON como sua resposta final. Sem texto adicional fora do JSON.

```json
{
  "status": "done | waiting-user-input | error",
  "narrativa_curta": "Uma a três frases em linguagem técnica que o Orquestrador vai re-traduzir para o lojista.",
  "paths_outputs": ["${CLAUDE_PLUGIN_DATA}/{processo}/outputs/{arquivo}.json"],
  "payload_relevante": {},
  "pergunta_ao_lojista": "Presente apenas se status = waiting-user-input. Pergunta técnica que o Orquestrador vai retraduzir.",
  "erro_detalhe": "Presente apenas se status = error."
}
```
```

---

## Regras

1. **Frontmatter obrigatório** — Sem frontmatter YAML, o arquivo não é reconhecido como subagente pelo Claude Code.
2. **`name` = stem do filename, sem prefixo do plugin** — `name: papel-segmento` deve corresponder exatamente ao nome do arquivo `papel-segmento.md`. O Claude Code resolve o namespace `{plugin}:{name}` automaticamente; incluir o prefixo no name causaria duplicação.
3. **Contexto isolado** — Cada invocação recebe contexto fresco. O subagente não "lembra" de invocações anteriores. A única bridge entre subagentes é o filesystem.
4. **Contrato de retorno JSON** — Todo subagente deve retornar o objeto JSON estruturado. O Orquestrador depende desse contrato para narrar ao lojista e decidir o próximo passo.
5. **Outputs em `${CLAUDE_PLUGIN_DATA}`** — Jamais gravar outputs dentro do diretório do plugin (`${CLAUDE_PLUGIN_ROOT}`). O estado da loja fica em `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`.
6. **Sem `report-progress.sh`** — Subagentes não chamam `report-progress.sh`. Os hooks do projeto (`PreToolUse`, `PostToolUse`) disparam telemetria automaticamente.
7. **Sem `overrides.md`** — Não existe mecanismo de customização por loja. Subagentes executam o comportamento padrão do plugin.
8. **Sem referências cruzadas** — Subagentes não referenciam outros plugins diretamente. Coordenação entre processos acontece via filesystem (outputs de um processo são input de outro em execuções futuras).
9. **Skills por namespace** — Invocar skills via `Skill("{plugin-name}:{skill-name}", ...)`. O namespace garante que a skill correta do plugin correto é usada.
