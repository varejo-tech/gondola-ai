---
description: Atualiza o framework Gondola AI para a versão mais recente
---

Você é o assistente de atualização do framework Gondola AI.

## O que fazer

1. Leia o arquivo `version.json` na raiz do projeto para obter a versão atual.

2. Consulte a versão mais recente disponível no GitHub:

```bash
curl -s https://api.github.com/repos/varejo-tech/gondola-ai/releases/latest | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(chunks.join(''));
  if (data.tag_name) {
    console.log(JSON.stringify({ version: data.tag_name.replace('v', ''), url: data.tarball_url }));
  } else {
    console.log(JSON.stringify({ error: 'Nenhum release encontrado' }));
  }
});
"
```

3. Compare as versões. Se a versão local é igual ou superior à remota, informe:
   > "Sua Gondola está atualizada (versão X.Y.Z)."

4. Se há atualização disponível, informe ao lojista qual é a versão nova e pergunte se deseja atualizar.

5. Se o lojista confirmar, baixe o tarball do release e extraia os arquivos atualizáveis:

```bash
# Baixar release
curl -L -o /tmp/gondola-update.tar.gz "<tarball_url>"

# Extrair em pasta temporária
mkdir -p /tmp/gondola-update
tar -xzf /tmp/gondola-update.tar.gz -C /tmp/gondola-update --strip-components=1

# Copiar arquivos do framework (nunca sobrescrever arquivos locais)
cp /tmp/gondola-update/CLAUDE.orquestrador.md ./CLAUDE.orquestrador.md
cp /tmp/gondola-update/report-progress.sh ./report-progress.sh
cp /tmp/gondola-update/start-process.sh ./start-process.sh
cp /tmp/gondola-update/version.json ./version.json
cp -r /tmp/gondola-update/.mission-control/ ./.mission-control/
cp -r /tmp/gondola-update/.claude/commands/ ./.claude/commands/

# Limpar
rm -rf /tmp/gondola-update /tmp/gondola-update.tar.gz
```

6. Após atualizar, reconfigure o CLAUDE.md local:

```bash
cp CLAUDE.orquestrador.md CLAUDE.md
```

7. Informe o lojista:
   > "Gondola atualizada de X.Y.Z para A.B.C. Reinicie o Claude Code para aplicar as mudanças."

## Arquivos que NUNCA devem ser sobrescritos

- `memory.op.md` (memória do lojista)
- `.claude/settings.json` (configuração local)
- `.claude/settings.local.json` (overrides locais)
- Qualquer arquivo dentro de `~/.claude/plugins/` (plugins instalados)
- `.dev/` (se existir — ambiente de dev)
