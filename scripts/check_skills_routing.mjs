// Routing half of the skills gate: a skill the matrix never mentions is dead
// weight, a matrix path that no longer exists sends the next agent to a file
// that is gone, and a `paths:` glob that matches nothing never fires on the
// file it was written for. The lock check covers content; this covers wiring.
// Run from the repository root.
import fs from "node:fs";
import path from "node:path";

const skillsDir = path.join(process.cwd(), ".agents", "skills");
const agents = fs.readFileSync("AGENTS.md", "utf8");

const installed = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort();

const problems = new Set();

// 1. Every installed skill is routed: named by path, or by name in backticks
//    inside the workflow row that covers the superpowers suite.
const unrouted = installed.filter(
  (name) => !agents.includes(`.agents/skills/${name}/`) && !agents.includes(`\`${name}\``),
);
if (unrouted.length) problems.add(`not mentioned in AGENTS.md: ${unrouted.join(", ")}`);

// 2. Every path the matrix names resolves to an installed skill.
for (const match of agents.matchAll(/\.agents\/skills\/([A-Za-z0-9._-]+)\//g)) {
  if (!installed.includes(match[1])) {
    problems.add(`AGENTS.md points at .agents/skills/${match[1]}/ which is not installed`);
  }
}

// 3. Frontmatter agrees with the folder, and its `paths:` prefixes exist.
function frontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  return end === -1 ? null : text.slice(3, end);
}

// A glob only has to point at something: keep the literal directories before
// the first wildcard and require them to exist.
function literalPrefix(glob) {
  const wildcard = glob.search(/[*?[{]/);
  if (wildcard === -1) return glob;
  const head = glob.slice(0, wildcard);
  const slash = head.lastIndexOf("/");
  return slash === -1 ? "" : head.slice(0, slash);
}

for (const name of installed) {
  const skillDir = path.join(skillsDir, name);
  const front = frontmatter(fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8"));
  if (front === null) {
    problems.add(`${name}: SKILL.md has no frontmatter block`);
    continue;
  }

  const declared = front.match(/^name:\s*(.+)$/m);
  if (!declared) problems.add(`${name}: frontmatter has no name`);
  else if (declared[1].trim().replace(/^["']|["']$/g, "") !== name) {
    problems.add(`${name}: frontmatter name is ${declared[1].trim()}`);
  }

  const paths = front.match(/^paths:\s*(\[.*\])\s*$/m);
  if (!paths) continue;

  let globs;
  try {
    globs = JSON.parse(paths[1]);
  } catch {
    problems.add(`${name}: paths is not a JSON array`);
    continue;
  }
  if (!Array.isArray(globs)) {
    problems.add(`${name}: paths is not a JSON array`);
    continue;
  }

  for (const glob of globs) {
    const prefix = literalPrefix(String(glob));
    if (prefix && !fs.existsSync(path.join(process.cwd(), prefix))) {
      problems.add(`${name}: paths entry "${glob}" points at a missing ${prefix}`);
    }
  }
}

if (problems.size) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log(`routing matrix, ${installed.length} skills and the filesystem agree`);
