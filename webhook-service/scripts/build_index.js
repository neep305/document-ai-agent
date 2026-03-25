/**
 * build_index.js — regenerate public/index.html (3-tab UI)
 * Run: node scripts/build_index.js  (from webhook-service/ root)
 */
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'index.html');

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tagging AI v2.0</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-base: #070912;
      --bg-2:    #0D1424;
      --bg-3:    #121D33;
      --bg-4:    #18243D;
      --border:    rgba(148,163,184,0.09);
      --border-md: rgba(148,163,184,0.14);
      --border-b:  rgba(59,130,246,0.38);
      --border-g:  rgba(16,185,129,0.32);
      --border-r:  rgba(239,68,68,0.32);
      --text:  #E2E8F0;
      --text-2: #94A3B8;
      --text-3: #475569;
      --blue:    #3B82F6; --blue-l:   #60A5FA;
      --cyan:    #06B6D4; --cyan-l:   #22D3EE;
      --green:   #10B981; --green-l:  #34D399;
      --amber:   #F59E0B; --amber-l:  #FCD34D;
      --red:     #EF4444; --red-l:    #FCA5A5;
      --purple:  #8B5CF6; --purple-l: #A78BFA;
      --r:    10px;
      --r-lg: 14px;
      --r-sm:  6px;
    }

    [data-theme="light"] {
      --bg-base: #F0F4FC;
      --bg-2:    #FFFFFF;
      --bg-3:    #F1F5FB;
      --bg-4:    #E4EBF7;
      --border:    rgba(30,58,138,0.08);
      --border-md: rgba(30,58,138,0.13);
      --border-b:  rgba(37,99,235,0.35);
      --border-g:  rgba(5,150,105,0.28);
      --border-r:  rgba(220,38,38,0.28);
      --text:  #1E293B;
      --text-2: #475569;
      --text-3: #94A3B8;
      --blue:   #2563EB; --blue-l:  #1D4ED8;
      --cyan:   #0891B2; --cyan-l:  #0E7490;
      --green:  #059669; --green-l: #047857;
      --amber:  #D97706; --amber-l: #B45309;
      --red:    #DC2626; --red-l:   #B91C1C;
      --purple: #7C3AED; --purple-l: #6D28D9;
    }
    [data-theme="light"] body {
      background-image:
        radial-gradient(ellipse 80% 40% at 15% 5%, rgba(99,102,241,0.05) 0%, transparent 100%),
        radial-gradient(ellipse 60% 50% at 85% 85%, rgba(139,92,246,0.03) 0%, transparent 100%);
    }
    [data-theme="light"] .site-header {
      background: linear-gradient(135deg, #E9EEFF 0%, #DDE5FF 100%);
      border-color: rgba(99,102,241,0.14);
    }
    [data-theme="light"] .brand h1 { color: #1E293B; }
    [data-theme="light"] .brand h1 em { color: #2563EB; }
    [data-theme="light"] .brand p { color: rgba(30,40,80,0.45); }
    [data-theme="light"] .tab-nav { background: #fff; }
    [data-theme="light"] .tab-btn:hover { background: #F1F5FB; }
    [data-theme="light"] input[type="text"],
    [data-theme="light"] select,
    [data-theme="light"] textarea { background: #fff; color: #1E293B; }
    [data-theme="light"] .drop-zone { background: #F8FAFF; border-color: rgba(30,58,138,0.14); }
    [data-theme="light"] .drop-zone:hover { background: #EEF2FF; }
    [data-theme="light"] .theme-toggle { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
    [data-theme="light"] .theme-toggle:hover { background: rgba(0,0,0,0.09); }
    [data-theme="light"] .tt-label { color: rgba(0,0,30,0.28); }
    [data-theme="light"] .tt-label.active { background: rgba(0,0,0,0.07); color: #1E293B; }
    [data-theme="light"] .tt-sep { color: rgba(0,0,0,0.15); }
    [data-theme="light"] .step-num { background: #F1F5FB; color: #64748B; }
    [data-theme="light"] .step-card { background: #F8FAFF; }
    [data-theme="light"] .step-item.active .step-card { background: #EEF2FF; }
    [data-theme="light"] .stat-box { background: #F8FAFF; }
    [data-theme="light"] .stat-n { color: #2563EB; }
    [data-theme="light"] .job-resume-btn { background: rgba(37,99,235,0.06); }
    [data-theme="light"] .job-delete-btn { background: #fff; }
    [data-theme="light"] .btn-sm { background: #F1F5FB; color: #475569; }
    [data-theme="light"] .btn-sm:hover { background: #E4EBF7; color: #1E293B; }
    [data-theme="light"] .n8n-mode-btn.mode-production { color: #059669; border-color: rgba(5,150,105,0.4); }
    [data-theme="light"] .n8n-mode-btn.mode-test { color: #d97706; border-color: rgba(217,119,6,0.4); background: rgba(217,119,6,0.05); }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-base);
      background-image:
        radial-gradient(ellipse 80% 40% at 15% 5%, rgba(59,130,246,0.07) 0%, transparent 100%),
        radial-gradient(ellipse 60% 50% at 85% 85%, rgba(139,92,246,0.05) 0%, transparent 100%);
      background-attachment: fixed;
      color: var(--text);
      min-height: 100vh;
      padding: 24px 20px 48px;
      line-height: 1.6;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── HEADER ── */
    .site-header {
      background: linear-gradient(135deg, #0C1526 0%, #152038 100%);
      border: 1px solid rgba(59,130,246,0.16);
      border-radius: var(--r-lg);
      padding: 22px 28px;
      position: relative;
      overflow: hidden;
    }
    .site-header::before {
      content: ''; position: absolute; top: -60px; right: -60px;
      width: 220px; height: 220px;
      background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%);
      pointer-events: none;
    }
    .header-row {
      display: flex; align-items: center; justify-content: space-between;
      position: relative; z-index: 1;
    }
    .brand h1 { font-size: 19px; font-weight: 800; color: #fff; letter-spacing: -0.4px; }
    .brand h1 em { font-style: normal; color: var(--blue-l); }
    .brand p { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 3px; font-weight: 500; }
    .live-badge {
      display: flex; align-items: center; gap: 6px; padding: 5px 12px;
      background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.22);
      border-radius: 20px; font-size: 10px; font-weight: 800;
      color: var(--green-l); letter-spacing: 0.08em;
    }
    .pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--green-l); animation: pulse 2s infinite; }

    /* ── TAB NAV ── */
    .tab-nav {
      background: var(--bg-2); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: 5px; display: flex; gap: 4px;
    }
    .tab-btn {
      flex: 1; padding: 11px 12px; border: 1px solid transparent;
      border-radius: var(--r); font-size: 13px; font-weight: 700; cursor: pointer;
      background: transparent; color: var(--text-3);
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: all 0.2s; font-family: inherit; letter-spacing: 0.01em;
    }
    .tab-btn:hover { background: var(--bg-3); color: var(--text-2); }
    .tab-btn.active.sdr  { background: rgba(59,130,246,0.11); border-color: rgba(59,130,246,0.22); color: var(--blue-l); }
    .tab-btn.active.tsd  { background: rgba(6,182,212,0.11);  border-color: rgba(6,182,212,0.22);  color: var(--cyan-l); }
    .tab-btn.active.tags { background: rgba(139,92,246,0.11); border-color: rgba(139,92,246,0.22); color: var(--purple-l); }
    .t-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .tab-btn.active.sdr  .t-dot { background: var(--blue-l);   box-shadow: 0 0 6px var(--blue); }
    .tab-btn.active.tsd  .t-dot { background: var(--cyan-l);   box-shadow: 0 0 6px var(--cyan); }
    .tab-btn.active.tags .t-dot { background: var(--purple-l); box-shadow: 0 0 6px var(--purple); }
    .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 50%;
      font-size: 10px; font-weight: 800; background: rgba(255,255,255,0.06);
    }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* ── CARD ── */
    .card { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px 24px; }
    .card + .card { margin-top: 12px; }
    .card-head { display: flex; align-items: center; gap: 11px; margin-bottom: 20px; }
    .card-ico { width: 34px; height: 34px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .ico-sdr  { background: rgba(59,130,246,0.14); }
    .ico-tsd  { background: rgba(6,182,212,0.14);  }
    .ico-tags { background: rgba(139,92,246,0.14); }
    .ico-hist { background: rgba(148,163,184,0.07); }
    .ico-done { background: rgba(16,185,129,0.11); }
    .card-head-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .card-head-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    /* ── FORM ── */
    .form-group { margin-bottom: 16px; }
    .field-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-2); margin-bottom: 6px; }
    input[type="text"], select, textarea {
      width: 100%; padding: 10px 14px; background: var(--bg-3);
      border: 1px solid var(--border-md); border-radius: var(--r);
      color: var(--text); font-size: 13px; font-family: inherit;
      transition: border 0.2s; appearance: none;
    }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    textarea { height: 110px; font-family: 'JetBrains Mono', monospace; font-size: 12px; resize: vertical; line-height: 1.5; }
    .hint { font-size: 11px; color: var(--text-3); margin-top: 5px; }

    /* ── BUTTONS ── */
    .btn-primary {
      width: 100%; padding: 13px 16px; border-radius: var(--r); border: none; cursor: pointer;
      color: white; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: opacity 0.2s, transform 0.1s; font-family: inherit;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .btn-sdr  { background: linear-gradient(135deg, #1e3a5f, var(--blue)); }
    .btn-tsd  { background: linear-gradient(135deg, #0e3a5c, var(--cyan)); }
    .btn-tags { background: linear-gradient(135deg, #3b1e78, var(--purple)); }

    /* ── DROP ZONE ── */
    .drop-zone {
      border: 1.5px dashed var(--border-md); border-radius: var(--r);
      padding: 28px 20px; text-align: center; cursor: pointer;
      transition: border-color 0.2s, background 0.2s; background: var(--bg-3); position: relative;
    }
    .drop-zone:hover, .drop-zone.dragover { border-color: var(--blue); background: rgba(59,130,246,0.05); }
    .drop-zone input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
    .dz-ico { font-size: 28px; display: block; margin-bottom: 8px; }
    .dz-label { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .dz-sub   { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .drop-zone.has-file { border-color: var(--green); background: rgba(16,185,129,0.05); }
    .file-info {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px;
      background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);
      border-radius: var(--r); margin-top: 10px;
    }
    .fi-name { font-size: 13px; font-weight: 600; color: var(--green-l); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fi-size { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
    .fi-remove { font-size: 15px; cursor: pointer; color: var(--text-3); flex-shrink: 0; }
    .fi-remove:hover { color: var(--red-l); }

    /* ── SDR PILL ── */
    .sdr-data-pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      border-radius: 20px; font-size: 12px; font-weight: 600;
      background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.22);
      color: var(--green-l); margin-bottom: 12px;
    }
    .sdr-data-pill.missing { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.22); color: var(--amber-l); }

    /* ── ALERT ── */
    .alert { padding: 11px 14px; border-radius: var(--r); font-size: 13px; display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; line-height: 1.5; }
    .alert.error   { background: rgba(239,68,68,0.09);  border: 1px solid var(--border-r); color: var(--red-l); }
    .alert.success { background: rgba(16,185,129,0.09); border: 1px solid var(--border-g); color: var(--green-l); }
    .alert.info    { background: rgba(59,130,246,0.09); border: 1px solid var(--border-b); color: var(--blue-l); }
    .alert.warning  { background: rgba(245,158,11,0.09); border: 1px solid rgba(245,158,11,0.38); color: var(--amber-l); }

    /* ── PROGRESS ── */
    .progress-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .timer-pill {
      display: flex; align-items: center; gap: 6px; padding: 4px 12px;
      background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 20px;
    }
    .timer-lbl { font-size: 10px; color: var(--text-3); font-weight: 700; letter-spacing: 0.06em; }
    .timer-val { font-size: 13px; font-weight: 800; color: var(--blue-l); font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
    .steps-list { display: flex; flex-direction: column; gap: 6px; }
    .step-item {
      display: flex; align-items: flex-start; gap: 14px; padding: 12px 14px;
      border-radius: var(--r); border: 1px solid var(--border); background: var(--bg-3); transition: all 0.2s;
    }
    .step-item.active { border-color: var(--border-b); background: rgba(59,130,246,0.05); }
    .step-item.done   { border-color: var(--border-g); background: rgba(16,185,129,0.05); }
    .step-item.error  { border-color: var(--border-r); background: rgba(239,68,68,0.05); }
    .step-item.cancelled { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
    .step-num {
      width: 24px; height: 24px; border-radius: 50%; background: var(--bg-4);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; color: var(--text-3); flex-shrink: 0; margin-top: 1px;
    }
    .step-item.active .step-num { background: var(--blue);  color: #fff; }
    .step-item.done   .step-num { background: var(--green); color: #fff; }
    .step-item.error  .step-num { background: var(--red);   color: #fff; }
    .step-item.cancelled .step-num { background: var(--amber); color: #fff; }
    .step-card { flex: 1; }
    .step-title { font-size: 13px; font-weight: 700; color: var(--text); }
    .step-desc  { font-size: 11px; color: var(--text-3); margin-top: 3px; }
    .step-tag   { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; color: var(--text-3); margin-top: 5px; display: block; }
    .step-item.active .step-tag { color: var(--blue-l); }
    .step-item.done   .step-tag { color: var(--green-l); }
    .step-item.error  .step-tag { color: var(--red-l); }
    .step-item.cancelled .step-tag { color: var(--amber-l); }

    /* ── RESULT ── */
    .result-panel { display: none; }
    .result-panel.show { display: block; }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat-box { background: var(--bg-3); border: 1px solid var(--border); border-radius: var(--r); padding: 14px; text-align: center; }
    .stat-n { font-size: 24px; font-weight: 800; color: var(--blue-l); }
    .stat-l { font-size: 11px; color: var(--text-3); margin-top: 3px; }
    .section-sep { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-3); margin: 14px 0 10px; }
    .drive-link {
      display: flex; align-items: center; gap: 12px; padding: 11px 14px;
      border-radius: var(--r); border: 1px solid var(--border); text-decoration: none; color: var(--text);
      margin-bottom: 8px; transition: border-color 0.2s, background 0.2s;
    }
    .drive-link:hover { border-color: var(--border-b); background: rgba(59,130,246,0.05); }
    .dl-icon { font-size: 20px; flex-shrink: 0; }
    .dl-meta { flex: 1; }
    .dl-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .dl-type { font-size: 11px; color: var(--text-3); }
    .dl-arr  { color: var(--text-3); font-size: 15px; }

    /* ── JOB HISTORY ── */
    .job-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .job-row:last-child { border-bottom: none; }
    .job-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
    .job-badge.processing { background: rgba(59,130,246,0.12); color: var(--blue-l); }
    .job-badge.completed  { background: rgba(16,185,129,0.12); color: var(--green-l); }
    .job-badge.failed     { background: rgba(239,68,68,0.12);  color: var(--red-l); }
    .job-badge.cancelled  { background: rgba(245,158,11,0.12); color: var(--amber-l); }
    .job-stage-pill { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 700; background: var(--bg-3); color: var(--text-3); }
    .job-info { flex: 1; }
    .job-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .job-time { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .job-resume-btn { font-size: 11px; padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--r-sm); background: rgba(59,130,246,0.06); color: var(--blue-l); cursor: pointer; font-weight: 700; font-family: inherit; }
    .job-delete-btn { font-size: 13px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg-3); cursor: pointer; color: var(--text-3); transition: all 0.2s; }
    .job-delete-btn:hover { background: rgba(239,68,68,0.08); border-color: var(--border-r); color: var(--red-l); }

    /* ── MISC ── */
    .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    .btn-sm { font-size: 12px; padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg-3); cursor: pointer; color: var(--text-2); font-family: inherit; transition: all 0.2s; }
    .btn-sm:hover { background: var(--bg-4); color: var(--text); }

    /* ── THEME TOGGLE ── */
    .header-controls { display: flex; align-items: center; gap: 8px; }
    .theme-toggle {
      display: flex; align-items: center; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.13); border-radius: var(--r-sm);
      padding: 3px 4px; cursor: pointer; transition: all 0.2s; gap: 0;
    }
    .theme-toggle:hover { background: rgba(255,255,255,0.13); }
    .tt-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.07em; padding: 4px 9px; border-radius: 4px; color: rgba(255,255,255,0.28); transition: all 0.2s; user-select: none; }
    .tt-label.active { background: rgba(255,255,255,0.12); color: var(--text); }
    .tt-sep { font-size: 10px; color: rgba(255,255,255,0.15); padding: 0 1px; pointer-events: none; user-select: none; }

    /* ── N8N MODE TOGGLE ── */
    .n8n-mode-btn {
      display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.13); border-radius: var(--r-sm);
      padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
      transition: all 0.2s; font-family: 'JetBrains Mono', monospace; color: var(--text-2);
    }
    .n8n-mode-btn .mode-dot { font-size: 9px; }
    .n8n-mode-btn.mode-production { border-color: rgba(52,211,153,0.45); color: #34d399; }
    .n8n-mode-btn.mode-test { border-color: rgba(251,191,36,0.45); color: #fbbf24; background: rgba(251,191,36,0.05); }
    .n8n-mode-btn:hover { transform: scale(1.04); }

    /* ── STOP BUTTON ── */
    .btn-stop {
      display: none; align-items: center; gap: 6px; padding: 5px 12px;
      border-radius: var(--r-sm); border: 1px solid var(--border-r);
      background: transparent; color: var(--red-l); font-size: 12px; font-weight: 700;
      cursor: pointer; transition: background 0.2s, opacity 0.2s; white-space: nowrap; font-family: inherit;
    }
    .btn-stop:hover:not(:disabled) { background: rgba(239,68,68,0.1); }
    .btn-stop:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── CANCEL MODAL ── */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .modal-overlay.open { opacity: 1; pointer-events: all; }
    .modal-box {
      background: var(--bg-2);
      border: 1px solid var(--border-md);
      border-radius: var(--r-lg);
      padding: 28px 28px 24px;
      width: 100%; max-width: 380px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45);
      transform: translateY(12px) scale(0.97);
      transition: transform 0.18s ease;
    }
    .modal-overlay.open .modal-box { transform: translateY(0) scale(1); }
    .modal-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.28);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; margin-bottom: 16px;
    }
    .modal-title { font-size: 15px; font-weight: 800; color: var(--text); margin-bottom: 6px; }
    .modal-desc  { font-size: 13px; color: var(--text-2); line-height: 1.6; margin-bottom: 22px; }
    .modal-btns  { display: flex; gap: 10px; justify-content: flex-end; }
    .modal-btn-cancel {
      padding: 8px 18px; border-radius: var(--r-sm);
      border: 1px solid var(--border-md); background: transparent;
      color: var(--text-2); font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }
    .modal-btn-cancel:hover { background: var(--bg-4); color: var(--text); }
    .modal-btn-confirm {
      padding: 8px 18px; border-radius: var(--r-sm);
      border: 1px solid rgba(239,68,68,0.5);
      background: rgba(239,68,68,0.1); color: var(--red-l);
      font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: background 0.15s;
    }
    .modal-btn-confirm:hover { background: rgba(239,68,68,0.2); }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    @media (max-width: 620px) {
      body { padding: 12px 12px 36px; }
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .header-row { flex-direction: column; align-items: flex-start; gap: 10px; }
      .tab-btn { font-size: 12px; padding: 10px 8px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <header class="site-header">
    <div class="header-row">
      <div class="brand">
        <h1>Document AI <em>v2.0</em></h1>
        <p>Adobe Analytics Automated Documentation Pipeline</p>
      </div>
      <div class="header-controls">
        <button id="n8nModeToggle" class="n8n-mode-btn mode-production" title="Click to toggle n8n mode">
          <span class="mode-dot" id="n8nModeIcon">&#9679;</span>
          <span id="n8nModeLabel">PRODUCTION</span>
        </button>
        <button id="themeToggle" class="theme-toggle" title="Toggle theme">
          <span class="tt-label light">LIGHT</span><span class="tt-sep">|</span><span class="tt-label dark active">DARK</span>
        </button>
        <div class="live-badge">
          <span class="pulse"></span>
          LIVE
        </div>
      </div>
    </div>
  </header>

  <!-- Tab navigation -->
  <div class="tab-nav">
    <button class="tab-btn sdr active" id="tab-sdr-btn" onclick="switchTab('sdr')">
      <span class="t-dot"></span>&#128202; SDR
      <span class="tab-badge" id="badge-sdr">1</span>
    </button>
    <button class="tab-btn tsd" id="tab-tsd-btn" onclick="switchTab('tsd')">
      <span class="t-dot"></span>&#128196; TSD
      <span class="tab-badge" id="badge-tsd">2</span>
    </button>
    <button class="tab-btn tags" id="tab-tags-btn" onclick="switchTab('tags')">
      <span class="t-dot"></span>&#127991; Tags
      <span class="tab-badge" id="badge-tags">3</span>
    </button>
  </div>

  <!-- SDR TAB -->
  <div class="tab-pane active" id="tab-sdr">
    <div class="card">
      <div class="card-head">
        <div class="card-ico ico-sdr">&#128202;</div>
        <div>
          <div class="card-head-title">Generate SDR</div>
          <div class="card-head-sub">BRD Excel &#8594; SDR Excel</div>
        </div>
      </div>
      <div id="sdr-error" class="alert error" style="display:none"><span>&#9888;</span><span id="sdr-errorMsg"></span></div>
      <div id="sdr-warning" class="alert warning" style="display:none"><span>&#9888;</span><span id="sdr-warningMsg"></span></div>
      <div class="form-group">
        <label class="field-label">Select BRD File</label>
        <div class="drop-zone" id="sdr-dropZone">
          <input type="file" id="sdr-fileInput" accept=".xlsx,.xls,.csv" onchange="onFileChange(event,'sdr')" />
          <div class="dz-ico">&#128194;</div>
          <div class="dz-label">Click or drag &amp; drop a file</div>
          <div class="dz-sub">Supports .xlsx / .xls / .csv</div>
        </div>
        <div id="sdr-fileInfo" style="display:none" class="file-info">
          <span style="font-size:18px">&#128202;</span>
          <span class="fi-name" id="sdr-fiName"></span>
          <span class="fi-size" id="sdr-fiSize"></span>
          <span class="fi-remove" onclick="removeFile('sdr')">&#10005;</span>
        </div>
      </div>
      <div class="form-group" id="sdr-sheetGroup" style="display:none">
        <label class="field-label" for="sdr-sheetSelect">Select BRD Sheet</label>
        <select id="sdr-sheetSelect"><option value="">&#8212; Loading sheets &#8212;</option></select>
        <div class="hint">Select the sheet containing your requirements.</div>
      </div>
      <div class="form-group">
        <label class="field-label" for="sdr-clientName">Client Name</label>
        <input type="text" id="sdr-clientName" placeholder="e.g., GSSHOP" />
      </div>
      <button class="btn-primary btn-sdr" id="sdr-btn" onclick="triggerStage('sdr')">
        <span>&#9889;</span> Generate SDR
      </button>
    </div>
    <div class="card" id="sdr-progressCard" style="display:none">
      <div class="progress-header">
        <div class="card-head-title">&#9203;&nbsp; Processing Status</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="timer-pill"><span class="timer-lbl">Elapsed</span><span class="timer-val" id="sdr-timer">00:00</span></div>
          <button class="btn-stop" id="sdr-stopBtn" onclick="cancelJob('sdr')">&#9632; Stop</button>
        </div>
      </div>
      <div class="steps-list">
        <div class="step-item idle" id="sdr-step-trigger">
          <div class="step-num" data-num="1">1</div>
          <div class="step-card">
            <div class="step-title">n8n Webhook Trigger</div>
            <div class="step-desc">Send BRD file &amp; issue Job ID</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
        <div class="step-item idle" id="sdr-step-sdr">
          <div class="step-num" data-num="2">2</div>
          <div class="step-card">
            <div class="step-title">SDR AI Generation <span style="font-size:11px;font-weight:500;color:var(--text-3)">(eVars &middot; Props &middot; Events)</span></div>
            <div class="step-desc">GPT-4o &times; 2 agents &mdash; parallel (~1m 30s)</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
        <div class="step-item idle" id="sdr-step-excel">
          <div class="step-num" data-num="3">3</div>
          <div class="step-card">
            <div class="step-title">SDR Excel Generation &#8594; Google Drive Upload</div>
            <div class="step-desc">Generate 6-sheet OOXML &amp; save to Drive</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card result-panel" id="sdr-result">
      <div class="card-head">
        <div class="card-ico ico-done">&#9989;</div>
        <div><div class="card-head-title">SDR Generation Complete</div></div>
      </div>
      <div class="stats-row" id="sdr-statsGrid"></div>
      <div class="section-sep">Google Drive Results</div>
      <div id="sdr-driveLinks"></div>
      <div id="sdr-nextStep" class="alert info" style="display:none;margin-top:12px">
        <span>&#8505;</span>
        <div>SDR data saved. Generate a TSD in the <strong>TSD tab</strong> or create Adobe Launch tags in the <strong>Tags tab</strong>.</div>
      </div>
    </div>
  </div><!-- /tab-sdr -->

  <!-- TSD TAB -->
  <div class="tab-pane" id="tab-tsd">
    <div class="card">
      <div class="card-head">
        <div class="card-ico ico-tsd">&#128196;</div>
        <div>
          <div class="card-head-title">Generate TSD</div>
          <div class="card-head-sub">SDR Data &#8594; TSD Document</div>
        </div>
      </div>
      <div id="tsd-error" class="alert error" style="display:none"><span>&#9888;</span><span id="tsd-errorMsg"></span></div>
      <div id="tsd-warning" class="alert warning" style="display:none"><span>&#9888;</span><span id="tsd-warningMsg"></span></div>
      <div id="tsd-sdrPill"></div>
      <div class="form-group">
        <label class="field-label" for="tsd-clientName">Client Name</label>
        <input type="text" id="tsd-clientName" placeholder="e.g., GSSHOP" />
      </div>
      <div class="form-group">
        <label class="field-label" for="tsd-sdrInput">SDR Data JSON</label>
        <textarea id="tsd-sdrInput" placeholder='{"evars":[...],"props":[...],"events":[]}'></textarea>
        <div class="hint">Auto-filled after SDR tab completes. Or paste directly.</div>
      </div>
      <button class="btn-primary btn-tsd" id="tsd-btn" onclick="triggerStage('tsd')">
        <span>&#9889;</span> Generate TSD
      </button>
    </div>
    <div class="card" id="tsd-progressCard" style="display:none">
      <div class="progress-header">
        <div class="card-head-title">&#9203;&nbsp; Processing Status</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="timer-pill"><span class="timer-lbl">Elapsed</span><span class="timer-val" id="tsd-timer">00:00</span></div>
          <button class="btn-stop" id="tsd-stopBtn" onclick="cancelJob('tsd')">&#9632; Stop</button>
        </div>
      </div>
      <div class="steps-list">
        <div class="step-item idle" id="tsd-step-trigger">
          <div class="step-num" data-num="1">1</div>
          <div class="step-card">
            <div class="step-title">n8n Webhook Trigger</div>
            <div class="step-desc">Send SDR data &amp; issue Job ID</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
        <div class="step-item idle" id="tsd-step-tsd_ai">
          <div class="step-num" data-num="2">2</div>
          <div class="step-card">
            <div class="step-title">TSD AI Generation <span style="font-size:11px;font-weight:500;color:var(--text-3)">(JS + Markdown Spec)</span></div>
            <div class="step-desc">GPT-4o &times; 2 agents &mdash; JS Agent + Doc Agent (~2m 30s)</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
        <div class="step-item idle" id="tsd-step-tsd_docx">
          <div class="step-num" data-num="3">3</div>
          <div class="step-card">
            <div class="step-title">TSD DOCX Generation &#8594; Google Drive Upload</div>
            <div class="step-desc">Save Word (.docx) + JS + MD files</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card result-panel" id="tsd-result">
      <div class="card-head">
        <div class="card-ico ico-done">&#9989;</div>
        <div><div class="card-head-title">TSD Generation Complete</div></div>
      </div>
      <div id="tsd-driveLinks"></div>
    </div>
  </div><!-- /tab-tsd -->

  <!-- TAGS TAB -->
  <div class="tab-pane" id="tab-tags">
    <div class="card">
      <div class="card-head">
        <div class="card-ico ico-tags">&#127991;</div>
        <div>
          <div class="card-head-title">Generate Tags</div>
          <div class="card-head-sub">SDR Data &#8594; Adobe Launch Rules</div>
        </div>
      </div>
      <div id="tags-error" class="alert error" style="display:none"><span>&#9888;</span><span id="tags-errorMsg"></span></div>
      <div id="tags-warning" class="alert warning" style="display:none"><span>&#9888;</span><span id="tags-warningMsg"></span></div>
      <div id="tags-sdrPill"></div>
      <div class="form-group">
        <label class="field-label" for="tags-clientName">Client Name</label>
        <input type="text" id="tags-clientName" placeholder="e.g., GSSHOP" />
      </div>
      <div class="form-group">
        <label class="field-label" for="tags-sdrInput">SDR Data JSON</label>
        <textarea id="tags-sdrInput" placeholder='{"evars":[...],"props":[...],"events":[]}'></textarea>
        <div class="hint">Auto-filled after SDR tab completes. Or paste directly.</div>
      </div>
      <div class="alert info">
        <span>&#8505;</span>
        <div><code>N8N_TAGS_WEBHOOK_URL</code> and Adobe Launch credentials must be configured in the Set Credentials node of your n8n workflow.</div>
      </div>
      <button class="btn-primary btn-tags" id="tags-btn" onclick="triggerStage('tags')">
        <span>&#9889;</span> Generate Tags
      </button>
    </div>
    <div class="card" id="tags-progressCard" style="display:none">
      <div class="progress-header">
        <div class="card-head-title">&#9203;&nbsp; Processing Status</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="timer-pill"><span class="timer-lbl">Elapsed</span><span class="timer-val" id="tags-timer">00:00</span></div>
          <button class="btn-stop" id="tags-stopBtn" onclick="cancelJob('tags')">&#9632; Stop</button>
        </div>
      </div>
      <div class="steps-list">
        <div class="step-item idle" id="tags-step-trigger">
          <div class="step-num" data-num="1">1</div>
          <div class="step-card">
            <div class="step-title">n8n Webhook Trigger</div>
            <div class="step-desc">Send SDR data &amp; issue Job ID</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
        <div class="step-item idle" id="tags-step-tags_create">
          <div class="step-num" data-num="2">2</div>
          <div class="step-card">
            <div class="step-title">Create Adobe Launch Rules</div>
            <div class="step-desc">IMS Auth &#8594; Create Rules + Components &#8594; Validate</div>
            <span class="step-tag">&#9679; Processing...</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card result-panel" id="tags-result">
      <div class="card-head">
        <div class="card-ico ico-done">&#9989;</div>
        <div><div class="card-head-title">Tags Generation Complete</div></div>
      </div>
      <div id="tags-summary"></div>
    </div>
  </div><!-- /tab-tags -->

  <!-- JOB HISTORY -->
  <div class="card">
    <div class="card-head">
      <div class="card-ico ico-hist">&#128336;</div>
      <div><div class="card-head-title">Recent Job History</div></div>
    </div>
    <div id="jobList">
      <div style="color:var(--text-3);font-size:13px">No job history.</div>
    </div>
    <div class="btn-row">
      <button class="btn-sm" onclick="loadJobs()">Refresh</button>
      <button class="btn-sm" style="color:var(--red-l)" onclick="deleteAllJobs()">Delete All</button>
    </div>
  </div>

</div><!-- /page -->

<script>
// ── Per-tab state ─────────────────────────────────────────────────────────
const state = {
  sdr:  { jobId: null, timer: null, startTime: null, sse: null, poll: null, file: null, fileB64: null },
  tsd:  { jobId: null, timer: null, startTime: null, sse: null, poll: null },
  tags: { jobId: null, timer: null, startTime: null, sse: null, poll: null },
};

// ── Theme ────────────────────────────────────────────────────────────────
function updateThemeToggle() {
  var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.querySelectorAll('.tt-label.light').forEach(function(el) {
    el.classList.toggle('active', !isDark);
  });
  document.querySelectorAll('.tt-label.dark').forEach(function(el) {
    el.classList.toggle('active', isDark);
  });
}
function toggleTheme() {
  var root = document.documentElement;
  var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  localStorage.setItem('doc_ai_theme', next);
  updateThemeToggle();
}

// ── n8n mode ─────────────────────────────────────────────────────────────
function loadN8nMode() {
  fetch('/api/n8n-mode')
    .then(function(r) { return r.json(); })
    .then(function(d) { applyN8nMode(d.mode, false); })
    .catch(function() {
      var m = localStorage.getItem('doc_ai_n8n_mode') || 'production';
      applyN8nMode(m, false);
    });
}
function applyN8nMode(mode, syncServer) {
  var btn = document.getElementById('n8nModeToggle');
  var lbl = document.getElementById('n8nModeLabel');
  if (!btn || !lbl) return;
  btn.classList.toggle('mode-production', mode === 'production');
  btn.classList.toggle('mode-test', mode === 'test');
  lbl.textContent = mode === 'production' ? 'PRODUCTION' : 'TEST';
  localStorage.setItem('doc_ai_n8n_mode', mode);
  if (syncServer !== false) {
    fetch('/api/n8n-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode })
    }).catch(function(e) { console.warn('n8n mode sync failed:', e); });
  }
}
function toggleN8nMode() {
  var cur = localStorage.getItem('doc_ai_n8n_mode') || 'production';
  applyN8nMode(cur === 'production' ? 'test' : 'production');
}

// ── Stop / cancel ─────────────────────────────────────────────────────────
function showStopBtn(stage) {
  var btn = document.getElementById(stage + '-stopBtn');
  if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerHTML = '&#9632; Stop'; }
}
function hideStopBtn(stage) {
  var btn = document.getElementById(stage + '-stopBtn');
  if (btn) btn.style.display = 'none';
}

// ── Cancel modal ──────────────────────────────────────────────────────────
var _cancelStage = null;

function openCancelModal(stage) {
  _cancelStage = stage;
  var overlay = document.getElementById('cancelModal');
  if (overlay) overlay.classList.add('open');
}

function closeCancelModal() {
  var overlay = document.getElementById('cancelModal');
  if (overlay) overlay.classList.remove('open');
  _cancelStage = null;
}

async function confirmCancel() {
  var stage = _cancelStage;
  closeCancelModal();
  if (!stage) return;

  var jobId = state[stage].jobId;
  if (!jobId) return;

  var btn = document.getElementById(stage + '-stopBtn');
  if (btn) { btn.innerHTML = '&#9203; Cancelling...'; btn.disabled = true; }

  try {
    var r = await fetch('/jobs/' + jobId + '/cancel', { method: 'POST' });
    if (!r.ok) throw new Error('cancel request failed: ' + r.status);
    var currentJobId = jobId;
    setTimeout(function() {
      if (state[stage].jobId === currentJobId) {
        finishStage(stage, 'cancelled', { error: 'Cancelled by user.' });
        loadJobs();
      }
    }, 3000);
  } catch (e) {
    finishStage(stage, 'cancelled', { error: 'Cancelled by user.' });
    hideStopBtn(stage);
    loadJobs();
  }
}

function cancelJob(stage) {
  var jobId = state[stage].jobId;
  if (!jobId) return;
  openCancelModal(stage);
}

// ── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  var savedTheme = localStorage.getItem('doc_ai_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggle();
  // Theme toggle button
  var themBtn = document.getElementById('themeToggle');
  if (themBtn) themBtn.addEventListener('click', toggleTheme);
  // n8n mode
  loadN8nMode();
  var n8nBtn = document.getElementById('n8nModeToggle');
  if (n8nBtn) n8nBtn.addEventListener('click', toggleN8nMode);
  // Cancel modal
  var modalNo  = document.getElementById('cancelModalNo');
  var modalYes = document.getElementById('cancelModalYes');
  if (modalNo)  modalNo.addEventListener('click', closeCancelModal);
  if (modalYes) modalYes.addEventListener('click', confirmCancel);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeCancelModal();
  });
  var cancelOverlay = document.getElementById('cancelModal');
  if (cancelOverlay) cancelOverlay.addEventListener('click', function(e) {
    if (e.target === cancelOverlay) closeCancelModal();
  });
  loadJobs();
  setupDropZone('sdr');
  loadSdrDataToTabs();
});

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-' + tab + '-btn').classList.add('active');
  if (tab === 'tsd' || tab === 'tags') loadSdrDataToTabs();
}

// ── SDR data: localStorage cache ─────────────────────────────────────────
function saveSdrData(clientName, sdrObj) {
  try {
    localStorage.setItem('doc_ai_sdr_client', clientName);
    localStorage.setItem('doc_ai_sdr_data', JSON.stringify(sdrObj));
    loadSdrDataToTabs();
  } catch(e) { console.warn('localStorage write failed', e); }
}

function loadSdrDataToTabs() {
  const clientName = localStorage.getItem('doc_ai_sdr_client');
  const sdrRaw     = localStorage.getItem('doc_ai_sdr_data');
  ['tsd', 'tags'].forEach(tab => {
    const pill = document.getElementById(tab + '-sdrPill');
    if (!pill) return;
    if (clientName && sdrRaw) {
      pill.innerHTML =
        '<div class="sdr-data-pill">&#10003; SDR data loaded — ' + clientName +
        ' <button onclick="clearSdrCache()" style="background:none;border:none;cursor:pointer;color:#16a34a;font-size:11px;margin-left:6px;">&#10005; Clear</button></div>';
      const cn = document.getElementById(tab + '-clientName');
      const si = document.getElementById(tab + '-sdrInput');
      if (cn && !cn.value) cn.value = clientName;
      if (si && !si.value) si.value = sdrRaw;
    } else {
      pill.innerHTML =
        '<div class="sdr-data-pill missing">&#9888; No SDR data — generate in the SDR tab first, or paste directly.</div>';
    }
  });
}

function clearSdrCache() {
  if (!confirm('Clear saved SDR data?')) return;
  localStorage.removeItem('doc_ai_sdr_client');
  localStorage.removeItem('doc_ai_sdr_data');
  ['tsd', 'tags'].forEach(tab => {
    const si = document.getElementById(tab + '-sdrInput');
    if (si) si.value = '';
    const cn = document.getElementById(tab + '-clientName');
    if (cn) cn.value = '';
  });
  loadSdrDataToTabs();
}

// ── Drop zone ─────────────────────────────────────────────────────────────
function setupDropZone(tab) {
  const zone = document.getElementById(tab + '-dropZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f, tab);
  });
}

function onFileChange(e, tab) {
  const f = e.target.files[0];
  if (f) handleFile(f, tab);
}

function handleFile(file, tab) {
  state[tab].file   = file;
  state[tab].fileB64 = null;
  document.getElementById(tab + '-fiName').textContent = file.name;
  document.getElementById(tab + '-fiSize').textContent = (file.size / 1024).toFixed(0) + ' KB';
  document.getElementById(tab + '-fileInfo').style.display = 'flex';
  const zone = document.getElementById(tab + '-dropZone');
  zone.classList.add('has-file');
  zone.querySelector('.dz-label').textContent = 'File selected (click to replace)';
  zone.querySelector('.dz-sub').textContent  = '';
  const slug = file.name.replace(/\\.[^.]+$/, '').replace(/[_\\-]+/g, ' ');
  const cn = document.getElementById(tab + '-clientName');
  if (cn && !cn.value) cn.value = slug;

  const reader = new FileReader();
  reader.onload = ev => {
    state[tab].fileB64 = ev.target.result.split(',')[1];
    loadSheets(state[tab].fileB64, tab);
  };
  reader.readAsDataURL(file);
}

function removeFile(tab) {
  state[tab].file   = null;
  state[tab].fileB64 = null;
  document.getElementById(tab + '-fileInfo').style.display = 'none';
  document.getElementById(tab + '-fileInput').value = '';
  const grp = document.getElementById(tab + '-sheetGroup');
  if (grp) grp.style.display = 'none';
  const zone = document.getElementById(tab + '-dropZone');
  zone.classList.remove('has-file');
  zone.querySelector('.dz-label').textContent = 'Click or drag & drop a file';
  zone.querySelector('.dz-sub').textContent  = 'Supports .xlsx / .xls / .csv';
}

async function loadSheets(base64, tab) {
  const grp = document.getElementById(tab + '-sheetGroup');
  const sel = document.getElementById(tab + '-sheetSelect');
  if (!grp || !sel) return;
  grp.style.display = 'none';
  sel.innerHTML = '<option value="">— Loading sheets —</option>';
  try {
    const r = await fetch('/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64 })
    });
    const { sheets } = await r.json();
    sel.innerHTML = (sheets && sheets.length)
      ? sheets.map(s => '<option value="' + s + '">' + s + '</option>').join('')
      : '<option value="">— No sheets found —</option>';
    grp.style.display = 'block';
  } catch {
    sel.innerHTML = '<option value="">— Sheet load failed —</option>';
    grp.style.display = 'block';
  }
}

// ── Trigger stages ────────────────────────────────────────────────────────
async function triggerStage(stage) {
  showErr(stage, null);
  hideWarning(stage);
  const clientName = (document.getElementById(stage + '-clientName').value || '').trim();
  if (!clientName) { showErr(stage, 'Please enter a client name.'); return; }

  let payload = { clientName };

  if (stage === 'sdr') {
    const sel = document.getElementById('sdr-sheetSelect');
    const baseSheetName = sel ? sel.value : '';
    if (!state.sdr.file)    { showErr('sdr', 'Please select a file.'); return; }
    if (!state.sdr.fileB64) { showErr('sdr', 'File is still loading. Please try again in a moment.'); return; }
    if (!baseSheetName)     { showErr('sdr', 'Please select a sheet to analyze.'); return; }
    payload = { clientName, fileName: state.sdr.file.name, fileBase64: state.sdr.fileB64, baseSheetName };
  } else {
    const rawSdr = (document.getElementById(stage + '-sdrInput').value || '').trim();
    if (!rawSdr) { showErr(stage, 'Please enter SDR data.'); return; }
    let sdrData;
    try { sdrData = JSON.parse(rawSdr); }
    catch { showErr(stage, 'Invalid SDR data JSON format.'); return; }
    payload = { clientName, sdrData };
  }

  // Reset UI
  setBtn(stage, true);
  resetSteps(stage);
  document.getElementById(stage + '-progressCard').style.display = 'block';
  document.getElementById(stage + '-result').classList.remove('show');
  setStep(stage, 'trigger', 'active');
  startTimer(stage);
  showStopBtn(stage);

  const endpoints = { sdr: '/trigger/sdr', tsd: '/trigger/tsd', tags: '/trigger/tags' };
  try {
    const r = await fetch(endpoints[stage], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Trigger failed (' + r.status + ')');

    state[stage].jobId = data.jobId;
    setStep(stage, 'trigger', 'done');
    loadJobs();
    startSSE(stage, data.jobId);
    clearInterval(state[stage].poll);
    state[stage].poll = setInterval(() => pollStatus(stage, data.jobId), 5000);
  } catch(e) {
    setStep(stage, 'trigger', 'error');
    showErr(stage, e.message);
    stopTimer(stage);
    setBtn(stage, false);
  }
}

// ── SSE / polling ─────────────────────────────────────────────────────────
function startSSE(stage, jobId) {
  if (state[stage].sse) state[stage].sse.close();
  const src = new EventSource('/events/' + jobId);
  src.onmessage = e => { handleJobUpdate(stage, JSON.parse(e.data)); };
  src.onerror   = () => { /* poll covers it */ };
  state[stage].sse = src;
}

async function pollStatus(stage, jobId) {
  try {
    const r = await fetch('/status/' + jobId);
    if (r.ok) handleJobUpdate(stage, await r.json());
  } catch {}
}

function handleJobUpdate(stage, job) {
  if (!job || job.jobId !== state[stage].jobId) return;

  if (Array.isArray(job.steps)) {
    job.steps.forEach(s => {
      if      (s.status === 'completed') setStep(stage, s.name, 'done');
      else if (s.status === 'active')    setStep(stage, s.name, 'active');
      else if (s.status === 'failed')    setStep(stage, s.name, 'error');
      else if (s.status === 'cancelled') setStep(stage, s.name, 'cancelled');
    });
    // Fallback: 모든 step이 completed인데 job.status가 아직 'processing'이면 완료 처리
    if (job.status === 'processing' && job.steps.length > 0 && job.steps.every(s => s.status === 'completed')) {
      job.status = 'completed';
    }
  }

  if (job.status === 'completed') {
    finishStage(stage, 'done', job);
    if (stage === 'sdr') onSdrComplete(job);
    loadJobs();
  } else if (job.status === 'failed') {
    finishStage(stage, 'failed', job);
    loadJobs();
  } else if (job.status === 'cancelled') {
    finishStage(stage, 'cancelled', job);
    loadJobs();
  }
}

function finishStage(stage, outcome, job) {
  clearInterval(state[stage].poll);
  if (state[stage].sse) { state[stage].sse.close(); state[stage].sse = null; }
  stopTimer(stage);
  setBtn(stage, false);
  hideStopBtn(stage);
  if (outcome === 'done') showResult(stage, job);
  else if (outcome === 'cancelled') {
    var pane = document.getElementById('tab-' + stage);
    if (pane) {
      pane.querySelectorAll('.step-item.active, .step-item.idle').forEach(function(el) {
        var name = el.id.replace(stage + '-step-', '');
        setStep(stage, name, 'cancelled');
      });
    }
    showWarning(stage, '작업이 취소되었습니다.');
  }
  else showErr(stage, (job && job.error) || 'An error occurred during processing.');
}

// ── Save SDR result to localStorage ──────────────────────────────────────
function onSdrComplete(job) {
  const sdrJson = (job.result && job.result.sdrJson) ? job.result.sdrJson : job.sdrJson;
  const clientName = (document.getElementById('sdr-clientName').value || '').trim();
  if (sdrJson && clientName) {
    saveSdrData(clientName, sdrJson.sdr || sdrJson);
    document.getElementById('sdr-nextStep').style.display = 'flex';
  }
}

// ── Show result ───────────────────────────────────────────────────────────
function showResult(stage, data) {
  const card = document.getElementById(stage + '-result');
  card.classList.add('show');

  if (stage === 'sdr') {
    const stats = (data.result && data.result.sdrSummary) ? data.result.sdrSummary : {};
    document.getElementById('sdr-statsGrid').innerHTML =
      [['eVars', stats.evarCount || '—'], ['Props', stats.propsCount || '—'], ['Events', stats.eventsCount || '—']]
      .map(function(p){ return '<div class="stat-box"><div class="stat-n">' + p[1] + '</div><div class="stat-l">' + p[0] + '</div></div>'; }).join('');

    const files = (data.result && data.result.googleDrive && data.result.googleDrive.files) ? data.result.googleDrive.files : [];
    const sdrLink = data.result && data.result.sdrDrive && data.result.sdrDrive.webViewLink;
    let html = '';
    if (sdrLink) html += dlLink('📊', 'SDR Excel', '.xlsx', sdrLink);
    files.forEach(function(f){
      const ext = (f.fileName||'').match(/\\.[^.]+$/);
      const icons = {'.xlsx':'📊','.docx':'📄','.js':'📜','.md':'📝','.json':'🗃️'};
      html += dlLink((ext && icons[ext[0]]) || '📁', f.fileName || 'File', (ext && ext[0]) || '', f.webViewLink);
    });
    document.getElementById('sdr-driveLinks').innerHTML = html || '<p style="color:var(--text-3);font-size:13px">No Drive links available</p>';

  } else if (stage === 'tsd') {
    const files = (data.result && data.result.googleDrive && data.result.googleDrive.files) ? data.result.googleDrive.files : [];
    let html = '';
    files.forEach(function(f){
      const ext = (f.fileName||'').match(/\\.[^.]+$/);
      const icons = {'.xlsx':'📊','.docx':'📄','.js':'📜','.md':'📝','.json':'🗃️'};
      html += dlLink((ext && icons[ext[0]]) || '📁', f.fileName || 'File', (ext && ext[0]) || '', f.webViewLink);
    });
    document.getElementById('tsd-driveLinks').innerHTML = html || '<p style="color:var(--text-3);font-size:13px">No Drive links available</p>';

  } else if (stage === 'tags') {
    const summary    = (data.result && data.result.summary) ? data.result.summary : {};
    const nextSteps  = (data.result && Array.isArray(data.result.nextSteps)) ? data.result.nextSteps : [];
    document.getElementById('tags-summary').innerHTML =
      '<div class="alert success" style="margin-bottom:12px">&#10003; Adobe Launch rules created — ' + (summary.rulesCreated || '?') + ' rule(s)</div>' +
      (nextSteps.length ? '<ul style="font-size:13px;padding-left:20px;color:var(--text);line-height:1.8">' + nextSteps.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ul>' : '');
  }
}

function dlLink(icon, name, type, url) {
  if (!url) return '';
  return '<a class="drive-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
    '<span class="dl-icon">' + icon + '</span>' +
    '<span class="dl-meta"><div class="dl-name">' + name + '</div><div class="dl-type">' + type + '</div></span>' +
    '<span class="dl-arr">&#8599;</span></a>';
}

// ── Job history ───────────────────────────────────────────────────────────
async function loadJobs() {
  try {
    const r = await fetch('/jobs');
    const { jobs: list } = await r.json();
    const el = document.getElementById('jobList');
    if (!list || !list.length) {
      el.innerHTML = '<div style="color:var(--text-3);font-size:13px">No job history.</div>';
      return;
    }
    const statusMap = { processing: 'Processing', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' };
    el.innerHTML = list.map(function(j) {
      const statusLabel = statusMap[j.status] || j.status;
      return '<div class="job-row">' +
        '<span class="job-badge ' + j.status + '">' + statusLabel + '</span>' +
        (j.stage ? '<span class="job-stage-pill">' + j.stage.toUpperCase() + '</span>' : '') +
        '<div class="job-info"><div class="job-name">' + (j.clientName || j.jobId) + '</div>' +
        '<div class="job-time">' + j.jobId + ' &middot; ' + fmtTime(j.createdAt) + '</div></div>' +
        (j.status === 'processing' ? '<button class="job-resume-btn" onclick="resumeJob(\\'' + j.jobId + '\\',\\'' + (j.stage||'sdr') + '\\')">Monitor</button>' : '') +
        '<button class="job-delete-btn" onclick="delJob(\\'' + j.jobId + '\\')">&#128465;</button>' +
        '</div>';
    }).join('');
  } catch {}
}

function resumeJob(jobId, stage) {
  switchTab(stage || 'sdr');
  state[stage].jobId = jobId;
  document.getElementById(stage + '-progressCard').style.display = 'block';
  startTimer(stage);
  startSSE(stage, jobId);
  clearInterval(state[stage].poll);
  state[stage].poll = setInterval(() => pollStatus(stage, jobId), 5000);
}

async function delJob(jobId) {
  if (!confirm('Delete this job?')) return;
  try { await fetch('/jobs/' + jobId, { method: 'DELETE' }); loadJobs(); } catch {}
}

async function deleteAllJobs() {
  if (!confirm('Delete all job history?')) return;
  try { await fetch('/jobs', { method: 'DELETE' }); loadJobs(); } catch {}
}

// ── UI helpers ────────────────────────────────────────────────────────────
function setStep(stage, name, cls) {
  var id = stage + '-step-' + name;
  var el = document.getElementById(id);
  if (!el) return;
  el.className = 'step-item ' + cls;
  var num = el.querySelector('.step-num');
  var tag = el.querySelector('.step-tag');
  if (num) {
    if (cls === 'done')        num.textContent = '✓';
    else if (cls === 'active') num.textContent = '●';
    else if (cls === 'error')     num.textContent = '✕';
    else if (cls === 'cancelled') num.textContent = '◌';
    else                          num.textContent = num.getAttribute('data-num') || '';
  }
  if (tag) {
    if (cls === 'done')        tag.textContent = '✓ Done';
    else if (cls === 'active') tag.textContent = '⬤ Running...';
    else if (cls === 'error')  tag.textContent = '✕ Failed';
    else if (cls === 'cancelled') tag.textContent = '◌ Cancelled';
    else                       tag.textContent = '○ Waiting';
  }
}

function resetSteps(stage) {
  var pane = document.getElementById('tab-' + stage);
  if (!pane) return;
  pane.querySelectorAll('.step-item').forEach(function(el) {
    el.className = 'step-item idle';
    var num = el.querySelector('.step-num');
    if (num) num.textContent = num.getAttribute('data-num') || '';
    var tag = el.querySelector('.step-tag');
    if (tag) tag.textContent = '○ Waiting';
  });
}

function setBtn(stage, loading) {
  var btn = document.getElementById(stage + '-btn');
  if (!btn) return;
  btn.disabled = loading;
  var labels = { sdr: 'SDR', tsd: 'TSD', tags: 'Tags' };
  btn.innerHTML = loading
    ? '<span>&#9203;</span> Processing...'
    : '<span>&#9889;</span> Generate ' + labels[stage];
}

function showErr(stage, msg) {
  var errEl  = document.getElementById(stage + '-error');
  var msgEl  = document.getElementById(stage + '-errorMsg');
  if (!errEl) return;
  if (msg) {
    msgEl.textContent = msg;
    errEl.style.display = 'flex';
  } else {
    errEl.style.display = 'none';
  }
}

function showWarning(stage, msg) {
  var el    = document.getElementById(stage + '-warning');
  var msgEl = document.getElementById(stage + '-warningMsg');
  if (!el) return;
  msgEl.textContent = msg || '작업이 취소되었습니다.';
  el.style.display = 'flex';
}

function hideWarning(stage) {
  var el = document.getElementById(stage + '-warning');
  if (el) el.style.display = 'none';
}

function startTimer(stage) {
  state[stage].startTime = Date.now();
  clearInterval(state[stage].timer);
  state[stage].timer = setInterval(function() {
    var s  = Math.floor((Date.now() - state[stage].startTime) / 1000);
    var el = document.getElementById(stage + '-timer');
    if (el) el.textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }, 1000);
}

function stopTimer(stage) { clearInterval(state[stage].timer); }

function pad(n) { return String(n).padStart(2, '0'); }

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso || ''; }
}

// Auto-refresh job list every 10 s
setInterval(loadJobs, 10000);
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
const lines = html.split('\n').length;
console.log('✅ index.html written → ' + OUT + ' (' + lines + ' lines)');
