(() => {
  "use strict";
  let currentTheme = null;

  function mixColors(hex1, hex2, weight) {
    try {
      if (!hex1 || hex1.includes('gradient') || !hex2 || hex2.includes('gradient')) return hex1 || '#333333';
      const h1 = hex1.replace('#',''), h2 = hex2.replace('#','');
      const r1 = parseInt(h1.substring(0,2), 16), g1 = parseInt(h1.substring(2,4), 16), b1 = parseInt(h1.substring(4,6), 16);
      const r2 = parseInt(h2.substring(0,2), 16), g2 = parseInt(h2.substring(2,4), 16), b2 = parseInt(h2.substring(4,6), 16);
      return `#${Math.round(r1*(1-weight)+r2*weight).toString(16).padStart(2,'0')}${Math.round(g1*(1-weight)+g2*weight).toString(16).padStart(2,'0')}${Math.round(b1*(1-weight)+b2*weight).toString(16).padStart(2,'0')}`;
    } catch(e) { return hex1 || '#333333'; }
  }

  function injectThemeCSS(theme) {
    let styleEl = document.getElementById('dsnx-theme-override');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dsnx-theme-override'; document.head.appendChild(styleEl); }
    const bg = theme.bg || '#0a0a0a', surface = theme.surface || '#141414', text = theme.text || '#ffffff', accent = theme.accent || '#4d7cfe';
    const border = mixColors(surface, '#ffffff', 0.1);
    const isGradient = (val) => val.includes('gradient');
    const bgStyle = isGradient(bg) ? `background: ${bg} !important;` : `background-color: ${bg} !important;`;
    const surfaceStyle = isGradient(surface) ? `background: ${surface} !important;` : `background-color: ${surface} !important;`;
    const accentStyle = isGradient(accent) ? `background: ${accent} !important;` : `background-color: ${accent} !important;`;

    styleEl.innerHTML = `
      html, body, #root, main, .ds-layout, .ds-container, .ds-main, aside, nav, header { ${bgStyle} color: ${text} !important; }
      [class*="bg-white"], [class*="bg-gray-"], [class*="bg-zinc-"], [class*="bg-neutral-"], [class*="bg-[#2"], [class*="bg-[#3"], [role="dialog"], .ds-card, .ds-message, .ds-message-content { ${surfaceStyle} color: ${text} !important; border-color: ${border} !important; }
      textarea, input, .ProseMirror, [contenteditable="true"] { ${surfaceStyle} color: ${text} !important; border-color: ${border} !important; }
      .bg-primary, button[type="submit"], [class*="bg-blue-"], [class*="bg-[#4d7cfe"], button[class*="bg-"]:not([class*="bg-transparent"]) { ${accentStyle} color: #ffffff !important; border-color: ${accent} !important; }
      p, span, h1, h2, h3, h4, h5, h6, li, a, .ds-markdown, .ds-markdown * { color: ${text} !important; }
      .text-gray-500, .text-gray-400, .text-muted-foreground, [class*="text-gray-"] { color: ${mixColors(text, bg, 0.6)} !important; }
    `;
  }

  async function applyTheme() {
    try {
      const data = await chrome.storage.local.get('dsnx_theme');
      if (data.dsnx_theme) {
        currentTheme = data.dsnx_theme;
        const root = document.documentElement;
        root.style.setProperty('--ds-accent', currentTheme.accent || '#4d7cfe');
        root.style.setProperty('--ds-bg-base', currentTheme.bg || '#0a0a0a');
        root.style.setProperty('--ds-bg-card', currentTheme.surface || '#141414');
        root.style.setProperty('--ds-text-primary', currentTheme.text || '#ffffff');
        injectThemeCSS(currentTheme);
      } else {
        const styleEl = document.getElementById('dsnx-theme-override');
        if (styleEl) styleEl.remove();
      }
    } catch (e) {}
  }

  function injectSettingsMenu() {
    try {
      const modal = document.querySelector('[data-shortcut-modal="settings"]') || document.querySelector('div[role="dialog"][aria-modal="true"]') || document.querySelector('div[role="dialog"]');
      if (!modal || modal.dataset.dsnxThemed) return;

      const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT, null, false);
      let generalTextNode = null, node;
      while (node = walker.nextNode()) { if (node.nodeValue.trim() === 'General') { generalTextNode = node; break; } }
      if (!generalTextNode) return;

      let navItem = generalTextNode.parentElement;
      while (navItem && navItem !== modal && !navItem.classList.contains('cursor-pointer') && navItem.getAttribute('role') !== 'button' && navItem.tagName !== 'BUTTON') navItem = navItem.parentElement;
      if (!navItem || navItem === modal) navItem = generalTextNode.parentElement;

      const navContainer = navItem.parentElement;
      if (!navContainer || navContainer.querySelector('.dsnx-themes-btn')) return;

      const themeBtn = document.createElement('button');
      themeBtn.className = (navItem.className || '');
      themeBtn.style.cssText = "display:flex; align-items:center; width:100%; padding:8px 12px; border:none; background:transparent; color:inherit; cursor:pointer; border-radius:6px; margin-top:4px; font-size:14px;";
      themeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
        <span style="margin-left:12px;">Themes</span>
      `;

      themeBtn.addEventListener('click', (e) => { e.stopPropagation(); openThemeEditor(modal); });
      navContainer.appendChild(themeBtn);
      modal.dataset.dsnxThemed = "1";
    } catch (e) {}
  }

  function openThemeEditor(modal) {
    let editor = modal.querySelector('.dsnx-theme-editor');
    if (editor) { editor.style.display = 'flex'; return; }
    if (getComputedStyle(modal).position === 'static') modal.style.position = 'relative';

    editor = document.createElement('div');
    editor.className = 'dsnx-theme-editor';
    editor.style.cssText = "position:absolute; inset:0; background:var(--ds-bg-base); z-index:9999; display:flex; flex-direction:column; padding:2rem; border-radius:inherit; overflow-y:auto; font-family:var(--ds-font); animation: dsnxFadeIn 0.3s var(--ds-ease);";

    const createField = (label, id, value) => `
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; font-weight:600; color:var(--ds-text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">${label}</label>
        <div style="display:flex; gap:8px;">
          <input type="color" id="${id}-picker" value="${value && value.startsWith('#') ? value : '#000000'}" style="width:36px; height:36px; border:none; border-radius:6px; cursor:pointer; padding:0; background:transparent;">
          <input type="text" id="${id}-text" value="${value || ''}" style="flex:1; padding:8px 12px; background:var(--ds-bg-card); border:1px solid var(--ds-border); border-radius:6px; color:var(--ds-text-primary); font-family:monospace; font-size:13px;">
        </div>
      </div>
    `;

    editor.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:20px; font-weight:600; color:var(--ds-text-primary);">Nexus Appearance</h2>
        <button id="dsnx-close-theme" style="background:transparent; border:none; color:var(--ds-text-secondary); cursor:pointer; font-size:24px; transition: 0.2s;">&times;</button>
      </div>
      <div style="flex:1;">
        <div style="margin-bottom:24px; background:var(--ds-bg-card); padding:20px; border-radius:8px; border:1px solid var(--ds-border);">
          <label style="display:block; font-weight:600; margin-bottom:12px; color:var(--ds-text-primary);">Dynamic Color Extraction</label>
          <input type="file" id="dsnx-theme-file" accept="image/*" style="display:block; width:100%; padding:12px; border:2px dashed var(--ds-border); border-radius:8px; color:var(--ds-text-primary);" />
          <p style="font-size:11px; color:var(--ds-text-secondary); margin-top:8px;">Pick an image, we will extract a solid color.</p>
        </div>
        ${createField('Background', 'dsnx-c-bg', currentTheme?.bg || '#0a0a0a')}
        ${createField('Surface / Cards', 'dsnx-c-surface', currentTheme?.surface || '#141414')}
        ${createField('Accent / Buttons', 'dsnx-c-accent', currentTheme?.accent || '#4d7cfe')}
        ${createField('Text Color', 'dsnx-c-text', currentTheme?.text || '#ffffff')}
      </div>
      <div style="margin-top:24px; display:flex; gap:12px;">
        <button id="dsnx-apply-theme" style="flex:1; padding:12px; background:var(--ds-accent); color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; transition: 0.2s;">Apply Theme</button>
        <button id="dsnx-reset-theme" style="padding:12px; background:transparent; border:1px solid var(--ds-border); color:var(--ds-text-primary); border-radius:8px; cursor:pointer; font-weight:600; transition: 0.2s;">Reset</button>
      </div>
    `;
    
    modal.appendChild(editor);

    editor.querySelector('#dsnx-close-theme').onclick = () => { editor.style.display = 'none'; };
    ['bg', 'surface', 'accent', 'text'].forEach(key => {
      const picker = editor.querySelector(`#dsnx-c-${key}-picker`);
      const text = editor.querySelector(`#dsnx-c-${key}-text`);
      picker.addEventListener('input', () => { text.value = picker.value; });
      text.addEventListener('input', () => { if (text.value.startsWith('#')) picker.value = text.value; });
    });

    editor.querySelector('#dsnx-theme-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 50; canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);
          const data = ctx.getImageData(0, 0, 50, 50).data;
          let maxSat = 0, best = { r: 77, g: 124, b: 254 };
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const l = (max + min) / 2;
            const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
            if (s > maxSat && l > 0.2 && l < 0.8) { maxSat = s; best = { r, g, b }; }
          }
          const hex = `#${best.r.toString(16).padStart(2,'0')}${best.g.toString(16).padStart(2,'0')}${best.b.toString(16).padStart(2,'0')}`;
          editor.querySelector('#dsnx-c-accent-picker').value = hex;
          editor.querySelector('#dsnx-c-accent-text').value = hex;
          const bgHex = mixColors(hex, '#000000', 0.9);
          editor.querySelector('#dsnx-c-bg-picker').value = bgHex;
          editor.querySelector('#dsnx-c-bg-text').value = bgHex;
          const surfHex = mixColors(hex, '#000000', 0.8);
          editor.querySelector('#dsnx-c-surface-picker').value = surfHex;
          editor.querySelector('#dsnx-c-surface-text').value = surfHex;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    editor.querySelector('#dsnx-apply-theme').onclick = async () => {
      const newTheme = {
        accent: editor.querySelector('#dsnx-c-accent-text').value,
        bg: editor.querySelector('#dsnx-c-bg-text').value,
        surface: editor.querySelector('#dsnx-c-surface-text').value,
        text: editor.querySelector('#dsnx-c-text-text').value
      };
      await chrome.storage.local.set({ dsnx_theme: newTheme });
      currentTheme = newTheme;
      applyTheme();
      editor.style.display = 'none';
    };

    editor.querySelector('#dsnx-reset-theme').onclick = async () => {
      await chrome.storage.local.remove('dsnx_theme');
      currentTheme = null;
      applyTheme();
      editor.style.display = 'none';
    };
  }

  applyTheme();
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.dsnx_theme) applyTheme();
  });
  setInterval(injectSettingsMenu, 1000);
})();