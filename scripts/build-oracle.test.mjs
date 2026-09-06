// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'compass-oracle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'oracle'));
  await copyFile(new URL('./build-oracle.mjs', import.meta.url), join(root, 'scripts/build-oracle.mjs'));
  const manifest = {
    instructions: 'oracle/PROMPT.md',
    skill: 'oracle/SKILL.md',
    documents: [
      { path: 'PRINCIPLES.md', role: 'principles' },
      { path: 'ORACLE.md', role: 'execution' },
    ],
  };
  await writeFile(join(root, 'oracle/manifest.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'oracle/PROMPT.md'), '# Instructions\nRead the supplied principles.\n');
  await writeFile(join(root, 'oracle/SKILL.md'), '---\nname: compass-propaganda\ndescription: Apply the oracle.\n---\nRead references/oracle.md.\n');
  await writeFile(join(root, 'PRINCIPLES.md'), '# Principles\nConsider the cost of acting.\n');
  await writeFile(join(root, 'ORACLE.md'), '# Execution\nApply the verified recommendation within its scope.\n');
  return {
    root,
    manifest,
    run: (...args) => spawnSync(process.execPath, [join(root, 'scripts/build-oracle.mjs'), ...args], {
      cwd: tmpdir(), encoding: 'utf8',
    }),
    output: () => readFile(join(root, 'dist/oracle.md'), 'utf8'),
  };
}

test('build is stable, self-contained and excludes unlisted files; changed principles make it stale', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'private.txt'), 'unlisted private content');
  assert.equal(f.run().status, 0);
  const original = await f.output();
  assert.match(original, /Consider the cost of acting/);
  assert.doesNotMatch(original, /unlisted private content/);
  assert.equal(f.run().status, 0);
  assert.equal(await f.output(), original);
  assert.equal(f.run('--check').status, 0);
  await writeFile(join(f.root, 'PRINCIPLES.md'), '# Principles\nA changed principle.\n');
  assert.equal(f.run('--check').status, 1);
  assert.equal(await f.output(), original);
  assert.equal(f.run().status, 0);
  const updated = await f.output();
  assert.match(updated, /A changed principle/);
  assert.notEqual(updated.match(/묶음 식별자: (.+)/)[1], original.match(/묶음 식별자: (.+)/)[1]);
});

test('missing sources fail without overwriting an existing artifact', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run().status, 0);
  const original = await f.output();
  await rm(join(f.root, 'PRINCIPLES.md'));
  assert.equal(f.run().status, 1);
  assert.equal(await f.output(), original);
});

test('recommendations remain outside the bundle and cannot be declared as bundled recommendations', async (t) => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'recommendations'));
  const recommendation = join(f.root, 'recommendations/example.md');
  await writeFile(recommendation, '# A recommendation fetched at runtime\n');
  assert.equal(f.run().status, 0);
  const original = await f.output();
  assert.doesNotMatch(original, /A recommendation fetched at runtime/);
  await writeFile(recommendation, '# A revised recommendation\n');
  assert.equal(f.run('--check').status, 0);
  assert.equal(f.run().status, 0);
  assert.equal(await f.output(), original);
  f.manifest.documents.push({ path: 'recommendations/example.md', role: 'recommendation' });
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
  assert.equal(await f.output(), original);
});

test('skill includes the same oracle and detects changed or damaged skill files', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run().status, 0);
  const skillPath = join(f.root, 'dist/compass-propaganda/SKILL.md');
  const referencePath = join(f.root, 'dist/compass-propaganda/references/oracle.md');
  assert.equal(await readFile(referencePath, 'utf8'), await f.output());
  assert.equal(await readFile(skillPath, 'utf8'), await readFile(join(f.root, 'oracle/SKILL.md'), 'utf8'));
  await writeFile(skillPath, 'damaged skill');
  assert.equal(f.run('--check').status, 1);
  assert.equal(f.run().status, 0);
  const original = await f.output();
  await writeFile(join(f.root, 'oracle/SKILL.md'), 'Updated skill instructions.');
  assert.equal(f.run('--check').status, 1);
  assert.equal(f.run().status, 0);
  assert.notEqual(await f.output(), original);
  await rm(referencePath);
  assert.equal(f.run('--check').status, 1);
});

test('rejects source paths and symlinks outside the repository', async (t) => {
  const f = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'compass-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'private.md'), 'not a project source');
  f.manifest.documents[0].path = join(outside, 'private.md');
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
  await symlink(join(outside, 'private.md'), join(f.root, 'linked.md'));
  f.manifest.documents[0].path = 'linked.md';
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
});

test('rejects unknown document roles and duplicate sources', async (t) => {
  const f = await fixture(t);
  f.manifest.documents[0].role = 'unknown';
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
  f.manifest.documents[0].role = 'principles';
  f.manifest.documents.push({ ...f.manifest.documents[0] });
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
});

test('canonical execution rules are included verbatim once and invalidate the generated bundle', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run().status, 0);
  const original = await f.output();
  const rules = await readFile(join(f.root, 'ORACLE.md'), 'utf8');
  assert.equal(original.split(rules).length - 1, 1);
  assert.match(original, /문서: "ORACLE.md"\n역할: execution/);
  const revised = '# Execution\nAn updated rule from the canonical source.\n';
  await writeFile(join(f.root, 'ORACLE.md'), revised);
  assert.equal(f.run('--check').status, 1);
  assert.equal(f.run().status, 0);
  const updated = await f.output();
  assert(updated.includes(revised));
  assert(!updated.includes(rules));
  assert.equal(await readFile(join(f.root, 'dist/compass-propaganda/references/oracle.md'), 'utf8'), updated);
});

test('missing or multiple execution sources cannot silently produce an incomplete oracle', async (t) => {
  const f = await fixture(t);
  assert.equal(f.run().status, 0);
  const original = await f.output();
  const execution = f.manifest.documents.pop();
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
  assert.equal(await f.output(), original);
  f.manifest.documents.push(execution, { path: 'SECOND.md', role: 'execution' });
  await writeFile(join(f.root, 'SECOND.md'), '# Alternative execution rules\n');
  await writeFile(join(f.root, 'oracle/manifest.json'), JSON.stringify(f.manifest));
  assert.equal(f.run().status, 1);
  assert.equal(await f.output(), original);
});
