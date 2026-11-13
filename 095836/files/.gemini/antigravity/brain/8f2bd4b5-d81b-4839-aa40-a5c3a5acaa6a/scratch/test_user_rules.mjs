const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function testNewRules() {
  console.log("1. Testing write to /quizzes/active...");
  const writeRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: { stringValue: "C Quiz: Switch Case" }
      }
    })
  });
  console.log("Write status:", writeRes.status);

  console.log("2. Testing read /quizzes/active...");
  const readRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`);
  console.log("Read status:", readRes.status);
}

testNewRules();
