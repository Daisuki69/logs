import fs from "fs";

const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function uploadTemplate() {
  const html = fs.readFileSync("index.html", "utf8");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/template?key=${apiKey}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        html: { stringValue: html },
        updatedAt: { integerValue: String(Date.now()) }
      }
    })
  });
  console.log("Template upload status:", res.status);
}

uploadTemplate();
