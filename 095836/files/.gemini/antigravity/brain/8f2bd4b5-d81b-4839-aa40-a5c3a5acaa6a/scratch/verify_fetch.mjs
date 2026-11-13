const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function verifyFetch() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Title in Firestore:", data.fields.title.stringValue);
  console.log("Total questions in Firestore:", data.fields.questions.arrayValue.values.length);
  const q1 = data.fields.questions.arrayValue.values[0].mapValue.fields;
  console.log("Q1 prompt:", q1.q.stringValue);
  console.log("Q1 correct:", q1.correct.stringValue);
  console.log("Q1 distractors count:", q1.wrongs.arrayValue.values.length);
}

verifyFetch();
