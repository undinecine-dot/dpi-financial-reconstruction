import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname);
const requiredFiles = ['index.html', 'review.html', 'submission.json', 'styles.css', 'app.js', 'favicon.svg', 'vercel.json'];
for (const file of requiredFiles) await fs.access(path.join(root, file));

const submission = JSON.parse(await fs.readFile(path.join(root, 'submission.json'), 'utf8'));
const requiredTopLevel = ['schemaVersion', 'caseId', 'student', 'evidence', 'decisions', 'schedules', 'statements', 'reconciliations', 'uncertainties', 'boardRecommendation'];
for (const key of requiredTopLevel) if (!(key in submission)) throw new Error(`Missing top-level key: ${key}`);
if (submission.schemaVersion !== '1.0') throw new Error('schemaVersion must be 1.0');
if (submission.caseId !== 'DPI-HT-01') throw new Error('caseId must be DPI-HT-01');
if (!Array.isArray(submission.decisions) || submission.decisions.length !== 100) throw new Error('Exactly 100 decisions are required');

const ids = new Set();
let material = 0;
let operational = 0;
const materialReasons = new Set();
for (const decision of submission.decisions) {
  if (!/^D\d{3}$/.test(decision.id)) throw new Error(`Invalid decision ID: ${decision.id}`);
  if (ids.has(decision.id)) throw new Error(`Duplicate decision ID: ${decision.id}`);
  ids.add(decision.id);
  if (!['low', 'medium', 'high'].includes(decision.confidence)) throw new Error(`Invalid confidence for ${decision.id}`);
  if (!Array.isArray(decision.evidence) || decision.evidence.length < 1) throw new Error(`Missing evidence for ${decision.id}`);
  if (decision.reviewTier === 'material_judgment') {
    material += 1;
    for (const key of ['aiProposal', 'independentChallenge', 'studentReasoning', 'statementEffect', 'changedFromAI']) if (!(key in decision)) throw new Error(`Missing ${key} for ${decision.id}`);
    if (String(decision.independentChallenge).length < 20) throw new Error(`Independent challenge too short for ${decision.id}`);
    if (String(decision.studentReasoning).length < 20) throw new Error(`Student reasoning too short for ${decision.id}`);
    if (/higher-ranked evidence/i.test(decision.studentReasoning)) throw new Error(`Generic evidence-ranking wording remains in ${decision.id}`);
    materialReasons.add(String(decision.studentReasoning).trim());
    for (const key of ['profit', 'cash', 'assets', 'liabilities', 'equity']) if (!(key in decision.statementEffect)) throw new Error(`Missing statement effect ${key} for ${decision.id}`);
  } else operational += 1;
}
if (material !== 25 || operational !== 75) throw new Error(`Expected 25 material and 75 operational decisions, got ${material} and ${operational}`);
if (materialReasons.size !== 25) throw new Error(`Expected 25 distinct material explanations, got ${materialReasons.size}`);

for (const id of ['D058', 'D072']) {
  const decision = submission.decisions.find((entry) => entry.id === id);
  const alternative = decision?.alternativeTreatment;
  if (!alternative?.assumption || !alternative?.treatment || !alternative?.effectComparedWithSelected || !alternative?.alternativeStatements) {
    throw new Error(`Missing no-provision alternative for ${id}`);
  }
  if (alternative.alternativeStatements.netProfit !== 74000 || alternative.alternativeStatements.totalLiabilities !== 406000 || alternative.alternativeStatements.equity !== 134000) {
    throw new Error(`Incorrect no-provision alternative figures for ${id}`);
  }
}

const bs = submission.statements.balanceSheet;
if (bs.totalAssets !== bs.totalLiabilitiesAndEquity) throw new Error('Balance sheet does not balance');
const cf = submission.statements.cashFlow;
if (cf.openingCash + cf.netChange !== cf.closingCash) throw new Error('Cash flow does not roll forward');
if (submission.schedules.equity.openingEquity + submission.schedules.equity.profit - submission.schedules.equity.distributions !== submission.schedules.equity.closingEquity) throw new Error('Equity does not roll forward');

console.log(JSON.stringify({ ok: true, decisions: submission.decisions.length, material, operational, totalAssets: bs.totalAssets, closingCash: cf.closingCash }));
