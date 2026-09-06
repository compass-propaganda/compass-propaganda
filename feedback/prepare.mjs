// SPDX-License-Identifier: MIT
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseRecommendations } from "../scripts/recommendations.mjs";

const directory = new URL("../recommendations/", import.meta.url);
const sources = new Map(await Promise.all((await readdir(directory)).filter((name) => /^\d+[^/]*\.md$/.test(name)).map(async (name) => [`recommendations/${name}`, await readFile(new URL(name, directory), "utf8")])));
const catalog = Object.fromEntries(parseRecommendations(sources).filter((rec) => rec.effect === "현행").map((rec) => [String(rec.number), createHash("sha256").update(sources.get(rec.source)).digest("hex")]));
await mkdir(new URL(".wrangler/", import.meta.url), { recursive: true });
await writeFile(new URL(".wrangler/recommendations.json", import.meta.url), JSON.stringify(catalog, null, 2) + "\n");
