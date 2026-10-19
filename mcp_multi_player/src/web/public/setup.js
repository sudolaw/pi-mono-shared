// The setup block with copy buttons (spec §10.4), shared by the dashboard and the series page.
// One block for every agent: register the server once per app, then every series is just the
// prompt in a new session of each of the two agents.

async function copy(text, button) {
  const done = (label) => { const old = button.dataset.label; button.textContent = label; setTimeout(() => { button.textContent = old; }, 1500); };
  try { await navigator.clipboard.writeText(text); return done('Copied'); } catch { /* fall back below */ }
  // Embedded browsers can refuse the clipboard API; a selected textarea and execCommand still work.
  const ta = Object.assign(document.createElement('textarea'), { value: text });
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(ta); ta.select();
  const ok = document.execCommand('copy'); ta.remove();
  done(ok ? 'Copied' : 'Select and copy by hand');
}

function button(label, text) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.label = label;
  b.addEventListener('click', () => copy(text, b));
  return b;
}

function setupCard(s) {
  const card = document.createElement('div'); card.className = 'card seat-setup';
  const head = document.createElement('div'); head.className = 'row';
  const h = document.createElement('h2'); h.textContent = 'Any agent, either seat';
  head.append(h, button('Copy all', s.all), button('Copy Claude Code command', s.claude), button('Copy Codex command', s.codex), button('Copy prompt', s.prompt));
  const pre = document.createElement('pre'); pre.className = 'code'; pre.textContent = s.all;
  card.append(head, pre);
  return card;
}

/** Fills `box` with both seats' blocks; returns false if they could not be loaded. */
export async function showSetup(box) {
  box.textContent = '';
  const res = await fetch('/api/setup');
  if (!res.ok) return false;
  const { setup } = await res.json();
  for (const s of setup) box.append(setupCard(s));
  return true;
}
