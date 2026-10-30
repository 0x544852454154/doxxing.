// Runs qa1.mjs against index.html using the already-installed chromium-1248,
// instead of letting patchright demand chromium-1243 (whose download failed).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const chrome = process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
let src = fs.readFileSync('C:\\Users\\eunso\\.codegpt\\skills\\browser-automation\\browser.mjs', 'utf8');
src = src.replace(
  /browser = await chromium\.launch\(\{[\s\S]*?\}\)/,
  `browser = await chromium.launch({ headless: true, executablePath: ${JSON.stringify(chrome)}, args: ['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'] })`
);
src = src.replace(/resolveChromium/g, 'resolveChromiumX');
fs.mkdirSync('.qa', { recursive: true });
fs.writeFileSync('.qa/browser-b.mjs', src);
fs.writeFileSync('.qa/qa1.mjs', fs.readFileSync('qa1.mjs'));
process.chdir('.qa');
process.argv = [process.argv[0], 'browser-b.mjs', 'file:///c:/Users/eunso/Documents/doxxing.site/index.html', '--script', './qa1.mjs'];
await import(pathToFileURL(process.cwd() + '/browser-b.mjs').href);
