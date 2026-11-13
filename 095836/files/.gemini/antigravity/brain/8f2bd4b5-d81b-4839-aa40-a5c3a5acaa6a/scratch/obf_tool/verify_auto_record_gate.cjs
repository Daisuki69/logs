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

function makeEnv(rt, { customFetch, initialStorage, vaultOverride, searchStr = '' } = {}) {
  const els = {};
  const lsStore = new Map(Object.entries(initialStorage || {}));
  const docHandlers = {};
  const winHandlers = {};
  const intervals = new Map();
  let nextIv = 1;

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

  const mkNode = (tag, initClasses = []) => ({
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
    querySelectorAll(sel) { return sel === '.q-card' ? this.children : []; },
    querySelector(sel) {
      const find = cls => {
        for (const lb of this.children) for (const ch of (lb.children || [])) if (String(ch.className || '').includes(cls)) return ch;
        return { value: '' };
      };
      const map = { '.q-text': 'q-text', '.q-corr': 'q-corr', '.q-w1': 'q-w1', '.q-w2': 'q-w2', '.q-w3': 'q-w3', '.q-exp': 'q-exp' };
      return map[sel] ? find(map[sel]) : { value: '', textContent: '' };
    },
    scrollIntoView() {},
    click() {},
    remove() {},
    parentNode: { removeChild() {} }
  });

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

  const ids = [
    'start','title','desc','nm','sc','err','go','lock','lk1','lk2','lkdl','exam','prog','sw','tm','pbar','tb','q','opts','nx','res','rn','rs','rd','res-actions','dl','cp','res-note','fbs','wm','warn','wp','wc','wbtn',
    'ws-bar','back-dash-btn','main-nav','tab-btn-dash','tab-btn-editor','tab-btn-sub','view-dash','dash-list','dash-msg','add-quiz-btn','active-quiz-badge','rename-modal','rename-input','rename-save-btn','rename-cancel-btn','view-editor','view-sub','qtitle','qdesc','save-btn','dl-quiz-btn','status-msg','questions-container','add-q-btn','sub-count-badge','clear-sub-btn','sub-desc','sub-status-msg','sub-feed','confirm-modal','modal-yes-btn','modal-no-btn','opt-btn','options-panel','edge-overlay','close-opt-btn','btn-rand-q','btn-rand-a','btn-tab-v','pen-box','pen-val','btn-timer','time-box','time-val','btn-auto-rec'
  ];
  ids.forEach(getEl);

  const noop = () => {};
  class FakeBlob {
    constructor(parts) { this.content = parts.join(''); }
  }
  let lastCreatedBlob = null;
  const ctx = {
    fetch: customFetch,
    TextEncoder, TextDecoder, btoa, atob, crypto, URLSearchParams, AbortController,
    Blob: function(parts) { lastCreatedBlob = new FakeBlob(parts); return lastCreatedBlob; },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: noop },
    setInterval: (fn, ms) => {
      const id = nextIv++;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval: id => { intervals.delete(id); },
    setTimeout, clearTimeout, alert: noop, scrollTo: noop,
    window: {
      location: { search: searchStr, pathname: '/', hash: '' },
      addEventListener: (ev, fn) => { (winHandlers[ev] ||= []).push(fn); },
      scrollTo: noop
    },
    location: { hash: '', search: searchStr, pathname: '/' },
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
    els, lsStore, docHandlers, winHandlers, intervals,
    getLastBlob: () => lastCreatedBlob && lastCreatedBlob.content
  };
}

function makeQuizDoc(settingsFields) {
  const fields = {
    title: { stringValue: 'Gate Test Quiz' },
    description: { stringValue: 'Desc' },
    timePerQuestion: { integerValue: '20' },
    lockEpoch: { integerValue: '0' },
    questions: {
      arrayValue: {
        values: [{
          mapValue: {
            fields: {
              q: { stringValue: '2+2?' },
              correct: { stringValue: '4' },
              wrongs: { arrayValue: { values: [{ stringValue: '3' }] } },
              explanation: { stringValue: 'Math' }
            }
          }
        }]
      }
    }
  };
  if (settingsFields !== undefined) {
    fields.settings = { mapValue: { fields: settingsFields } };
  }
  return { name: 'projects/sir-jasper-quiz/databases/(default)/documents/quizzes/active', fields };
}

(async () => {
  async function testIndexFinish(label, settingsFields, expectPost, vaultOverride) {
    const posts = [];
    const mockFetch = async (url, opts = {}) => {
      if ((opts.method || 'GET').toUpperCase() === 'POST') {
        posts.push(url);
        return { ok: true, status: 200, json: async () => ({ name: 'sub1' }) };
      }
      if (vaultOverride) throw new Error('offline');
      return { ok: true, status: 200, json: async () => makeQuizDoc(settingsFields) };
    };
    const env = makeEnv(idxRt, { customFetch: mockFetch, vaultOverride });
    vm.runInContext(idxRt.boot, env.ctx);
    await new Promise(r => setTimeout(r, 30));
    env.els['nm'].value = 'Student One';
    env.els['sc'].value = 'Sec A';
    env.els['go'].onclick();
    env.els['opts'].children[0].onclick();
    env.els['nx'].onclick();
    await new Promise(r => setTimeout(r, 30));

    if (posts.length !== expectPost) {
      throw new Error(`${label}: expected ${expectPost} POST(s), got ${posts.length}`);
    }
    const wantDisplay = expectPost ? 'none' : 'flex';
    if (env.els['res-actions'].style.display !== wantDisplay) {
      throw new Error(`${label}: expected res-actions display=${wantDisplay}, got ${env.els['res-actions'].style.display}`);
    }

    const lockJson = env.lsStore.get('ds_quiz_lock_active');
    if (!lockJson) throw new Error(`${label}: missing ds_quiz_lock_active`);
    const reloadFetch = async () => {
      if (vaultOverride) throw new Error('offline');
      return { ok: true, status: 200, json: async () => makeQuizDoc(settingsFields) };
    };
    const relEnv = makeEnv(idxRt, { customFetch: reloadFetch, initialStorage: { ds_quiz_lock_active: lockJson }, vaultOverride });
    vm.runInContext(idxRt.boot, relEnv.ctx);
    await new Promise(r => setTimeout(r, 30));
    const dlHidden = relEnv.els['lkdl'].classList.contains('hide');
    if (dlHidden !== Boolean(expectPost)) {
      throw new Error(`${label}: expected lkdl hide=${Boolean(expectPost)}, got ${dlHidden}`);
    }
    console.log(`PASS [index.html] ${label}: posts=${posts.length}, res-actions=${env.els['res-actions'].style.display}, lkdl.hide=${dlHidden}`);
  }

  await testIndexFinish('autoRecordQuiz=false', { autoRecordQuiz: { booleanValue: false } }, 0);
  await testIndexFinish('autoRecordQuiz=true', { autoRecordQuiz: { booleanValue: true } }, 1);
  await testIndexFinish('legacy settings omitted', undefined, 1);

  const subGets = [];
  let subAbortSignals = [];
  let hangNextSubGet = false;
  let resolveHungSub = null;
  let autoSettingRemote = false;

  const tchFetch = async (url, opts = {}) => {
    const isSubs = url.includes('/submissions');
    if (isSubs) {
      subGets.push({ url, opts });
      if (opts && opts.signal) subAbortSignals.push(opts.signal);
      if (hangNextSubGet) {
        hangNextSubGet = false;
        return new Promise((resolve, reject) => {
          resolveHungSub = () => resolve({ ok: true, status: 200, json: async () => ({ documents: [{ name: 'p1', fields: { n: { stringValue: 'Stale' }, s: { stringValue: '1A' }, sc: { integerValue: '5' }, tot: { integerValue: '10' } } }] }) });
          if (opts.signal) {
            opts.signal.addEventListener('abort', () => {
              const e = new Error('The operation was aborted');
              e.name = 'AbortError';
              reject(e);
            });
          }
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          documents: [{
            name: 'projects/sir-jasper-quiz/databases/(default)/documents/quizzes/active/submissions/s1',
            fields: { n: { stringValue: 'asd' }, s: { stringValue: 'asd' }, sc: { integerValue: '0' }, tot: { integerValue: '1' } }
          }]
        })
      };
    }
    if (url.includes('/template')) {
      return { ok: true, status: 200, json: async () => ({ fields: { html: { stringValue: idxHtml } } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => makeQuizDoc({ autoRecordQuiz: { booleanValue: autoSettingRemote } })
    };
  };

  const tEnv = makeEnv(tchRt, { customFetch: tchFetch, searchStr: '?quiz=active' });
  vm.runInContext(tchRt.boot, tEnv.ctx);
  await new Promise(r => setTimeout(r, 40));

  if (tEnv.els['clear-sub-btn'].classList.contains('hide') || !tEnv.els['sub-count-badge'].classList.contains('hide') || !tEnv.els['sub-desc'].classList.contains('hide')) {
    throw new Error('Expected #clear-sub-btn VISIBLE, and #sub-count-badge / #sub-desc hidden when autoRecordQuiz=false');
  }
  if (!tEnv.els['sub-feed'].innerHTML.includes('Notice: This is only available to auto record quiz')) {
    throw new Error('Expected notice inside #sub-feed, got: ' + tEnv.els['sub-feed'].innerHTML);
  }
  if (subGets.length !== 0 || tEnv.intervals.size !== 0) {
    throw new Error(`Expected 0 submission GETs & 0 polling intervals when OFF; got gets=${subGets.length}, iv=${tEnv.intervals.size}`);
  }

  tEnv.els['tab-btn-sub'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (subGets.length !== 0 || tEnv.intervals.size !== 0 || tEnv.els['clear-sub-btn'].classList.contains('hide')) {
    throw new Error('Switching to Submissions with autoRecordQuiz=false triggered GETs or hid #clear-sub-btn!');
  }

  tEnv.els['clear-sub-btn'].onclick();
  if (tEnv.els['confirm-modal'].classList.contains('hide')) {
    throw new Error('#clear-sub-btn.onclick did not open #confirm-modal when autoRecordQuiz=false');
  }
  tEnv.els['modal-no-btn'].onclick();
  console.log('PASS [teacher.html] autoRecordQuiz=false hides badge/desc, shows Notice, keeps Clear Students clickable with 0 polling fetches');

  tEnv.els['btn-auto-rec'].onclick();
  await new Promise(r => setTimeout(r, 40));
  if (tEnv.els['clear-sub-btn'].classList.contains('hide') || tEnv.els['sub-count-badge'].classList.contains('hide')) {
    throw new Error('Toggling Auto Record Quiz ON did not show Clear Students / badge');
  }
  if (subGets.length !== 1 || tEnv.intervals.size !== 1 || !tEnv.els['sub-feed'].innerHTML.includes('asd')) {
    throw new Error(`Expected 1 sub GET, 1 interval, and rendered student; got gets=${subGets.length}, iv=${tEnv.intervals.size}, feed=${tEnv.els['sub-feed'].innerHTML}`);
  }

  const ivEntry = Array.from(tEnv.intervals.values())[0];
  ivEntry.fn();
  await new Promise(r => setTimeout(r, 20));
  if (subGets.length !== 2) throw new Error('Polling tick failed while view-sub active & visible');

  tEnv.ctx.document.hidden = true;
  (tEnv.docHandlers['visibilitychange'] || []).forEach(fn => fn());
  if (tEnv.intervals.size !== 0) throw new Error('Expected poller stopped when document.hidden=true');

  tEnv.ctx.document.hidden = false;
  (tEnv.docHandlers['visibilitychange'] || []).forEach(fn => fn());
  if (tEnv.intervals.size !== 1) throw new Error('Expected poller restarted when document visible on view-sub');

  tEnv.els['tab-btn-editor'].onclick();
  if (tEnv.intervals.size !== 0) throw new Error('Expected poller stopped when leaving view-sub');

  hangNextSubGet = true;
  tEnv.els['tab-btn-sub'].onclick();
  tEnv.els['btn-auto-rec'].onclick();
  await new Promise(r => setTimeout(r, 30));
  if (!subAbortSignals.some(s => s.aborted)) throw new Error('Expected in-flight submission GET aborted when toggling OFF');
  if (!tEnv.els['sub-feed'].innerHTML.includes('Notice: This is only available to auto record quiz') || tEnv.els['clear-sub-btn'].classList.contains('hide')) {
    throw new Error('Notice or Clear Students visibility broken after mid-flight abort!');
  }
  console.log('PASS [teacher.html] Toggle ON/OFF, visibility & tab-aware poller, mid-flight AbortController cancellation');

  tEnv.els['dl-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 30));
  const dlHtml = tEnv.getLastBlob();
  const dlVaultMatch = /<script\s+id=["']local-db-vault["'][^>]*>([\s\S]*?)<\/script>/i.exec(dlHtml);
  await testIndexFinish('offline vault autoRecordQuiz=false', undefined, 0, dlVaultMatch[1]);

  console.log('ALL AUTO RECORD QUIZ GATE & SUBMISSIONS NOTICE VERIFICATIONS PASSED!');
})();
