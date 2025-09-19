const fs = require('fs');
const path = require('path');
const terser = require('terser');

(async () => {
  const srcPath = path.join(__dirname, 'scripts/visited-improved.user.js');
  const outDirMin = path.join(__dirname, 'scripts-min');
  const outPathMin = path.join(outDirMin, 'visited-improved-min.user.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const lines = src.split(/\r?\n/);
  let headerEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('==/UserScript==')) { headerEnd = i; break; }
  }
  if (headerEnd === -1) throw new Error('Userscript header end not found');
  const header = lines.slice(0, headerEnd + 1).join('\n');
  const headerMin = (() => {
    const hs = header.split(/\r?\n/).map(line => {
      if (/^\/\/\s*@updateURL\b/.test(line) || /^\/\/\s*@downloadURL\b/.test(line)) {
        return line.replace(/\/scripts\/visited-improved\.user\.js\b/, '/scripts-min/visited-improved-min.user.js');
      }
      return line;
    });
    return hs.join('\n');
  })();
  const body = lines.slice(headerEnd + 1).join('\n');
  const min = await terser.minify(body, {
    compress: {
      passes: 2,
      ecma: 2019,
      hoist_funs: true,
      hoist_vars: true,
      unsafe: true,
      unsafe_arrows: true
    },
    mangle: true,
    ecma: 2019,
    format: {
      comments: false
    }
  });
  if (min.error) throw min.error;
  // ensure output directory exists
  if (!fs.existsSync(outDirMin)) fs.mkdirSync(outDirMin, { recursive: true });

  // write minified distributable with .user.js extension
  fs.writeFileSync(outPathMin, headerMin + '\n' + min.code + '\n');
  console.log('Minified ->', path.relative(process.cwd(), outPathMin));
})();
