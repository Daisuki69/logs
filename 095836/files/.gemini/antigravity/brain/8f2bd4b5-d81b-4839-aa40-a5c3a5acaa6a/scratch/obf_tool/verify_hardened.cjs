const fs = require('fs');
const vm = require('vm');

if (fs.existsSync('raw') || fs.existsSync('.vercelignore')) {
  throw new Error('raw or .vercelignore still exists!');
}
console.log('Workspace check: raw/ and .vercelignore deleted');

const idxHtml = fs.readFileSync('index.html', 'utf8');
const tchHtml = fs.readFileSync('teacher.html', 'utf8');

const pat = /firebase|firestore|gstatic|sir-jasper-quiz|googleapis|stringValue|integerValue|doubleValue|booleanValue|nullValue|arrayValue|mapValue|collection|EncryptedLocalDB|readQuiz|writeQuiz|appendRecord|listRecords|purgeRecords|patchFields|listQuizzes|runQuery|structuredQuery|collectionId|toStoreVal|fromStoreVal|\bfetch\b/i;
for (const [name, src] of [['index.html', idxHtml], ['teacher.html', tchHtml]]) {
  const m = src.match(pat);
  if (m) throw new Error('Forbidden trace in ' + name + ': ' + m[0]);
  console.log(name + ': 0 forbidden traces (including fetch & helper names)');
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

function parseRuntime(html) {
  const vaultMatch = /<script\s+id=["']local-db-vault["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  const cipherMatch = /<script\s+id=["']local-runtime-cipher["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  const bootStart = html.lastIndexOf('<script>');
  const bootEnd = html.lastIndexOf('</script>');
  if (!cipherMatch || bootStart === -1 || bootEnd <= bootStart) {
    throw new Error('Missing runtime cipher or bootstrapper');
  }
  const boot = html.slice(bootStart + 8, bootEnd);
  new Function(boot);
  return {
    vault: vaultMatch ? vaultMatch[1] : '',
    cipher: cipherMatch[1],
    boot
  };
}

const idxRt = parseRuntime(idxHtml);
const tchRt = parseRuntime(tchHtml);
console.log('Both index.html and teacher.html have valid #local-runtime-cipher + obfuscated <script> bootstrapper');

function makeDomEnv(rt, customFetch) {
  const els = {};
  const created = [];
  const getEl = id => {
    if (id === 'local-runtime-cipher') return { textContent: rt.cipher };
    if (id === 'local-db-vault') return { textContent: rt.vault };
    if (!els[id]) {
      els[id] = {
        id,
        style: {},
        classList: {
          _set: new Set(),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); },
          toggle(c, force) {
            if (force === true) { this._set.add(c); return true; }
            if (force === false) { this._set.delete(c); return false; }
            if (this._set.has(c)) { this._set.delete(c); return false; }
            this._set.add(c); return true;
          }
        },
        value: '',
        textContent: '',
        _innerHTML: '',
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = String(v); if (!v) this.children = []; },
        disabled: true,
        children: [],
        append(...args) { this.children.push(...args); },
        appendChild(a) { this.children.push(a); },
        querySelectorAll(sel) {
          if (id === 'questions-container' && sel === '.q-card') return this.children;
          return [];
        },
        querySelector(sel) {
          if (sel === '.q-num-label') return { textContent: '' };
          if (sel === '.q-text') return { value: this._data?.q || '' };
          if (sel === '.q-corr') return { value: this._data?.correct || '' };
          if (sel === '.q-w1') return { value: this._data?.wrongs?.[0] || '' };
          if (sel === '.q-w2') return { value: this._data?.wrongs?.[1] || '' };
          if (sel === '.q-w3') return { value: this._data?.wrongs?.[2] || '' };
          if (sel === '.q-exp') return { value: this._data?.explanation || '' };
          return { value: '', textContent: '' };
        },
        scrollIntoView() {},
        onclick: null
      };
    }
    return els[id];
  };

  let lastBlobContent = null;
  class FakeBlob {
    constructor(parts) {
      this.content = parts.join('');
      lastBlobContent = this.content;
    }
  }

  const noop = () => {};
  const ctx = {
    fetch: customFetch || fetch,
    TextEncoder, TextDecoder, btoa, atob, crypto,
    Blob: FakeBlob,
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: noop },
    URLSearchParams,
    setInterval: noop, clearInterval: noop, setTimeout: fn => fn(), alert: noop, scrollTo: noop,
    window: { location: { search: '', pathname: '/', hash: '' }, addEventListener: noop, scrollTo: noop },
    location: { hash: '', search: '', pathname: '/' },
    history: { replaceState: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    document: {
      hidden: true,
      getElementById: getEl,
      createElement: tag => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          style: {},
          children: [],
          append(...args) {
            if (args[0] && args[0].className === 'top') {}
            this.children.push(...args);
          },
          appendChild(a) { this.children.push(a); },
          querySelector(sel) {
            const valOf = cls => {
              for (const lbl of this.children) {
                for (const ch of (lbl.children || [])) {
                  if (String(ch.className || '').includes(cls.slice(1))) return ch;
                }
              }
              return { value: '' };
            };
            if (sel === '.q-text') return valOf('.q-text');
            if (sel === '.q-corr') return valOf('.q-corr');
            if (sel === '.q-w1') return valOf('.q-w1');
            if (sel === '.q-w2') return valOf('.q-w2');
            if (sel === '.q-w3') return valOf('.q-w3');
            if (sel === '.q-exp') return valOf('.q-exp');
            return { value: '' };
          },
          click() {},
          scrollIntoView() {},
          remove() {},
          parentNode: { removeChild: noop }
        };
        created.push(el);
        return el;
      },
      addEventListener: noop,
      body: { appendChild: noop }
    }
  };
  ctx.globalThis = ctx;
  return { ctx: vm.createContext(ctx), els, getLastBlob: () => lastBlobContent };
}

(async () => {
  const idxEnv = makeDomEnv(idxRt);
  vm.runInContext(idxRt.boot, idxEnv.ctx);
  await new Promise(r => setTimeout(r, 1500));
  console.log('Hardened index.html live loadQuiz -> title:', idxEnv.els['title']?.textContent, '| go.disabled:', idxEnv.els['go']?.disabled);
  if (!idxEnv.els['title']?.textContent || idxEnv.els['go']?.disabled !== false) {
    throw new Error('Hardened index.html failed live loadQuiz!');
  }

  const tchEnv = makeDomEnv(tchRt);
  vm.runInContext(tchRt.boot, tchEnv.ctx);
  await new Promise(r => setTimeout(r, 1500));
  const dashRows = tchEnv.els['dash-list']?.children || [];
  if (dashRows.length < 2) throw new Error('Dashboard did not render Quiz 1 & Quiz 2 rows!');
  dashRows[0].children[0].onclick();
  await new Promise(r => setTimeout(r, 1500));
  console.log('Hardened teacher.html live Dashboard->Load Quiz 1 -> status:', tchEnv.els['status-msg']?.textContent, '| qtitle:', tchEnv.els['qtitle']?.value);
  if (!tchEnv.els['qtitle']?.value) {
    throw new Error('Hardened teacher.html failed to populate active quiz title!');
  }

  tchEnv.els['dl-quiz-btn'].onclick();
  await new Promise(r => setTimeout(r, 500));
  const downloadedHtml = tchEnv.getLastBlob();
  if (!downloadedHtml) throw new Error('Download Quiz File produced no blob!');
  const dlVaultMatch = /<script\s+id=["']local-db-vault["'][^>]*>([\s\S]*?)<\/script>/i.exec(downloadedHtml);
  console.log('Downloaded index.html injected #local-db-vault bytes:', dlVaultMatch ? dlVaultMatch[1].length : 0);
  if (!dlVaultMatch || dlVaultMatch[1].length < 50) {
    throw new Error('injectVault failed on hardened template!');
  }

  const offlineIdxRt = parseRuntime(downloadedHtml);
  const offlineEnv = makeDomEnv(offlineIdxRt, () => Promise.reject(new Error('offline')));
  vm.runInContext(offlineIdxRt.boot, offlineEnv.ctx);
  await new Promise(r => setTimeout(r, 500));
  console.log('Offline downloaded index.html vault decryption -> title:', offlineEnv.els['title']?.textContent, '| go.disabled:', offlineEnv.els['go']?.disabled);
  if (offlineEnv.els['title']?.textContent !== tchEnv.els['qtitle']?.value || offlineEnv.els['go']?.disabled !== false) {
    throw new Error('Offline vault fallback decryption mismatch!');
  }

  console.log('ALL HARDENED RUNTIME & OFFLINE VAULT TESTS PASSED!');
})();
