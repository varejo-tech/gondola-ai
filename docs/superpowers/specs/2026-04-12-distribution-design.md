# Gondola AI — Design de Distribuição

**Data:** 2026-04-12
**Status:** Aprovado
**Autor:** Leonardo Chaves Moreira + Agente Desenvolvedor

---

## Objetivo

Definir a estratégia de distribuição do framework Gondola AI para dois públicos: supermercadistas (lojistas) que usam o sistema, e desenvolvedores da Avanço Informática que constroem e mantêm o framework e seus plugins.

---

## 1. Repositórios

O ecossistema Gondola é composto por 4 repositórios no GitHub:

| Repo | Visibilidade | Público-alvo | Conteúdo |
|---|---|---|---|
| `avanco/gondola-ai` | Público | Todos | Framework central: Orquestrador, Mission Control, scripts, CLAUDE.orquestrador.md, bootstrap |
| `avanco/create-gondola` | Público (npm) | Todos | Pacote npm do instalador — baixa o framework, roda bootstrap, exibe instruções |
| `avanco/gondola-marketplace` | Privado | Clientes Avanço | Marketplace limpo: `marketplace.json` + plugins publicados (sem fixtures, sem artefatos de dev) |
| `avanco/gondola-dev-tools` | Privado | Devs Avanço | Pasta `.dev/`: modo.sh, settings dev/op, templates do contrato de plugin |

O ambiente local de desenvolvimento de plugins (`gondola-plugins-catalog`) continua existindo nas máquinas dos devs, mas não é publicado. Os plugins são copiados limpos para `gondola-marketplace` quando prontos para release.

---

## 2. Fluxo do lojista

### 2.1 Pré-requisitos

- Node.js instalado
- Claude Code instalado

### 2.2 Instalação inicial

```bash
npx create-gondola
```

O instalador executa:

1. Pergunta o nome da pasta (default: `gondola-ai`)
2. Baixa o release mais recente de `avanco/gondola-ai` via GitHub API (não exige git)
3. Extrai os arquivos, excluindo: `.git/`, `.dev/`, `.github/`
4. Roda `bootstrap.sh` — cria arquivos locais (memória, settings locais, `.gitignore`)
5. Remove `bootstrap.sh` (já cumpriu sua função)
6. Exibe mensagem de conclusão com próximos passos

O instalador NÃO registra o marketplace nem instala plugins.

### 2.3 Primeiro uso

O lojista abre Claude Code na pasta do framework. O Orquestrador detecta que não há plugins instalados (via `/processos` retornando lista vazia) e exibe a mensagem de onboarding:

> "Bem-vindo à gondola.ai. Eu sou o Orquestrador da gondola e minha missão é ajudá-lo a executar seus processos de forma automatizada por agentes de IA especialistas. Por enquanto sua gondola está vazia — para começar a automatizar os seus processos é necessário conectar ao marketplace da Avanço e acessar o catálogo de plugins da gondola.ai. Se precisar de ajuda para executar estes passos, estou à disposição."

Se o lojista pedir ajuda, o Orquestrador guia:

1. Registro do marketplace: `/plugin marketplace add avanco/gondola-marketplace`
2. Visualização dos plugins disponíveis: `/plugin`
3. Instalação de plugins: `/plugin install nome-do-plugin`

Após o primeiro plugin ser instalado, o Orquestrador volta ao comportamento normal — apresenta processos disponíveis e pergunta qual executar.

### 2.4 Atualização do framework

Três caminhos equivalentes, para diferentes níveis de conforto técnico:

| Método | Comando | Quando usar |
|---|---|---|
| Dentro do Claude Code | `/gondola update` | Já está usando o sistema |
| Via npx | `npx create-gondola` (na pasta existente) | Prefere rodar no terminal |
| Via git | `git pull` | Clonou o repo originalmente |

Todos respeitam a mesma regra: atualizam arquivos do framework, nunca tocam em arquivos locais (memória, config, outputs, plugins).

---

## 3. Fluxo do dev da Avanço

### 3.1 Pré-requisitos

- Git, Node.js, Claude Code instalados
- Acesso aos repos privados da Avanço no GitHub

### 3.2 Setup inicial

```bash
git clone avanco/gondola-ai
cd gondola-ai
git clone avanco/gondola-dev-tools .dev
./bootstrap.sh
.dev/modo.sh dev
```

Resultado: framework completo com histórico git, pasta `.dev/` com modo dev/op, persona de dev ativa.

### 3.3 Desenvolvimento de plugins

```bash
cd ~/projetos
git clone avanco/gondola-marketplace
```

Para testar um plugin em desenvolvimento localmente:

```
/plugin marketplace add ~/projetos/gondola-marketplace
/plugin install promocao
```

### 3.4 Publicação de plugin

O dev copia os arquivos finais do ambiente local de desenvolvimento para `gondola-marketplace`, atualiza o `marketplace.json`, faz push. O lojista recebe na próxima vez que rodar `/plugin update`.

### 3.5 Alternância de modo

```bash
.dev/modo.sh op    # testa como lojista (persona Orquestrador)
.dev/modo.sh dev   # volta para dev do framework
```

---

## 4. Pacote `create-gondola`

### 4.1 Tecnologia

Pacote Node.js publicado no npm público como `create-gondola`. Invocado via `npx create-gondola`.

### 4.2 Estrutura do pacote

```
create-gondola/
├── package.json          ← name: "create-gondola", bin: "create-gondola"
├── index.js              ← lógica do instalador (~100-150 linhas)
└── README.md
```

### 4.3 Comportamento

1. Pergunta o nome da pasta (default: `gondola-ai`)
2. Baixa tarball do release mais recente via GitHub API
3. Extrai excluindo `.git/`, `.dev/`, `.github/`
4. Roda `bootstrap.sh`
5. Remove `bootstrap.sh`
6. Exibe mensagem de conclusão

Se detectar instalação existente (pasta já contém `version.json`), opera em modo de atualização: mesma lógica do `/gondola update` (Seção 6) — substitui arquivos do framework, preserva arquivos locais.

### 4.4 O que NÃO faz

- Não registra marketplace
- Não instala plugins
- Não exige git na máquina do lojista

---

## 5. README.md do gondola-ai

### 5.1 Público

Qualquer pessoa que chegue ao repo — lojista, dev, cliente em potencial.

### 5.2 Estrutura

1. **Header** — Nome/logo da Gondola AI + tagline ("Framework de automação por IA para supermercados")
2. **O que é a Gondola** — 2-3 parágrafos: framework que orquestra agentes de IA para automatizar processos do supermercado. Orquestrador como ponto central, plugins como unidades de automação.
3. **Como funciona** — Diagrama visual (mermaid) mostrando: Gondola → Orquestrador → Plugins → Agentes. Explicação breve do modelo.
4. **Instalação rápida** — Comando `npx create-gondola` e passos seguintes.
5. **Conectando ao marketplace** — Como registrar, visualizar e instalar plugins. Comandos exatos.
6. **Atualizando a Gondola** — As três formas: npx, git pull, `/gondola update`.
7. **Para desenvolvedores** — Seção breve direcionando para `gondola-dev-tools`.
8. **Suporte** — Contato com a Avanço.

### 5.3 Tom

Profissional, acessível, sem jargão técnico desnecessário. Formatação com badges, seções claras, blocos de código com syntax highlighting.

---

## 6. Comando `/gondola update`

### 6.1 Tipo

Slash command do Claude Code em `.claude/commands/gondola-update.md`.

### 6.2 Comportamento

1. Lê `version.json` na raiz do framework para obter versão atual
2. Consulta versão mais recente em `avanco/gondola-ai` (GitHub releases API)
3. Se há atualização:
   - Baixa os arquivos atualizados
   - Substitui arquivos do framework (scripts, CLAUDE.orquestrador.md, Mission Control)
   - Preserva: memória, config local, outputs, plugins instalados
   - Atualiza `version.json`
   - Informa o que mudou
4. Se já está na versão mais recente, informa que está atualizado

### 6.3 Requer

- `version.json` na raiz do framework com campo `version` (semver)
- GitHub releases no repo `avanco/gondola-ai` para marcar versões

### 6.4 O que NÃO faz

- Não atualiza plugins (isso é `/plugin update`)
- Não altera arquivos locais do lojista
- Não exige git

---

## 7. Onboarding no Orquestrador

### 7.1 Alteração necessária

Adicionar seção de onboarding no `CLAUDE.orquestrador.md`.

### 7.2 Detecção

Quando `/processos` retorna lista vazia (nenhum plugin tipo "processo" instalado), o Orquestrador entra em modo de onboarding.

### 7.3 Mensagem de boas-vindas

Texto definido na Seção 2.3 deste documento.

### 7.4 Guia de registro

Se o lojista pedir ajuda, o Orquestrador orienta passo a passo:

1. Registro do marketplace: `/plugin marketplace add avanco/gondola-marketplace`
2. Visualização: `/plugin`
3. Instalação: `/plugin install nome-do-plugin`

### 7.5 Transição

Após o primeiro plugin ser instalado, o Orquestrador retorna ao comportamento operacional normal.

---

## 8. Estrutura do `gondola-marketplace`

### 8.1 Estrutura de diretórios

```
gondola-marketplace/
├── .claude-plugin/
│   └── marketplace.json
├── promocao/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── gondola.json
│   ├── processo.md
│   ├── commands/
│   │   └── promocao.md
│   ├── agents/
│   │   └── *.md
│   ├── skills/
│   │   └── */SKILL.md
│   ├── templates/
│   │   └── config.template.json
│   └── README.md
├── compras/                     ← futuro plugin
│   └── ...
└── README.md
```

### 8.2 O que NÃO entra

- `.dev/`, `fixtures/`, testes
- Arquivos de desenvolvimento do catálogo local
- Qualquer artefato que não seja o plugin publicado

### 8.3 Publicação

O dev copia os arquivos finais do ambiente de desenvolvimento para este repo, atualiza `marketplace.json`, faz push.

---

## 9. Estrutura do `gondola-dev-tools`

### 9.1 Estrutura de diretórios

```
gondola-dev-tools/              ← clonado como .dev/ dentro do gondola-ai
├── CLAUDE.dev.md
├── modo.sh
├── settings.dev.json
├── settings.op.json
├── memory.dev.md
└── templates/
    ├── criar-processo.md
    ├── criar-agente.md
    ├── criar-skill.md
    └── convencoes-framework.md
```

### 9.2 O que NÃO entra

- Código do framework (está no `gondola-ai`)
- Plugins (estão no `gondola-marketplace`)
- Fixtures de teste (ficam no ambiente local de dev de plugins)

### 9.3 README

Instruções de setup para devs da Avanço: como clonar dentro do gondola-ai, como alternar modos, como usar os templates para criar plugins.

---

## Decisões registradas

| # | Decisão | Justificativa |
|---|---|---|
| D1 | Framework público, marketplace privado | Valor está nos plugins; framework aberto atrai visibilidade |
| D2 | `npx create-gondola` não registra marketplace | Marketplace é privado, requer acesso de cliente |
| D3 | Onboarding no Orquestrador (não no instalador) | O Orquestrador é o ponto de contato natural do lojista |
| D4 | Repo de dev-tools separado | `.dev/` não pode ficar no repo público (lojista clonaria) |
| D5 | Marketplace como repo limpo (não o catálogo de dev) | Separar artefatos de dev dos plugins publicados |
| D6 | Três caminhos de atualização do framework | npx, git pull, `/gondola update` — cada público no seu conforto |
| D7 | `version.json` + GitHub releases | Controle de versão necessário para `/gondola update` funcionar |
