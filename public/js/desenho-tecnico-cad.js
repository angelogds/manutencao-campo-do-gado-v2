(function () {
  const initial = window.CAD_INITIAL || {};
  const svg = document.getElementById('cadCanvas');
  if (!svg) return;

  const statusBar = document.getElementById('cadStatusBar');
  const layerSelect = document.getElementById('cadLayerSelect');
  const layersBox = document.getElementById('cadLayers');
  const propsBox = document.getElementById('cadProperties');

  const state = {
    tool: 'select',
    selectedId: null,
    drawing: null,
    pointer: { x: 0, y: 0 },
    history: [],
    future: [],
    data: {
      gridStep: 20,
      snapEnabled: true,
      showGrid: true,
      activeLayer: 'geometria_principal',
      layers: {},
      objects: [],
      dimensions: [],
      ...(initial.data || {}),
    },
  };

  if (!state.data.layers || !Object.keys(state.data.layers).length) {
    state.data.layers = {
      geometria_principal: { color: '#0f172a', visible: true, locked: false },
      linhas_de_centro: { color: '#0284c7', visible: true, locked: false },
      cotas: { color: '#166534', visible: true, locked: false },
      textos: { color: '#7c3aed', visible: true, locked: false },
      furos: { color: '#dc2626', visible: true, locked: false },
      construcao: { color: '#64748b', visible: true, locked: false },
      observacoes: { color: '#92400e', visible: true, locked: false },
    };
  }

  function pushHistory() {
    state.history.push(JSON.stringify(state.data));
    if (state.history.length > 120) state.history.shift();
    state.future = [];
  }

  function getPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const xRaw = ((evt.clientX - rect.left) / rect.width) * 1600;
    const yRaw = ((evt.clientY - rect.top) / rect.height) * 900;
    const step = Number(state.data.gridStep || 20);
    const snapOn = state.data.snapEnabled;

    const x = snapOn ? Math.round(xRaw / step) * step : xRaw;
    const y = snapOn ? Math.round(yRaw / step) * step : yRaw;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), rawX: xRaw, rawY: yRaw };
  }

  function dist(a, b) {
    return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
  }

  function angle(a, b) {
    return (Math.atan2((b.y || 0) - (a.y || 0), (b.x || 0) - (a.x || 0)) * 180) / Math.PI;
  }

  function objectLength(obj) {
    if (obj.type !== 'line' && obj.type !== 'centerline') return null;
    return Number(dist({ x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 }).toFixed(2));
  }

  function hitTest(point) {
    let best = null;
    for (const obj of state.data.objects) {
      if (obj.type === 'line' || obj.type === 'centerline') {
        const minX = Math.min(obj.x, obj.x2) - 8;
        const maxX = Math.max(obj.x, obj.x2) + 8;
        const minY = Math.min(obj.y, obj.y2) - 8;
        const maxY = Math.max(obj.y, obj.y2) + 8;
        if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
          best = obj;
        }
      } else if (obj.type === 'rect') {
        if (point.x >= obj.x && point.x <= obj.x + obj.width && point.y >= obj.y && point.y <= obj.y + obj.height) best = obj;
      } else if (obj.type === 'circle') {
        const d = dist(point, { x: obj.x, y: obj.y });
        if (Math.abs(d - obj.radius) <= 8 || d <= obj.radius) best = obj;
      } else if (obj.type === 'text') {
        if (Math.abs(point.x - obj.x) <= 24 && Math.abs(point.y - obj.y) <= 16) best = obj;
      }
    }
    return best;
  }

  function renderLayersPanel() {
    const names = Object.keys(state.data.layers || {});
    layerSelect.innerHTML = names.map((name) => `<option value="${name}" ${state.data.activeLayer === name ? 'selected' : ''}>${name}</option>`).join('');
    layersBox.innerHTML = names.map((name) => {
      const cfg = state.data.layers[name] || {};
      return `<div class="cad-layer-row"><span>${name}</span><label><input type="checkbox" data-layer-visible="${name}" ${cfg.visible !== false ? 'checked' : ''}>visível</label><label><input type="checkbox" data-layer-locked="${name}" ${cfg.locked ? 'checked' : ''}>lock</label></div>`;
    }).join('');
  }

  function renderDimensions() {
    return (state.data.dimensions || []).map((d) => {
      if (d.type === 'linear') {
        return `<g class="cad-dim"><line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#16a34a" stroke-dasharray="5 3" /><text x="${(d.x1 + d.x2) / 2 + 6}" y="${(d.y1 + d.y2) / 2 - 6}" fill="#166534" font-size="13">${d.value}</text></g>`;
      }
      if (d.type === 'radius') {
        return `<g class="cad-dim"><line x1="${d.cx}" y1="${d.cy}" x2="${d.px}" y2="${d.py}" stroke="#16a34a" /><text x="${d.px + 6}" y="${d.py - 6}" fill="#166534" font-size="13">R ${d.value}</text></g>`;
      }
      return '';
    }).join('');
  }

  function renderProperties() {
    const selected = state.data.objects.find((o) => o.id === state.selectedId);
    if (!selected) {
      propsBox.innerHTML = 'Selecione um objeto para editar propriedades.';
      return;
    }

    const len = objectLength(selected);
    propsBox.innerHTML = `
      <div class="cad-prop-grid">
        <div><b>Tipo:</b> ${selected.type}</div>
        ${len != null ? `<label>Comprimento <input class="input" data-prop="length" value="${len}"></label>` : ''}
        ${(selected.type === 'line' || selected.type === 'centerline') ? `<label>Ângulo <input class="input" data-prop="angle" value="${Number(angle({ x: selected.x, y: selected.y }, { x: selected.x2, y: selected.y2 }).toFixed(2))}"></label>` : ''}
        <label>X <input class="input" data-prop="x" value="${selected.x ?? ''}"></label>
        <label>Y <input class="input" data-prop="y" value="${selected.y ?? ''}"></label>
        ${selected.x2 != null ? `<label>X2 <input class="input" data-prop="x2" value="${selected.x2}"></label>` : ''}
        ${selected.y2 != null ? `<label>Y2 <input class="input" data-prop="y2" value="${selected.y2}"></label>` : ''}
        ${selected.width != null ? `<label>Largura <input class="input" data-prop="width" value="${selected.width}"></label>` : ''}
        ${selected.height != null ? `<label>Altura <input class="input" data-prop="height" value="${selected.height}"></label>` : ''}
        ${selected.radius != null ? `<label>Raio <input class="input" data-prop="radius" value="${selected.radius}"></label>` : ''}
        ${selected.text != null ? `<label>Texto <input class="input" data-prop="text" value="${selected.text}"></label>` : ''}
        <label>Camada <input class="input" data-prop="layer" value="${selected.layer || ''}"></label>
      </div>
    `;
  }

  function renderStatus(preview) {
    const p = preview || state.pointer;
    const draw = state.drawing;
    let text = `Cursor: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
    if (draw && draw.start) {
      const l = dist(draw.start, p).toFixed(2);
      const a = angle(draw.start, p).toFixed(1);
      text += ` • Comprimento: ${l} mm • Ângulo: ${a}°`;
    }
    statusBar.textContent = text;
  }

  function render() {
    const step = Number(state.data.gridStep || 20);
    const showGrid = document.getElementById('cadGridToggle')?.checked !== false;

    const grid = [];
    if (showGrid) {
      for (let x = 0; x <= 1600; x += step) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="900" stroke="#edf2f7"/>`);
      for (let y = 0; y <= 900; y += step) grid.push(`<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#edf2f7"/>`);
    }

    const shapes = state.data.objects.map((obj) => {
      const layerCfg = state.data.layers[obj.layer] || {};
      if (layerCfg.visible === false) return '';
      const stroke = obj.id === state.selectedId ? '#f59e0b' : (layerCfg.color || '#0f172a');

      if (obj.type === 'line' || obj.type === 'centerline') {
        const len = objectLength(obj);
        const cx = ((obj.x + obj.x2) / 2) + 6;
        const cy = ((obj.y + obj.y2) / 2) - 6;
        return `<g><line data-id="${obj.id}" x1="${obj.x}" y1="${obj.y}" x2="${obj.x2}" y2="${obj.y2}" stroke="${stroke}" stroke-width="2" ${obj.type === 'centerline' ? 'stroke-dasharray="8 4"' : ''}/><text x="${cx}" y="${cy}" fill="#334155" font-size="12">${len} mm</text></g>`;
      }
      if (obj.type === 'rect') return `<rect data-id="${obj.id}" x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
      if (obj.type === 'circle') return `<circle data-id="${obj.id}" cx="${obj.x}" cy="${obj.y}" r="${obj.radius}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
      if (obj.type === 'arc') return `<path data-id="${obj.id}" d="M ${obj.x} ${obj.y} Q ${(obj.x + obj.x2) / 2} ${obj.y - (obj.radius || 40)} ${obj.x2} ${obj.y2}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
      if (obj.type === 'text') return `<text data-id="${obj.id}" x="${obj.x}" y="${obj.y}" fill="${stroke}" font-size="${obj.fontSize || 14}">${obj.text || 'Texto'}</text>`;
      return '';
    }).join('');

    const preview = state.drawing ? (() => {
      const { start, current } = state.drawing;
      if (!start || !current) return '';
      if (state.tool === 'line' || state.tool === 'centerline' || state.tool === 'dim_h' || state.tool === 'dim_v' || state.tool === 'dim_aligned') {
        return `<g><line x1="${start.x}" y1="${start.y}" x2="${current.x}" y2="${current.y}" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${current.x + 8}" y="${current.y - 8}" fill="#0369a1" font-size="12">${dist(start, current).toFixed(2)} mm / ${angle(start, current).toFixed(1)}°</text></g>`;
      }
      if (state.tool === 'rect') {
        return `<rect x="${Math.min(start.x, current.x)}" y="${Math.min(start.y, current.y)}" width="${Math.abs(current.x - start.x)}" height="${Math.abs(current.y - start.y)}" fill="none" stroke="#0ea5e9" stroke-dasharray="4 4"/>`;
      }
      if (state.tool === 'circle' || state.tool === 'dim_radius' || state.tool === 'dim_diameter') {
        return `<circle cx="${start.x}" cy="${start.y}" r="${Math.max(3, dist(start, current))}" fill="none" stroke="#0ea5e9" stroke-dasharray="4 4"/>`;
      }
      return '';
    })() : '';

    svg.innerHTML = `${grid.join('')}${shapes}${renderDimensions()}${preview}`;
    renderLayersPanel();
    renderProperties();
    renderStatus();
  }

  function createObjectFromDrag(start, end) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
    const base = { id, layer: state.data.activeLayer, thickness: 1 };

    if (state.tool === 'line' || state.tool === 'centerline') {
      return { ...base, type: state.tool === 'centerline' ? 'centerline' : 'line', x: start.x, y: start.y, x2: end.x, y2: end.y };
    }
    if (state.tool === 'rect') {
      return { ...base, type: 'rect', x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    }
    if (state.tool === 'circle') {
      return { ...base, type: 'circle', x: start.x, y: start.y, radius: Number(dist(start, end).toFixed(2)) };
    }
    if (state.tool === 'arc') {
      return { ...base, type: 'arc', x: start.x, y: start.y, x2: end.x, y2: end.y, radius: Number(dist(start, end).toFixed(2)) };
    }
    if (state.tool === 'polyline') {
      return { ...base, type: 'line', x: start.x, y: start.y, x2: end.x, y2: end.y };
    }
    return null;
  }

  svg.addEventListener('mousedown', (evt) => {
    const p = getPoint(evt);
    state.pointer = p;

    if (state.tool === 'select') {
      const selected = hitTest(p);
      state.selectedId = selected ? selected.id : null;
      render();
      return;
    }

    if (state.tool === 'erase') {
      const selected = hitTest(p);
      if (selected) {
        pushHistory();
        state.data.objects = state.data.objects.filter((o) => o.id !== selected.id);
        if (state.selectedId === selected.id) state.selectedId = null;
        render();
      }
      return;
    }

    if (state.tool === 'text') {
      const text = prompt('Digite o texto técnico:', 'TEXTO') || '';
      if (!text) return;
      pushHistory();
      state.data.objects.push({ id: `${Date.now()}`, type: 'text', x: p.x, y: p.y, text, fontSize: 14, layer: state.data.activeLayer, thickness: 1 });
      render();
      return;
    }

    state.drawing = { start: p, current: p };
  });

  svg.addEventListener('mousemove', (evt) => {
    const p = getPoint(evt);
    state.pointer = p;
    if (state.drawing) state.drawing.current = p;
    renderStatus(p);
    if (state.drawing) render();
  });

  svg.addEventListener('mouseup', (evt) => {
    if (!state.drawing) return;
    const end = getPoint(evt);
    const start = state.drawing.start;

    if (state.tool.startsWith('dim_')) {
      pushHistory();
      if (state.tool === 'dim_radius' || state.tool === 'dim_diameter') {
        state.data.dimensions.push({ id: `${Date.now()}`, type: 'radius', cx: start.x, cy: start.y, px: end.x, py: end.y, value: Number(dist(start, end).toFixed(2)) });
      } else {
        state.data.dimensions.push({ id: `${Date.now()}`, type: 'linear', x1: start.x, y1: start.y, x2: end.x, y2: end.y, value: `${dist(start, end).toFixed(2)} mm` });
      }
    } else {
      const obj = createObjectFromDrag(start, end);
      if (obj) {
        pushHistory();
        state.data.objects.push(obj);
        state.selectedId = obj.id;
      }
    }

    state.drawing = null;
    render();
  });

  document.querySelectorAll('.cad-tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      document.querySelectorAll('.cad-tool').forEach((b) => b.classList.remove('btn-green'));
      btn.classList.add('btn-green');
    });
  });

  layerSelect?.addEventListener('change', () => { state.data.activeLayer = layerSelect.value; });
  document.getElementById('cadGridToggle')?.addEventListener('change', render);
  document.getElementById('cadSnapToggle')?.addEventListener('change', (e) => { state.data.snapEnabled = !!e.target.checked; });

  layersBox?.addEventListener('change', (e) => {
    const v = e.target.getAttribute('data-layer-visible');
    const l = e.target.getAttribute('data-layer-locked');
    if (v && state.data.layers[v]) state.data.layers[v].visible = e.target.checked;
    if (l && state.data.layers[l]) state.data.layers[l].locked = e.target.checked;
    render();
  });

  propsBox?.addEventListener('change', (e) => {
    const prop = e.target.getAttribute('data-prop');
    if (!prop || !state.selectedId) return;

    const obj = state.data.objects.find((o) => o.id === state.selectedId);
    if (!obj) return;

    pushHistory();
    const raw = e.target.value;
    const num = Number(raw);

    if (prop === 'length' && (obj.type === 'line' || obj.type === 'centerline')) {
      const currentLength = dist({ x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 });
      const targetLength = Number(raw);
      if (Number.isFinite(targetLength) && targetLength > 0 && currentLength > 0) {
        const ratio = targetLength / currentLength;
        obj.x2 = Number((obj.x + ((obj.x2 - obj.x) * ratio)).toFixed(2));
        obj.y2 = Number((obj.y + ((obj.y2 - obj.y) * ratio)).toFixed(2));
      }
    } else if (prop === 'angle' && (obj.type === 'line' || obj.type === 'centerline')) {
      const currentLength = dist({ x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 });
      if (Number.isFinite(num)) {
        const rad = (num * Math.PI) / 180;
        obj.x2 = Number((obj.x + Math.cos(rad) * currentLength).toFixed(2));
        obj.y2 = Number((obj.y + Math.sin(rad) * currentLength).toFixed(2));
      }
    } else {
      obj[prop] = Number.isFinite(num) && raw !== '' && prop !== 'layer' && prop !== 'text' ? num : raw;
    }

    render();
  });

  document.getElementById('cadUndoBtn')?.addEventListener('click', () => {
    if (!state.history.length) return;
    state.future.push(JSON.stringify(state.data));
    state.data = JSON.parse(state.history.pop());
    render();
  });

  document.getElementById('cadRedoBtn')?.addEventListener('click', () => {
    if (!state.future.length) return;
    state.history.push(JSON.stringify(state.data));
    state.data = JSON.parse(state.future.pop());
    render();
  });

  document.getElementById('cadSaveBtn')?.addEventListener('click', async () => {
    const res = await fetch(`/desenho-tecnico/cad/${initial.desenhoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data),
    });
    const json = await res.json();
    alert(json.ok ? 'CAD salvo com sucesso.' : `Erro ao salvar: ${json.error}`);
  });

  document.getElementById('cadMetaSaveBtn')?.addEventListener('click', async () => {
    const payload = {
      codigo: document.getElementById('cadMetaCodigo')?.value,
      titulo: document.getElementById('cadMetaTitulo')?.value,
      material: document.getElementById('cadMetaMaterial')?.value,
      equipamento_id: document.getElementById('cadMetaEquipamento')?.value,
      observacoes: document.getElementById('cadMetaObservacoes')?.value,
    };

    const res = await fetch(`/desenho-tecnico/cad/${initial.desenhoId}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) return alert(`Erro ao salvar metadados: ${json.error}`);

    state.data.codigo = payload.codigo || '';
    state.data.titulo = payload.titulo || '';
    state.data.material = payload.material || '';
    state.data.equipamento_id = payload.equipamento_id || null;
    state.data.observacoes = payload.observacoes || '';
    alert('Metadados salvos.');
  });

  render();
})();
