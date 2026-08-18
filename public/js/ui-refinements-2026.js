/* Ajustes de interface incrementais — Agosto/2026
   Reorganiza ações existentes sem alterar rotas, permissões ou regras de negócio. */
(function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function visibleText(el) {
    return normalizeText(el?.textContent || el?.value || '');
  }

  function markOsActions() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/os' && path !== '/ordens-servico') return;

    const candidates = Array.from(
      document.querySelectorAll('.content a, .content button, main a, main button')
    );

    let primary = null;
    let operational = null;
    let pdf = null;

    candidates.forEach((el) => {
      const text = visibleText(el);

      if (!primary && (text === '+ nova os' || text === 'nova os' || text.includes('nova os'))) {
        primary = el;
        el.classList.add('os-primary-action');
      }

      if (!operational && text.includes('painel operacional')) {
        operational = el;
        el.classList.add('os-operational-action');
      }

      if (!pdf && (text.includes('pdf das os') || text.includes('pdf da os'))) {
        pdf = el;
        el.classList.add('os-pdf-action');
      }
    });

    const existing = [primary, operational, pdf].filter(Boolean);
    if (existing.length < 2) return;

    const sameParent = existing.every((el) => el.parentElement === existing[0].parentElement);
    if (sameParent && existing[0].parentElement) {
      existing[0].parentElement.classList.add('os-page-actions');
    }
  }

  function hideFilterSelect(select) {
    if (!select || select.dataset.uiRefinementHidden === '1') return;
    select.dataset.uiRefinementHidden = '1';

    let wrapper = select.parentElement;
    let depth = 0;

    while (wrapper && depth < 3 && !wrapper.classList.contains('content')) {
      const otherControls = wrapper.querySelectorAll('input, select, textarea, button, a').length;
      if (otherControls <= 1) break;
      wrapper = wrapper.parentElement;
      depth += 1;
    }

    (wrapper || select).classList.add('ui-dashboard-filter-hidden');
  }

  function findCardFromLabel(el) {
    let current = el;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      const cls = normalizeText(current.className || '');
      if (
        cls.includes('card') ||
        cls.includes('kpi') ||
        cls.includes('metric') ||
        cls.includes('stat') ||
        cls.includes('indicador')
      ) {
        return current;
      }
    }
    return null;
  }

  function cleanKpiIcons() {
    const labels = [
      'os abertas',
      'em andamento',
      'os atrasadas',
      'preventivas pendentes',
      'equipamentos criticos',
      'demandas ativas',
    ];

    const textNodes = Array.from(document.querySelectorAll('.content *'));

    labels.forEach((label) => {
      const labelEl = textNodes.find((el) => visibleText(el) === label);
      if (!labelEl) return;

      const card = findCardFromLabel(labelEl);
      if (!card) return;

      card.classList.add('ui-kpi-clean');

      const decorative = card.querySelectorAll(
        'svg, i, [class*="icon"], [class*="Icon"], [class*="symbol"], [class*="Symbol"]'
      );

      decorative.forEach((el) => {
        if (el.closest('a, button')) return;
        if (el.contains(labelEl) || labelEl.contains(el)) return;
        el.classList.add('ui-kpi-decorative-hidden');
      });
    });
  }

  function refineDashboard() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/dashboard' && path !== '/') return;

    Array.from(document.querySelectorAll('.content select')).forEach((select) => {
      const selectedText = normalizeText(
        select.options?.[select.selectedIndex]?.text || select.getAttribute('aria-label') || ''
      );

      if (selectedText === 'ultimos 30 dias' || selectedText === 'todos os setores') {
        hideFilterSelect(select);
      }
    });

    Array.from(document.querySelectorAll('.content a, .content button')).forEach((el) => {
      const text = visibleText(el);
      if (text === 'atualizar' || text === 'modo tv' || text.includes('modo tv')) {
        el.classList.add('ui-compact-action');
      }
    });

    cleanKpiIcons();
  }

  function run() {
    markOsActions();
    refineDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
