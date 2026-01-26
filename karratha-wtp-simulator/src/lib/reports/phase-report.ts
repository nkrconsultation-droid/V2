/**
 * PHASE COST & THREE-FRACTION QUALITY REPORT GENERATOR
 * =====================================================
 * Generates comprehensive HTML reports for batch phase analysis
 */

import {
  PhaseDataRecord,
  getPhaseAverage,
  calculateOverallTotals,
  calculateWeightedQuality,
  CostRates,
} from '../../hooks/usePhaseTracking';
import { FeedstockType, TransportDestination } from '../constants/feedstock';

export interface PhaseReportConfig {
  phaseData: PhaseDataRecord[];
  feedstock: FeedstockType;
  destination: TransportDestination;
  costs: CostRates;
  formatTime: (seconds: number) => string;
}

/**
 * Generate HTML for the Phase Cost & Quality Report
 */
export function generatePhaseReportHTML(config: PhaseReportConfig): string {
  const { phaseData, feedstock, destination, costs, formatTime } = config;

  const overallTotals = calculateOverallTotals(phaseData);
  const totalCosts = overallTotals.costs.energy + overallTotals.costs.chemicals +
    overallTotals.costs.disposal + overallTotals.costs.water +
    overallTotals.costs.labor + overallTotals.costs.filter;

  const { avgOilEff, avgSolidsEff, avgWQ } = calculateWeightedQuality(phaseData);
  const overallMassBalance = overallTotals.feed > 0
    ? ((overallTotals.water + overallTotals.oil + overallTotals.solids) / overallTotals.feed) * 100
    : 100;

  // Generate table rows
  const phaseRows = phaseData.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="py-2 px-3 font-medium">${p.phaseName}</td>
      <td class="py-2 px-3 text-right">${formatTime(p.startTime)} - ${formatTime(p.endTime || p.startTime)}</td>
      <td class="py-2 px-3 text-right">${formatTime(p.totals.duration)}</td>
      <td class="py-2 px-3 text-right">${p.totals.feed.toFixed(3)} m³</td>
      <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
      <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
      <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
    </tr>
  `).join('');

  const phaseCostRows = phaseData.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="py-2 px-3 font-medium">${p.phaseName}</td>
      <td class="py-2 px-3 text-right">$${p.costs.energy.toFixed(2)}</td>
      <td class="py-2 px-3 text-right">$${p.costs.chemicals.toFixed(2)}</td>
      <td class="py-2 px-3 text-right">$${p.costs.disposal.toFixed(2)}</td>
      <td class="py-2 px-3 text-right">$${p.costs.water.toFixed(2)}</td>
      <td class="py-2 px-3 text-right">$${p.costs.labor.toFixed(2)}</td>
      <td class="py-2 px-3 text-right font-bold">$${(p.costs.energy + p.costs.chemicals + p.costs.disposal + p.costs.water + p.costs.labor + p.costs.filter).toFixed(2)}</td>
    </tr>
  `).join('');

  const fractionQualityRows = phaseData.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="py-2 px-3 font-medium" rowspan="3">${p.phaseName}</td>
      <td class="py-2 px-3 text-blue-600 font-medium">Water</td>
      <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
      <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.water / p.totals.feed) * 100).toFixed(1) : 0}%</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.water.oilContent).toFixed(0)} ppm OiW</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.water.tss).toFixed(0)} mg/L TSS</td>
      <td class="py-2 px-3 text-center">${getPhaseAverage(p.fractions.water.oilContent) < 500 ? '✅' : '⚠️'}</td>
    </tr>
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="py-2 px-3 text-amber-600 font-medium">Oil</td>
      <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
      <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.oil / p.totals.feed) * 100).toFixed(2) : 0}%</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.oil.waterContent).toFixed(1)}% H₂O</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.oil.recovery).toFixed(1)}% recovery</td>
      <td class="py-2 px-3 text-center">${getPhaseAverage(p.fractions.oil.recovery) >= 95 ? '✅' : '⚠️'}</td>
    </tr>
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''} border-b-2 border-gray-300">
      <td class="py-2 px-3 text-orange-600 font-medium">Solids</td>
      <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
      <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.solids / p.totals.feed) * 100).toFixed(2) : 0}%</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.solids.moisture).toFixed(1)}% moisture</td>
      <td class="py-2 px-3 text-right">${getPhaseAverage(p.fractions.solids.recovery).toFixed(1)}% recovery</td>
      <td class="py-2 px-3 text-center">${getPhaseAverage(p.fractions.solids.moisture) <= 20 ? '✅' : '⚠️'}</td>
    </tr>
  `).join('');

  const massBalanceRows = phaseData.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td class="py-2 px-3 font-medium">${p.phaseName}</td>
      <td class="py-2 px-3 text-right">${p.massBalance.totalIn.toFixed(4)} m³</td>
      <td class="py-2 px-3 text-right">${p.massBalance.totalOut.toFixed(4)} m³</td>
      <td class="py-2 px-3 text-right font-bold ${Math.abs(getPhaseAverage(p.massBalance.closurePct) - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${getPhaseAverage(p.massBalance.closurePct).toFixed(1)}%</td>
      <td class="py-2 px-3 text-center">${Math.abs(getPhaseAverage(p.massBalance.closurePct) - 100) < 2 ? '✅ Valid' : '⚠️ Check'}</td>
      <td class="py-2 px-3 text-right text-gray-500">${p.dataQuality.samplesCollected}</td>
    </tr>
  `).join('');

  const anomalySummary = phaseData.flatMap(p =>
    p.dataQuality.anomalies.map(a => `<li>${p.phaseName}: ${a}</li>`)
  ).slice(0, 15).join('');

  return `
    <html>
    <head>
      <title>Phase Cost & Three-Fraction Quality Report - Karratha WTP</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
        h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; font-size: 20px; }
        h2 { color: #1e40af; margin-top: 25px; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
        th { background: #1e40af; color: white; padding: 8px 6px; text-align: left; }
        td { border: 1px solid #e5e7eb; padding: 6px; }
        .bg-gray-50 { background: #f9fafb; }
        .positive { color: #16a34a; font-weight: bold; }
        .negative { color: #dc2626; }
        .highlight { background: #fef3c7; }
        .metric-box { display: inline-block; padding: 12px; margin: 5px; border: 2px solid #ddd; border-radius: 8px; text-align: center; min-width: 120px; }
        .metric-value { font-size: 18px; font-weight: bold; }
        .metric-label { font-size: 9px; color: #666; margin-top: 3px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9px; color: #666; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-blue-600 { color: #2563eb; }
        .text-amber-600 { color: #d97706; }
        .text-orange-600 { color: #ea580c; }
        .text-green-600 { color: #16a34a; }
        .text-red-600 { color: #dc2626; }
        .text-gray-500 { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .font-medium { font-weight: 500; }
        @media print { body { padding: 15px; } }
      </style>
    </head>
    <body>
      <h1>📊 Simulation Phase Cost & Three-Fraction Quality Report</h1>
      <p><strong>Equipment:</strong> SACOR Delta-Canter 20-843A Three-Phase Tricanter</p>
      <p><strong>Feedstock:</strong> ${feedstock.name} | <strong>Destination:</strong> ${destination.name}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0;">
        <div class="metric-box"><div class="metric-value">${phaseData.length}</div><div class="metric-label">Phases Completed</div></div>
        <div class="metric-box"><div class="metric-value">${formatTime(overallTotals.duration)}</div><div class="metric-label">Total Run Time</div></div>
        <div class="metric-box"><div class="metric-value">${overallTotals.feed.toFixed(2)} m³</div><div class="metric-label">Feed Processed</div></div>
        <div class="metric-box" style="border-color: #16a34a;"><div class="metric-value positive">${(overallTotals.oil * 1000).toFixed(1)} L</div><div class="metric-label">Oil Recovered</div></div>
        <div class="metric-box"><div class="metric-value">${avgOilEff.toFixed(1)}%</div><div class="metric-label">Avg Oil Recovery</div></div>
        <div class="metric-box" style="border-color: ${Math.abs(overallMassBalance - 100) < 2 ? '#16a34a' : '#dc2626'};"><div class="metric-value ${Math.abs(overallMassBalance - 100) < 2 ? 'positive' : 'negative'}">${overallMassBalance.toFixed(1)}%</div><div class="metric-label">Mass Balance</div></div>
        <div class="metric-box" style="border-color: #dc2626;"><div class="metric-value negative">$${totalCosts.toFixed(2)}</div><div class="metric-label">Total Cost</div></div>
      </div>

      <h2>📦 Phase Volume Summary</h2>
      <table><thead><tr><th>Phase</th><th class="text-right">Time Window</th><th class="text-right">Duration</th><th class="text-right">Feed In</th><th class="text-right">Water Out</th><th class="text-right">Oil Out</th><th class="text-right">Solids Out</th></tr></thead>
      <tbody>${phaseRows}<tr class="highlight font-bold"><td>TOTAL</td><td class="text-right">-</td><td class="text-right">${formatTime(overallTotals.duration)}</td><td class="text-right">${overallTotals.feed.toFixed(3)} m³</td><td class="text-right">${(overallTotals.water * 1000).toFixed(0)} L</td><td class="text-right">${(overallTotals.oil * 1000).toFixed(1)} L</td><td class="text-right">${(overallTotals.solids * 1000).toFixed(1)} L</td></tr></tbody></table>

      <h2>💰 Phase Cost Breakdown</h2>
      <table><thead><tr><th>Phase</th><th class="text-right">Energy</th><th class="text-right">Chemicals</th><th class="text-right">Disposal</th><th class="text-right">Water</th><th class="text-right">Labor</th><th class="text-right">Total</th></tr></thead>
      <tbody>${phaseCostRows}<tr class="highlight font-bold"><td>TOTAL</td><td class="text-right">$${overallTotals.costs.energy.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.chemicals.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.disposal.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.water.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.labor.toFixed(2)}</td><td class="text-right">$${totalCosts.toFixed(2)}</td></tr></tbody></table>

      <h2>🔬 Three-Fraction Quality Report</h2>
      <table><thead><tr><th>Phase</th><th>Fraction</th><th class="text-right">Volume</th><th class="text-right">Yield %</th><th class="text-right">Primary</th><th class="text-right">Secondary</th><th class="text-center">Status</th></tr></thead>
      <tbody>${fractionQualityRows}</tbody></table>

      <h2>⚖️ Mass Balance Validation</h2>
      <table><thead><tr><th>Phase</th><th class="text-right">Mass In</th><th class="text-right">Mass Out</th><th class="text-right">Closure %</th><th class="text-center">Validation</th><th class="text-right">Samples</th></tr></thead>
      <tbody>${massBalanceRows}<tr class="highlight font-bold"><td>OVERALL</td><td class="text-right">${overallTotals.feed.toFixed(4)} m³</td><td class="text-right">${(overallTotals.water + overallTotals.oil + overallTotals.solids).toFixed(4)} m³</td><td class="text-right ${Math.abs(overallMassBalance - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${overallMassBalance.toFixed(1)}%</td><td class="text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅' : '⚠️'}</td><td class="text-right">-</td></tr></tbody></table>

      ${anomalySummary ? `<h2>🚨 Anomalies</h2><ul style="margin-left: 20px; color: #dc2626;">${anomalySummary}</ul>` : ''}

      <h2>📈 Overall Performance</h2>
      <table><thead><tr><th>Metric</th><th class="text-right">Value</th><th class="text-right">Target</th><th class="text-center">Status</th></tr></thead>
      <tbody>
        <tr><td>Oil Recovery</td><td class="text-right font-bold">${avgOilEff.toFixed(1)}%</td><td class="text-right">≥95%</td><td class="text-center">${avgOilEff >= 95 ? '✅' : '⚠️'}</td></tr>
        <tr class="bg-gray-50"><td>Solids Removal</td><td class="text-right font-bold">${avgSolidsEff.toFixed(1)}%</td><td class="text-right">≥95%</td><td class="text-center">${avgSolidsEff >= 95 ? '✅' : '⚠️'}</td></tr>
        <tr><td>Water Quality</td><td class="text-right font-bold">${avgWQ.toFixed(0)} ppm</td><td class="text-right">≤500 ppm</td><td class="text-center">${avgWQ <= 500 ? '✅' : '⚠️'}</td></tr>
        <tr class="bg-gray-50"><td>Specific Energy</td><td class="text-right font-bold">${overallTotals.feed > 0 ? (overallTotals.energy / overallTotals.feed).toFixed(2) : 0} kWh/m³</td><td class="text-right">≤5 kWh/m³</td><td class="text-center">${overallTotals.feed > 0 && (overallTotals.energy / overallTotals.feed) <= 5 ? '✅' : '⚠️'}</td></tr>
        <tr><td>Cost per m³</td><td class="text-right font-bold">$${overallTotals.feed > 0 ? (totalCosts / overallTotals.feed).toFixed(2) : 0}</td><td class="text-right">-</td><td class="text-center">📊</td></tr>
        <tr class="highlight"><td class="font-bold">Mass Balance</td><td class="text-right font-bold">${overallMassBalance.toFixed(1)}%</td><td class="text-right">98-102%</td><td class="text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅' : '⚠️'}</td></tr>
      </tbody></table>

      <div class="footer">
        <p><strong>Karratha WTP Simulator v15</strong> | SACOR Delta-Canter 20-843A | ${new Date().toISOString()}</p>
      </div>
    </body></html>
  `;
}

/**
 * Open and print the phase report in a new window
 */
export function printPhaseReport(config: PhaseReportConfig): void {
  const html = generatePhaseReportHTML(config);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
