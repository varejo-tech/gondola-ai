# Framework Gondola AI — Arquitetura de Plugins

**Data:** 2026-04-11
**Autor:** Leonardo Chaves Moreira (com Agente Desenvolvedor do framework)
**Status:** Design aprovado, aguardando writing-plans

---

## Contexto e motivação

O framework Gondola AI foi concebido para ser uma "Operação Virtual" liderada por um agente Orquestrador que comanda a execução de processos operacionais de supermercadistas (promoção, compras, gestão de estoque, etc.). A premissa arquitetural — que só ficou explícita na iteração atual — é que:

1. O **framework central** é um repositório comunitário enxuto que entrega apenas a infraestrutura da Operação Virtual: persona do Orquestrador, Mission Control, scripts utilitários, contratos e documentação. Ele **não carrega nenhum processo de domínio**.
2. Cada **processo de negócio** (ex.: promoção, compras) é distribuído como plugin instalável, carregando sozinho suas regras, agentes, skills, templates e texto guia de configuração.
3. A **Avanço Informática** mantém um marketplace oficial curado com os plugins de fábrica; lojistas instalam com um comando.
4. **Lojistas da comunidade** podem criar seus próprios processos localmente, seguindo o padrão de estrutura do framework, sem publicar no marketplace oficial.
5. Os agentes de um processo são **subagentes reais** do Claude Code que o Orquestrador despacha via `Task`, e múltiplos processos podem rodar em paralelo.

A estrutura atual do repositório foi construída antes dessa premissa estar clara. O processo de promoção vive como subpasta em `promocao/`, os agentes são papéis markdown lidos pelo Orquestrador dentro de uma única sessão Claude, e várias convenções assumem o modelo single-repo. Este documento formaliza o alvo arquitetural e as decisões que orientam a migração.

---

## Decisões tomadas (Fase A de brainstorming)

### Decisão 1 — Topologia do marketplace: monorepo único

O catálogo oficial da Avanço é um **único repositório git** (`gondola-plugins-catalog`) contendo todos os plugins-processo curados, cada um em uma subpasta, e um `.claude-plugin/marketplace.json` na raiz que os lista por caminho local. Lojistas adicionam este repositório como marketplace uma única vez (`/plugin marketplace add github:avanco/gondola-plugins-catalog`) e depois instalam plugins individuais (`/plugin install promocao@gondola-oficial`).

**Razões:** equipe pequena da Avanço, nenhum processo-único ainda exige versionamento independente, releases coordenados são úteis quando plugins compartilham convenções, e a migração para multi-repo é possível depois com `git filter-repo` se virar necessário.

**Separação clara dos repositórios:**

| Repositório | Propósito | Atualização pelo lojista |
|---|---|---|
| `gondola-ai` (este) | Framework central: Orquestrador, Mission Control, scripts, contrato, docs | `git pull` ocasional |
| `gondola-plugins-catalog` | Catálogo oficial de plugins-processo da Avanço | `/plugin update` via Claude Code |

O lojista **nunca clona** `gondola-plugins-catalog` — o Claude Code gerencia o download, cache e atualização via seu próprio sistema de plugins.

### Decisão 2 — Sem shared skills no framework central

Plugins **não compartilham skills** através do framework central. Cada plugin carrega seu próprio código, mesmo que isso implique duplicação (ex.: cada plugin que precise gerar PDF traz sua própria implementação de renderização).

**Razões:**
- A ferramenta `Skill` do Claude Code não torna skills de `.claude/skills/` do projeto host automaticamente visíveis para subagentes de plugins instalados. Seria necessário workaround via `Read` manual, o que quebra o idioma do framework.
- Simplifica o contrato de plugin ("tudo que seu plugin precisa, vive dentro dele").
- Simplifica a experiência do lojista (sem necessidade de instalar "cores" ou gerenciar dependências entre plugins).
- A duplicação é gerenciável para a Avanço enquanto o catálogo for pequeno; pode ser reconsiderada quando for problema real.

**Consequência:** o diretório `.skills/` atual do framework central é removido inteiramente durante a migração. Qualquer skill que hoje vive lá (ex.: `skill-renderizar-pdf` e seu runtime `.skills/_lib/pdf-renderer/`) migra para dentro dos plugins que a utilizam.

### Decisão 3 — Protocolo de despacho e narrativa

**Mecanismo:** todos os despachos de subagentes acontecem em **background** (`background: true` na ferramenta `Task`). O Orquestrador nunca fica preso por uma tarefa síncrona; o lojista pode conversar com ele paralelamente à execução.

**Granularidade:** cada despacho corresponde a **um segmento entre checkpoints** do processo. O autor do plugin decide a decomposição. Para o processo de promoção, isso resulta em 5 despachos:

| Despacho | Subagente do plugin | Termina em |
|---|---|---|
| 1 | `promocao:analista-oportunidades` | `waiting-user-input` (validar lista de produtos) |
| 2 | `promocao:analista-consolidacao` | `done` (cross-selling, pesquisa concorrente, gravar análise) |
| 3 | `promocao:criativo-briefing` | `waiting-user-input` (aprovar briefing) |
| 4 | `promocao:criativo-geracao-publicacao` | `done` (gerar peça, publicar, registrar) |
| 5 | `promocao:execucao-distribuicao` | `done` (PDFs, distribuição via webhook) |

**Não há** limite de duração por despacho. Cada um toma o tempo que precisar.

**Contrato de entrada do despacho:** o Orquestrador passa ao subagente um input enxuto contendo a instrução específica, paths (não conteúdo) dos outputs anteriores, caminhos de `config.json` em `${CLAUDE_PLUGIN_DATA}`, e — se o despacho for continuação após um checkpoint — a resposta do lojista traduzida em instrução concreta. Dados pesados são lidos do filesystem pelo próprio subagente.

**Contrato de retorno do despacho:** o subagente devolve um objeto JSON estruturado:

```json
{
  "status": "done" | "waiting-user-input" | "error",
  "narrativa_curta": "Uma a três frases em linguagem técnica que o Orquestrador vai re-traduzir para o lojista",
  "paths_outputs": ["caminho/para/arquivo.json"],
  "payload_relevante": { },
  "pergunta_ao_lojista": "presente apenas se status = waiting-user-input",
  "erro_detalhe": "presente apenas se status = error"
}
```

O Orquestrador nunca copia a `narrativa_curta` literalmente — ela é matéria-prima que ele re-traduz no tom do lojista (linguagem de varejo, sem jargão técnico, foco em resultado).

**Narrativa ao lojista:**

- **Entre despachos:** o Orquestrador narra com base no retorno estruturado do subagente.
- **Durante um despacho em execução:** se o lojista perguntar sobre o progresso ("como está indo?"), o Orquestrador consulta o **Mission Control** (via leitura de estado no filesystem) e responde. Não despacha novo subagente para isso. O Mission Control é o canal visual contínuo de progresso, enquanto o Orquestrador é o canal conversacional sob demanda.
- **Enquanto um despacho roda:** o lojista pode perguntar livremente sobre outros assuntos do negócio (vendas, estoque, dúvidas operacionais). O Orquestrador usa suas próprias ferramentas (`Read`, `Grep`, `Bash`) para responder sem tocar no subagente em execução.

**Checkpoints:** implementados exclusivamente via retorno `status: "waiting-user-input"`. O Orquestrador pausa, retraduz a pergunta para o tom do lojista, aguarda a resposta, interpreta, e só então dispara o próximo despacho com a resposta convertida em instrução no input.

**Interrupção pelo lojista:** se o lojista pedir para parar o processo durante a execução, o Orquestrador:

1. Confirma a intenção de parar com o lojista em tom natural.
2. **Marca internamente que não despachará o próximo passo.**
3. Aguarda o subagente em execução **terminar naturalmente** (sem tentar cancelá-lo — background tasks não são canceláveis programaticamente no Claude Code atual).
4. Quando o subagente retorna, o Orquestrador ignora o resultado no sentido operacional (outputs gerados ficam salvos em disco, sem dispachar próximos passos) e confirma ao lojista que o processo foi interrompido como solicitado.

**Redirecionamento pelo lojista:** se o lojista pedir para mudar o comportamento do próximo passo, o Orquestrador interpreta a instrução, aguarda o passo atual terminar (se houver um em execução), e então dispara o próximo passo com a orientação nova incluída no input. Redirecionamento do passo em execução **não é suportado** — um subagente não escuta mensagens externas depois de iniciar.

**Múltiplos processos em paralelo:** o lojista pode disparar `/compras` enquanto `/promocao` ainda está executando. O Orquestrador despacha o primeiro subagente de `compras` em background, ambos os processos convivem, e o Orquestrador interleava narrativas conforme cada um retorna. **Não há coordenação em tempo real entre processos** (Agent Teams explicitamente fora de escopo). A coordenação entre processos, quando existir, acontece via outputs em disco (o output de um processo pode ser input de outro em execuções futuras).

### Decisão 4 — Anatomia do plugin de processo

```
{nome-do-processo}/                    ← pasta dentro de gondola-plugins-catalog/
├── .claude-plugin/
│   └── plugin.json                    ← manifest obrigatório do Claude Code
├── processo.md                        ← definição do processo para o Orquestrador ler
├── commands/
│   └── {nome-do-processo}.md          ← slash command que aciona o processo
├── agents/                            ← subagentes nativos do Claude Code
│   └── ...                            ← um arquivo .md por segmento de despacho
├── skills/                            ← skills específicas do processo
│   ├── {nome-skill}/
│   │   └── SKILL.md
│   └── ...
├── templates/
│   └── config.template.json           ← esqueleto do config a ser preenchido pelo lojista
└── README.md                          ← documentação humana do plugin
```

**Fixtures** ficam **fora** do plugin, em `gondola-plugins-catalog/.dev/fixtures/`, compartilhadas entre plugins do catálogo. Não são distribuídas no `/plugin install` porque estão fora do diretório do plugin.

**Estado da loja** é separado do plugin e vive em `${CLAUDE_PLUGIN_DATA}/{nome-do-processo}/`:

```
${CLAUDE_PLUGIN_DATA}/{nome-do-processo}/
├── config.json                        ← configuração efetiva preenchida pelo lojista
└── outputs/                           ← artefatos gerados em cada execução
```

Essa separação garante que `/plugin update` pode atualizar o plugin sem afetar o estado da loja.

**Sem mecanismo de customização formal.** Não existe `overrides.md` em nenhum lugar. Se o lojista quiser customizar o comportamento de um plugin, ele tem duas opções: (a) pedir para a Avanço publicar um plugin oficial com a mudança, ou (b) criar um plugin caseiro próprio com o padrão e instalar localmente, substituindo o oficial. Nada entre esses extremos é suportado. Se o lojista editar os arquivos do plugin instalado no cache diretamente, ele assume a responsabilidade — na próxima `/plugin update` as mudanças são perdidas.

#### Estrutura do `plugin.json`

```json
{
  "name": "promocao",
  "description": "Processo de promoção semanal — análise de oportunidades, criação de materiais e distribuição de relatórios",
  "version": "1.0.0",
  "gondola": {
    "tipo": "processo",
    "modo": "hibrido",
    "framework_min": "1.0",
    "dependencias": []
  }
}
```

O namespace `gondola` dentro do manifest é reservado para metadados do framework Gondola, que o Claude Code ignora (tudo que ele não reconhece). Campos relevantes:

- **`tipo`** — obrigatório. Valor `"processo"` distingue plugins-processo de outros tipos que possam aparecer no futuro (ex.: `"skill"`, `"utilitario"`). Apenas plugins `tipo == "processo"` aparecem listados em `/processos`.
- **`modo`** — obrigatório. Um de `auto`, `interativo`, `hibrido`. Governa o default de interação com o lojista (conforme persona do Orquestrador).
- **`framework_min`** — obrigatório. Versão mínima do framework central compatível com este plugin. O Orquestrador recusa ativar plugins incompatíveis com aviso claro.
- **`dependencias`** — opcional. Lista de outros processos (pelo nome do plugin) cujos outputs este processo requer. Vazio para a maioria dos casos.

#### Estrutura do `processo.md`

Este arquivo é **lido pelo Orquestrador** ao dispachar o processo. Contém a descrição narrativa do fluxo: quais despachos existem em ordem, o que cada um faz, quais são checkpoints, quais datasets são consumidos, e o texto guia para o Orquestrador apresentar ao lojista ao configurar `config.template.json`.

É prosa em português, estruturada em seções fixas que o contrato documenta (ver Apêndice A ao final).

#### Estrutura dos subagentes (`agents/*.md`)

Cada arquivo é um subagente nativo do Claude Code, com frontmatter YAML obrigatório e body em markdown que é o system prompt do subagente:

```markdown
---
name: promocao-analista-oportunidades
description: Identifica oportunidades promocionais cruzando estoque, vendas, sazonalidade e tendências. Retorna lista candidata aguardando validação do lojista.
model: sonnet
tools: Read, Grep, Glob, Bash, Skill, Write
---

# Analista de Oportunidades (promoção)

## Contexto
Você é um subagente despachado pelo Orquestrador do framework Gondola. [...]

## Inputs esperados
- `caminho_config`: path para config.json em ${CLAUDE_PLUGIN_DATA}/promocao/
- [...]

## Etapas
1. [...]

## Contrato de retorno
Retorne um objeto JSON [...]
```

**Nomenclatura:** usar prefixo de papel lógico (`analista-`, `criativo-`, `execucao-`) para preservar a organização conceitual dos três papéis atuais do processo, mesmo que fisicamente existam 5 subagentes para `promocao`.

**Namespace de invocação:** o Claude Code expõe subagentes de plugin como `{plugin-name}:{subagent-name}` (ex.: `promocao:analista-oportunidades`). O Orquestrador usa esse identificador ao invocar via `Task`.

**Contexto isolado:** cada invocação de subagente recebe contexto fresco. Nada do que um subagente "sabia" sobrevive para o próximo. A única ponte entre subagentes de um mesmo processo é o filesystem (outputs em `${CLAUDE_PLUGIN_DATA}/{processo}/outputs/`). Os subagentes devem ser redigidos como se não conhecessem uns aos outros — só conhecem o contrato de entrada e saída.

#### Estrutura das skills (`skills/{nome}/SKILL.md`)

Skills internas do plugin seguem o formato nativo de skills do Claude Code: cada skill é uma subpasta contendo `SKILL.md` (arquivo principal) e opcionalmente arquivos auxiliares (references, scripts). O `SKILL.md` tem frontmatter YAML opcional (name, description) e body com as instruções que o subagente segue ao invocar a skill.

Os subagentes invocam skills via a ferramenta `Skill` passando `{plugin-name}:{skill-name}` (ex.: `promocao:oportunidade-promocional`).

#### Slash command (`commands/{processo}.md`)

Cada plugin registra seu próprio slash command através de um arquivo markdown em `commands/`, que o Claude Code descobre automaticamente. O conteúdo é um template curto que, quando invocado, gera um prompt dizendo ao Claude (que está rodando como Orquestrador) que o lojista solicitou a execução do processo:

```markdown
---
description: Executa o processo de promoção semanal
---

O lojista acabou de invocar o processo de promoção. Você é o Orquestrador do framework Gondola. Execute o protocolo padrão de despacho de processo:

1. Leia `${CLAUDE_PLUGIN_ROOT}/processo.md` para entender o fluxo deste processo.
2. Aplique o protocolo de configuração: se o config em `${CLAUDE_PLUGIN_DATA}/promocao/config.json` não existir ou tiver campos pendentes, guie a configuração primeiro.
3. Aplique o protocolo de dependências.
4. Inicie a execução do Mission Control (`./start-process.sh promocao`).
5. Despache os subagentes em ordem, seguindo o protocolo padrão de despacho (background, retorno estruturado, narrativa no tom do lojista).
```

O template é praticamente idêntico entre plugins, variando apenas o nome do processo. Pode virar um template de scaffolding no futuro.

### Decisão 5 — `.dev/` do framework central: mantido, escopo reduzido

O diretório `.dev/` continua existindo no framework central, servindo ao desenvolvimento **do próprio framework** (e não mais ao desenvolvimento de processos). O dual-mode via `modo.sh` continua existindo porque o framework central precisa hospedar dois agentes conceitualmente distintos: o **Agente Desenvolvedor do Framework** (arquiteto, par técnico) quando a Avanço está evoluindo a infraestrutura, e o **Orquestrador** quando a Avanço está testando como o lojista vai experimentar.

**Muda:**

- A persona `CLAUDE.dev.md` tem seu escopo redesenhado: foca exclusivamente no framework central (persona do Orquestrador, Mission Control, scripts utilitários, contrato de plugin, documentação). Perde responsabilidades sobre criação de processos, agentes de processo e skills de processo — essas atividades pertencem ao dev do plugin, em outro repositório.
- O "modo op" do framework central passa a pressupor que pelo menos um plugin está instalado localmente para haver o que comandar.
- `.dev/fixtures/` é removido (fixtures migram para o repositório do catálogo).
- `.dev/test-outputs/` é removido (sem função na nova arquitetura).

**Continua:**

- `.dev/templates/` (`criar-processo.md`, `criar-agente.md`, `criar-skill.md`, `convencoes-framework.md`) fica no framework central como **referência documental canônica do contrato de plugin**. São consultados por devs da Avanço e por membros da comunidade que queiram criar processos caseiros. Não são ativamente usados pelo Agente Desenvolvedor do framework central no seu dia-a-dia.
- `CLAUDE.dev.md`, `memory.dev.md`, `modo.sh`, `settings.dev.json`, `settings.op.json` permanecem conforme estrutura atual.

### Decisão 6 — Persona do Orquestrador e descoberta de processos

**Invocação de processos pelo lojista:** cada plugin registra seu próprio slash command (Decisão 4). O lojista digita `/promocao` e o Claude Code expande o template do plugin, que instrui Claude (rodando como Orquestrador por força do `CLAUDE.md` do framework central) a conduzir a execução.

**Listagem de processos disponíveis (`/processos`):** este command vive **no framework central** em `.claude/commands/processos.md` e sua implementação enumera plugins instalados de tipo `"processo"`.

**Mecanismo de enumeração:**

1. O Orquestrador lê `enabledPlugins` de `~/.claude/settings.json` (ou `.claude/settings.json` do projeto) para saber quais plugins estão ativos.
2. Para cada plugin ativo, lê `~/.claude/plugins/cache/{plugin-id}/.claude-plugin/plugin.json`.
3. Filtra pelos que têm `gondola.tipo == "processo"`.
4. Extrai nome, descrição, modo, versão e dependências.
5. Retorna a lista formatada no tom do lojista.

A implementação do `/processos` no framework central é um script utilitário invocado por Read + Glob + Bash (jq para parse de JSON). Migrável para uma ferramenta nativa do Claude Code se uma for exposta no futuro.

**Reforma da persona (`CLAUDE.orquestrador.md`):**

*Removido:*

- Tabela hardcoded de processos disponíveis (linhas atuais ~38–42 com `/promocao` fixo).
- Implementação do `/processos` baseada em "listar subpastas da raiz, excluindo `.dev/`, `.mission-control/`, etc.".
- Toda a seção "Customização por loja" (linhas ~144–174).
- Todas as referências a "leia `{processo}/CLAUDE.md`" e "leia `{processo}/overrides.md`".
- Instruções sobre injetar overrides no contexto de cada agente.

*Adicionado:*

- **Seção "Como despachar subagentes de plugin"** formalizando o protocolo da Decisão 3: usar `Task` com `background: true`, passar input enxuto com paths, interpretar retorno estruturado, retraduzir `narrativa_curta` no tom do lojista, tratar `waiting-user-input` pausando para perguntar e incluindo a resposta no próximo despacho, tratar `error` seguindo a postura diagnóstica existente (diagnosticar → oferecer opções ao subagente → negociar → só então escalar), usar nomenclatura `{plugin-name}:{subagent-name}`.
- **Seção "Interrupção e redirecionamento pelo lojista"** explicando o protocolo de parada (confirma, marca não-despachar-próximo, aguarda passo atual terminar, confirma ao lojista) e de redirecionamento (interpreta, inclui orientação no input do próximo despacho, não suporta mid-step).
- **Seção "Múltiplos processos em paralelo"** explicando que plugins podem coexistir em execução, o Orquestrador interleava narrativas, e que não existe coordenação em tempo real entre processos.
- **Seção "Como descobrir processos instalados"** explicando o mecanismo de enumeração via `enabledPlugins` + leitura de `plugin.json` do cache, com filtro por `gondola.tipo == "processo"`.
- **Referências a variáveis de ambiente** `${CLAUDE_PLUGIN_ROOT}` (leitura de arquivos pristinos do plugin instalado) e `${CLAUDE_PLUGIN_DATA}` (leitura/escrita de dados da loja: config, outputs).

*Permanece:*

- Identidade, tom, postura, estilo de comunicação, linguagem de varejo.
- Fluxo de configuração de processos (configurar somente ao executar, sem crítica preventiva, campo a campo, nunca exibir credenciais).
- Protocolo de erro e postura diagnóstica (diagnosticar → oferecer opções → negociar → escalar com análise, nunca descarregar erros crus).
- Tratamento de dependências entre processos (verificar antes de executar, oferecer executar dependência primeiro, permitir prosseguir com aviso se o processo suportar).
- Instruções do Mission Control (auto-start antes de executar, exibir quando solicitado, encerrar ao sair).

---

## Estrutura alvo dos repositórios

### Framework central (`gondola-ai`)

```
gondola-ai/
├── CLAUDE.md                         ← symlink: dev ou op
├── CLAUDE.orquestrador.md            ← persona do Orquestrador (reformada)
├── report-progress.sh                ← script de progresso do Mission Control
├── start-process.sh                  ← script de início de execução
├── .claude/
│   ├── commands/
│   │   ├── processos.md              ← listar plugins-processo instalados
│   │   └── modo.md                   ← dev-only (alternância de modo)
│   ├── settings.json                 ← symlink para dev ou op settings
│   ├── settings.local.json
│   └── memory.md                     ← symlink para memória ativa
├── .mission-control/                 ← infraestrutura do dashboard (inalterada)
├── .dev/
│   ├── CLAUDE.dev.md                 ← persona do dev do framework (escopo reformado)
│   ├── memory.dev.md
│   ├── modo.sh
│   ├── settings.dev.json
│   ├── settings.op.json
│   └── templates/                    ← referência canônica do contrato de plugin
│       ├── criar-processo.md
│       ├── criar-agente.md
│       ├── criar-skill.md
│       └── convencoes-framework.md
├── docs/
│   └── superpowers/specs/            ← documentação do framework
└── memory.op.md                      ← memória do modo op

(removido: .skills/, promocao/, .dev/fixtures/, .dev/test-outputs/)
```

### Catálogo de plugins (`gondola-plugins-catalog`)

```
gondola-plugins-catalog/
├── .claude-plugin/
│   └── marketplace.json              ← catálogo oficial da Avanço
├── promocao/                         ← plugin de promoção (primeiro a ser extraído)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── processo.md
│   ├── commands/
│   │   └── promocao.md
│   ├── agents/
│   │   ├── analista-oportunidades.md
│   │   ├── analista-consolidacao.md
│   │   ├── criativo-briefing.md
│   │   ├── criativo-geracao-publicacao.md
│   │   └── execucao-distribuicao.md
│   ├── skills/
│   │   ├── oportunidade-promocional/SKILL.md
│   │   ├── cross-selling/SKILL.md
│   │   ├── pesquisa-concorrente/SKILL.md
│   │   ├── briefing/SKILL.md
│   │   ├── geracao-imagem/SKILL.md
│   │   ├── publicacao/SKILL.md
│   │   ├── redacao-relatorio-concorrentes/SKILL.md
│   │   ├── redacao-resumo-promocao/SKILL.md
│   │   ├── distribuicao/SKILL.md
│   │   └── renderizar-pdf/             ← migrado do .skills/ do framework central
│   │       └── SKILL.md
│   └── README.md
└── .dev/
    └── fixtures/                      ← dev-only, não copiado em /plugin install
        ├── estoque.json
        ├── vendas.json
        └── ...
```

Nota sobre `skill-checklist-loja`: esta skill estava desativada no processo atual (requer infraestrutura de webhook de coleta que ainda não existe). Na migração, ela é **removida do plugin** em vez de mantida como "disabled". Quando a funcionalidade for implementada de verdade, a skill é adicionada no momento da implementação.

### Plano de dados da loja

```
${CLAUDE_PLUGIN_DATA}/promocao/
├── config.json                       ← preenchido na primeira configuração
└── outputs/
    ├── 2026-04-11_analise-promocional.json
    ├── 2026-04-11_criacao-publicacao.json
    └── 2026-04-11_execucao-loja.json
```

A primeira execução do processo detecta ausência de `config.json` em `${CLAUDE_PLUGIN_DATA}/promocao/`, copia `templates/config.template.json` do plugin para lá, e entra no fluxo de configuração guiada do Orquestrador.

---

## Roadmap de migração (alto nível)

A Fase A deste documento (brainstorming e design) está **completa**. As Fases B–E são o trabalho de implementação, a ser detalhado pelo passo seguinte (writing-plans):

- **Fase B — Framework central ready.** Preparar o framework para reconhecer plugins instalados (atualizar `.mission-control/server/discovery.js`, reformar persona do Orquestrador, implementar `/processos` command, remover `.skills/`, limpar `.dev/` de itens descontinuados). Durante esta fase, `promocao/` continua como está no repo para não quebrar testes.
- **Fase C — Extração do `promocao/` para plugin.** Criar o repositório `gondola-plugins-catalog`, mover `promocao/` para dentro dele usando `git filter-repo` para preservar histórico, adicionar `plugin.json`, `processo.md`, frontmatter YAML aos agentes (e split de 3 agentes em 5 subagentes), `commands/promocao.md`, ajustar referências internas de paths. Remover `promocao/` do framework central. Instalar o plugin extraído no framework via marketplace local e validar end-to-end.
- **Fase D — Validação multi-plugin.** Criar um segundo plugin-piloto mínimo (`hello-supermercado` ou equivalente) para provar que múltiplos plugins coexistem, que `/processos` enumera os dois, que o Mission Control acompanha ambos, e que execuções paralelas funcionam.
- **Fase E — Documentação do contrato.** Publicar no repositório do framework central um guia formal do contrato de plugin para a comunidade: o que um plugin DEVE ter, PODE ter, NÃO PODE ter; como criar um plugin caseiro; checklist de compatibilidade; exemplos concretos.

A Avanço decide ao final da Fase D se avança imediatamente para Fase E ou se valida operacionalmente com usuários reais antes.

---

## Itens fora de escopo para esta iteração

- **Customização formal por loja** (`overrides.md` ou equivalente). Explicitamente removido do design. Se virar necessário no futuro, é um redesenho deliberado, não um patch.
- **Shared skills no framework central** (ferramentas invocáveis por subagentes de plugins distintos). Removido por incompatibilidade com a isolação de namespace do Claude Code. Plugins duplicam o código necessário.
- **Agent Teams** do Claude Code (mecanismo experimental de coordenação peer-to-peer entre agentes). Não adotado por ser experimental, exigir flag de ambiente e não haver caso de uso atual que exija coordenação bidirecional entre agentes.
- **Cancelamento de Task em background pelo teclado**. Não suportado nativamente pelo Claude Code. Mitigação: Orquestrador decide não despachar próximo passo e aguarda conclusão natural do atual.
- **Conversa inter-plugin em tempo real** (ex.: analista de compras consultando analista de promoção ativo). Coordenação entre processos acontece exclusivamente via outputs em disco.
- **Versionamento independente por plugin** no catálogo. Todos os plugins são versionados junto com o catálogo enquanto for monorepo.
- **Ferramenta CLI própria de instalação** (`gondola install promocao`). A instalação usa o mecanismo nativo do Claude Code (`/plugin marketplace add` + `/plugin install`).
- **CRON-based automatic execution** (v2). Processos só executam sob comando do lojista. Automação via agendamento fica para iteração futura.

---

## Riscos e pendências técnicas

- **Keybinding de interrupção** — durante a Fase A ficou documentado que background tasks não são canceláveis por teclado; a pergunta "qual é o keybind correto para interromper foreground?" ficou em aberto mas não afeta o design atual (não usamos foreground). Pode ser confirmado quando relevante.
- **Path exato do `${CLAUDE_PLUGIN_ROOT}` e `${CLAUDE_PLUGIN_DATA}`** em runtime — estas variáveis são expostas pelo Claude Code ao código dos plugins, mas a forma exata de acessá-las de dentro de um subagente (via env var, via template expansion, via ferramenta específica) precisa ser validada em prova de conceito na Fase C. Se o acesso não for direto, o Orquestrador resolve os paths via lookup no diretório canônico (`~/.claude/plugins/cache/{id}/` e `~/.claude/plugins/data/{id}/`).
- **Comportamento de `enabledPlugins`** em precedência entre user-level, project-level e local settings. A enumeração pode precisar consolidar múltiplas fontes com ordem de prioridade definida. Detalhe a validar na implementação do `/processos`.
- **Split dos agentes atuais em subagentes menores** — a tabela de 5 subagentes para `promocao` assume que os checkpoints atuais ficam onde estão. A Fase C pode revelar que algum ajuste de fronteira entre subagentes é melhor (ex.: juntar dois ou dividir mais um). A decisão definitiva sobre cada fronteira acontece durante a implementação da extração, guiada por este design.
- **Hooks do Mission Control em subagentes de plugin** — os hooks `PreToolUse`, `PostToolUse`, `Stop` vivem no `settings.json` do projeto (framework central) e são project-scoped. Esperam-se que disparem para tool calls feitos de dentro de subagentes de plugin, mantendo a telemetria do Mission Control funcionando sem ajuste. Validar na Fase C.

---

## Apêndice A — Seções obrigatórias do `processo.md`

O arquivo `processo.md` de um plugin de processo deve conter estas seções, nesta ordem:

1. **Identificação** — Nome, descrição em uma frase, modo padrão (auto/interativo/hibrido), versão.
2. **Fluxo de execução** — Lista ordenada de fases do processo, com descrição curta do que cada fase faz e quais subagentes são despachados em cada uma. Cada checkpoint deve ser explicitamente declarado (nome do subagente, pergunta que será feita ao lojista).
3. **Datasets consumidos** — Lista de fontes de dados externas ao framework (APIs, bancos, webhooks) que o processo precisa. Para cada uma: nome lógico, propósito, parâmetros requeridos em `config.json`.
4. **Texto guia de configuração** — Para cada campo de `config.template.json`, o texto exato que o Orquestrador apresenta ao lojista ao pedir o valor. Em linguagem de varejo, não técnica.
5. **Dependências de outros processos** — Se este processo consome outputs de outros, declarar aqui em linguagem narrativa (a declaração técnica vive em `plugin.json > gondola.dependencias`).
6. **Contratos dos subagentes** — Resumo de alto nível do que cada subagente declarado em `agents/` faz, espera como input e retorna. Detalhes técnicos completos vivem no próprio markdown do subagente.

O Orquestrador lê este arquivo no momento da invocação do processo e o usa como bússola durante todo o ciclo de execução.
