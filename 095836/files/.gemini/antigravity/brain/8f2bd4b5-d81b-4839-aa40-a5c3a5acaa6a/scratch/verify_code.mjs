import fs from "fs";

const files = ["firebase-config.js", "index.html", "teacher.html", "vercel.json"];
let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  let check = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes("<!doctype html>") || file.endsWith(".js") || file.endsWith(".json")) {
      check = true;
    }
    if (check) {
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || (trimmed.startsWith("<!--") && !trimmed.includes("DOCTYPE"))) {
        console.error(`Forbidden comment at ${file}:${i + 1} -> ${trimmed}`);
        failed = true;
      }
      if (line.includes("TODO") || line.includes("FIXME")) {
        console.error(`Forbidden TODO/FIXME at ${file}:${i + 1} -> ${trimmed}`);
        failed = true;
      }
    }
  });
}

if (!failed) {
  console.log("ZERO IN-CODE DOCUMENTATION verified: All files comply perfectly with Rule 9!");
}
