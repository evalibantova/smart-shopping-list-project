#!/usr/bin/env node
// Install Debian packages needed for headless Chromium in the container.
// Run once per container session; /tmp/ is wiped on restart.
// Usage: node /tmp/install-chrome-libs.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const LIBS_DIR = '/tmp/chrome-libs';
const DEBS_DIR = '/tmp/chrome-debs';
const FONTS_CONF = '/tmp/chrome-fonts.conf';

const DEBIAN_MIRROR = 'http://deb.debian.org/debian';
const SUITE = 'trixie';
const ARCH = 'amd64';

// NOTE: Debian trixie renamed several packages with a "t64" suffix.
// libglib2.0-0, libatk1.0-0, libatk-bridge2.0-0, libatspi2.0-0, libasound2, libgtk-3-0
// are now libglib2.0-0t64, libatk1.0-0t64, libatk-bridge2.0-0t64, libatspi2.0-0t64,
// libasound2t64, libgtk-3-0t64. The list below uses the trixie names.
const PACKAGES = [
  'libx11-6', 'libx11-data', 'libxcb1', 'libxext6', 'libxcomposite1',
  'libxcursor1', 'libxdamage1', 'libxfixes3', 'libxi6', 'libxinerama1',
  'libxrandr2', 'libxrender1', 'libxss1', 'libxtst6', 'libxkbcommon0',
  'libxau6', 'libxdmcp6',
  'libatk1.0-0t64', 'libatk-bridge2.0-0t64', 'libatspi2.0-0t64',
  'libglib2.0-0t64', 'libpango-1.0-0', 'libpangocairo-1.0-0',
  'libcairo2', 'libcairo-gobject2',
  'libgdk-pixbuf-2.0-0', 'libgtk-3-0t64',
  'libnss3', 'libnspr4',
  'libasound2t64', 'libdrm2', 'libgbm1',
  'libdbus-1-3', 'libexpat1', 'libffi8',
  'fonts-dejavu-core',
  'libfontconfig1', 'libfreetype6',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https : http;
    get.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

async function getPackageUrls() {
  const packagesUrl = `${DEBIAN_MIRROR}/dists/${SUITE}/main/binary-${ARCH}/Packages.gz`;
  const tmpGz = '/tmp/Packages.gz';
  console.log('Fetching package index...');
  await download(packagesUrl, tmpGz);
  // Write decompressed output to a file to avoid execSync ENOBUFS on large output
  execSync(`zcat ${tmpGz} > /tmp/Packages.txt`, { stdio: 'pipe', maxBuffer: 100 * 1024 * 1024 });
  const raw = fs.readFileSync('/tmp/Packages.txt', 'utf8');
  const urls = {};
  let current = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('Package: ')) current = line.slice(9).trim();
    if (line.startsWith('Filename: ') && current && PACKAGES.includes(current)) {
      urls[current] = `${DEBIAN_MIRROR}/${line.slice(10).trim()}`;
    }
  }
  return urls;
}

async function main() {
  fs.mkdirSync(LIBS_DIR, { recursive: true });
  fs.mkdirSync(DEBS_DIR, { recursive: true });

  const urls = await getPackageUrls();
  const missing = PACKAGES.filter(p => !urls[p]);
  if (missing.length) console.warn('Could not find packages:', missing.join(', '));

  for (const [pkg, url] of Object.entries(urls)) {
    const debFile = path.join(DEBS_DIR, `${pkg}.deb`);
    if (!fs.existsSync(debFile)) {
      process.stdout.write(`Downloading ${pkg}... `);
      try {
        await download(url, debFile);
        console.log('ok');
      } catch (e) {
        console.log(`FAILED: ${e.message}`);
        continue;
      }
    }
    try {
      execSync(`dpkg-deb -x ${debFile} ${LIBS_DIR}`, { stdio: 'pipe' });
    } catch (e) {
      console.warn(`Failed to extract ${pkg}: ${e.message}`);
    }
  }

  // Write fontconfig pointing at extracted fonts
  fs.writeFileSync(FONTS_CONF, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${LIBS_DIR}/usr/share/fonts</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
</fontconfig>`);

  console.log('\nLib install complete. Verify with:');
  console.log(`node -e "require('fs').existsSync('${LIBS_DIR}/usr/lib/x86_64-linux-gnu/libX11.so.6') && console.log('OK')"`);
}

main().catch(e => { console.error(e); process.exit(1); });
