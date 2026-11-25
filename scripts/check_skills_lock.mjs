// Local half of the skills-lock gate: coverage (a skill folder with no lock
// entry) and content (a skill edited without re-pinning its hash). CI still
// runs the frozen restore, but this catches the same drift before a push.
// The hash is the one `skills` writes: sha256 over path\0length\0content of
// every file in the folder, paths sorted, CRLF normalised to LF.
// Run from the repository root.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EXCLUDED_FILES = new Set(["metadata.json"]);
const EXCLUDED_DIRS = new Set([".git", "__pycache__", "__pypackages__"]);

const dir = path.join(process.cwd(), ".agents", "skills");
const lock = JSON.parse(fs.readFileSync("skills-lock.json", "utf8"));

function collectFiles(skillDir, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(path.join(skillDir, entry.name), `${prefix}${entry.name}/`));
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      files.push({ path: prefix + entry.name, content: fs.readFileSync(path.join(skillDir, entry.name)) });
    }
  }
  return files;
}

// Binary files are hashed as-is; text is normalised so a CRLF checkout hashes
// the same as the LF copy the CLI wrote.
function normalise(content) {
  if (content.includes(0) || !content.includes("\r\n")) return content;
  return Buffer.from(content.toString("latin1").replaceAll("\r\n", "\n"), "latin1");
}

function folderHash(skillDir) {
  const entries = collectFiles(skillDir)
    .map((file) => ({ path: Buffer.from(file.path, "utf8"), content: normalise(file.content) }))
    .sort((a, b) => Buffer.compare(a.path, b.path));

  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(String(entry.content.length));
    hash.update("\0");
    hash.update(entry.content);
  }
  return hash.digest("hex");
}

const installed = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();
const locked = Object.keys(lock.skills).sort();

const unpinned = installed.filter((n) => !locked.includes(n));
const orphaned = locked.filter((n) => !installed.includes(n));

// A skill whose recorded hash is missing or stale: the CLI would restore it
// and leave a modified tree, which the CI job turns into a failure.
const drifted = installed.filter((name) => {
  const recorded = lock.skills[name]?.computedHash;
  return !recorded || recorded !== folderHash(path.join(dir, name));
});

const problems = [
  unpinned.length && `not in skills-lock.json: ${unpinned.join(", ")}`,
  orphaned.length && `in skills-lock.json but not installed: ${orphaned.join(", ")}`,
  drifted.length && `edited without re-pinning: ${drifted.join(", ")}`,
].filter(Boolean);

if (problems.length) {
  for (const problem of problems) console.error(problem);
  console.error("Run 'npx --yes skills@1.9.0 experimental_install --no-frozen-lockfile' and commit skills-lock.json.");
  process.exit(1);
}

console.log(`skills-lock.json pins all ${installed.length} installed skills and their content hashes match`);
