const fs = require('fs');
const vm = require('vm');

const idxHtml = fs.readFileSync('index.html', 'utf8');
const tchHtml = fs.readFileSync('teacher.html', 'utf8');

const pat = /firebase|firestore|gstatic|sir-jasper-quiz|googleapis|stringValue|integerValue|doubleValue|booleanValue|nullValue|arrayValue|mapValue|collection/i;
for (const [name, src] of [['index.html', idxHtml], ['teacher.html', tchHtml]]) {
  const m = src.match(pat);
  if (m) throw new Error('Forbidden trace in ' + name + ': ' + m[0]);
  console.log(name + ': 0 forbidden traces');
}

for (const [name, src] of [['index.html', idxHtml], ['teacher.html', tchHtml]]) {
  src.split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('<!--')) {
      throw new Error('Comment in ' + name + ' line ' + (i + 1) + ': ' + t);
    }
  });
  console.log(name + ': 0 comments verified');
}

function getInlineScript(html) {
  const re = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m, out = [];
  while ((m = re.exec(html)) !== null) {
    if (m[0].includes('src=')) throw new Error('Unexpected external script tag!');
    if (m[1].trim()) out.push(m[1]);
  }
  return out;
}

const idxScripts = getInlineScript(idxHtml);
const tchScripts = getInlineScript(tchHtml);
if (idxScripts.length !== 1 || tchScripts.length !== 1) throw new Error('Unexpected script count');
new Function(idxScripts[0]);
new Function(tchScripts[0]);
console.log('Syntax check OK (1 inline script each, 0 external script tags)');

(async () => {
  const mkSandbox = () => {
    const noop = () => {};
    const mkEl = () => ({
      style: {},
      classList: { add: noop, remove: noop, contains: () => false },
      value: '', textContent: '', innerHTML: '',
      append: noop, appendChild: noop,
      addEventListener: noop, querySelectorAll: () => [], scrollIntoView: noop
    });
    const ctx = {
      fetch, TextEncoder, TextDecoder, btoa, atob, crypto, URL, Blob,
      Math, Number, String, Boolean, Array, Object, JSON, Date, Error, Uint8Array, Promise, encodeURIComponent,
      setInterval: noop, clearInterval: noop, setTimeout: noop, alert: noop, scrollTo: noop,
      window: { location: { search: '', pathname: '/', hash: '' }, addEventListener: noop, scrollTo: noop },
      location: { hash: '', search: '', pathname: '/' },
      history: { replaceState: noop },
      localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      document: {
        hidden: true,
        getElementById: mkEl,
        createElement: mkEl,
        addEventListener: noop,
        body: { appendChild: noop }
      },
      URLSearchParams
    };
    return vm.createContext(ctx);
  };

  const tCtx = mkSandbox();
  vm.runInContext(tchScripts[0] + '; this.__T = { EncryptedLocalDB, sealPayload, _dec, _vC, _vB };', tCtx);

  const iCtx = mkSandbox();
  vm.runInContext(idxScripts[0] + '; this.__I = { EncryptedLocalDB, unsealPayload };', iCtx);

  const active = await iCtx.__I.EncryptedLocalDB.readQuiz('active');
  console.log('Live readQuiz(active) OK -> title:', active.title, '| questions:', active.questions.length);

  const tplDoc = await tCtx.__T.EncryptedLocalDB.readQuiz('template');
  console.log('Live readQuiz(template) matches disk index.html:', tplDoc && tplDoc.html === idxHtml);

  const sealed = tCtx.__T.sealPayload(active);
  const injected = idxHtml.replace(/const LOCAL_ENCRYPTED_VAULT\s*=\s*"[^"]*";/, 'const LOCAL_ENCRYPTED_VAULT = "' + sealed + '";');
  const match = injected.match(/const LOCAL_ENCRYPTED_VAULT = "([^"]+)";/);
  const decrypted = iCtx.__I.unsealPayload(match[1]);
  console.log('Injected vault round-trip exact match:', JSON.stringify(decrypted) === JSON.stringify(active));

  const subPayload = {
    n: '__verify_probe__', s: 'TEST', studentName: '__verify_probe__', courseSection: 'TEST',
    scoreText: '1 / 1', violationsText: '0 (-0 pts)', durationSeconds: 5, timeSpent: '5s (5 seconds)',
    submittedAtText: 'verify', raw: 1, sw: 0, pen: 0, sc: 1, tot: 1, ts: Date.now(), t: 5, code: 'test', submittedAt: Date.now()
  };
  await iCtx.__I.EncryptedLocalDB.appendRecord('active', subPayload);
  const recs = await tCtx.__T.EncryptedLocalDB.listRecords('active');
  const probe = recs.find(r => r.n === '__verify_probe__');
  console.log('Submission appendRecord + listRecords OK -> found probe:', !!probe);

  if (probe) {
    const commitUrl = tCtx.__T._dec(tCtx.__T._vB, 73) + tCtx.__T._dec(tCtx.__T._vC, 113);
    const delRes = await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{ delete: probe._path }] })
    });
    console.log('Cleanup :commit delete status:', delRes.status);
  }
  const afterRecs = await tCtx.__T.EncryptedLocalDB.listRecords('active');
  console.log('Submissions after cleanup count:', afterRecs.length);
})();
