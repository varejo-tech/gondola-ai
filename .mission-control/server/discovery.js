const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const EXCLUDED_DIRS = new Set([
  '.git', '.dev', '.skills', '.mission-control', '.claude',
  'node_modules', 'docs',
]);

function readMetadata(claudeMdPath) {
  try {
    const md = fs.readFileSync(claudeMdPath, 'utf-8');
    const metadata = {};
    const modoMatch = md.match(/^modo:\s*(.+)$/m);
    const descMatch = md.match(/^descricao:\s*(.+)$/m);
    if (modoMatch) metadata.modo = modoMatch[1].trim();
    if (descMatch) metadata.descricao = descMatch[1].trim();
    return metadata;
  } catch {
    return {};
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
    const [, , , taskName, status, step, total, msg] = m;
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

  let entries;
  try {
    entries = fs.readdirSync(ROOT, { withFileTypes: true });
  } catch {
    return processes;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const procDir = path.join(ROOT, entry.name);
    const claudeMd = path.join(procDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMd)) continue;

    const procName = entry.name;
    const metadata = readMetadata(claudeMd);

    const proc = {
      status: 'idle',
      installed: true,
      modo: metadata.modo || null,
      descricao: metadata.descricao || null,
      agents: {},
    };

    const agentsDir = path.join(procDir, 'agents');
    if (fs.existsSync(agentsDir)) {
      let agentFiles;
      try {
        agentFiles = fs.readdirSync(agentsDir).filter(f => f.startsWith('agente-') && f.endsWith('.md'));
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
