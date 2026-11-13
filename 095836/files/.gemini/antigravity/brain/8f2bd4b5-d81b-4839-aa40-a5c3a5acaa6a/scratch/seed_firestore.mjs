import fs from "fs";

const apiKey = "AIzaSyBkqJ9WvtXfGJt19XK7SLK9v5cJwp4EVII";
const projectId = "sir-jasper-quiz";

const defaultQuestions = [
  { q: "Which C statement selects one of many code blocks to run based on the value of an expression?", correct: "switch", wrongs: ["for", "while", "goto"], explanation: "switch compares one expression against a list of constant case labels and runs the matching block." },
  { q: "Which type of expression can be used as the controlling expression of a switch in C?", correct: "int or char", wrongs: ["float", "double", "string (char*)"], explanation: "switch works with integral types such as int and char, not floating-point values or strings." },
  { q: "Which keyword prevents execution from falling through to the next case?", correct: "break", wrongs: ["continue", "return 0", "exit"], explanation: "break leaves the switch block immediately after the matching case finishes." },
  { q: "When does the default label run?", correct: "When no case label matches", wrongs: ["Always, before the cases", "Only when the first case fails", "Only if break is missing"], explanation: "default is the fallback block used when no case matches the expression." },
  { q: "What is the output?\nint x = 2;\nswitch (x) {\n  case 1: printf(\"A\");\n  case 2: printf(\"B\");\n  case 3: printf(\"C\");\n}", correct: "BC", wrongs: ["B", "C", "ABC"], explanation: "No break statements, so execution starts at case 2 and falls through to case 3." },
  { q: "What is the output?\nint x = 3;\nswitch (x) {\n  case 1: printf(\"1\"); break;\n  default: printf(\"D\");\n}", correct: "D", wrongs: ["1", "1D", "Nothing is printed"], explanation: "x is 3, no case matches, so default runs." },
  { q: "Is the default label required in a switch statement?", correct: "No, it is optional", wrongs: ["Yes, always", "Yes, but only with char", "Only if there is no break"], explanation: "default is optional; without it, nothing runs when no case matches." },
  { q: "Which case label is valid in C?", correct: "case 'A':", wrongs: ["case x:  (x is a variable)", "case 1.5:", "case \"A\":"], explanation: "Case labels must be integer or character constants. Variables, floats and strings are not allowed." },
  { q: "What is the output?\nchar c = 'b';\nswitch (c) {\n  case 'a': printf(\"1\"); break;\n  case 'b': printf(\"2\");\n  case 'c': printf(\"3\"); break;\n}", correct: "23", wrongs: ["2", "3", "123"], explanation: "case 'b' matches and prints 2, has no break, then falls into case 'c' and prints 3 before break." },
  { q: "What happens if two case labels in the same switch have the same constant value?", correct: "Compile-time error", wrongs: ["The first one runs", "The last one runs", "Both run"], explanation: "Duplicate case values are not allowed and the compiler reports an error." },
  { q: "Where can the default label be placed inside a switch?", correct: "Anywhere inside the switch", wrongs: ["Only at the end", "Only at the beginning", "Only after a break"], explanation: "default may appear in any position; it is used only when no case matches." },
  { q: "What is the output when x = 1?\nswitch (x) {\n  case 1:\n  case 2: printf(\"Low\"); break;\n  case 3: printf(\"High\");\n}", correct: "Low", wrongs: ["High", "LowHigh", "Nothing is printed"], explanation: "Stacked labels share one block, so case 1 falls into case 2's code, which prints Low and breaks." },
  { q: "Which is NOT allowed as the controlling expression of a switch in C?", correct: "A float variable, e.g. switch(f)", wrongs: ["An int variable, e.g. switch(x)", "A char variable, e.g. switch(c)", "An expression, e.g. switch(x % 3)"], explanation: "The controlling expression must be an integer type; float values are not allowed." },
  { q: "Which statement about case labels is true?", correct: "They must be constant expressions", wrongs: ["They can be any variable", "They can be float values", "They can be strings"], explanation: "The compiler needs constant integer or character values to build the jump table." },
  { q: "What is the output?\nint x = 5;\nswitch (x % 2) {\n  case 0: printf(\"Even\"); break;\n  case 1: printf(\"Odd\"); break;\n}", correct: "Odd", wrongs: ["Even", "EvenOdd", "Nothing is printed"], explanation: "5 % 2 is 1, so case 1 runs." },
  { q: "What is the output?\nint x = 1;\nswitch (x) {\n  default: printf(\"D\");\n  case 1: printf(\"1\"); break;\n  case 2: printf(\"2\");\n}", correct: "1", wrongs: ["D1", "D", "12"], explanation: "x matches case 1 directly, so default is skipped. Only 1 is printed, then break." },
  { q: "When is switch preferred over an if-else if chain?", correct: "Comparing one variable against several constant values", wrongs: ["Testing ranges like x > 10", "Comparing strings", "Evaluating floating-point conditions"], explanation: "switch is designed for equality checks of one integral value against constants. It cannot test ranges." },
  { q: "What is the value printed?\nint a = 1;\nswitch (a) {\n  case 1: a++;\n  case 2: a += 2; break;\n  case 3: a = 10;\n}\nprintf(\"%d\", a);", correct: "4", wrongs: ["3", "2", "10"], explanation: "case 1 makes a = 2, falls into case 2 so a = 4, then break." },
  { q: "Which is the correct switch syntax?", correct: "switch (x) { case 1: printf(\"One\"); break; }", wrongs: ["switch x { case 1: printf(\"One\"); break; }", "switch (x) { case 1 printf(\"One\"); break; }", "switch (x) { case(1) = printf(\"One\"); }"], explanation: "The expression goes in parentheses and each case label ends with a colon." },
  { q: "Can a switch statement be nested inside another switch statement in C?", correct: "Yes", wrongs: ["No", "Only inside default", "Only with goto"], explanation: "Switch statements can be nested; each break only exits the innermost switch." }
];

async function seed() {
  const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/quizzes/active?key=${apiKey}`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: { stringValue: "C Quiz: Switch Case" },
        description: { stringValue: "20 items • 20 seconds per question • Do not switch tabs or windows." },
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
            values: defaultQuestions.map(q => ({
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
  console.log("Seeding response status:", res.status);
}

seed();
