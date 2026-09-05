// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { invoke, makeInput } from './eval-oracle.mjs';

test('case IDs and checks are valid; generation input excludes grading and future turns', async () => {
  const cases = JSON.parse(await readFile(new URL('../evals/oracle/cases.json', import.meta.url), 'utf8'));
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const c of cases) {
    assert.match(c.id, /^[a-z0-9-]+$/);
    assert(c.turns.length > 0 && c.checks.length > 0);
    assert([...c.turns, ...c.checks].every(s => typeof s === 'string' && s.trim()));
    const input = makeInput('bundle', [], [{ role: 'user', content: c.turns[0] }], 'model');
    assert(!Object.hasOwn(input, 'checks'));
    for (const check of c.checks) assert(!JSON.stringify(input).includes(check));
    for (const future of c.turns.slice(1)) assert(!JSON.stringify(input).includes(future));
  }
});

test('runner replays actual earlier answers, withholds future turns and refuses overwrite', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'oracle-runner-test-'));
  const adapter = join(cwd, 'adapter.mjs');
  const bundle = join(cwd, 'oracle.md');
  const output = join(cwd, 'run');
  const run = promisify(execFile);
  const script = fileURLToPath(new URL('./eval-oracle.mjs', import.meta.url));
  const args = [script, '--adapter', adapter, '--bundle', bundle, '--model', 'fixture', '--output', output, '--case', 'facts-arrive-later'];
  try {
    await writeFile(bundle, 'fixture principles');
    await writeFile(adapter, 'let data="";for await (const chunk of process.stdin)data+=chunk; const input=JSON.parse(data);process.stdout.write(JSON.stringify({text:"reply-"+input.messages.length}));');
    await run(process.execPath, args);
    const first = JSON.parse(await readFile(join(output, 'facts-arrive-later.1.1.input.json')));
    const second = JSON.parse(await readFile(join(output, 'facts-arrive-later.1.2.input.json')));
    assert.equal(first.messages.length, 1);
    assert.deepEqual(second.messages[1], { role: 'assistant', content: 'reply-1' });
    assert.equal(second.messages.length, 3);
    assert(!first.sources.some(s => s.path.includes('DRAFTS')));
    await assert.rejects(run(process.execPath, args), /EEXIST/);
    const summary = JSON.parse(await readFile(join(output, 'summary.json')));
    assert.equal(summary.grading, 'pending');
    assert.equal(summary.completed, 2);
    await writeFile(adapter, 'process.exit(1);');
    args[args.indexOf('--output') + 1] = join(cwd, 'failed');
    await assert.rejects(run(process.execPath, args));
    const failed = JSON.parse(await readFile(join(cwd, 'failed/summary.json')));
    assert.equal(failed.turns, 1);
    assert.equal(failed.completed, 0);
    assert.equal(failed.failed, 1);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test('adapter errors and empty responses are failures rather than successful judgments', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'oracle-adapter-test-'));
  const adapter = join(cwd, 'adapter.mjs');
  try {
    await writeFile(adapter, 'process.stdout.write(JSON.stringify({text:"답변"}));');
    assert.equal((await invoke(adapter, {}, cwd)).text, '답변');
    await writeFile(adapter, 'process.stdout.write(JSON.stringify({text:""}));');
    await assert.rejects(invoke(adapter, {}, cwd), /no answer/);
    await writeFile(adapter, 'process.stderr.write("failure"); process.exit(1);');
    await assert.rejects(invoke(adapter, {}, cwd), /failure/);
    await writeFile(adapter, 'process.stdout.write("not json");');
    await assert.rejects(invoke(adapter, {}, cwd));
    await writeFile(adapter, 'setInterval(() => {}, 1000);');
    await assert.rejects(invoke(adapter, {}, cwd, 100), /Adapter failed/);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
