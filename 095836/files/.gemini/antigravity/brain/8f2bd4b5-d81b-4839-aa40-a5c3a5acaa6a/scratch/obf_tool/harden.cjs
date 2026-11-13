const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JavaScriptObfuscator = require('./node_modules/javascript-obfuscator');

const WORKSPACE = 'C:\\Users\\CxAdmin\\Desktop\\Exploit';

const innerOpts = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 4,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  selfDefending: false,
  debugProtection: false
};

const bootOpts = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.5,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 4,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 1,
  selfDefending: false,
  debugProtection: false
};

function sealBytes(text, key, nonce) {
  const bytes = new TextEncoder().encode(text);
  const fk = Array.from(key).concat(Array.from(nonce));
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + fk[i % fk.length]) & 255;
    const t = s[i]; s[i] = s[j]; s[j] = t;
  }
  const enc = new Uint8Array(bytes.length);
  let p = 0, q = 0;
  for (let i = 0; i < bytes.length; i++) {
    p = (p + 1) & 255;
    q = (q + s[p]) & 255;
    const t = s[p]; s[p] = s[q]; s[q] = t;
    enc[i] = bytes[i] ^ s[(s[p] + s[q]) & 255];
  }
  const combined = Buffer.concat([Buffer.from(nonce), Buffer.from(enc)]);
  return combined.toString('base64');
}

function hardenFile(filename) {
  const targetPath = path.join(WORKSPACE, filename);
  const src = fs.readFileSync(targetPath, 'utf8');
  const scriptStart = src.lastIndexOf('<script>');
  const scriptEnd = src.lastIndexOf('</script>');
  if (scriptStart === -1 || scriptEnd === -1 || scriptEnd <= scriptStart) {
    throw new Error('Could not find inline script in ' + filename);
  }
  const innerCode = src.slice(scriptStart + 8, scriptEnd);
  const innerObf = JavaScriptObfuscator.obfuscate(innerCode, innerOpts).getObfuscatedCode();

  const key = crypto.randomBytes(16);
  const mask = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(8);
  const masked = Array.from(key).map((b, i) => b ^ mask[i]);
  const cipherB64 = sealBytes(innerObf, key, nonce);

  const bootSrc = `(function(){const el=document.getElementById('local-runtime-cipher');if(!el)return;const m=[${Array.from(mask).join(',')}];const e=[${masked.join(',')}];const k=new Array(16);for(let i=0;i<16;i++)k[i]=(m[i]^e[i])&255;const bin=atob(el.textContent.trim());const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);const n=b.slice(0,8),c=b.slice(8),fk=k.concat(Array.from(n));const s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;let j=0;for(let i=0;i<256;i++){j=(j+s[i]+fk[i%fk.length])&255;const t=s[i];s[i]=s[j];s[j]=t}const o=new Uint8Array(c.length);let p=0,q=0;for(let i=0;i<c.length;i++){p=(p+1)&255;q=(q+s[p])&255;const t=s[p];s[p]=s[q];s[q]=t;o[i]=c[i]^s[(s[p]+s[q])&255]}(new Function(new TextDecoder().decode(o)))();})();`;

  const bootObf = JavaScriptObfuscator.obfuscate(bootSrc, bootOpts).getObfuscatedCode();
  if (bootObf.toLowerCase().includes('</script')) {
    throw new Error('Bootstrap unexpectedly contains closing script tag');
  }

  const outHtml = src.slice(0, scriptStart) +
    '<script id="local-runtime-cipher" type="application/octet-stream">' + cipherB64 + '</script>\n  <script>' + bootObf + '</script>' +
    src.slice(scriptEnd + 9);

  if (Buffer.byteLength(outHtml, 'utf8') >= 900000) {
    throw new Error(filename + ' exceeded 900KB safety ceiling: ' + Buffer.byteLength(outHtml, 'utf8'));
  }

  fs.writeFileSync(targetPath, outHtml, 'utf8');
  console.log(filename, 'hardened cleanly:', 'inner=', innerObf.length, 'boot=', bootObf.length, 'totalBytes=', Buffer.byteLength(outHtml, 'utf8'));
}

hardenFile('index.html');
hardenFile('teacher.html');
