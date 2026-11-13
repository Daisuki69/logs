const fs = require('fs');
const vm = require('vm');

const idxHtml = fs.readFileSync('index.html', 'utf8');
const tchHtml = fs.readFileSync('teacher.html', 'utf8');

const pat = /firebase|firestore|gstatic|sir-jasper-quiz|googleapis|stringValue|integerValue|doubleValue|booleanValue|nullValue|arrayValue|mapValue|collection|EncryptedLocalDB|readQuiz|writeQuiz|appendRecord|listRecords|purgeRecords|patchField|patchFields|listQuizzes|runQuery|structuredQuery|collectionId|toStoreVal|fromStoreVal|\bfetch\b/i;
for (const [name, src] of [['index.html', idxHtml], ['teacher.html', tchHtml]]) {
  const m = src.match(pat);
  if (m) throw new Error('Forbidden trace in ' + name + ': ' + m[0]);
  src.split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('<!--')) {
      throw new Error('Comment in ' + name + ' line ' + (i + 1));
    }
  });
}
if (/tab-btn-reset|view-reset|reset-lock-btn|reset-status-msg/i.test(tchHtml)) {
  throw new Error('Legacy Reset tab markup/identifiers still present in teacher.html');
}
if (!tchHtml.includes('Clearing students also resets the response lock. Are you sure this is what you want?')) {
  throw new Error('Updated confirmation modal warning missing from teacher.html');
}
console.log('Audit OK: 0 forbidden traces, 0 comments, Reset tab removed, updated modal warning present');

function extract(html) {
  const c = /<script\s+id=["']local-runtime-cipher["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)[1];
  const s = html.lastIndexOf('<script>'), e = html.lastIndexOf('</script>');
  return { cipher: c, boot: html.slice(s + 8, e), html };
}

function makeEnv(rt, searchStr, initialStorage) {
  const els = {};
  const lsStore = new Map(Object.entries(initialStorage || {}));
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
  const getEl = id => {
    if (id === 'local-runtime-cipher') return { textContent: rt.cipher };
    if (id === 'local-db-vault') return { textContent: '' };
    if (!els[id]) {
      els[id] = {
        id, style: {}, disabled: true, value: '', textContent: '',
        _innerHTML: '', get innerHTML() { return this._innerHTML; }, set innerHTML(v) { this._innerHTML = String(v); if (!v) this.children = []; },
        classList: mkClassList(initClassesFromHtml(id)),
        children: [],
        append(...a) { this.children.push(...a); },
        appendChild(a) { this.children.push(a); },
        querySelectorAll(sel) { return sel === '.q-card' ? this.children : []; },
        scrollIntoView() {},
        onclick: null
      };
    }
    return els[id];
  };
  [
    'start','title','desc','nm','sc','err','go','lock','lk1','lk2','lkdl','exam','prog','sw','tm','pbar','tb','q','opts','nx','res','rn','rs','rd','res-actions','dl','cp','res-note','fbs','wm','warn','wp','wc','wbtn',
    'ws-bar','back-dash-btn','main-nav','tab-btn-dash','tab-btn-editor','tab-btn-sub','view-dash','dash-list','dash-msg','add-quiz-btn','active-quiz-badge','rename-modal','rename-input','rename-save-btn','rename-cancel-btn','view-editor','view-sub','qtitle','qdesc','save-btn','dl-quiz-btn','status-msg','questions-container','add-q-btn','sub-count-badge','clear-sub-btn','sub-desc','sub-status-msg','sub-feed','confirm-modal','modal-yes-btn','modal-no-btn','opt-btn','options-panel','edge-overlay','close-opt-btn','btn-rand-q','btn-rand-a','btn-tab-v','pen-box','pen-val','btn-timer','time-box','time-val','btn-auto-rec'
  ].forEach(getEl);

  const noop = () => {};
  const ctx = {
    fetch, TextEncoder, TextDecoder, btoa, atob, crypto, URLSearchParams, AbortController,
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL: noop },
    setInterval: noop, clearInterval: noop, setTimeout: noop, alert: noop, scrollTo: noop,
    window: { location: { search: searchStr, pathname: '/', hash: '' }, addEventListener: noop, scrollTo: noop },
    location: { hash: '', search: searchStr, pathname: '/' },
    history: { replaceState: noop },
    localStorage: {
      getItem: k => lsStore.has(k) ? lsStore.get(k) : null,
      setItem: (k, v) => lsStore.set(k, String(v)),
      removeItem: k => lsStore.delete(k)
    },
    document: {
      hidden: false, getElementById: getEl, addEventListener: noop, body: { appendChild: noop },
      createElement: tag => ({
        tagName: tag.toUpperCase(), className: '', style: {}, children: [],
        append(...a) { this.children.push(...a); }, appendChild(a) { this.children.push(a); },
        querySelector(sel) {
          const find = cls => {
            for (const lb of this.children) for (const ch of (lb.children || [])) if (String(ch.className || '').includes(cls)) return ch;
            return { value: '' };
          };
          const map = { '.q-text': 'q-text', '.q-corr': 'q-corr', '.q-w1': 'q-w1', '.q-w2': 'q-w2', '.q-w3': 'q-w3', '.q-exp': 'q-exp' };
          return map[sel] ? find(map[sel]) : { value: '' };
        },
        click: noop, scrollIntoView: noop, remove: noop
      })
    }
  };
  ctx.globalThis = ctx;
  return { ctx: vm.createContext(ctx), els, lsStore };
}

(async () => {
  const probeUrl = 'https://firestore.googleapis.com/v1/projects/sir-jasper-quiz/databases/(default)/documents/quizzes/verify_probe_tmp';
  const subsUrl = probeUrl + '/submissions';

  async function seedProbe(lockEpoch, autoRecordQuiz) {
    await fetch(probeUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          title: { stringValue: 'Combined Clear+Reset Probe' },
          description: { stringValue: 'Desc' },
          lockEpoch: { integerValue: String(lockEpoch) },
          settings: { mapValue: { fields: { autoRecordQuiz: { booleanValue: autoRecordQuiz } } } },
          questions: { arrayValue: { values: [{ mapValue: { fields: { q: { stringValue: 'Q1' }, correct: { stringValue: 'A' }, wrongs: { arrayValue: { values: [{ stringValue: 'B' }] } } } } }] } }
        }
      })
    });
    await fetch(subsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { n: { stringValue: 'Test Student' }, s: { stringValue: 'BSIT-2A' }, sc: { integerValue: '1' }, tot: { integerValue: '1' } }
      })
    });
  }

  const iRt = extract(idxHtml);
  const tRt = extract(tchHtml);

  await seedProbe(100, true);
  const tOnEnv = makeEnv(tRt, '?quiz=verify_probe_tmp', { ds_quiz_lock_verify_probe_tmp: 'stale_local' });
  vm.runInContext(tRt.boot, tOnEnv.ctx);
  await new Promise(r => setTimeout(r, 1200));

  tOnEnv.els['tab-btn-sub'].onclick();
  await new Promise(r => setTimeout(r, 800));
  if (!tOnEnv.els['sub-feed'].innerHTML.includes('Test Student')) {
    throw new Error('Case ON: expected seeded Test Student in #sub-feed');
  }
  tOnEnv.els['clear-sub-btn'].onclick();
  if (tOnEnv.els['confirm-modal'].classList.contains('hide')) {
    throw new Error('Case ON: #confirm-modal did not open');
  }
  await tOnEnv.els['modal-yes-btn'].onclick();
  await new Promise(r => setTimeout(r, 800));

  const subsAfterOn = await (await fetch(subsUrl)).json();
  const docAfterOn = await (await fetch(probeUrl)).json();
  const epochOn = Number(docAfterOn.fields.lockEpoch.integerValue);
  if ((subsAfterOn.documents || []).length !== 0 || !(epochOn > 100) || tOnEnv.lsStore.has('ds_quiz_lock_verify_probe_tmp')) {
    throw new Error(`Case ON failed: subs=${(subsAfterOn.documents || []).length}, epoch=${epochOn}`);
  }
  if (tOnEnv.els['sub-status-msg'].classList.contains('hide') || !tOnEnv.els['sub-status-msg'].textContent.includes('Cleared students and reset response lock')) {
    throw new Error('Case ON: #sub-status-msg not updated');
  }
  console.log('1. Case ON (autoRecordQuiz=true): cleared students, bumped lockEpoch=' + epochOn + ', cleared local lock');

  const reloadOn = makeEnv(iRt, '?quiz=verify_probe_tmp', {
    ds_quiz_lock_verify_probe_tmp: JSON.stringify({ state: 'done', rec: { n: 'Ana', s: '2A' }, epoch: 100 })
  });
  vm.runInContext(iRt.boot, reloadOn.ctx);
  await new Promise(r => setTimeout(r, 1000));
  if (reloadOn.lsStore.has('ds_quiz_lock_verify_probe_tmp') || reloadOn.els['start'].classList.contains('hide')) {
    throw new Error('Case ON: student device stayed locked after combined Clear Students!');
  }
  console.log('2. Case ON: locked student unlocked on reload after Clear Students');

  await seedProbe(200, false);
  const tOffEnv = makeEnv(tRt, '?quiz=verify_probe_tmp', { ds_quiz_lock_verify_probe_tmp: 'stale_local_off' });
  vm.runInContext(tRt.boot, tOffEnv.ctx);
  await new Promise(r => setTimeout(r, 1200));

  tOffEnv.els['tab-btn-sub'].onclick();
  await new Promise(r => setTimeout(r, 200));
  if (tOffEnv.els['clear-sub-btn'].classList.contains('hide') || !tOffEnv.els['sub-feed'].innerHTML.includes('Notice: This is only available to auto record quiz')) {
    throw new Error('Case OFF: Clear Students hidden or Notice missing!');
  }
  tOffEnv.els['clear-sub-btn'].onclick();
  if (tOffEnv.els['confirm-modal'].classList.contains('hide')) {
    throw new Error('Case OFF: #confirm-modal did not open');
  }
  await tOffEnv.els['modal-yes-btn'].onclick();
  await new Promise(r => setTimeout(r, 800));

  const subsAfterOff = await (await fetch(subsUrl)).json();
  const docAfterOff = await (await fetch(probeUrl)).json();
  const epochOff = Number(docAfterOff.fields.lockEpoch.integerValue);
  if ((subsAfterOff.documents || []).length !== 0 || !(epochOff > 200) || tOffEnv.lsStore.has('ds_quiz_lock_verify_probe_tmp')) {
    throw new Error(`Case OFF failed: subs=${(subsAfterOff.documents || []).length}, epoch=${epochOff}`);
  }
  if (!tOffEnv.els['sub-feed'].innerHTML.includes('Notice: This is only available to auto record quiz') || tOffEnv.els['sub-status-msg'].classList.contains('hide')) {
    throw new Error('Case OFF: Notice overwritten or #sub-status-msg missing!');
  }
  console.log('3. Case OFF (autoRecordQuiz=false): Clear Students worked, bumped lockEpoch=' + epochOff + ', cleared leftover sub, kept Notice');

  const reloadOff = makeEnv(iRt, '?quiz=verify_probe_tmp', {
    ds_quiz_lock_verify_probe_tmp: JSON.stringify({ state: 'done', rec: { n: 'Ben', s: '2B' }, epoch: 200 })
  });
  vm.runInContext(iRt.boot, reloadOff.ctx);
  await new Promise(r => setTimeout(r, 1000));
  if (reloadOff.lsStore.has('ds_quiz_lock_verify_probe_tmp') || reloadOff.els['start'].classList.contains('hide')) {
    throw new Error('Case OFF: locked student stayed locked after Clear Students!');
  }
  console.log('4. Case OFF: locked student unlocked on reload after Clear Students');

  const delRes = await fetch(probeUrl, { method: 'DELETE' });
  console.log('5. Cleanup temporary probe doc HTTP:', delRes.status);
  console.log('ALL COMBINED CLEAR STUDENTS + RESET LOCK TESTS PASSED!');
})();
