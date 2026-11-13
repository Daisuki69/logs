const fs = require('fs');
const vm = require('vm');

const idxHtml = fs.readFileSync('index.html', 'utf8');
const tchHtml = fs.readFileSync('teacher.html', 'utf8');

const pat = /firebase|firestore|gstatic|sir-jasper-quiz|googleapis|stringValue|integerValue|doubleValue|booleanValue|nullValue|arrayValue|mapValue|collection|EncryptedLocalDB|readQuiz|writeQuiz|appendRecord|listRecords|purgeRecords|patchField|toStoreVal|fromStoreVal|\bfetch\b/i;
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
console.log('Audit OK: 0 forbidden traces and 0 comments in compiled index.html & teacher.html');

function extract(html) {
  const c = /<script\s+id=["']local-runtime-cipher["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)[1];
  const s = html.lastIndexOf('<script>'), e = html.lastIndexOf('</script>');
  return { cipher: c, boot: html.slice(s + 8, e) };
}

function makeEnv(rt, searchStr, initialStorage) {
  const els = {};
  const lsStore = new Map(Object.entries(initialStorage || {}));
  const mkClassList = initHide => {
    const set = new Set(initHide ? ['hide'] : []);
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
      const startHidden = ['lock', 'exam', 'res', 'view-sub', 'view-reset', 'confirm-modal'].includes(id);
      els[id] = {
        id, style: {}, disabled: true, value: '', textContent: '', innerHTML: '',
        classList: mkClassList(startHidden),
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
  const noop = () => {};
  const ctx = {
    fetch, TextEncoder, TextDecoder, btoa, atob, crypto, URLSearchParams,
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
  const seedPayload = {
    fields: {
      title: { stringValue: 'Epoch Probe Quiz' },
      description: { stringValue: 'Desc' },
      lockEpoch: { integerValue: '100' },
      settings: { mapValue: { fields: { autoRecordQuiz: { booleanValue: false } } } },
      questions: { arrayValue: { values: [{ mapValue: { fields: { q: { stringValue: 'Q1' }, correct: { stringValue: 'A' }, wrongs: { arrayValue: { values: [{ stringValue: 'B' }] } } } } }] } }
    }
  };
  await fetch(probeUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seedPayload) });

  const iRt = extract(idxHtml);
  const tRt = extract(tchHtml);

  const lockedEnv = makeEnv(iRt, '?quiz=verify_probe_tmp', {
    ds_quiz_lock_verify_probe_tmp: JSON.stringify({ state: 'done', rec: { n: 'Ana', s: '2A' }, epoch: 100 })
  });
  vm.runInContext(iRt.boot, lockedEnv.ctx);
  await new Promise(r => setTimeout(r, 1000));
  console.log('1. Locked student stays locked (same epoch=100): lock.hidden=', lockedEnv.els['lock'].classList.contains('hide'), 'start.hidden=', lockedEnv.els['start'].classList.contains('hide'));
  if (lockedEnv.els['lock'].classList.contains('hide') || !lockedEnv.els['start'].classList.contains('hide')) {
    throw new Error('Student should still be locked!');
  }

  const tEnv = makeEnv(tRt, '?quiz=verify_probe_tmp', { ds_quiz_lock_verify_probe_tmp: 'stale_local' });
  vm.runInContext(tRt.boot, tEnv.ctx);
  await new Promise(r => setTimeout(r, 1000));

  tEnv.els['tab-btn-reset'].onclick();
  if (tEnv.els['view-reset'].classList.contains('hide') || !tEnv.els['view-editor'].classList.contains('hide') || !tEnv.els['tab-btn-reset'].classList.contains('active')) {
    throw new Error('Reset tab failed to activate!');
  }
  console.log('2. Switch to Reset tab OK -> view-reset visible, view-editor hidden');

  tEnv.els['reset-lock-btn'].onclick();
  if (tEnv.els['confirm-modal'].classList.contains('hide')) {
    throw new Error('Confirmation modal did not open on Reset Response Lock!');
  }
  await tEnv.els['modal-yes-btn'].onclick();
  await new Promise(r => setTimeout(r, 800));
  console.log('3. Reset modal Yes -> status:', tEnv.els['reset-status-msg'].textContent, '| local lock removed:', !tEnv.lsStore.has('ds_quiz_lock_verify_probe_tmp'));

  const afterDoc = await (await fetch(probeUrl)).json();
  const newEpoch = Number(afterDoc.fields.lockEpoch.integerValue);
  console.log('4. Remote lockEpoch bumped cleanly:', newEpoch > 100, '| title preserved:', afterDoc.fields.title.stringValue);
  if (!(newEpoch > 100) || afterDoc.fields.title.stringValue !== 'Epoch Probe Quiz') {
    throw new Error('Remote lockEpoch bump or title preservation failed!');
  }

  const reloadUnlocked = makeEnv(iRt, '?quiz=verify_probe_tmp', {
    ds_quiz_lock_verify_probe_tmp: JSON.stringify({ state: 'done', rec: { n: 'Ana', s: '2A' }, epoch: 100 })
  });
  vm.runInContext(iRt.boot, reloadUnlocked.ctx);
  await new Promise(r => setTimeout(r, 1000));
  console.log('5. Reload locked device after reset -> ls unlocked:', !reloadUnlocked.lsStore.has('ds_quiz_lock_verify_probe_tmp'), '| start visible:', !reloadUnlocked.els['start'].classList.contains('hide'), '| go.disabled:', reloadUnlocked.els['go'].disabled);
  if (reloadUnlocked.lsStore.has('ds_quiz_lock_verify_probe_tmp') || reloadUnlocked.els['start'].classList.contains('hide') || reloadUnlocked.els['go'].disabled !== false) {
    throw new Error('Remote unlock on reload failed!');
  }

  const reLocked = makeEnv(iRt, '?quiz=verify_probe_tmp', {
    ds_quiz_lock_verify_probe_tmp: JSON.stringify({ state: 'done', rec: { n: 'Ana', s: '2A' }, epoch: newEpoch })
  });
  vm.runInContext(iRt.boot, reLocked.ctx);
  await new Promise(r => setTimeout(r, 1000));
  console.log('6. Re-locked at new epoch stays locked:', !reLocked.els['lock'].classList.contains('hide') && reLocked.els['start'].classList.contains('hide'));
  if (reLocked.els['lock'].classList.contains('hide') || !reLocked.els['start'].classList.contains('hide')) {
    throw new Error('Device locked at new epoch did not stay locked!');
  }

  const delRes = await fetch(probeUrl, { method: 'DELETE' });
  console.log('7. Cleanup temporary probe doc HTTP:', delRes.status);
  console.log('ALL RESET TAB & EPOCH UNLOCK TESTS PASSED!');
})();
