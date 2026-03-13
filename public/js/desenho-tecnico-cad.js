(function () {
  const initial = window.CAD_INITIAL || {};
  const svg = document.getElementById('cadCanvas');
  if (!svg) return;

  const state = {
    tool: 'select',
    selectedId: null,
    history: [],
    future: [],
    data: {
      gridStep: 25,
      snapEnabled: true,
      activeLayer: 'geometria_principal',
      layers: {
        geometria_principal: { color: '#0f172a', visible: true, locked: false },
        linhas_de_centro: { color: '#0ea5e9', visible: true, locked: false },
        cotas: { color: '#16a34a', visible: true, locked: false },
        textos: { color: '#7c3aed', visible: true, locked: false },
        furos: { color: '#dc2626', visible: true, locked: false },
        construcao: { color: '#64748b', visible: true, locked: false },
        observacoes: { color: '#ea580c', visible: true, locked: false },
      },
      objects: [],
      ...(initial.data || {}),
    },
  };

  const layerSelect = document.getElementById('cadLayerSelect');
  const layersBox = document.getElementById('cadLayers');
  const propsBox = document.getElementById('cadProperties');

  function snap(n) {
    if (!state.data.snapEnabled) return n;
    const step = Number(state.data.gridStep || 25);
    return Math.round(n / step) * step;
  }

  function pushHistory() {
    state.history.push(JSON.stringify(state.data));
    if (state.history.length > 80) state.history.shift();
    state.future = [];
  }

  function getPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 1200;
    const y = ((evt.clientY - rect.top) / rect.height) * 760;
    return { x: snap(x), y: snap(y) };
  }

  function renderLayersPanel() {
    const layers = Object.keys(state.data.layers || {});
    layerSelect.innerHTML = layers.map((name) => `<option value="${name}" ${state.data.activeLayer === name ? 'selected' : ''}>${name}</option>`).join('');
    layersBox.innerHTML = layers.map((name) => {
      const cfg = state.data.layers[name];
      return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;margin-bottom:4px;"><span>${name}</span><label><input type="checkbox" data-layer-visible="${name}" ${cfg.visible !== false ? 'checked' : ''}>visível</label><label><input type="checkbox" data-layer-locked="${name}" ${cfg.locked ? 'checked' : ''}>lock</label></div>`;
    }).join('');
  }

  function render() {
    const grid = [];
    for (let x = 0; x <= 1200; x += Number(state.data.gridStep || 25)) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="760" stroke="#f1f5f9"/>`);
    for (let y = 0; y <= 760; y += Number(state.data.gridStep || 25)) grid.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="#f1f5f9"/>`);

    const shapes = state.data.objects.map((obj) => {
      const layer = state.data.layers[obj.layer] || {};
      if (layer.visible === false) return '';
      const color = layer.color || '#0f172a';
      const activeStroke = obj.id === state.selectedId ? '#f59e0b' : color;
      if (obj.type === 'line') return `<line data-id="${obj.id}" x1="${obj.x}" y1="${obj.y}" x2="${obj.x2}" y2="${obj.y2}" stroke="${activeStroke}" stroke-width="2" />`;
      if (obj.type === 'rect') return `<rect data-id="${obj.id}" x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="none" stroke="${activeStroke}" />`;
      if (obj.type === 'circle' || obj.type === 'hole') return `<circle data-id="${obj.id}" cx="${obj.x}" cy="${obj.y}" r="${obj.radius}" fill="none" stroke="${activeStroke}" />`;
      if (obj.type === 'text' || obj.type === 'note') return `<text data-id="${obj.id}" x="${obj.x}" y="${obj.y}" fill="${activeStroke}" font-size="${obj.fontSize || 12}">${obj.text || 'Texto'}</text>`;
      if (obj.type === 'centerline') return `<line data-id="${obj.id}" x1="${obj.x}" y1="${obj.y}" x2="${obj.x2}" y2="${obj.y2}" stroke="${activeStroke}" stroke-dasharray="8 4"/>`;
      return '';
    }).join('');

    svg.innerHTML = `${document.getElementById('cadGridToggle')?.checked ? grid.join('') : ''}${shapes}`;
    renderLayersPanel();
    renderProperties();
  }

  function renderProperties() {
    const selected = state.data.objects.find((obj) => obj.id === state.selectedId);
    if (!selected) { propsBox.innerHTML = 'Selecione um objeto para editar propriedades.'; return; }
    propsBox.innerHTML = `<div style="display:grid;gap:6px;"><b>${selected.type}</b><label>X <input class="input" data-prop="x" value="${selected.x ?? ''}"></label><label>Y <input class="input" data-prop="y" value="${selected.y ?? ''}"></label><label>Espessura <input class="input" data-prop="thickness" value="${selected.thickness ?? ''}"></label><label>Camada <input class="input" data-prop="layer" value="${selected.layer ?? ''}"></label></div>`;
  }

  let startPoint = null;
  svg.addEventListener('mousedown', (evt) => { startPoint = getPoint(evt); });
  svg.addEventListener('mouseup', (evt) => {
    const end = getPoint(evt);
    if (!startPoint) return;

    if (state.tool === 'select') {
      const target = evt.target.closest('[data-id]');
      state.selectedId = target ? target.getAttribute('data-id') : null;
      render();
      return;
    }

    pushHistory();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const base = { id, layer: state.data.activeLayer, thickness: 1 };

    if (state.tool === 'line' || state.tool === 'dim_h' || state.tool === 'dim_v' || state.tool === 'dim_angle' || state.tool === 'dim_centers') {
      state.data.objects.push({ ...base, type: state.tool.startsWith('dim_') ? 'centerline' : 'line', x: startPoint.x, y: startPoint.y, x2: end.x, y2: end.y });
    } else if (state.tool === 'rect') {
      state.data.objects.push({ ...base, type: 'rect', x: Math.min(startPoint.x, end.x), y: Math.min(startPoint.y, end.y), width: Math.abs(end.x - startPoint.x), height: Math.abs(end.y - startPoint.y) });
    } else if (state.tool === 'circle' || state.tool === 'hole' || state.tool === 'dim_diameter' || state.tool === 'dim_radius' || state.tool === 'center_mark') {
      const radius = Math.max(4, Math.round(Math.hypot(end.x - startPoint.x, end.y - startPoint.y)));
      state.data.objects.push({ ...base, type: state.tool === 'hole' ? 'hole' : 'circle', x: startPoint.x, y: startPoint.y, radius });
    } else if (state.tool === 'text' || state.tool === 'note') {
      const text = prompt('Digite o texto técnico:', state.tool === 'text' ? 'TEXTO' : 'OBSERVAÇÃO') || '';
      if (text) state.data.objects.push({ ...base, type: state.tool === 'text' ? 'text' : 'note', x: end.x, y: end.y, text, fontSize: 12 });
    } else if (state.tool === 'arc') {
      state.data.objects.push({ ...base, type: 'arc', x: startPoint.x, y: startPoint.y, x2: end.x, y2: end.y, radius: Math.max(8, Math.abs(end.x - startPoint.x)) });
    } else if (state.tool === 'polyline') {
      state.data.objects.push({ ...base, type: 'line', x: startPoint.x, y: startPoint.y, x2: end.x, y2: end.y });
    } else if (state.tool === 'erase' && state.selectedId) {
      state.data.objects = state.data.objects.filter((obj) => obj.id !== state.selectedId);
      state.selectedId = null;
    }

    render();
  });

  document.querySelectorAll('.cad-tool').forEach((btn) => {
    btn.addEventListener('click', () => { state.tool = btn.dataset.tool; });
  });

  layerSelect.addEventListener('change', () => { state.data.activeLayer = layerSelect.value; });
  document.getElementById('cadGridToggle').addEventListener('change', render);
  document.getElementById('cadSnapToggle').addEventListener('change', (e) => { state.data.snapEnabled = e.target.checked; });

  layersBox.addEventListener('change', (e) => {
    const visibleLayer = e.target.getAttribute('data-layer-visible');
    const lockedLayer = e.target.getAttribute('data-layer-locked');
    if (visibleLayer) state.data.layers[visibleLayer].visible = e.target.checked;
    if (lockedLayer) state.data.layers[lockedLayer].locked = e.target.checked;
    render();
  });

  propsBox.addEventListener('change', (e) => {
    const prop = e.target.getAttribute('data-prop');
    if (!prop || !state.selectedId) return;
    const target = state.data.objects.find((obj) => obj.id === state.selectedId);
    if (!target) return;
    target[prop] = ['layer'].includes(prop) ? e.target.value : Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : e.target.value;
    render();
  });

  document.getElementById('cadUndoBtn').addEventListener('click', () => {
    if (!state.history.length) return;
    state.future.push(JSON.stringify(state.data));
    state.data = JSON.parse(state.history.pop());
    render();
  });

  document.getElementById('cadRedoBtn').addEventListener('click', () => {
    if (!state.future.length) return;
    state.history.push(JSON.stringify(state.data));
    state.data = JSON.parse(state.future.pop());
    render();
  });

  document.getElementById('cadSaveBtn').addEventListener('click', async () => {
    const res = await fetch(`/desenho-tecnico/cad/${initial.desenhoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...state.data }),
    });
    const json = await res.json();
    alert(json.ok ? 'CAD salvo com sucesso.' : `Erro ao salvar: ${json.error}`);
  });

  document.getElementById('cadRender3dBtn').addEventListener('click', async () => {
    const r = await fetch(`/desenho-tecnico/cad/${initial.desenhoId}/render-3d`, { method: 'POST' });
    const data = await r.json();
    const ctx = document.getElementById('cad3dCanvas').getContext('2d');
    ctx.clearRect(0, 0, 320, 220);
    if (!data.ok) {
      document.getElementById('cad3dHint').textContent = data.error;
      return;
    }
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.2;
    (data.preview3d.items || []).forEach((item, idx) => {
      const z = Math.max(8, Number(item.thickness || 8));
      const ox = 18 + idx * 10;
      const oy = 30 + idx * 8;
      if (item.type === 'rect') {
        ctx.strokeRect(ox + item.x * 0.2, oy + item.y * 0.2, Math.max(6, item.width * 0.2), Math.max(6, item.height * 0.2));
        ctx.strokeRect(ox + z + item.x * 0.2, oy - z + item.y * 0.2, Math.max(6, item.width * 0.2), Math.max(6, item.height * 0.2));
      }
      if (item.type === 'circle') {
        ctx.beginPath(); ctx.arc(ox + item.x * 0.2, oy + item.y * 0.2, Math.max(4, item.radius * 0.2), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ox + z + item.x * 0.2, oy - z + item.y * 0.2, Math.max(4, item.radius * 0.2), 0, Math.PI * 2); ctx.stroke();
      }
    });
    document.getElementById('cad3dHint').textContent = `Prévia 3D simplificada (${(data.preview3d.items || []).length} extrusão(ões)).`;
  });

  render();
})();
