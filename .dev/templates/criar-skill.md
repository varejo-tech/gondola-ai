# Template: Criar Skill de Plugin

Checklist e template para criação de uma skill dentro de um plugin de processo.

> Na arquitetura de plugins, uma skill vive em `skills/{nome}/SKILL.md` — **uma subpasta por skill**. Cada plugin é autossuficiente: não há skills compartilhadas no framework central. Se dois plugins precisam da mesma capacidade técnica (ex.: renderizar PDF), cada um carrega sua própria implementação.

---

## Checklist

### 1. Definir propósito

Antes de criar o arquivo, responder:
- O que esta skill faz?
- Quais são seus inputs (dados que recebe)?
- Quais são seus outputs (dados que produz)?
- Consome API/MCP da Avanço? Qual?
- Precisa de código de runtime (scripts Node, Python, binários)?

### 2. Criar subpasta e arquivo da skill

```
{plugin}/skills/{nome-da-skill}/SKILL.md
```

O nome da subpasta deve ser kebab-case e corresponder ao `name` no frontmatter do `SKILL.md`.

Se a skill precisa de código de runtime:

```
{plugin}/skills/{nome-da-skill}/
├── SKILL.md
└── _lib/
    ├── package.json     (ou requirements.txt, Cargo.toml, etc.)
    ├── {script}.js
    └── ...
```

O `node_modules/` (ou equivalente) entra no `.gitignore`.

### 3. Documentar API/MCP (se aplicável)

Se a skill consome API ou MCP da Avanço:
- Documentar o endpoint/MCP utilizado.
- Documentar parâmetros esperados.
- Documentar formato de resposta.
- Prever fallback para indisponibilidade.

### 4. Criar fixture de desenvolvimento (se aplicável)

Se a skill consome API externa, criar fixture mock no catálogo:

```
gondola-plugins-catalog/.dev/fixtures/{plugin}-{descritivo}.json
```

### 5. Validar

- [ ] Subpasta `skills/{nome}/` criada?
- [ ] `SKILL.md` tem frontmatter YAML com `name` e `description`?
- [ ] `name` no frontmatter corresponde ao nome da subpasta?
- [ ] Propósito claramente descrito?
- [ ] Inputs declarados com tipo e descrição semântica (nunca nomes de colunas)?
- [ ] Outputs declarados com tipo e descrição?
- [ ] Se consome API: endpoint, parâmetros e resposta documentados?
- [ ] Se consome API: fallback previsto para indisponibilidade?
- [ ] Skill NÃO faz referência a agentes, outros plugins ou ao Orquestrador?
- [ ] Skill NÃO chama `report-progress.sh`?
- [ ] Se tem runtime (`_lib/`): `node_modules/` está no `.gitignore`?

---

## Template: `SKILL.md`

```markdown
---
name: {nome-da-skill}
description: {Uma frase em português descrevendo o que esta skill faz}
---

## Propósito

{Descrição detalhada do que esta skill faz}

## Inputs

- `{nome_semantico}`: {tipo} — {descrição do significado do dado, nunca nome de coluna/campo. Ex: "identificador único do produto no sistema da loja" em vez de "codigo_produto"}
- `{nome_semantico}`: {tipo} — {descrição}

## Outputs

- `{nome_do_output}`: {tipo} — {descrição}
- `{nome_do_output}`: {tipo} — {descrição}

## Implementação

### Passos

1. {Passo 1 — o que fazer}
2. {Passo 2 — o que fazer}
3. {Passo N — o que fazer}

### API/MCP (se aplicável)

**Endpoint:** `{URL ou nome do MCP}`
**Método:** `{GET/POST/etc.}`
**Parâmetros:**
- `{param}`: {tipo} — {descrição}

**Resposta esperada:**
```json
{exemplo de resposta}
```

### Fallback

Se a API estiver indisponível:
- {Comportamento alternativo — ex: retornar mensagem ao operador, usar cache, etc.}
```

---

## Skills com runtime (`_lib/`)

Quando a implementação da skill requer código executável (scripts Node, Python, binários), o código fica em `_lib/` dentro da subpasta da skill:

```
{plugin}/skills/{nome-da-skill}/
├── SKILL.md           ← instruções para o subagente
└── _lib/
    ├── package.json   ← dependências isoladas desta skill
    ├── render.js      ← script executável
    └── ...
```

**Regras de runtime:**

1. **Isolado por skill** — `_lib/` de uma skill não é compartilhado com outras skills. Cada skill gerencia suas próprias dependências.
2. **Bootstrap idempotente** — O subagente que invoca a skill é responsável por rodar `npm install` (ou equivalente) na primeira execução, se necessário. A skill deve verificar se `node_modules/` existe antes de chamar o script.
3. **`node_modules/` no `.gitignore`** — Sempre. Configurar no `.gitignore` do plugin.

---

## Regras

1. **Subpasta obrigatória** — Cada skill é uma subpasta `skills/{nome}/`, não um arquivo solto. O `SKILL.md` fica dentro da subpasta.
2. **Frontmatter obrigatório** — `name` e `description` no frontmatter do `SKILL.md`.
3. **`name` = nome da subpasta** — `name: minha-skill` corresponde a `skills/minha-skill/SKILL.md`.
4. **Invocação via namespace** — Subagentes invocam via `Skill("{plugin}:{skill}", ...)`. O namespace garante isolação entre plugins.
5. **Sem `report-progress`** — Skills não chamam `report-progress.sh`. Quem reporta é o Orquestrador via hooks automáticos.
6. **Sem referências a agentes ou outros plugins** — Skills não conhecem quem as invoca nem outros plugins.
7. **API documentada** — Toda integração com API/MCP deve ter endpoint, parâmetros e resposta documentados na seção `## Implementação`.
8. **Fallback obrigatório** — Sempre prever comportamento para quando a API estiver indisponível.
9. **Inputs semânticos** — Declarar inputs pelo significado do dado (ex: "identificador da transação"), nunca por nomes de colunas ou campos específicos do sistema do lojista (ex: `Numero_Nota`, `estoque_atual`). Cada lojista pode ter fontes com estruturas distintas. O subagente é responsável por mapear a correspondência.
10. **Auto-suficiência** — Não existe skill compartilhada no framework central. Se dois plugins precisam da mesma capacidade, cada um carrega sua própria cópia.
