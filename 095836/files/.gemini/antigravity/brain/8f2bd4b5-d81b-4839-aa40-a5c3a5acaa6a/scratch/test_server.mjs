import http from "http";
import fs from "fs";
import path from "path";

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(process.cwd(), reqPath.replace(/^\//, ""));
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    let contentType = "text/html";
    if (ext === ".js") contentType = "application/javascript";
    if (ext === ".json") contentType = "application/json";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3333, async () => {
  console.log("Test server listening on 3333");

  const rIndex = await fetch("http://localhost:3333/index.html");
  console.log("index.html status:", rIndex.status);
  const rTeacher = await fetch("http://localhost:3333/teacher.html");
  console.log("teacher.html status:", rTeacher.status);
  const rConfig = await fetch("http://localhost:3333/firebase-config.js");
  console.log("firebase-config.js status:", rConfig.status);
  const rVercel = await fetch("http://localhost:3333/vercel.json");
  console.log("vercel.json status:", rVercel.status);

  server.close(() => {
    console.log("Server closed successfully.");
  });
});
