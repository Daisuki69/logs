const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function clean() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/test?key=${apiKey}`;
  const res = await fetch(url, { method: "DELETE" });
  console.log("Delete Status:", res.status);
}
clean();
