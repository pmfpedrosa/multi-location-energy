import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "custom_components/multi_location_energy");
fs.mkdirSync(path.join(target, "frontend"), { recursive: true });
fs.mkdirSync(path.join(target, "translations"), { recursive: true });
for (const file of ["panel.js", "scope.js", "native-loader.js"]) {
  fs.copyFileSync(path.join(root, "frontend", file), path.join(target, "frontend", file));
}
fs.copyFileSync(path.join(target, "strings.json"), path.join(target, "translations/en.json"));
const files = fs.readdirSync(path.join(root, "upstream/core")).sort();
const provenance = Object.fromEntries(files.map(name => [name, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "upstream/core", name))).digest("hex")]));
fs.writeFileSync(path.join(root, "upstream/core-sha256.json"), JSON.stringify(provenance, null, 2) + "\n");
fs.copyFileSync(path.join(root, "LICENSE"), path.join(target, "LICENSE"));
fs.copyFileSync(path.join(root, "NOTICE"), path.join(target, "NOTICE"));
console.log("Built custom_components/multi_location_energy (no frontend dependencies required)");
