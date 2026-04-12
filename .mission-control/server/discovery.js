const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_CACHE_ROOT = path.join(os.homedir(), '.claude', 'plugins', 'cache');

function readPluginManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function readGondolaManifest(pluginDir) {
  const gondolaPath = path.join(pluginDir, 'gondola.json');
  if (!fs.existsSync(gondolaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(gondolaPath, 'utf-8'));
  } catch {
    return null;
  }
}

function parseAgentTasks(agentFilePath) {
  const tasks = {};
  let content;
  try {
    content = fs.readFileSync(agentFilePath, 'utf-8');
  } catch {
    return tasks;
  }

  // report-progress.sh <processo> <agente> <tarefa> <status> <step> <total> "<mensagem>"
  const re = /report-progress\.sh\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)(?:\s+"([^"]*)")?/g;

  let m;
  while ((m = re.exec(content)) !== null) {
    const [, , , taskName, status, step, total] = m;
    const totalSteps = parseInt(total, 10);

    if (!tasks[taskName]) {
      tasks[taskName] = {
        status: 'idle',
        step: 0,
        total_steps: totalSteps,
        message: '',
        timestamp: null,
        installed: true,
        statusesSeen: new Set(),
      };
    }

    const t = tasks[taskName];
    t.statusesSeen.add(status);
    if (totalSteps > t.total_steps) t.total_steps = totalSteps;
  }

  // Pós-processamento: tarefas que só aparecem como `disabled` no source ficam disabled de saída.
  // As demais começam idle (nenhum evento ainda).
  for (const t of Object.values(tasks)) {
    const only = t.statusesSeen;
    if (only.size === 1 && only.has('disabled')) {
      t.status = 'disabled';
    }
    delete t.statusesSeen;
  }

  return tasks;
}

/**
 * Enumera diretórios de plugin instalados.
 * Estrutura do cache: cache/{marketplace}/{plugin}/{version}/
 * Retorna um array de paths absolutos para o diretório da versão mais recente de cada plugin.
 */
function enumeratePluginDirs() {
  const dirs = [];
  if (!fs.existsSync(PLUGIN_CACHE_ROOT)) return dirs;

  let marketplaces;
  try {
    marketplaces = fs.readdirSync(PLUGIN_CACHE_ROOT, { withFileTypes: true });
  } catch {
    return dirs;
  }

  for (const mkt of marketplaces) {
    if (!mkt.isDirectory()) continue;
    const mktPath = path.join(PLUGIN_CACHE_ROOT, mkt.name);

    let plugins;
    try {
      plugins = fs.readdirSync(mktPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const plug of plugins) {
      if (!plug.isDirectory()) continue;
      const plugPath = path.join(mktPath, plug.name);

      let versions;
      try {
        versions = fs.readdirSync(plugPath, { withFileTypes: true })
          .filter(v => v.isDirectory())
          .map(v => v.name)
          .sort();
      } catch {
        continue;
      }

      if (versions.length === 0) continue;
      // Pega a última versão (sort lexicográfico, suficiente para semver simples)
      dirs.push(path.join(plugPath, versions[versions.length - 1]));
    }
  }

  return dirs;
}

function discoverProcesses() {
  const processes = {};
  const pluginDirs = enumeratePluginDirs();

  for (const pluginDir of pluginDirs) {
    const manifest = readPluginManifest(pluginDir);
    if (!manifest) continue;

    const gondola = readGondolaManifest(pluginDir);
    if (!gondola || gondola.tipo !== 'processo') continue;

    const dirName = path.basename(path.dirname(pluginDir)); // nome do plugin no cache
    const procName = typeof manifest.name === 'string' && manifest.name.length > 0
      ? manifest.name
      : dirName;
    const proc = {
      status: 'idle',
      installed: true,
      modo: gondola.modo || null,
      descricao: manifest.description || null,
      agents: {},
    };

    const agentsDir = path.join(pluginDir, 'agents');
    if (fs.existsSync(agentsDir)) {
      let agentFiles;
      try {
        agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      } catch {
        agentFiles = [];
      }
      agentFiles.sort();

      for (const af of agentFiles) {
        const agentName = af.replace(/\.md$/, '');
        const tasks = parseAgentTasks(path.join(agentsDir, af));

        const taskList = Object.values(tasks);
        const allDisabled = taskList.length > 0 && taskList.every(t => t.status === 'disabled');

        proc.agents[agentName] = {
          status: allDisabled ? 'disabled' : 'idle',
          installed: true,
          tasks,
        };
      }
    }

    processes[procName] = proc;
  }

  return processes;
}

module.exports = { discoverProcesses };
