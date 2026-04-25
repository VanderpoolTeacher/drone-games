import { CONFIG } from '../config.js';

// Module-load fetch of CHANGELOG.md so the overlay has data ready by the
// first Shift+C press. Falls back to a placeholder line if the fetch fails
// (e.g. opening index.html via file:// — fetch is blocked there).
let entries = [{ version: 'loading…', lines: [] }];
fetch('./CHANGELOG.md')
  .then(r => r.text())
  .then(text => { entries = parseChangelog(text); })
  .catch(() => { entries = [{ version: '(changelog unavailable)', lines: [] }]; });

function parseChangelog(md) {
  const out = [];
  let cur = null;
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('## ')) {
      if (cur) out.push(cur);
      cur = { version: line.slice(3).trim(), lines: [] };
    } else if (cur && /^[-*]\s/.test(line)) {
      cur.lines.push(line.replace(/^[-*]\s+/, ''));
    } else if (cur && /^\s{2,}/.test(line) && cur.lines.length) {
      // Continuation of the previous bullet — collapse leading whitespace.
      cur.lines[cur.lines.length - 1] += ' ' + line.trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function renderChangelog(ctx) {
  const W = 440, H = 240;
  const x = Math.round((CONFIG.virtualWidth - W) / 2);
  const y = Math.round((CONFIG.virtualHeight - H) / 2);
  ctx.save();
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, W, H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('CHANGELOG', x + W / 2, y + 8);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  const lineH = 9;
  const maxY = y + H - 18;
  let ly = y + 24;
  for (const entry of entries) {
    if (ly + lineH > maxY) break;
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillText(entry.version, x + 12, ly);
    ly += lineH;
    for (const text of entry.lines) {
      const wrapped = wrap(text, 64);
      for (let i = 0; i < wrapped.length; i++) {
        if (ly + lineH > maxY) { ctx.restore(); return; }
        ctx.fillStyle = CONFIG.colors.accentWhite;
        const prefix = i === 0 ? '* ' : '  ';
        ctx.fillText(prefix + wrapped[i], x + 16, ly);
        ly += lineH;
      }
    }
    ly += 3;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('SHIFT+C OR ESC TO CLOSE', x + W / 2, y + H - 12);
  ctx.restore();
}

function wrap(s, width) {
  const out = [];
  const words = s.split(/\s+/);
  let line = '';
  for (const w of words) {
    if (!line) { line = w; continue; }
    if (line.length + 1 + w.length <= width) line += ' ' + w;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}
