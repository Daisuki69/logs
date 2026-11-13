const fs = require('fs');
const vm = require('vm');

const idxHtml = fs.readFileSync('C:\\Users\\CxAdmin\\Desktop\\Exploit\\index.html', 'utf8');

const rulesMatch = /<div\s+id=["']start["'][\s\S]*?<ul>([\s\S]*?)<\/ul>/i.exec(idxHtml);
if (!rulesMatch) throw new Error('Missing start rules <ul> in index.html');
const ruleItems = [...rulesMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
if (ruleItems.length !== 4) throw new Error('Expected exactly 4 start rules, found ' + ruleItems.length);
const visibleHtml = idxHtml
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '');
if (/screenshot|watermark|screen\s*capture|blur/i.test(visibleHtml)) {
  throw new Error('Visible HTML leaked capture/watermark wording!');
}
console.log('Static audit OK: 4 start rules intact, zero visible mention of screenshot/watermark/blur');

const cipherMatch = /<script\s+id=["']local-runtime-cipher["'][^>]*>([\s\S]*?)<\/script>/i.exec(idxHtml);
const vaultMatch = /<script\s+id=["']local-db-vault["'][^>]*>([\s\S]*?)<\/script>/i.exec(idxHtml);
const bootStart = idxHtml.lastIndexOf('<script>');
const bootEnd = idxHtml.lastIndexOf('</script>');
const boot = idxHtml.slice(bootStart + 8, bootEnd);

function makeStealthEnv(mockFetch, initialStorage) {
  const els = {};
  const winHandlers = {};
  const docHandlers = {};
  const timers = new Map();
  let nextTimerId = 1;
  const lsStore = new Map(Object.entries(initialStorage || {}));

  const initClassesFromHtml = id => {
    const re = new RegExp(`id=["']${id}["'][^>]*class=["']([^"']+)["']`, 'i');
    const m = re.exec(idxHtml);
    return m ? m[1].split(/\s+/).filter(Boolean) : [];
  };

  const mkClassList = init => {
    const set = new Set(init);
    return {
      add(c) { set.add(c); },
      remove(c) { set.delete(c); },
      contains(c) { return set.has(c); },
      toggle(c, force) {
        if (force === true) { set.add(c); return true; }
        if (force === false) { set.delete(c); return false; }
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      }
    };
  };

  const mkNode = (tag, initClasses = []) => {
    const node = {
      tagName: tag.toUpperCase(),
      className: initClasses.join(' '),
      style: {},
      disabled: false,
      value: '',
      textContent: '',
      innerHTML: '',
      classList: mkClassList(initClasses),
      children: [],
      onclick: null,
      append(...a) { this.children.push(...a); },
      appendChild(a) { this.children.push(a); },
      scrollIntoView() {}
    };
    return node;
  };

  const getEl = id => {
    if (id === 'local-runtime-cipher') return { textContent: cipherMatch[1] };
    if (id === 'local-db-vault') return { textContent: vaultMatch ? vaultMatch[1] : '' };
    if (!els[id]) {
      els[id] = mkNode('div', initClassesFromHtml(id));
      els[id].id = id;
      if (id === 'go') els[id].disabled = true;
      if (id === 'wc') els[id].textContent = '0';
    }
    return els[id];
  };
  ['start','title','desc','nm','sc','err','go','lock','lk1','lk2','lkdl','exam','prog','sw','tm','pbar','tb','q','opts','nx','res','rn','rs','rd','res-actions','dl','cp','res-note','fbs','wm','warn','wp','wc','wbtn'].forEach(getEl);

  const noop = () => {};
  const ctx = {
    fetch: mockFetch,
    TextEncoder, TextDecoder, btoa, atob, crypto, URLSearchParams,
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL: noop },
    setInterval: noop, clearInterval: noop, alert: noop, scrollTo: noop,
    setTimeout: (fn, ms) => {
      const id = nextTimerId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: id => { timers.delete(id); },
    window: {
      location: { search: '', pathname: '/', hash: '' },
      addEventListener: (ev, fn) => { (winHandlers[ev] ||= []).push(fn); },
      scrollTo: noop
    },
    location: { hash: '', search: '', pathname: '/' },
    history: { replaceState: noop },
    localStorage: {
      getItem: k => lsStore.has(k) ? lsStore.get(k) : null,
      setItem: (k, v) => lsStore.set(k, String(v)),
      removeItem: k => lsStore.delete(k)
    },
    document: {
      hidden: false,
      getElementById: getEl,
      addEventListener: (ev, fn) => { (docHandlers[ev] ||= []).push(fn); },
      createElement: tag => mkNode(tag),
      body: { appendChild: noop }
    }
  };
  ctx.globalThis = ctx;
  return {
    ctx: vm.createContext(ctx),
    els,
    lsStore,
    winHandlers,
    docHandlers,
    flushTimers: minMs => {
      for (const [id, t] of Array.from(timers.entries())) {
        if ((t.ms || 0) >= (minMs || 0)) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    timerCount: () => timers.size
  };
}

function quizDoc(enableTabViolation) {
  return {
    name: 'projects/sir-jasper-quiz/databases/(default)/documents/quizzes/default',
    fields: {
      title: { stringValue: 'Stealth Probe Quiz' },
      description: { stringValue: 'Desc' },
      timePerQuestion: { integerValue: '30' },
      lockEpoch: { integerValue: '0' },
      settings: {
        mapValue: {
          fields: {
            randomizeQuestions: { booleanValue: false },
            enableTabViolation: { booleanValue: enableTabViolation },
            autoRecordQuiz: { booleanValue: true },
            maxViolations: { integerValue: '3' }
          }
        }
      },
      questions: {
        arrayValue: {
          values: [{
            mapValue: {
              fields: {
                q: { stringValue: 'Q1?' },
                correct: { stringValue: 'A' },
                wrongs: { arrayValue: { values: [{ stringValue: 'B' }, { stringValue: 'C' }, { stringValue: 'D' }] } },
                explanation: { stringValue: 'Because A' }
              }
            }
          }]
        }
      }
    }
  };
}

(async () => {
  const posted = [];
  const mockFetch = enableTabViolation => async (url, opts = {}) => {
    if ((opts.method || 'GET').toUpperCase() === 'POST') {
      posted.push(JSON.parse(opts.body));
      return { ok: true, status: 200, json: async () => ({ name: 'sub1' }) };
    }
    return { ok: true, status: 200, json: async () => quizDoc(enableTabViolation) };
  };

  const env1 = makeStealthEnv(mockFetch(false));
  vm.runInContext(boot, env1.ctx);
  await new Promise(r => setTimeout(r, 30));

  env1.els['nm'].value = 'Ana & "Ben"';
  env1.els['sc'].value = 'BSIT-2A <Sec>';
  env1.els['go'].onclick();

  const wmBg = env1.els['wm'].style.backgroundImage;
  if (env1.els['wm'].classList.contains('hide')) throw new Error('#wm should be unhidden on quiz start');
  if (!wmBg.startsWith('url("data:image/svg+xml,')) throw new Error('Invalid #wm backgroundImage: ' + wmBg);
  if (wmBg.includes('%2523')) throw new Error('Double-encoded %2523 detected in watermark URI');
  const decodedSvg = decodeURIComponent(wmBg.slice('url("data:image/svg+xml,'.length, -2));
  if (!decodedSvg.includes('fill="#7f8799"') || !decodedSvg.includes('Ana &amp; &quot;Ben&quot; • BSIT-2A &lt;Sec&gt;')) {
    throw new Error('Unexpected SVG watermark content: ' + decodedSvg);
  }
  console.log('Watermark SVG verified:', decodedSvg.match(/<text[^>]*>([^<]+)<\/text>/)[1]);

  (env1.winHandlers['blur'] || []).forEach(fn => fn());
  if (!env1.els['exam'].classList.contains('obscure')) throw new Error('#exam must gain .obscure on window blur');
  if (env1.els['wc'].textContent !== '0' || !env1.els['warn'].classList.contains('hide')) {
    throw new Error('Silent blur inflated violation counters or displayed warning!');
  }

  (env1.winHandlers['focus'] || []).forEach(fn => fn());
  if (env1.els['exam'].classList.contains('obscure')) throw new Error('#exam must clear .obscure on window focus');

  env1.ctx.document.hidden = true;
  (env1.docHandlers['visibilitychange'] || []).forEach(fn => fn());
  if (!env1.els['exam'].classList.contains('obscure')) throw new Error('#exam must gain .obscure on hidden visibilitychange');
  if (env1.els['wc'].textContent !== '0') throw new Error('Hidden visibilitychange incremented violation when enableTabViolation=false!');

  env1.ctx.document.hidden = false;
  (env1.docHandlers['visibilitychange'] || []).forEach(fn => fn());
  if (env1.els['exam'].classList.contains('obscure')) throw new Error('#exam must clear .obscure when visible & unfocused state cleared');

  let prevented = false;
  (env1.docHandlers['keydown'] || []).forEach(fn => fn({ key: 'a', preventDefault: () => { prevented = true; } }));
  if (env1.els['exam'].classList.contains('obscure') || prevented) throw new Error('Regular key "a" must not obscure exam');

  let ctrlCPrevented = false;
  (env1.docHandlers['keydown'] || []).forEach(fn => fn({ key: 'c', ctrlKey: true, target: { tagName: 'DIV' }, preventDefault: () => { ctrlCPrevented = true; } }));
  if (!ctrlCPrevented) throw new Error('Ctrl+C outside input failed to preventDefault');

  for (const [evType, keyEvt] of [
    ['keydown', { key: 'PrintScreen' }],
    ['keyup', { key: 'PrintScreen' }],
    ['keydown', { metaKey: true, shiftKey: true, key: '4' }],
    ['keydown', { ctrlKey: true, shiftKey: true, key: '5' }]
  ]) {
    (env1.docHandlers[evType] || []).forEach(fn => fn({ ...keyEvt, target: { tagName: 'DIV' }, preventDefault: () => {} }));
    if (!env1.els['exam'].classList.contains('obscure')) throw new Error(evType + ' failed to obscure: ' + JSON.stringify(keyEvt));
    env1.flushTimers(1000);
    if (env1.els['exam'].classList.contains('obscure')) throw new Error('Pulse blur timer did not clear .obscure after timeout');
  }
  if (env1.els['wc'].textContent !== '0' || !env1.els['warn'].classList.contains('hide')) {
    throw new Error('Desktop capture shortcuts created a violation or warning!');
  }
  console.log('Silent blur, visibility, keydown/keyup PrintScreen, Cmd/Ctrl+Shift+4/5 pulse & zero-violation checks PASSED');

  const firstOpt = env1.els['opts'].children[0];
  firstOpt.onclick();
  env1.els['nx'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (!env1.els['exam'].classList.contains('hide')) throw new Error('#exam should be hidden after finish()');
  if (env1.els['exam'].classList.contains('obscure')) throw new Error('#exam should remove .obscure after finish()');
  if (!env1.els['wm'].classList.contains('hide') || env1.els['wm'].style.backgroundImage !== '') {
    throw new Error('#wm should hide and clear backgroundImage after finish()');
  }
  if (posted.length !== 1) throw new Error('Expected 1 submission POST, got: ' + posted.length);
  const postedSw = posted[0].fields.sw?.integerValue;
  if (postedSw !== '0') throw new Error('Expected 0 sw in submission, got: ' + JSON.stringify(posted[0]));
  console.log('finish() cleanup & 0-violation submission payload PASSED');

  const lockKey = Array.from(env1.lsStore.keys()).find(k => k.startsWith('ds_quiz_lock_')) || 'ds_quiz_lock_default';
  const lockedEnv = makeStealthEnv(mockFetch(false), {
    [lockKey]: JSON.stringify({ state: 'done', rec: { n: 'Ana', s: 'BSIT-2A' }, epoch: 0 })
  });
  lockedEnv.els['wm'].classList.remove('hide');
  vm.runInContext(boot, lockedEnv.ctx);
  await new Promise(r => setTimeout(r, 30));
  if (lockedEnv.els['lock'].classList.contains('hide')) throw new Error('Expected #lock visible when already responded');
  if (!lockedEnv.els['wm'].classList.contains('hide')) {
    throw new Error('showLock() did not hide #wm!');
  }
  console.log('showLock() watermark suppression PASSED');

  const env2 = makeStealthEnv(mockFetch(true));
  vm.runInContext(boot, env2.ctx);
  await new Promise(r => setTimeout(r, 30));
  env2.els['nm'].value = 'Chris';
  env2.els['sc'].value = 'BSCS';
  env2.els['go'].onclick();
  (env2.winHandlers['blur'] || []).forEach(fn => fn());
  if (!env2.els['exam'].classList.contains('obscure')) throw new Error('Mask should apply with enableTabViolation=true');
  if (String(env2.els['wc'].textContent) !== '1') throw new Error('Existing tab violation counter regressed: ' + env2.els['wc'].textContent);
  console.log('Regression check (enableTabViolation=true keeps counting switches + masks exam) PASSED');

  console.log('ALL STEALTH MASK & WATERMARK VERIFICATIONS PASSED!');
})();
