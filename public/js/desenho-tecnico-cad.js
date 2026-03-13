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
    viewport: { zoom: 1, panX: 0, panY: 0, panning: false, panStart: null },
    history: [],
    future: [],
    data: {
      gridStep: 20,
      snapEnabled: true,
      snapEndpoint: true,
      snapCenter: true,
      showGrid: true,
      activeLayer: 'geometria_principal',
      layers: {},
      objects: [],
      dimensions: [],
      ...(initial.data || {}),
    },
  };

  if (!Object.keys(state.data.layers || {}).length) {
    state.data.layers = {
      geometria_principal: { color: '#d9e3f0', visible: true, locked: false },
      linhas_de_centro: { color: '#38bdf8', visible: true, locked: false },
      cotas: { color: '#4ade80', visible: true, locked: false },
      textos: { color: '#a78bfa', visible: true, locked: false },
      construcao: { color: '#94a3b8', visible: true, locked: false },
      observacoes: { color: '#f59e0b', visible: true, locked: false },
    };
  }

  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  const dist = (a, b) => Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
  const angle = (a, b) => (Math.atan2((b.y || 0) - (a.y || 0), (b.x || 0) - (a.x || 0)) * 180) / Math.PI;
  const objectLength = (o) => (o.type === 'line' || o.type === 'centerline') ? Number(dist({ x: o.x, y: o.y }, { x: o.x2, y: o.y2 }).toFixed(2)) : null;

  function pushHistory() {
    state.history.push(JSON.stringify(state.data));
    if (state.history.length > 150) state.history.shift();
    state.future = [];
  }

  function nearestSnap(raw) {
    const candidates = [];
    if (state.data.snapEndpoint) {
      for (const obj of state.data.objects) {
        if (obj.x != null && obj.y != null) candidates.push({ x: obj.x, y: obj.y });
        if (obj.x2 != null && obj.y2 != null) candidates.push({ x: obj.x2, y: obj.y2 });
      }
    }
    if (state.data.snapCenter) {
      for (const obj of state.data.objects) {
        if (obj.type === 'circle') candidates.push({ x: obj.x, y: obj.y });
      }
    }
    let best = null;
    for (const c of candidates) {
      const d = dist(raw, c);
      if (d <= 12 && (!best || d < best.d)) best = { ...c, d };
    }
    return best;
  }

  function getPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const xCanvas = ((evt.clientX - rect.left) / rect.width) * 1600;
    const yCanvas = ((evt.clientY - rect.top) / rect.height) * 900;
    const xRaw = (xCanvas - state.viewport.panX) / state.viewport.zoom;
    const yRaw = (yCanvas - state.viewport.panY) / state.viewport.zoom;

    let x = xRaw;
    let y = yRaw;
    if (state.data.snapEnabled) {
      const step = Number(state.data.gridStep || 20);
      x = Math.round(x / step) * step;
      y = Math.round(y / step) * step;
    }

    const snap = nearestSnap({ x, y });
    if (snap) {
      x = snap.x;
      y = snap.y;
    }

    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), rawX: xRaw, rawY: yRaw };
  }

  function hitTest(point) {
    let best = null;
    for (const obj of state.data.objects) {
      if ((obj.type === 'line' || obj.type === 'centerline') && point.x >= Math.min(obj.x, obj.x2) - 8 && point.x <= Math.max(obj.x, obj.x2) + 8 && point.y >= Math.min(obj.y, obj.y2) - 8 && point.y <= Math.max(obj.y, obj.y2) + 8) best = obj;
      if (obj.type === 'rect' && point.x >= obj.x && point.x <= obj.x + obj.width && point.y >= obj.y && point.y <= obj.y + obj.height) best = obj;
      if (obj.type === 'circle' && dist(point, { x: obj.x, y: obj.y }) <= obj.radius + 6) best = obj;
      if (obj.type === 'text' && Math.abs(point.x - obj.x) <= 28 && Math.abs(point.y - obj.y) <= 16) best = obj;
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

  function renderProperties() {
    const o = state.data.objects.find((i) => i.id === state.selectedId);
    if (!o) return (propsBox.innerHTML = 'Selecione um objeto para editar propriedades.');
    propsBox.innerHTML = `<div class="cad-prop-grid">
      <div><b>Tipo:</b> ${o.type}</div>
      ${objectLength(o) != null ? `<label>Comprimento <input class="input" data-prop="length" value="${objectLength(o)}"></label>` : ''}
      ${(o.type === 'line' || o.type === 'centerline') ? `<label>Ângulo <input class="input" data-prop="angle" value="${Number(angle({ x: o.x, y: o.y }, { x: o.x2, y: o.y2 }).toFixed(2))}"></label>` : ''}
      <label>X1 <input class="input" data-prop="x" value="${o.x ?? ''}"></label>
      <label>Y1 <input class="input" data-prop="y" value="${o.y ?? ''}"></label>
      ${o.x2 != null ? `<label>X2 <input class="input" data-prop="x2" value="${o.x2}"></label>` : ''}
      ${o.y2 != null ? `<label>Y2 <input class="input" data-prop="y2" value="${o.y2}"></label>` : ''}
      ${o.width != null ? `<label>Largura <input class="input" data-prop="width" value="${o.width}"></label>` : ''}
      ${o.height != null ? `<label>Altura <input class="input" data-prop="height" value="${o.height}"></label>` : ''}
      ${o.radius != null ? `<label>Raio <input class="input" data-prop="radius" value="${o.radius}"></label>` : ''}
      ${o.text != null ? `<label>Texto <input class="input" data-prop="text" value="${o.text}"></label>` : ''}
      <label>Camada <input class="input" data-prop="layer" value="${o.layer || ''}"></label>
      <label>Espessura <input class="input" data-prop="thickness" value="${o.thickness || 1}"></label>
    </div>`;
  }

  function renderStatus(preview) {
    const p = preview || state.pointer;
    let text = `Cursor: X ${p.x.toFixed(1)} / Y ${p.y.toFixed(1)}`;
    if (state.drawing?.start) {
      text += ` • Comprimento: ${dist(state.drawing.start, p).toFixed(2)} mm • Ângulo: ${angle(state.drawing.start, p).toFixed(1)}°`;
    }
    statusBar.textContent = text;
  }

  function render() {
    const showGrid = document.getElementById('cadGridToggle')?.checked !== false;
    const step = Number(state.data.gridStep || 20);
    const grid = [];
    if (showGrid) {
      for (let x = 0; x <= 1600; x += step) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="900" stroke="#1f2937" stroke-width="0.7"/>`);
      for (let y = 0; y <= 900; y += step) grid.push(`<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#1f2937" stroke-width="0.7"/>`);
    }

    const shapes = state.data.objects.map((o) => {
      const layer = state.data.layers[o.layer] || {};
      if (layer.visible === false) return '';
      const stroke = o.id === state.selectedId ? '#f59e0b' : (layer.color || '#d9e3f0');
      if (o.type === 'line' || o.type === 'centerline') return `<g><line x1="${o.x}" y1="${o.y}" x2="${o.x2}" y2="${o.y2}" stroke="${stroke}" stroke-width="${o.thickness || 1.5}" ${o.type === 'centerline' ? 'stroke-dasharray="8 5"' : ''}/><text x="${(o.x + o.x2) / 2 + 6}" y="${(o.y + o.y2) / 2 - 6}" fill="#93c5fd" font-size="12">${objectLength(o)} mm</text></g>`;
      if (o.type === 'rect') return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="none" stroke="${stroke}" stroke-width="${o.thickness || 1.5}"/>`;
      if (o.type === 'circle') return `<circle cx="${o.x}" cy="${o.y}" r="${o.radius}" fill="none" stroke="${stroke}" stroke-width="${o.thickness || 1.5}"/>`;
      if (o.type === 'arc') return `<path d="M ${o.x} ${o.y} Q ${(o.x + o.x2) / 2} ${o.y - (o.radius || 40)} ${o.x2} ${o.y2}" fill="none" stroke="${stroke}" stroke-width="${o.thickness || 1.5}"/>`;
      if (o.type === 'text') return `<text x="${o.x}" y="${o.y}" fill="${stroke}" font-size="${o.fontSize || 14}">${o.text || 'Texto'}</text>`;
      return '';
    }).join('');

    const dimensions = (state.data.dimensions || []).map((d) => d.type === 'radius'
      ? `<g><line x1="${d.cx}" y1="${d.cy}" x2="${d.px}" y2="${d.py}" stroke="#4ade80"/><text x="${d.px + 6}" y="${d.py - 6}" fill="#4ade80" font-size="12">R ${d.value}</text></g>`
      : `<g><line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#4ade80" stroke-dasharray="6 4"/><text x="${(d.x1 + d.x2) / 2 + 6}" y="${(d.y1 + d.y2) / 2 - 6}" fill="#4ade80" font-size="12">${d.value}</text></g>`).join('');

    const preview = state.drawing ? (() => {
      const { start, current } = state.drawing;
      if (!start || !current) return '';
      if (['line', 'centerline', 'dim_h', 'dim_v', 'dim_aligned'].includes(state.tool)) return `<g><line x1="${start.x}" y1="${start.y}" x2="${current.x}" y2="${current.y}" stroke="#38bdf8" stroke-dasharray="4 4"/><text x="${current.x + 8}" y="${current.y - 8}" fill="#38bdf8" font-size="12">${dist(start, current).toFixed(2)} mm • ${angle(start, current).toFixed(1)}°</text></g>`;
      if (state.tool === 'rect') return `<rect x="${Math.min(start.x, current.x)}" y="${Math.min(start.y, current.y)}" width="${Math.abs(current.x - start.x)}" height="${Math.abs(current.y - start.y)}" fill="none" stroke="#38bdf8" stroke-dasharray="4 4"/>`;
      if (['circle', 'dim_radius', 'dim_diameter'].includes(state.tool)) return `<circle cx="${start.x}" cy="${start.y}" r="${Math.max(3, dist(start, current))}" fill="none" stroke="#38bdf8" stroke-dasharray="4 4"/>`;
      return '';
    })() : '';

    svg.innerHTML = `<g transform="translate(${state.viewport.panX} ${state.viewport.panY}) scale(${state.viewport.zoom})">${grid.join('')}${shapes}${dimensions}${preview}</g>`;
    renderLayersPanel();
    renderProperties();
    renderStatus();
  }

  function createObjectFromDrag(start, end) {
    const base = { id: uid(), layer: state.data.activeLayer, thickness: 1.5 };
    if (['line', 'centerline'].includes(state.tool)) return { ...base, type: state.tool, x: start.x, y: start.y, x2: end.x, y2: end.y };
    if (state.tool === 'rect') return { ...base, type: 'rect', x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    if (state.tool === 'circle') return { ...base, type: 'circle', x: start.x, y: start.y, radius: Number(dist(start, end).toFixed(2)) };
    if (state.tool === 'arc') return { ...base, type: 'arc', x: start.x, y: start.y, x2: end.x, y2: end.y, radius: Number(dist(start, end).toFixed(2)) };
    if (state.tool === 'polyline') return { ...base, type: 'line', x: start.x, y: start.y, x2: end.x, y2: end.y };
    return null;
  }

  svg.addEventListener('mousedown', (evt) => {
    if (evt.button === 1 || state.tool === 'pan') {
      state.viewport.panning = true;
      state.viewport.panStart = { x: evt.clientX, y: evt.clientY, panX: state.viewport.panX, panY: state.viewport.panY };
      return;
    }
    const p = getPoint(evt);
    state.pointer = p;
    if (state.tool === 'select') {
      state.selectedId = hitTest(p)?.id || null;
      return render();
    }
    if (state.tool === 'erase') {
      const selected = hitTest(p);
      if (selected) {
        pushHistory();
        state.data.objects = state.data.objects.filter((o) => o.id !== selected.id);
      }
      state.selectedId = null;
      return render();
    }
    if (state.tool === 'text') {
      const text = prompt('Digite o texto técnico:', 'TEXTO') || '';
      if (!text) return;
      pushHistory();
      state.data.objects.push({ id: uid(), type: 'text', x: p.x, y: p.y, text, fontSize: 14, layer: state.data.activeLayer, thickness: 1 });
      return render();
    }
    state.drawing = { start: p, current: p };
  });

  svg.addEventListener('mousemove', (evt) => {
    if (state.viewport.panning && state.viewport.panStart) {
      const dx = evt.clientX - state.viewport.panStart.x;
      const dy = evt.clientY - state.viewport.panStart.y;
      state.viewport.panX = state.viewport.panStart.panX + dx;
      state.viewport.panY = state.viewport.panStart.panY + dy;
      return render();
    }
    const p = getPoint(evt);
    state.pointer = p;
    if (state.drawing) {
      state.drawing.current = p;
      render();
    } else {
      renderStatus(p);
    }
  });

  svg.addEventListener('mouseup', (evt) => {
    if (state.viewport.panning) {
      state.viewport.panning = false;
      state.viewport.panStart = null;
      return;
    }
    if (!state.drawing) return;
    const end = getPoint(evt);
    const start = state.drawing.start;
    pushHistory();
    if (state.tool.startsWith('dim_')) {
      if (['dim_radius', 'dim_diameter'].includes(state.tool)) state.data.dimensions.push({ id: uid(), type: 'radius', cx: start.x, cy: start.y, px: end.x, py: end.y, value: Number(dist(start, end).toFixed(2)) });
      else state.data.dimensions.push({ id: uid(), type: 'linear', x1: start.x, y1: start.y, x2: end.x, y2: end.y, value: `${dist(start, end).toFixed(2)} mm` });
    } else {
      const obj = createObjectFromDrag(start, end);
      if (obj) {
        state.data.objects.push(obj);
        state.selectedId = obj.id;
      }
    }
    state.drawing = null;
    render();
  });

  svg.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const factor = evt.deltaY < 0 ? 1.1 : 0.9;
    state.viewport.zoom = Math.max(0.5, Math.min(3.5, state.viewport.zoom * factor));
    render();
  }, { passive: false });

  document.querySelectorAll('.cad-tool').forEach((b) => b.addEventListener('click', () => {
    state.tool = b.dataset.tool;
    document.querySelectorAll('.cad-tool').forEach((x) => x.classList.remove('btn-green'));
    b.classList.add('btn-green');
  }));

  layerSelect?.addEventListener('change', () => { state.data.activeLayer = layerSelect.value; });
  document.getElementById('cadGridToggle')?.addEventListener('change', () => render());
  document.getElementById('cadSnapToggle')?.addEventListener('change', (e) => { state.data.snapEnabled = e.target.checked; });
  document.getElementById('cadSnapEndpointToggle')?.addEventListener('change', (e) => { state.data.snapEndpoint = e.target.checked; });
  document.getElementById('cadSnapCenterToggle')?.addEventListener('change', (e) => { state.data.snapCenter = e.target.checked; });

  layersBox?.addEventListener('change', (e) => {
    const visible = e.target.getAttribute('data-layer-visible');
    const locked = e.target.getAttribute('data-layer-locked');
    if (visible && state.data.layers[visible]) state.data.layers[visible].visible = e.target.checked;
    if (locked && state.data.layers[locked]) state.data.layers[locked].locked = e.target.checked;
    render();
  });

  propsBox?.addEventListener('change', (e) => {
    const prop = e.target.getAttribute('data-prop');
    const obj = state.data.objects.find((o) => o.id === state.selectedId);
    if (!prop || !obj) return;
    pushHistory();
    const raw = e.target.value;
    const num = Number(raw);
    if (prop === 'length' && ['line', 'centerline'].includes(obj.type)) {
      const current = dist({ x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 });
      const target = Number(raw);
      if (Number.isFinite(target) && target > 0 && current > 0) {
        const ratio = target / current;
        obj.x2 = Number((obj.x + (obj.x2 - obj.x) * ratio).toFixed(2));
        obj.y2 = Number((obj.y + (obj.y2 - obj.y) * ratio).toFixed(2));
      }
    } else if (prop === 'angle' && ['line', 'centerline'].includes(obj.type) && Number.isFinite(num)) {
      const current = dist({ x: obj.x, y: obj.y }, { x: obj.x2, y: obj.y2 });
      const rad = (num * Math.PI) / 180;
      obj.x2 = Number((obj.x + Math.cos(rad) * current).toFixed(2));
      obj.y2 = Number((obj.y + Math.sin(rad) * current).toFixed(2));
    } else {
      obj[prop] = (raw !== '' && Number.isFinite(num) && !['layer', 'text'].includes(prop)) ? num : raw;
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
    Object.assign(state.data, {
      codigo: payload.codigo || '',
      titulo: payload.titulo || '',
      material: payload.material || '',
      equipamento_id: payload.equipamento_id || null,
      observacoes: payload.observacoes || '',
    });
    alert('Metadados salvos.');
  });

  render();
})();
