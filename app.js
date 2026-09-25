const content = document.querySelector('#content');
const view = document.body.dataset.view;

const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-IE');

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const titleCase = (value) => String(value ?? '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return 'Not evidenced';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const monetary = /(cash|revenue|profit|expense|cost|payable|receivable|inventory|ppe|loan|principal|interest|depreciation|debt|equity|assets|liabilities|amount|cogs|flow|advance|deposit|distribution|writeoff|provision|rent|marketing|software|utilities|repair|payroll)/i.test(key);
    return monetary ? money.format(value) : number.format(value);
  }
  if (Array.isArray(value)) return value.map((item) => formatValue(item, key)).join(' to ');
  if (typeof value === 'object') {
    return Object.entries(value).map(([childKey, childValue]) => `${titleCase(childKey)}: ${formatValue(childValue, childKey)}`).join(' | ');
  }
  return String(value);
};

const badge = (text, className = '') => `<span class="badge ${escapeHtml(className)}">${escapeHtml(text)}</span>`;
const evidenceList = (evidence = []) => `<ul class="evidence-list">${evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

const financialRows = (obj) => {
  const entries = Object.entries(obj ?? {});
  return `<dl class="financial-list">${entries.map(([key, value], index) => {
    const isTotal = /total|closing|net profit|gross profit|operating profit|net change/i.test(titleCase(key)) || index === entries.length - 1;
    return `<div class="financial-row ${isTotal ? 'total' : ''}"><dt>${escapeHtml(titleCase(key))}</dt><dd>${escapeHtml(formatValue(value, key))}</dd></div>`;
  }).join('')}</dl>`;
};

const answerSummary = (answer) => escapeHtml(formatValue(answer));
const effectSummary = (effect = {}) => Object.entries(effect).map(([key, value]) => `${titleCase(key)} ${formatValue(value, key)}`).join(' | ');

const judgmentExplanation = (decision) => {
  const alternative = decision.alternativeTreatment;
  return `<div class="judgment-explanation">
    <h5>Student judgment</h5>
    <p>${escapeHtml(decision.studentReasoning ?? 'No student reasoning recorded.')}</p>
    <div class="judgment-evidence"><strong>Evidence considered</strong>${evidenceList(decision.evidence)}</div>
    ${alternative ? `<aside class="alternative-callout">
      <strong>Alternative without the disposal provision</strong>
      <p><b>Selected-case assumption:</b> ${escapeHtml(alternative.assumption)}</p>
      <p><b>Alternative treatment:</b> ${escapeHtml(alternative.treatment)}</p>
      <div class="effect-line">Effect versus selected case | ${escapeHtml(effectSummary(alternative.effectComparedWithSelected))}</div>
      <div class="effect-line">Alternative statements | ${escapeHtml(formatValue(alternative.alternativeStatements))}</div>
    </aside>` : ''}
  </div>`;
};

async function loadSubmission() {
  const response = await fetch('/submission.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Submission data returned ${response.status}`);
  return response.json();
}

function renderDecisionTable(decisions, targetId = 'decision-results') {
  const target = document.querySelector(`#${targetId}`);
  if (!target) return;
  if (!decisions.length) {
    target.innerHTML = '<div class="empty-state">No decisions match these filters.</div>';
    return;
  }
  target.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Question and answer</th><th>Tier</th><th>Confidence</th><th>Evidence</th></tr></thead>
    <tbody>${decisions.map((decision) => `<tr>
      <td class="decision-id">${escapeHtml(decision.id)}</td>
      <td class="answer-text"><strong>${escapeHtml(decision.question)}</strong><div>${answerSummary(decision.answer)}</div></td>
      <td>${badge(titleCase(decision.reviewTier), decision.reviewTier === 'material_judgment' ? 'material' : 'operational')}</td>
      <td>${badge(titleCase(decision.confidence), decision.confidence)}</td>
      <td>${evidenceList(decision.evidence)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function installDecisionFilters(decisions) {
  const search = document.querySelector('#decision-search');
  const tier = document.querySelector('#decision-tier');
  const category = document.querySelector('#decision-category');
  const confidence = document.querySelector('#decision-confidence');
  const run = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = decisions.filter((decision) => {
      const haystack = `${decision.id} ${decision.question} ${formatValue(decision.answer)} ${(decision.evidence ?? []).join(' ')}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!tier.value || decision.reviewTier === tier.value)
        && (!category.value || decision.category === category.value)
        && (!confidence.value || decision.confidence === confidence.value);
    });
    renderDecisionTable(filtered);
    document.querySelector('#decision-count').textContent = `${filtered.length} of ${decisions.length}`;
  };
  [search, tier, category, confidence].forEach((element) => element.addEventListener('input', run));
  run();
}

function renderMain(data) {
  const pnl = data.statements?.profitAndLoss ?? {};
  const cash = data.statements?.cashFlow ?? {};
  const bs = data.statements?.balanceSheet ?? {};
  const material = data.decisions.filter((d) => d.reviewTier === 'material_judgment');
  const lowConfidence = data.decisions.filter((d) => d.confidence === 'low').length;
  const board = data.boardRecommendation ?? {};

  content.innerHTML = `
    <section class="hero-grid" aria-labelledby="case-title">
      <div class="hero">
        <p class="eyebrow">DPI-HT-01 | takeover reconstruction</p>
        <h1 id="case-title">Evidence before valuation.</h1>
        <p>The management deck claimed exceptional profit. This review rebuilds the accounts from bank records, accepted contracts, supplier evidence, physical stock, payroll, debt, and subsequent confirmations.</p>
        <div class="hero-meta"><span>Reporting date 31 Aug 2026</span><span>Currency EUR</span><span>100 evidence-linked decisions</span></div>
      </div>
      <aside class="board-card">
        <div><p class="eyebrow">Board position</p><h2>Correct the accounts first</h2><p>${escapeHtml(board.decision ?? 'Board recommendation pending.')}</p></div>
        <div class="verdict">Management profit is not suitable for earn-out valuation.</div>
      </aside>
    </section>
    <section class="metric-grid" aria-label="Headline figures">
      <div class="metric good"><span>Revenue</span><strong>${money.format(pnl.revenue ?? 0)}</strong></div>
      <div class="metric good"><span>Net profit</span><strong>${money.format(pnl.netProfit ?? 0)}</strong></div>
      <div class="metric warn"><span>Closing cash</span><strong>${money.format(cash.closingCash ?? 0)}</strong></div>
      <div class="metric"><span>Net receivables</span><strong>${money.format(bs.netReceivables ?? 0)}</strong></div>
      <div class="metric"><span>Total assets</span><strong>${money.format(bs.totalAssets ?? 0)}</strong></div>
      <div class="metric ${lowConfidence ? 'warn' : 'good'}"><span>Low confidence</span><strong>${lowConfidence}</strong></div>
    </section>
    <nav class="section-nav" aria-label="Case sections">
      <a href="#statements">Statements</a><a href="#schedules">Schedules</a><a href="#decisions">100 decisions</a><a href="#trail">AI review trail</a><a href="#evidence">Evidence</a><a href="#reconciliations">Reconciliations</a><a href="#uncertainty">Uncertainty</a><a href="#board">Board actions</a>
    </nav>
    <section class="panel" id="statements">
      <div class="panel-heading"><div><h2>Three statements</h2><p>Linked reconstruction at 31 August 2026.</p></div></div>
      <div class="statement-grid">
        <article class="statement-card"><h3>Profit and Loss</h3>${financialRows(pnl)}</article>
        <article class="statement-card"><h3>Cash Flow</h3>${financialRows(cash)}</article>
        <article class="statement-card"><h3>Balance Sheet</h3>${financialRows(bs)}</article>
      </div>
    </section>
    <section class="panel" id="schedules">
      <div class="panel-heading"><div><h2>Supporting schedules</h2><p>Revenue, working capital, payroll, PPE, debt, and equity.</p></div></div>
      <div class="schedule-grid">${Object.entries(data.schedules ?? {}).map(([name, values]) => `<article class="schedule-card"><h3>${escapeHtml(titleCase(name))}</h3>${financialRows(values)}</article>`).join('')}</div>
    </section>
    <section class="panel" id="decisions">
      <div class="panel-heading"><div><h2>Decision register</h2><p>Every answer links to evidence and carries a confidence assessment.</p></div><span class="count-chip" id="decision-count">${data.decisions.length}</span></div>
      <div class="filter-bar">
        <input id="decision-search" type="search" placeholder="Search ID, question, answer, or evidence" aria-label="Search decisions" />
        <select id="decision-tier" aria-label="Filter by review tier"><option value="">All tiers</option><option value="material_judgment">Material judgments</option><option value="operational">Operational</option></select>
        <select id="decision-category" aria-label="Filter by category"><option value="">All categories</option><option value="evidence_matching">Evidence matching</option><option value="classification">Classification</option><option value="estimation">Estimation</option><option value="board_decision">Board decision</option></select>
        <select id="decision-confidence" aria-label="Filter by confidence"><option value="">All confidence</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      </div>
      <div id="decision-results"></div>
    </section>
    <section class="panel" id="trail">
      <div class="panel-heading"><div><h2>AI review trail</h2><p>Agent 1 proposal, independent Agent 2 challenge, and certified student answer for all 25 material judgments.</p></div><span class="count-chip">${material.length} judgments</span></div>
      <div class="trail-list">${material.map((decision) => `<article class="trail-item">
        <div class="trail-head"><h3><span class="decision-id">${escapeHtml(decision.id)}</span> ${escapeHtml(decision.question)}</h3><div>${badge(titleCase(decision.confidence), decision.confidence)} ${decision.agentDisagreement ? badge('Agent disagreement', 'disagreement') : ''}</div></div>
        <div class="trail-body">
          <div class="trail-column"><h4>Agent 1 proposal</h4><p>${answerSummary(decision.aiProposal)}</p></div>
          <div class="trail-column"><h4>Independent challenge</h4><p>${escapeHtml(decision.independentChallenge ?? 'No challenge recorded.')}</p></div>
          <div class="trail-column"><h4>Certified student answer</h4><p>${answerSummary(decision.answer)}</p><div class="effect-line">${escapeHtml(effectSummary(decision.statementEffect))}</div>${judgmentExplanation(decision)}</div>
        </div>
      </article>`).join('')}</div>
    </section>
    <section class="panel" id="evidence">
      <div class="panel-heading"><div><h2>Evidence register</h2><p>Original case files used in the reconstruction.</p></div><span class="count-chip">${data.evidence?.length ?? 0} sources</span></div>
      <div class="evidence-grid">${(data.evidence ?? []).map((item, index) => `<article class="evidence-item"><strong>${String(index + 1).padStart(2, '0')} | ${escapeHtml(typeof item === 'string' ? item : item.name ?? item.id ?? 'Evidence')}</strong><span>${escapeHtml(typeof item === 'string' ? 'Original case evidence' : item.role ?? item.description ?? '')}</span></article>`).join('')}</div>
    </section>
    <section class="panel" id="reconciliations">
      <div class="panel-heading"><div><h2>Reconciliations</h2><p>Required statement and schedule controls.</p></div></div>
      <ul class="reconciliation-list">${(data.reconciliations ?? []).map((item) => `<li><span class="status-icon">OK</span><span>${escapeHtml(item.name)}</span>${badge(item.difference === 0 ? 'Reconciled' : formatValue(item.difference), item.difference === 0 ? 'pass' : 'fail')}</li>`).join('')}</ul>
    </section>
    <section class="panel" id="uncertainty">
      <div class="panel-heading"><div><h2>Uncertainty</h2><p>Limits remain visible rather than being filled with unsupported assumptions.</p></div></div>
      <ul class="uncertainty-list">${(data.uncertainties ?? []).map((item) => `<li><span class="status-icon">!</span><span><strong>${escapeHtml(item.item)}</strong><br>${escapeHtml(item.assessment)}</span>${badge(titleCase(item.confidence), item.confidence)}</li>`).join('')}</ul>
    </section>
    <section class="panel" id="board">
      <div class="panel-heading"><div><h2>Immediate board controls</h2><p>Actions required before valuation and normal operation.</p></div></div>
      <ol class="control-list">${(board.controls ?? []).map((control) => `<li>${escapeHtml(control)}</li>`).join('')}</ol>
    </section>
    <p class="footer-note">DPI-HT-01 | Static submission data | No login or external API required</p>
  `;
  installDecisionFilters(data.decisions);
}

function renderReview(data) {
  const material = data.decisions.filter((d) => d.reviewTier === 'material_judgment');
  const disagreements = material.filter((d) => d.agentDisagreement);
  const overrides = material.filter((d) => d.changedFromAI);
  const lowConfidence = data.decisions.filter((d) => d.confidence === 'low');
  const unresolved = data.decisions.filter((d) => d.answer === null || d.answer === '' || d.unresolved || JSON.stringify(d.answer).includes('Not evidenced'));
  const flags = [
    ...disagreements.map((d) => ({ ...d, flag: 'Agent disagreement', detail: d.independentChallenge, danger: true })),
    ...overrides.map((d) => ({ ...d, flag: 'Student override', detail: d.studentReasoning, danger: false })),
    ...lowConfidence.map((d) => ({ ...d, flag: 'Low confidence', detail: answerSummary(d.answer), danger: true })),
    ...unresolved.filter((candidate, index, array) => array.findIndex((item) => item.id === candidate.id) === index).map((d) => ({ ...d, flag: 'Unresolved uncertainty', detail: answerSummary(d.answer), danger: true })),
  ].filter((candidate, index, array) => array.findIndex((item) => `${item.id}-${item.flag}` === `${candidate.id}-${candidate.flag}`) === index);

  content.innerHTML = `
    <section class="hero-grid" aria-labelledby="review-title">
      <div class="hero"><p class="eyebrow">Assessor view | DPI-HT-01</p><h1 id="review-title">Exceptions first.</h1><p>Compact review of material judgments, agent disagreements, student overrides, low-confidence answers, and unresolved evidence.</p><div class="hero-meta"><span>100 decisions</span><span>25 material judgments</span><span>${flags.length} review flags</span></div></div>
      <aside class="board-card"><div><p class="eyebrow">Submission status</p><h2>${escapeHtml(data.certificationStatus ?? 'Awaiting student certification')}</h2><p>Every final answer must be checked against the evidence before submission.</p></div><div class="verdict">Profit ${money.format(data.statements?.profitAndLoss?.netProfit ?? 0)} | Cash ${money.format(data.statements?.cashFlow?.closingCash ?? 0)}</div></aside>
    </section>
    <section class="review-summary" aria-label="Review counts">
      <article class="review-card"><strong>100</strong><span>Total decisions</span></article>
      <article class="review-card"><strong>${material.length}</strong><span>Material judgments</span></article>
      <article class="review-card"><strong>${disagreements.length}</strong><span>Agent disagreements</span></article>
      <article class="review-card"><strong>${overrides.length}</strong><span>Student overrides</span></article>
      <article class="review-card"><strong>${lowConfidence.length}</strong><span>Low confidence</span></article>
    </section>
    <section class="panel">
      <div class="panel-heading"><div><h2>Review flags</h2><p>Items requiring the assessor's attention.</p></div><span class="count-chip">${flags.length} flags</span></div>
      <div class="flag-list">${flags.length ? flags.map((item) => `<article class="flag-item ${item.danger ? 'danger' : ''}"><h3><span class="decision-id">${escapeHtml(item.id)}</span> ${escapeHtml(item.flag)}</h3><p><strong>${escapeHtml(item.question)}</strong><br>${escapeHtml(item.detail ?? '')}</p></article>`).join('') : '<div class="empty-state">No exception flags.</div>'}</div>
    </section>
    <section class="panel">
      <div class="panel-heading"><div><h2>Material judgment trail</h2><p>Both AI positions and the proposed final answer.</p></div></div>
      <div class="trail-list">${material.map((decision) => `<article class="trail-item"><div class="trail-head"><h3><span class="decision-id">${escapeHtml(decision.id)}</span> ${escapeHtml(decision.question)}</h3><div>${badge(titleCase(decision.confidence), decision.confidence)} ${decision.agentDisagreement ? badge('Disagreement', 'disagreement') : ''}</div></div><div class="trail-body"><div class="trail-column"><h4>Agent 1</h4><p>${answerSummary(decision.aiProposal)}</p></div><div class="trail-column"><h4>Agent 2</h4><p>${escapeHtml(decision.independentChallenge ?? '')}</p></div><div class="trail-column"><h4>Final answer</h4><p>${answerSummary(decision.answer)}</p><div class="effect-line">${escapeHtml(effectSummary(decision.statementEffect))}</div>${judgmentExplanation(decision)}</div></div></article>`).join('')}</div>
    </section>
    <section class="panel">
      <div class="panel-heading"><div><h2>All decisions</h2><p>Compact machine-readable answer review.</p></div><span class="count-chip" id="decision-count">${data.decisions.length}</span></div>
      <div class="filter-bar"><input id="decision-search" type="search" placeholder="Search decisions" aria-label="Search decisions" /><select id="decision-tier" aria-label="Filter by tier"><option value="">All tiers</option><option value="material_judgment">Material judgments</option><option value="operational">Operational</option></select><select id="decision-category" aria-label="Filter by category"><option value="">All categories</option><option value="evidence_matching">Evidence matching</option><option value="classification">Classification</option><option value="estimation">Estimation</option><option value="board_decision">Board decision</option></select><select id="decision-confidence" aria-label="Filter by confidence"><option value="">All confidence</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
      <div id="decision-results"></div>
    </section>
    <p class="footer-note">DPI-HT-01 | Assessor review route</p>
  `;
  installDecisionFilters(data.decisions);
}

try {
  const data = await loadSubmission();
  if (!Array.isArray(data.decisions) || data.decisions.length !== 100) throw new Error('Submission must contain exactly 100 decisions');
  view === 'review' ? renderReview(data) : renderMain(data);
} catch (error) {
  content.innerHTML = `<div class="error-shell"><h1>Case data could not be loaded</h1><p>${escapeHtml(error.message)}</p></div>`;
}
