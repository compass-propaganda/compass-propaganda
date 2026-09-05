// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const digest = (content) => createHash('sha256').update(content).digest('hex');

async function readSource(path) {
  if (typeof path !== 'string' || !path.endsWith('.md') || isAbsolute(path)) {
    throw new Error(`Invalid source path: ${path}`);
  }
  const actual = await realpath(resolve(root, path));
  const local = relative(root, actual);
  if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    throw new Error(`Source must remain inside the repository: ${path}`);
  }
  return readFile(actual, 'utf8');
}

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/build-oracle.mjs [--check]');
  }
  const manifest = JSON.parse(await readFile(resolve(root, 'oracle/manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.documents) || manifest.documents.length === 0) {
    throw new Error('The manifest must list source documents.');
  }
  const roles = new Set(['principles', 'terminology']);
  const paths = new Set([manifest.instructions, manifest.skill]);
  if (paths.size !== 2) throw new Error('Skill and execution instructions must be separate sources.');
  for (const doc of manifest.documents) {
    if (!doc || !roles.has(doc.role) || paths.has(doc.path)) {
      throw new Error('Invalid document role or duplicate source.');
    }
    paths.add(doc.path);
  }
  const sources = [];
  for (const entry of [{ path: manifest.instructions, role: 'instructions' }, ...manifest.documents]) {
    const content = await readSource(entry.path);
    sources.push({ ...entry, sha256: digest(content), content });
  }
  const skill = await readSource(manifest.skill);
  const bundleId = digest(JSON.stringify({ sources, skill: { path: manifest.skill, sha256: digest(skill) } }));
  const output = [
    '# Compass Propaganda — 다른 AI에 제공할 오라클',
    `문서 묶음 식별자: sha256:${bundleId}`,
    '이 파일 전체를 AI에 제공하고, 별도의 메시지에 자신의 사례를 적으세요. 아래 문서의 상대 경로는 원본 저장소의 경로입니다. 링크된 외부 자료의 본문은 포함되어 있지 않습니다.',
    ...sources.map(({ path, role, sha256, content }) =>
      `---\n문서: ${JSON.stringify(path)}\n역할: ${role}\n원문 SHA-256: ${sha256}\n\n${content}`),
    '---\nCompass Propaganda contributors. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 링크된 외부 자료는 각 출처의 이용 조건을 따릅니다.',
  ].join('\n\n') + '\n';

  const outputs = new Map([
    ['dist/oracle.md', output],
    ['dist/compass-propaganda/SKILL.md', skill],
    ['dist/compass-propaganda/references/oracle.md', output],
  ]);
  if (args[0] === '--check') {
    for (const [path, content] of outputs) {
      if (await readFile(resolve(root, path), 'utf8') !== content) {
        throw new Error(`Generated file is stale: ${path}. Run node scripts/build-oracle.mjs.`);
      }
    }
    console.log('Oracle prompt and skill are current.');
  } else {
    for (const [path, content] of outputs) {
      const destination = resolve(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }
    console.log(`Generated oracle prompt and skill in ${resolve(root, 'dist')}\nsha256:${bundleId}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
