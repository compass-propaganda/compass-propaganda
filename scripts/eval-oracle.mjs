// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
export const hash = (value) => createHash('sha256').update(value).digest('hex');

export function makeInput(bundle, sources, messages, model) {
  return {
    model,
    instructions: bundle,
    context: '평가 환경에서 아래 sources는 조회 도구가 반환한 공식 저장소의 고정 원문이다. 이 자료와 대화만으로 사용자의 마지막 발언에 답하라. 외부 조회 도구는 사용할 수 없다. sources가 비어 있으면 권장 원문을 확인할 수 없는 환경이다.',
    sources,
    messages,
  };
}

export async function invoke(adapter, input, cwd, timeoutMs = 180000) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [adapter], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.stdin.on('error', () => {});
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error(`Adapter failed (${code}): ${stderr.slice(-2000)}`);
        const result = JSON.parse(stdout);
        if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('Adapter returned no answer.');
        accept(result);
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

async function main() {
  const { values } = parseArgs({ options: {
    adapter: { type: 'string' }, model: { type: 'string' }, output: { type: 'string' },
    bundle: { type: 'string', default: 'dist/oracle.md' },
    repeat: { type: 'string', default: '1' }, case: { type: 'string' },
  } });
  if (!values.adapter || !values.model || !values.output) {
    throw new Error('Usage: node scripts/eval-oracle.mjs --adapter FILE --model MODEL --output DIR [--bundle FILE] [--repeat N] [--case ID]');
  }
  const repeats = Number(values.repeat);
  if (!Number.isSafeInteger(repeats) || repeats < 1) throw new Error('repeat must be a positive integer.');
  const adapter = resolve(values.adapter), output = resolve(values.output);
  const bundle = await readFile(resolve(values.bundle), 'utf8');
  const suiteText = await readFile(join(root, 'evals/oracle/cases.json'), 'utf8');
  const suite = JSON.parse(suiteText);
  const cases = suite.filter(c => !values.case || c.id === values.case);
  if (!cases.length) throw new Error('No matching cases.');
  const sources = await Promise.all((await readdir(join(root, 'recommendations')))
    .filter(name => /^\d.*\.md$/.test(name)).sort().map(async name => ({
      path: `recommendations/${name}`, content: await readFile(join(root, 'recommendations', name), 'utf8'),
    })));
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Refuse to overwrite a previous run.
  const metadata = {
    startedAt: new Date().toISOString(), requestedModel: values.model,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    bundleSha256: hash(bundle), suiteSha256: hash(suiteText), adapterSha256: hash(await readFile(adapter)),
    sources: sources.map(s => ({ path: s.path, sha256: hash(s.content) })),
    repeats, caseIds: cases.map(c => c.id), environment: 'fixed-sources',
  };
  await writeFile(join(output, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
  await writeFile(join(output, 'oracle.md'), bundle);
  await writeFile(join(output, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
  await writeFile(join(output, 'rubric.json'), JSON.stringify(cases, null, 2) + '\n');
  const workspace = await mkdtemp(join(tmpdir(), 'compass-eval-'));
  const results = [];
  try {
    for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const c of cases) {
        const messages = [];
        for (const [index, user] of c.turns.entries()) {
          messages.push({ role: 'user', content: user });
          const input = makeInput(bundle, c.sources === false ? [] : sources, messages, values.model);
          const prefix = `${c.id}.${repeat}.${index + 1}`;
          await writeFile(join(output, `${prefix}.input.json`), JSON.stringify(input, null, 2) + '\n');
          const start = Date.now();
          let result;
          try {
            result = { ...await invoke(adapter, input, workspace), status: 'completed' };
          } catch (error) {
            result = { status: 'failed', error: error.message };
          }
          result = { caseId: c.id, repeat, turn: index + 1, elapsedMs: Date.now() - start, ...result };
          await writeFile(join(output, `${prefix}.output.json`), JSON.stringify(result, null, 2) + '\n');
          results.push(result);
          console.log(`${prefix}: ${result.status}`);
          if (result.status !== 'completed') break;
          messages.push({ role: 'assistant', content: result.text });
        }
      }
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
  const summary = {
    completedAt: new Date().toISOString(), turns: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    failed: results.filter(r => r.status === 'failed').length,
    grading: 'pending',
  };
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  if (summary.failed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
