const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const roots = ["src", "scripts"];
const files = roots
  .flatMap((root) => walk(path.resolve(process.cwd(), root)))
  .filter((file) => file.endsWith(".js"));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
