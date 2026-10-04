/**
 * Copy the Prisma CLI, plus packages the entrypoint loads outside Next's
 * bundle, into a flat folder. The runtime image merges that folder into
 * standalone's node_modules so migrate and seed work without the
 * TypeScript/ESLint tree. bcryptjs is bundled into the Next server, so
 * seed.js would not find it unless it is copied here.
 */
import { cpSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const destRoot = process.argv[2] || "prisma-cli-modules";
const root = process.cwd();
const sourceModules = path.join(root, "node_modules");
const seen = new Set();

function packageDir(name) {
  return path.join(sourceModules, ...name.split("/"));
}

function walk(name) {
  if (seen.has(name)) return;
  const dir = packageDir(name);
  const manifestPath = path.join(dir, "package.json");
  if (!existsSync(manifestPath)) return;
  seen.add(name);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const deps = {
    ...(manifest.dependencies || {}),
    ...(manifest.optionalDependencies || {}),
  };
  for (const dep of Object.keys(deps)) walk(dep);
}

for (const name of ["prisma", "bcryptjs"]) walk(name);

mkdirSync(destRoot, { recursive: true });
for (const name of seen) {
  const from = packageDir(name);
  const to = path.join(destRoot, ...name.split("/"));
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

console.log(`collected ${seen.size} packages into ${destRoot}`);
console.log([...seen].sort().join("\n"));
