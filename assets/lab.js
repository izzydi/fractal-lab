/* Fractal Lab: κοινός κώδικας για τα εργαστήρια.
   Επεξεργαστής κώδικα με χρωματισμό, εκτέλεση Python μέσω Pyodide,
   slider επιπέδου (και προαιρετικές παράμετροι), επαναφορά και αντιγραφή. */
(function () {
  const $ = s => document.querySelector(s);
  const KEYWORDS = 'def|return|if|for|in|from|import|else|elif|while|and|or|not|True|False|None|continue|break';
  const BUILTINS = 'sqrt|range|print|len|reversed|cos|sin|radians|abs|round';
  const COLOR_NAMES = /^(red|blue|green|purple|orange|pink|yellow|black|white|cyan|magenta|brown|navy|teal|gold|gray|grey)$/i;
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

  function escapeHTML(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function syntaxColor(source) {
    const token = new RegExp('#.*|(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')|\\b(?:' + KEYWORDS + ')\\b|\\b(?:' + BUILTINS + ')\\b|\\b\\d+(?:\\.\\d+)?\\b|\\b[a-zA-Z_][a-zA-Z_0-9]*(?=\\s*\\()', 'g');
    let out = '', last = 0, m;
    while ((m = token.exec(source)) !== null) {
      out += escapeHTML(source.slice(last, m.index));
      const t = m[0];
      const cls = t.startsWith('#') ? 'py-comment'
        : /^["']/.test(t) ? 'py-string'
        : new RegExp('^(' + KEYWORDS + ')$').test(t) ? 'py-keyword'
        : /^\d/.test(t) ? 'py-number'
        : new RegExp('^(' + BUILTINS + ')$').test(t) ? 'py-builtin' : 'py-function';
      out += '<span class="' + cls + '">' + escapeHTML(t) + '</span>';
      last = token.lastIndex;
    }
    return out + escapeHTML(source.slice(last)) + '\n';
  }

  let pyodidePromise = null;
  function loadPython(status) {
    if (pyodidePromise) return pyodidePromise;
    status.textContent = 'Φόρτωση της Python… (μόνο την πρώτη φορά)';
    pyodidePromise = (async () => {
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = PYODIDE + 'pyodide.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Δεν είναι διαθέσιμη η σύνδεση με την Python.'));
          document.head.appendChild(s);
        });
      }
      return await window.loadPyodide({ indexURL: PYODIDE });
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
    return pyodidePromise;
  }

  /* cfg:
     initial      αρχικός κώδικας Python
     outputVar    όνομα της λίστας που σχεδιάζεται (π.χ. "triangles")
     color        αρχικό χρώμα
     maxItems     μέγιστο πλήθος στοιχείων
     level        {min, max, value} ή null, αν το εργαστήριο δεν έχει LEVEL
     params       [{name, input, text, format}] επιπλέον μεταβλητές με slider ή πεδίο αριθμού
     afterRun(obj)          προαιρετικό, καλείται μετά από επιτυχημένη εκτέλεση
     preview(vars)          -> στοιχεία υπολογισμένα σε JavaScript
     validate(items)        -> null ή μήνυμα λάθους
     render(items, color, vars)
     countLabel(items)      -> κείμενο για το σήμα πλήθους
  */
  function start(cfg) {
    const code = $('#code'), status = $('#status');
    const level = cfg.level ? $('#level') : null, levelText = cfg.level ? $('#levelText') : null;
    const highlight = $('#highlight'), highlightCode = $('#highlightCode'), badge = $('#countBadge');
    const params = cfg.params || [];
    let color = cfg.color, items = [];

    const vars = () => {
      const v = level ? { LEVEL: Number(level.value) } : {};
      for (const p of params) v[p.name] = Number($(p.input).value);
      return v;
    };
    const updateHighlight = () => {
      highlightCode.innerHTML = syntaxColor(code.value);
      highlight.scrollTop = code.scrollTop; highlight.scrollLeft = code.scrollLeft;
    };
    const setVarInCode = (name, value) => {
      code.value = code.value.replace(new RegExp('^' + name + '\\s*=\\s*-?[\\d.]+(?:[eE][-+]?\\d+)?', 'm'), name + ' = ' + value);
    };
    const show = (list, c) => {
      items = list; color = c;
      badge.textContent = cfg.countLabel(list);
      cfg.render(list, c, vars());
    };
    const preview = () => {
      if (level) levelText.textContent = level.value;
      for (const p of params) if (p.text) $(p.text).textContent = p.format ? p.format(Number($(p.input).value)) : $(p.input).value;
      show(cfg.preview(vars()), color);
    };

    code.value = cfg.initial;
    code.addEventListener('input', updateHighlight);
    code.addEventListener('scroll', () => { highlight.scrollTop = code.scrollTop; highlight.scrollLeft = code.scrollLeft; });
    code.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); code.setRangeText('    ', code.selectionStart, code.selectionEnd, 'end'); updateHighlight(); }
    });

    if (level) level.addEventListener('input', () => {
      setVarInCode('LEVEL', level.value); preview(); updateHighlight();
      status.textContent = 'Προεπισκόπηση για επίπεδο ' + level.value + '. Πάτησε «Εκτέλεση Python» για να τρέξει ο κώδικας.';
      status.className = 'status';
    });
    for (const p of params) {
      $(p.input).addEventListener('input', () => {
        // Ένα μισογραμμένο πεδίο αριθμού (π.χ. «-») δεν αλλάζει τον κώδικα.
        const raw = $(p.input).value;
        if (raw === '' || !Number.isFinite(Number(raw))) return;
        setVarInCode(p.name, raw); preview(); updateHighlight();
        status.textContent = 'Προεπισκόπηση με ' + p.name + ' = ' + $(p.input).value + '. Πάτησε «Εκτέλεση Python» για να τρέξει ο κώδικας.';
        status.className = 'status';
      });
    }
    window.addEventListener('resize', () => cfg.render(items, color, vars()));

    $('#run').addEventListener('click', async () => {
      const btn = $('#run'); btn.disabled = true; status.className = 'status';
      try {
        const py = await loadPython(status);
        status.textContent = 'Εκτέλεση του κώδικα…';
        // Μικρή παύση ώστε να φανεί το μήνυμα πριν αρχίσει ο υπολογισμός.
        await new Promise(r => setTimeout(r, 40));
        const extra = (level ? ', "level": LEVEL' : '') + params.map(p => ', "' + p.name + '": ' + p.name).join('');
        const result = await py.runPythonAsync(code.value + '\nimport json\njson.dumps({"items": ' + cfg.outputVar + ', "color": COLOR' + extra + '})');
        const obj = JSON.parse(result);
        if (!Array.isArray(obj.items)) throw Error('Η μεταβλητή ' + cfg.outputVar + ' πρέπει να είναι λίστα.');
        if (obj.items.length > cfg.maxItems) throw Error('Πάρα πολλά στοιχεία (' + obj.items.length.toLocaleString('el-GR') + '). Η σελίδα δείχνει έως ' + cfg.maxItems.toLocaleString('el-GR') + '. Δοκίμασε μικρότερο LEVEL.');
        const problem = cfg.validate(obj.items);
        if (problem) throw Error(problem);
        if (typeof obj.color !== 'string' || !COLOR_NAMES.test(obj.color)) throw Error('Γράψε COLOR = "' + cfg.color + '" ή ένα άλλο όνομα χρώματος στα αγγλικά, π.χ. red, blue, green, purple.');
        if (level && Number.isInteger(obj.level) && obj.level >= cfg.level.min && obj.level <= cfg.level.max) { level.value = obj.level; levelText.textContent = obj.level; }
        for (const p of params) {
          const v = obj[p.name], el = $(p.input);
          if (typeof v === 'number' && v >= Number(el.min) && v <= Number(el.max)) { el.value = v; if (p.text) $(p.text).textContent = p.format ? p.format(v) : v; }
        }
        show(obj.items, obj.color.toLowerCase());
        if (cfg.afterRun) cfg.afterRun(obj);
        status.textContent = '✓ Ο κώδικας Python εκτελέστηκε! ' + cfg.countLabel(obj.items) + '.';
        status.className = 'status ok';
      } catch (e) {
        status.textContent = '⚠ ' + e.message; status.className = 'status error';
      } finally { btn.disabled = false; }
    });

    $('#reset').addEventListener('click', () => {
      code.value = cfg.initial; if (level) level.value = cfg.level.value;
      for (const p of params) $(p.input).value = p.value;
      color = cfg.color; preview(); updateHighlight();
      status.textContent = 'Επαναφέρθηκε ο αρχικός κώδικας.'; status.className = 'status';
    });
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.value); status.textContent = '✓ Ο κώδικας αντιγράφηκε.'; status.className = 'status ok'; }
      catch { code.select(); status.textContent = 'Επίλεξε τον κώδικα και πάτησε Ctrl+C.'; }
    });

    updateHighlight(); preview();
    return { preview, vars };
  }

  window.FractalLab = { start };
})();
