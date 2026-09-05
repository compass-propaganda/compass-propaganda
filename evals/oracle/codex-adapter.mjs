// SPDX-License-Identifier: MIT
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const input = JSON.parse(await new Promise(resolve => {
  let value = '';
  process.stdin.on('data', chunk => { value += chunk; });
  process.stdin.on('end', () => resolve(value));
}));
const binary = process.env.ORACLE_EVAL_CODEX || 'codex';
const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
const directory = await mkdtemp(join(tmpdir(), 'compass-answer-'));
const answer = join(directory, 'answer.txt');
const args = [
  'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
  '--sandbox', 'read-only', '--json', '--model', input.model,
  '-c', 'model_reasoning_effort="high"', '-c', 'project_doc_max_bytes=0',
  '-c', 'features.shell_tool=false', '-c', 'features.memories=false',
  '-c', 'features.apps=false', '-c', 'features.skip_host_skill_discovery=true',
  '-c', 'web_search="disabled"', '--output-last-message', answer, '-',
];
let child;
process.on('SIGTERM', () => { child?.kill('SIGTERM'); });
try {
  const events = await new Promise((accept, reject) => {
    child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.stdin.on('error', () => {});
    child.on('error', reject);
    child.on('close', code => code === 0 ? accept(stdout) : reject(new Error(stderr.slice(-2000) || stdout.slice(-2000))));
    child.stdin.end(`${input.instructions}\n\n${input.context}\n\n자료:\n${JSON.stringify(input.sources)}\n\n대화:\n${JSON.stringify(input.messages)}`);
  });
  const parsed = events.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const text = await readFile(answer, 'utf8');
  const usage = parsed.filter(event => event.type === 'turn.completed').map(event => event.usage);
  process.stdout.write(JSON.stringify({ text, requestedModel: input.model, reasoningEffort: 'high', runtime: version, usage, events: parsed }));
} finally { await rm(directory, { recursive: true, force: true }); }
