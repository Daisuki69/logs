const fs = require('fs');
const vm = require('vm');

const idxHtml = fs.readFileSync('C:\\Users\\CxAdmin\\Desktop\\Exploit\\index.html', 'utf8');
const tchHtml = fs.readFileSync('C:\\Users\\CxAdmin\\Desktop\\Exploit\\teacher.html', 'utf8');

function extractRuntime(html) {
  const c = /<script\s+id=["']local-runtime-cipher["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)[1];
  const v = /<script\s+id=["']local-db-vault["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  const s = html.lastIndexOf('<script>');
  const e = html.lastIndexOf('</script>');
  return { cipher: c, vault: v ? v[1] : '', boot: html.slice(s + 8, e), html };
}

const idxRt = extractRuntime(idxHtml);
const tchRt = extractRuntime(tchHtml);

function makeEnv(rt, { customFetch, initialStorage, searchStr = '', vaultOverride } = {}) {
  const els = {};
  const lsStore = new Map(Object.entries(initialStorage || {}));
  const createdDownloads = [];
  let lastCreatedBlob = null;

  const initClassesFromHtml = id => {
    const re = new RegExp(`id=["']${id}["'][^>]*class=["']([^"']+)["']`, 'i');
    const m = re.exec(rt.html);
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
      _innerHTML: '',
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) { this._innerHTML = String(v); if (!v) this.children = []; },
      download: '',
      href: '',
      classList: mkClassList(initClasses),
      children: [],
      onclick: null,
      focus() {},
      scrollIntoView() {},
      append(...a) { this.children.push(...a); },
      appendChild(a) { this.children.push(a); },
      querySelectorAll(sel) { return sel === '.q-card' ? this.children : []; },
      querySelector(sel) {
        const find = cls => {
          for (const lb of this.children) for (const ch of (lb.children || [])) if (String(ch.className || '').includes(cls)) return ch;
          return { value: '' };
        };
        const map = { '.q-text': 'q-text', '.q-corr': 'q-corr', '.q-w1': 'q-w1', '.q-w2': 'q-w2', '.q-w3': 'q-w3', '.q-exp': 'q-exp' };
        return map[sel] ? find(map[sel]) : { value: '', textContent: '' };
      },
      click() {
        if (this.tagName === 'A' && this.download) {
          createdDownloads.push({ download: this.download, href: this.href });
        }
      },
      remove() {},
      parentNode: { removeChild() {} }
    };
    return node;
  };

  const getEl = id => {
    if (id === 'local-runtime-cipher') return { textContent: rt.cipher };
    if (id === 'local-db-vault') return { textContent: vaultOverride !== undefined ? vaultOverride : rt.vault };
    if (!els[id]) {
      els[id] = mkNode('div', initClassesFromHtml(id));
      els[id].id = id;
      if (id === 'go') els[id].disabled = true;
      if (id === 'wc') els[id].textContent = '0';
    }
    return els[id];
  };

  [
    'start','title','desc','nm','sc','err','go','lock','lk1','lk2','lkdl','exam','prog','sw','tm','pbar','tb','q','opts','nx','res','rn','rs','rd','res-actions','dl','cp','res-note','fbs','wm','warn','wp','wc','wbtn',
    'ws-bar','back-dash-btn','main-nav','tab-btn-dash','tab-btn-editor','tab-btn-sub','view-dash','dash-list','dash-msg','add-quiz-btn','active-quiz-badge','rename-modal','rename-input','rename-save-btn','rename-cancel-btn','view-editor','view-sub','qtitle','qdesc','save-btn','dl-quiz-btn','status-msg','questions-container','add-q-btn','sub-count-badge','clear-sub-btn','sub-desc','sub-status-msg','sub-feed','confirm-modal','modal-yes-btn','modal-no-btn','opt-btn','options-panel','edge-overlay','close-opt-btn','btn-rand-q','btn-rand-a','btn-tab-v','pen-box','pen-val','btn-timer','time-box','time-val','btn-auto-rec'
  ].forEach(getEl);

  const noop = () => {};
  const winHandlers = {};
  const histCalls = [];
  const ctx = {
    fetch: customFetch,
    TextEncoder, TextDecoder, btoa, atob, crypto, URLSearchParams, AbortController,
    Blob: function(parts) { lastCreatedBlob = parts.join(''); return { content: lastCreatedBlob }; },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: noop },
    setInterval: noop, clearInterval: noop, setTimeout, clearTimeout, alert: noop, scrollTo: noop,
    window: { location: { search: searchStr, pathname: '/', hash: '' }, addEventListener: (ev, fn) => { (winHandlers[ev] ||= []).push(fn); }, scrollTo: noop },
    location: { hash: '', search: searchStr, pathname: '/' },
    history: {
      state: null,
      pushState(s, _, u) {
        this.state = s;
        const qi = String(u).indexOf('?');
        ctx.location.search = qi >= 0 ? String(u).slice(qi) : '';
        ctx.window.location.search = ctx.location.search;
        histCalls.push(['push', u, s]);
      },
      replaceState(s, _, u) {
        this.state = s;
        const qi = String(u).indexOf('?');
        ctx.location.search = qi >= 0 ? String(u).slice(qi) : '';
        ctx.window.location.search = ctx.location.search;
        histCalls.push(['replace', u, s]);
      }
    },
    localStorage: {
      getItem: k => lsStore.has(k) ? lsStore.get(k) : null,
      setItem: (k, v) => lsStore.set(k, String(v)),
      removeItem: k => lsStore.delete(k)
    },
    document: {
      hidden: false,
      getElementById: getEl,
      addEventListener: noop,
      createElement: tag => mkNode(tag),
      body: { appendChild: noop }
    }
  };
  ctx.globalThis = ctx;
  return {
    ctx: vm.createContext(ctx),
    els, lsStore, winHandlers, histCalls,
    getLastBlob: () => lastCreatedBlob,
    getDownloads: () => createdDownloads
  };
}

(async () => {
  const store = new Map([
    ['active', {
      title: { stringValue: 'C Switch Quiz' },
      description: { stringValue: 'Active desc' },
      settings: { mapValue: { fields: { autoRecordQuiz: { booleanValue: false } } } },
      questions: { arrayValue: { values: [{ mapValue: { fields: { q: { stringValue: 'Q1?' }, correct: { stringValue: 'A' }, wrongs: { arrayValue: { values: [{ stringValue: 'B' }] } } } } }] } }
    }],
    ['template', { html: { stringValue: idxHtml } }]
  ]);

  let lastRunQuerySelect = null;
  const mockFetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (url.endsWith(':runQuery') && method === 'POST') {
      const body = JSON.parse(opts.body);
      lastRunQuerySelect = body.structuredQuery.select.fields.map(f => f.fieldPath);
      const out = [];
      for (const [id, fields] of store.entries()) {
        const picked = {};
        for (const k of lastRunQuerySelect) {
          if (fields[k] !== undefined) picked[k] = fields[k];
        }
        out.push({
          document: {
            name: 'projects/sir-jasper-quiz/databases/(default)/documents/quizzes/' + id,
            fields: picked
          }
        });
      }
      return { ok: true, status: 200, json: async () => out };
    }
    if (url.includes('/submissions')) {
      return { ok: true, status: 200, json: async () => ({ documents: [] }) };
    }
    const idMatch = /\/quizzes\/([^/?]+)/.exec(url);
    const id = idMatch ? decodeURIComponent(idMatch[1]) : '';
    if (method === 'GET') {
      if (!store.has(id)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ name: '.../' + id, fields: store.get(id) }) };
    }
    if (method === 'PATCH') {
      const body = JSON.parse(opts.body);
      const prev = store.get(id) || {};
      const next = { ...prev, ...body.fields };
      store.set(id, next);
      return { ok: true, status: 200, json: async () => ({ name: '.../' + id, fields: next }) };
    }
    return { ok: false, status: 400, json: async () => ({}) };
  };

  const tEnv = makeEnv(tchRt, { customFetch: mockFetch });
  vm.runInContext(tchRt.boot, tEnv.ctx);
  await new Promise(r => setTimeout(r, 40));

  if (tEnv.els['view-dash'].classList.contains('hide') || !tEnv.els['main-nav'].classList.contains('hide') || !tEnv.els['opt-btn'].classList.contains('hide')) {
    throw new Error('Default boot without ?quiz= must show #view-dash and hide #main-nav / #opt-btn');
  }
  if (!lastRunQuerySelect || lastRunQuerySelect.join(',') !== 'label,quizOrder,title') {
    throw new Error('Unexpected :runQuery field projection: ' + JSON.stringify(lastRunQuerySelect));
  }
  const rows1 = tEnv.els['dash-list'].children;
  if (rows1.length !== 2 || rows1[0].children[0].textContent !== 'Load Quiz 1' || rows1[1].children[0].textContent !== 'Load Quiz 2') {
    throw new Error('Expected initial Load Quiz 1 & Load Quiz 2 rows, got: ' + rows1.map(r => r.children[0].textContent));
  }
  console.log('1. Default Dashboard render, :runQuery projection [label,quizOrder,title], minimal buttons PASSED');

  rows1[1].children[1].onclick();
  if (tEnv.els['rename-modal'].classList.contains('hide') || tEnv.els['rename-input'].value !== 'Quiz 2') {
    throw new Error('Rename modal did not open with Quiz 2');
  }
  tEnv.els['rename-input'].value = 'Midterm C: Exam?';
  await tEnv.els['rename-save-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (tEnv.els['dash-list'].children[1].children[0].textContent !== 'Load Midterm C: Exam?') {
    throw new Error('Rename did not update Dashboard row button');
  }
  if (store.get('quiz_2').label.stringValue !== 'Midterm C: Exam?') {
    throw new Error('Rename did not persist label to Firestore store');
  }
  console.log('2. Rename Quiz 2 -> Midterm C: Exam? & Firestore patchFields persistence PASSED');

  await tEnv.els['add-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  const rows2 = tEnv.els['dash-list'].children;
  if (rows2.length !== 3 || rows2[2].children[0].textContent !== 'Load Quiz 3' || !store.has('quiz_3')) {
    throw new Error('Add more Quiz failed to create persistent Quiz 3!');
  }
  console.log('3. Add more Quiz created Quiz 3 cleanly PASSED');

  rows2[0].children[0].onclick();
  await new Promise(r => setTimeout(r, 40));
  if (!tEnv.els['view-dash'].classList.contains('hide') || tEnv.els['main-nav'].classList.contains('hide') || tEnv.els['opt-btn'].classList.contains('hide')) {
    throw new Error('Clicking Load Quiz 1 failed to show workspace nav/options & hide Dashboard');
  }
  if (tEnv.els['active-quiz-badge'].textContent !== 'Quiz 1' || tEnv.els['qtitle'].value !== 'C Switch Quiz') {
    throw new Error('Load Quiz 1 did not hydrate title/badge');
  }
  tEnv.els['dl-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (tEnv.getDownloads().pop().download !== 'Quiz 1.html') {
    throw new Error('Expected downloaded filename Quiz 1.html');
  }
  console.log('4. Load Quiz 1 -> hydrated Editor + downloaded "Quiz 1.html" PASSED');

  tEnv.els['tab-btn-sub'].onclick();
  if (tEnv.els['ws-bar'].classList.contains('hide') || tEnv.els['view-sub'].classList.contains('hide')) {
    throw new Error('#ws-bar / Back button hidden on Submissions tab!');
  }
  tEnv.els['back-dash-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (tEnv.els['view-dash'].classList.contains('hide') || !tEnv.els['ws-bar'].classList.contains('hide') || !tEnv.els['main-nav'].classList.contains('hide') || tEnv.ctx.location.search !== '') {
    throw new Error('Back button failed to return to Dashboard cleanly or clear ?quiz= URL param');
  }
  console.log('4b. Top Back button from Submissions -> Dashboard & URL cleanup PASSED');

  tEnv.els['dash-list'].children[1].children[0].onclick();
  await new Promise(r => setTimeout(r, 40));
  if (!tEnv.histCalls.some(c => c[0] === 'push' && c[1].includes('quiz=quiz_2'))) {
    throw new Error('Expected pushState for Quiz 2 drill-down');
  }
  tEnv.ctx.location.search = '';
  tEnv.ctx.window.location.search = '';
  (tEnv.winHandlers['popstate'] || []).forEach(fn => fn({ state: { dash: true } }));
  if (tEnv.els['view-dash'].classList.contains('hide') || !tEnv.els['ws-bar'].classList.contains('hide')) {
    throw new Error('Browser popstate failed to return to Dashboard');
  }
  console.log('4c. Browser Back (popstate) -> Dashboard restore PASSED');

  tEnv.els['dash-list'].children[1].children[0].onclick();
  await new Promise(r => setTimeout(r, 40));
  if (tEnv.els['active-quiz-badge'].textContent !== 'Midterm C: Exam?' || tEnv.els['qtitle'].value !== '') {
    throw new Error('Switching from Quiz 1 to Quiz 2 leaked previous title or wrong label: ' + tEnv.els['qtitle'].value);
  }
  tEnv.els['qtitle'].value = 'Midterm Exam';
  const q1Card = tEnv.els['questions-container'].children[0];
  q1Card.querySelector('.q-text').value = 'Q2 item?';
  q1Card.querySelector('.q-corr').value = 'Yes';
  tEnv.els['btn-auto-rec'].onclick();
  tEnv.els['save-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (store.get('quiz_2').label.stringValue !== 'Midterm C: Exam?') {
    throw new Error('Save to Quiz overwrote custom quiz label!');
  }

  tEnv.els['dl-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  const dl2Name = tEnv.getDownloads().pop().download;
  const dl2Html = tEnv.getLastBlob();
  if (dl2Name !== 'Midterm C_ Exam_.html') {
    throw new Error('Expected sanitized download name "Midterm C_ Exam_.html", got: ' + dl2Name);
  }
  console.log('5. Switching to Quiz 2 -> isolated state, preserved label, downloaded "' + dl2Name + '" PASSED');

  const dl2Rt = extractRuntime(dl2Html);
  const postedPaths = [];
  const requestedPaths = [];
  const studentFetch = async (url, opts = {}) => {
    if ((opts.method || 'GET').toUpperCase() === 'POST') {
      postedPaths.push(url);
      return { ok: true, status: 200, json: async () => ({ name: 'sub2' }) };
    }
    requestedPaths.push(url);
    return mockFetch(url, opts);
  };
  const sEnv = makeEnv(dl2Rt, {
    customFetch: studentFetch,
    initialStorage: { ds_quiz_lock_active: JSON.stringify({ state: 'done', epoch: 0 }) }
  });
  vm.runInContext(dl2Rt.boot, sEnv.ctx);
  await new Promise(r => setTimeout(r, 40));
  if (!sEnv.els['lock'].classList.contains('hide') || sEnv.els['title'].textContent !== 'Midterm Exam') {
    throw new Error('Standalone Midterm Exam collided with active Quiz 1 lock!');
  }
  if (!requestedPaths.every(p => p.includes('/quizzes/quiz_2'))) {
    throw new Error('Standalone file queried wrong quizId: ' + requestedPaths.join(', '));
  }
  sEnv.els['nm'].value = 'Student Two';
  sEnv.els['sc'].value = 'BSIT';
  sEnv.els['go'].onclick();
  sEnv.els['opts'].children[0].onclick();
  sEnv.els['nx'].onclick();
  await new Promise(r => setTimeout(r, 40));
  if (postedPaths.length !== 1 || !postedPaths[0].includes('/quizzes/quiz_2/submissions') || !sEnv.lsStore.has('ds_quiz_lock_quiz_2')) {
    throw new Error('Standalone Quiz 2 submission or lock isolation failed: ' + JSON.stringify(postedPaths));
  }
  console.log('6. Standalone downloaded Quiz 2 file isolated lock & routed to quiz_2 PASSED');

  tEnv.els['tab-btn-dash'].onclick();
  await new Promise(r => setTimeout(r, 30));
  tEnv.els['dash-list'].children[1].children[1].onclick();
  tEnv.els['rename-input'].value = 'CON';
  await tEnv.els['rename-save-btn'].onclick();
  tEnv.els['dash-list'].children[1].children[0].onclick();
  await new Promise(r => setTimeout(r, 30));
  tEnv.els['dl-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (tEnv.getDownloads().pop().download !== '_CON.html') {
    throw new Error('DOS reserved word CON was not prefixed to _CON.html');
  }
  console.log('7. Reserved Windows device name sanitization (CON -> _CON.html) PASSED');

  const liveProbeUrl = 'https://firestore.googleapis.com/v1/projects/sir-jasper-quiz/databases/(default)/documents/quizzes/verify_probe_q3';
  const liveEnv = makeEnv(tchRt, { customFetch: fetch });
  vm.runInContext(tchRt.boot, liveEnv.ctx);
  await new Promise(r => setTimeout(r, 1200));
  await fetch(liveProbeUrl + '?updateMask.fieldPaths=label&updateMask.fieldPaths=quizOrder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { label: { stringValue: 'Probe Quiz 99' }, quizOrder: { integerValue: '99' } } })
  });
  liveEnv.els['tab-btn-dash'].onclick();
  await new Promise(r => setTimeout(r, 1200));
  const liveRows = liveEnv.els['dash-list'].children;
  const found = liveRows.find(r => r.children[0].textContent === 'Load Probe Quiz 99');
  await fetch(liveProbeUrl, { method: 'DELETE' });
  if (!found) throw new Error('Live Firestore :runQuery failed to list renamed probe quiz');
  console.log('8. Live Firestore :runQuery metadata roundtrip & cleanup PASSED');

  console.log('ALL MULTI-QUIZ DASHBOARD, RENAME, ADD & AUTO-FILENAME VERIFICATIONS PASSED!');
})();
