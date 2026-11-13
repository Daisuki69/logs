const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

async function verifyFirestore() {
  const sampleQuiz = {
    title: "C Quiz: Switch Case",
    description: "20 items • 20 seconds per question • Anti-cheat active",
    settings: {
      timePerQuestion: 20,
      enableTimer: true,
      enableTabViolation: true,
      tabViolationPenalty: 1,
      randomizeQuestions: true,
      randomizeAnswers: true
    },
    questions: [
      {
        q: "Which C statement selects one of many code blocks to run based on the value of an expression?",
        correct: "switch",
        wrongs: ["for", "while", "goto"],
        explanation: "switch compares one expression against a list of constant case labels and runs the matching block."
      }
    ]
  };

  const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: { stringValue: sampleQuiz.title },
        description: { stringValue: sampleQuiz.description },
        updatedAt: { integerValue: String(Date.now()) },
        settings: {
          mapValue: {
            fields: {
              timePerQuestion: { integerValue: "20" },
              enableTimer: { booleanValue: true },
              enableTabViolation: { booleanValue: true },
              tabViolationPenalty: { integerValue: "1" },
              randomizeQuestions: { booleanValue: true },
              randomizeAnswers: { booleanValue: true }
            }
          }
        },
        questions: {
          arrayValue: {
            values: sampleQuiz.questions.map(q => ({
              mapValue: {
                fields: {
                  q: { stringValue: q.q },
                  correct: { stringValue: q.correct },
                  wrongs: {
                    arrayValue: {
                      values: q.wrongs.map(w => ({ stringValue: w }))
                    }
                  },
                  explanation: { stringValue: q.explanation }
                }
              }
            }))
          }
        }
      }
    })
  });

  console.log("Save status:", patchRes.status);
  const patchData = await patchRes.json();
  if (patchRes.status !== 200) {
    console.error("Save error:", patchData);
    process.exit(1);
  }

  const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`;
  const getRes = await fetch(getUrl);
  console.log("Fetch status:", getRes.status);
  const getData = await getRes.json();
  console.log("Fetched Quiz Title:", getData.fields.title.stringValue);
  console.log("Fetched Questions Count:", getData.fields.questions.arrayValue.values.length);
}

verifyFirestore();
