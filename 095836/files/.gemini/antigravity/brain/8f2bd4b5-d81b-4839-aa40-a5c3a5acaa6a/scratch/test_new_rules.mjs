const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function testRules() {
  console.log("1. Testing read /quizzes/active...");
  const readRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`);
  console.log("Read status:", readRes.status);

  console.log("2. Testing create /quizzes/active/submissions...");
  const subPayload = {
    fields: {
      n: { stringValue: "Juan Dela Cruz" },
      s: { stringValue: "BSIT 2-A" },
      raw: { integerValue: "18" },
      sw: { integerValue: "1" },
      pen: { integerValue: "1" },
      sc: { integerValue: "17" },
      tot: { integerValue: "20" },
      ts: { integerValue: String(Date.now()) },
      t: { integerValue: "120" },
      code: { stringValue: "dGVzdA==" },
      submittedAt: { integerValue: String(Date.now()) }
    }
  };
  const subRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active/submissions?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subPayload)
  });
  console.log("Submission create status:", subRes.status);
  const subData = await subRes.json();
  if (subRes.status === 200) {
    console.log("Submission created successfully:", subData.name);
  } else {
    console.log("Submission error:", JSON.stringify(subData));
  }

  console.log("3. Testing write /quizzes/active...");
  const writeRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: { stringValue: "Test Update" }
      }
    })
  });
  console.log("Quiz write status:", writeRes.status);
  const writeData = await writeRes.json();
  console.log("Quiz write response:", JSON.stringify(writeData).slice(0, 200));
}

testRules();
