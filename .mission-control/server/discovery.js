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

function discoverProcesses() {
  const processes = {};

  if (!fs.existsSync(PLUGIN_CACHE_ROOT)) {
    return processes;
  }

  let pluginDirs;
  try {
    pluginDirs = fs.readdirSync(PLUGIN_CACHE_ROOT, { withFileTypes: true });
  } catch {
    return processes;
  }

  for (const entry of pluginDirs) {
    if (!entry.isDirectory()) continue;

    const pluginDir = path.join(PLUGIN_CACHE_ROOT, entry.name);
    const manifest = readPluginManifest(pluginDir);
    if (!manifest) continue;
    if (!manifest.gondola || manifest.gondola.tipo !== 'processo') continue;

    const procName = manifest.name;
    const proc = {
      status: 'idle',
      installed: true,
      modo: manifest.gondola.modo || null,
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

        // Status inicial do agente: disabled se TODAS as tarefas forem disabled, senão idle.
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
