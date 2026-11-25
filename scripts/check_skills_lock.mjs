// Coverage half of the skills-lock gate: content hashes are checked by the
// skills CLI, but it silently ignores a skill folder that has no lock entry.
// Run from the repository root.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".agents", "skills");
const lock = JSON.parse(fs.readFileSync("skills-lock.json", "utf8"));

const installed = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();
const locked = Object.keys(lock.skills).sort();

const unpinned = installed.filter((n) => !locked.includes(n));
const orphaned = locked.filter((n) => !installed.includes(n));

if (unpinned.length || orphaned.length) {
  if (unpinned.length) console.error(`not in skills-lock.json: ${unpinned.join(", ")}`);
  if (orphaned.length) console.error(`in skills-lock.json but not installed: ${orphaned.join(", ")}`);
  process.exit(1);
}

console.log(`skills-lock.json pins all ${installed.length} installed skills`);
