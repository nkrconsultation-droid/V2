/**
 * EXCEL REPORT EXPORT
 * ====================
 * Professional Excel report generation for the Centrifuge Process Simulator
 * Features: Multiple sheets, styling, charts preparation, conditional formatting
 */

import ExcelJS from 'exceljs';
import type {
  ProcessState,
  ProcessTotals,
  ProcessAlarm,
  TrendDataPoint,
  FeedTank,
  OilTank,
  EvaporationPond,
  CostParameters,
  DischargeLimits,
} from './process-types';

// ═══════════════════════════════════════════════════════════════════════════
// BRAND COLORS & STYLING
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = {
  primary: '1F4E79',      // Dark blue
  secondary: '2E75B6',    // Medium blue
  accent: '5B9BD5',       // Light blue
  success: '70AD47',      // Green
  warning: 'FFC000',      // Amber
  danger: 'C00000',       // Red
  header: '1F4E79',       // Header background
  headerText: 'FFFFFF',   // Header text
  altRow: 'D6DCE5',       // Alternating row
  border: 'B4B4B4',       // Border color
};

const FONTS = {
  title: { name: 'Calibri', size: 24, bold: true, color: { argb: COLORS.primary } },
  subtitle: { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.secondary } },
  header: { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerText } },
  normal: { name: 'Calibri', size: 10 },
  value: { name: 'Consolas', size: 10 },
  small: { name: 'Calibri', size: 9, color: { argb: '666666' } },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
    cell.font = FONTS.header;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  row.height = 22;
}

function applyDataStyle(row: ExcelJS.Row, isAlt: boolean = false): void {
  row.eachCell(cell => {
    if (isAlt) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.altRow },
      };
    }
    cell.font = FONTS.normal;
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT DATA INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface ReportData {
  // Header info
  reportTitle: string;
  generatedAt: Date;
  operator?: string;
  shift?: string;

  // Run summary
  simTime: number;
  isRunning: boolean;

  // Current state
  proc: ProcessState;
  totals: ProcessTotals;
  costs: CostParameters;
  dischargeLimits: DischargeLimits;

  // Tank states
  feedTanks: FeedTank[];
  oilTanks: OilTank[];
  pond: EvaporationPond;

  // Historical data
  trendData: TrendDataPoint[];
  alarms: ProcessAlarm[];
  events: Array<{ time: string; simTime: number; type: string; desc: string }>;

  // Calculated metrics
  kpis?: {
    avgOilEfficiency: number;
    avgSolidsEfficiency: number;
    avgWaterQuality: number;
    avgThroughput: number;
    totalOilRecovered: number;
    totalWaterProcessed: number;
    energyPerCubicMeter: number;
    uptime: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function generateExcelReport(data: ReportData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  // Workbook properties
  workbook.creator = 'Karratha WTP Simulator';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.lastModifiedBy = 'Karratha Water Treatment Plant';

  // Create sheets
  createSummarySheet(workbook, data);
  createProcessDataSheet(workbook, data);
  createTankStatusSheet(workbook, data);
  createTrendDataSheet(workbook, data);
  createAlarmHistorySheet(workbook, data);
  createComplianceSheet(workbook, data);

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createSummarySheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: COLORS.primary } },
  });

  // Set column widths
  sheet.columns = [
    { width: 5 },
    { width: 25 },
    { width: 20 },
    { width: 5 },
    { width: 25 },
    { width: 20 },
  ];

  // ─── HEADER ───────────────────────────────────────────────────────────────

  // Logo placeholder and title
  sheet.mergeCells('B2:F2');
  const titleCell = sheet.getCell('B2');
  titleCell.value = '⚙️ KARRATHA WATER TREATMENT PLANT';
  titleCell.font = FONTS.title;
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('B3:F3');
  const subtitleCell = sheet.getCell('B3');
  subtitleCell.value = 'CENTRIFUGE PROCESS CONTROL - OPERATIONS REPORT';
  subtitleCell.font = FONTS.subtitle;
  subtitleCell.alignment = { horizontal: 'center' };

  // Report metadata
  sheet.getCell('B5').value = 'Report Generated:';
  sheet.getCell('C5').value = formatDateTime(data.generatedAt);
  sheet.getCell('C5').font = FONTS.value;

  sheet.getCell('E5').value = 'Run Duration:';
  sheet.getCell('F5').value = formatDuration(data.simTime);
  sheet.getCell('F5').font = FONTS.value;

  if (data.operator) {
    sheet.getCell('B6').value = 'Operator:';
    sheet.getCell('C6').value = data.operator;
  }
  if (data.shift) {
    sheet.getCell('E6').value = 'Shift:';
    sheet.getCell('F6').value = data.shift;
  }

  // ─── KPI SECTION ──────────────────────────────────────────────────────────

  sheet.mergeCells('B8:F8');
  const kpiHeader = sheet.getCell('B8');
  kpiHeader.value = '📊 KEY PERFORMANCE INDICATORS';
  kpiHeader.font = FONTS.subtitle;
  kpiHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };

  const kpiData = [
    ['Oil Recovery Efficiency', `${data.proc.oilEff.toFixed(1)}%`, 'Target: >90%', data.proc.oilEff >= 90],
    ['Solids Removal Efficiency', `${data.proc.solidsEff.toFixed(1)}%`, 'Target: >95%', data.proc.solidsEff >= 95],
    ['Water Quality (OiW)', `${data.proc.waterQuality.toFixed(0)} ppm`, 'Limit: <50 ppm', data.proc.waterQuality <= 50],
    ['Throughput', `${data.proc.feedFlow.toFixed(1)} m³/h`, 'Design: 12 m³/h', true],
    ['Energy Consumption', `${data.proc.totalPower.toFixed(0)} kW`, '', true],
    ['Vibration', `${data.proc.vibration.toFixed(1)} mm/s`, 'Limit: <5 mm/s', data.proc.vibration <= 5],
  ];

  let row = 10;
  kpiData.forEach(([label, value, note, isGood], idx) => {
    sheet.getCell(`B${row}`).value = label;
    sheet.getCell(`B${row}`).font = FONTS.normal;

    const valueCell = sheet.getCell(`C${row}`);
    valueCell.value = value;
    valueCell.font = { ...FONTS.value, bold: true };
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isGood ? 'C6EFCE' : 'FFC7CE' },
    };

    sheet.getCell(`D${row}`).value = note;
    sheet.getCell(`D${row}`).font = FONTS.small;

    row++;
  });

  // ─── TOTALS SECTION ───────────────────────────────────────────────────────

  row += 2;
  sheet.mergeCells(`B${row}:F${row}`);
  const totalsHeader = sheet.getCell(`B${row}`);
  totalsHeader.value = '📈 PRODUCTION TOTALS';
  totalsHeader.font = FONTS.subtitle;
  totalsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDEBF7' } };

  row += 2;
  const totalsData = [
    ['Total Feed Processed', `${data.totals.feed.toFixed(1)} m³`],
    ['Water Discharged', `${data.totals.water.toFixed(1)} m³`],
    ['Oil Recovered', `${data.totals.oil.toFixed(1)} m³`],
    ['Solids Removed', `${data.totals.solids.toFixed(3)} m³`],
    ['Energy Used', `${data.totals.energy.toFixed(0)} kWh`],
    ['Total Runtime', formatDuration(data.totals.runTime)],
  ];

  totalsData.forEach(([label, value]) => {
    sheet.getCell(`B${row}`).value = label;
    sheet.getCell(`C${row}`).value = value;
    sheet.getCell(`C${row}`).font = FONTS.value;
    row++;
  });

  // ─── COST ANALYSIS ────────────────────────────────────────────────────────

  row += 2;
  sheet.mergeCells(`B${row}:F${row}`);
  const costHeader = sheet.getCell(`B${row}`);
  costHeader.value = '💰 COST ANALYSIS';
  costHeader.font = FONTS.subtitle;
  costHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };

  row += 2;
  const energyCost = data.totals.energy * data.costs.elec;
  const oilRevenue = data.totals.oil * data.costs.oilValue;
  const waterCost = data.totals.water * data.costs.waterTreatment;
  const netValue = oilRevenue - energyCost - waterCost;

  const costData = [
    ['Energy Cost', `$${energyCost.toFixed(2)}`, `@ $${data.costs.elec}/kWh`],
    ['Oil Recovery Value', `$${oilRevenue.toFixed(2)}`, `@ $${data.costs.oilValue}/m³`],
    ['Water Treatment Cost', `$${waterCost.toFixed(2)}`, `@ $${data.costs.waterTreatment}/m³`],
    ['Net Value', `$${netValue.toFixed(2)}`, netValue >= 0 ? '✓ Profitable' : '⚠ Loss'],
  ];

  costData.forEach(([label, value, note]) => {
    sheet.getCell(`B${row}`).value = label;
    const valueCell = sheet.getCell(`C${row}`);
    valueCell.value = value;
    valueCell.font = { ...FONTS.value, bold: label === 'Net Value' };
    if (label === 'Net Value') {
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: netValue >= 0 ? 'C6EFCE' : 'FFC7CE' },
      };
    }
    sheet.getCell(`D${row}`).value = note;
    sheet.getCell(`D${row}`).font = FONTS.small;
    row++;
  });

  // Footer
  row += 3;
  sheet.mergeCells(`B${row}:F${row}`);
  const footer = sheet.getCell(`B${row}`);
  footer.value = 'Generated by Karratha WTP Simulator v14.0 | ISA-101/ISA-18.2 Compliant';
  footer.font = FONTS.small;
  footer.alignment = { horizontal: 'center' };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS DATA SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createProcessDataSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Process Data', {
    properties: { tabColor: { argb: COLORS.secondary } },
  });

  sheet.columns = [
    { header: 'Parameter', key: 'param', width: 30 },
    { header: 'Value', key: 'value', width: 15 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Low Limit', key: 'low', width: 12 },
    { header: 'High Limit', key: 'high', width: 12 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  const processParams = [
    { param: 'Feed Temperature', value: data.proc.feedTemp, unit: '°C', low: 20, high: 80 },
    { param: 'Heater Temperature', value: data.proc.heaterTemp, unit: '°C', low: 50, high: 85 },
    { param: 'Bowl Temperature', value: data.proc.bowlTemp, unit: '°C', low: 50, high: 80 },
    { param: 'Feed Flow Rate', value: data.proc.feedFlow, unit: 'm³/h', low: 5, high: 15 },
    { param: 'Water Output', value: data.proc.waterOut, unit: 'm³/h' },
    { param: 'Oil Output', value: data.proc.oilOut, unit: 'm³/h' },
    { param: 'Solids Output', value: data.proc.solidsOut, unit: 'm³/h' },
    { param: 'Bowl Speed', value: data.proc.bowlSpeed, unit: 'RPM', low: 1500, high: 5000 },
    { param: 'Differential Speed', value: data.proc.diffSpeed, unit: 'RPM' },
    { param: 'Vibration', value: data.proc.vibration, unit: 'mm/s', high: 5 },
    { param: 'Oil Efficiency', value: data.proc.oilEff, unit: '%', low: 80 },
    { param: 'Solids Efficiency', value: data.proc.solidsEff, unit: '%', low: 90 },
    { param: 'Water Quality (OiW)', value: data.proc.waterQuality, unit: 'ppm', high: 50 },
    { param: 'pH', value: data.proc.pH, unit: '-', low: 6.5, high: 8.5 },
    { param: 'Turbidity', value: data.proc.turbidity, unit: 'NTU', high: 100 },
    { param: 'Heater Power', value: data.proc.heaterPower, unit: 'kW' },
    { param: 'Motor Power', value: data.proc.motorPower, unit: 'kW' },
    { param: 'Total Power', value: data.proc.totalPower, unit: 'kW' },
    { param: 'G-Force', value: data.proc.gForce, unit: 'g' },
  ];

  processParams.forEach((p, idx) => {
    const row = sheet.addRow({
      param: p.param,
      value: typeof p.value === 'number' ? p.value.toFixed(2) : p.value,
      unit: p.unit,
      status: getStatus(p.value, p.low, p.high),
      low: p.low ?? '-',
      high: p.high ?? '-',
    });
    applyDataStyle(row, idx % 2 === 1);

    // Conditional formatting for status
    const statusCell = row.getCell('status');
    const status = getStatus(p.value, p.low, p.high);
    if (status === 'ALARM') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
      statusCell.font = { ...FONTS.normal, color: { argb: 'C00000' }, bold: true };
    } else if (status === 'WARNING') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } };
      statusCell.font = { ...FONTS.normal, color: { argb: '9C6500' } };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
      statusCell.font = { ...FONTS.normal, color: { argb: '006100' } };
    }
  });
}

function getStatus(value: number, low?: number, high?: number): string {
  if (high !== undefined && value > high) return 'ALARM';
  if (low !== undefined && value < low) return 'ALARM';
  if (high !== undefined && value > high * 0.9) return 'WARNING';
  if (low !== undefined && value < low * 1.1) return 'WARNING';
  return 'NORMAL';
}

// ═══════════════════════════════════════════════════════════════════════════
// TANK STATUS SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createTankStatusSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Tank Status', {
    properties: { tabColor: { argb: COLORS.accent } },
  });

  // Feed Tanks Section
  sheet.mergeCells('A1:G1');
  const feedHeader = sheet.getCell('A1');
  feedHeader.value = '🛢️ FEED TANKS (VT-001 to VT-006)';
  feedHeader.font = FONTS.subtitle;
  feedHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDEBF7' } };

  sheet.getRow(3).values = ['Tank ID', 'Level (%)', 'Water (%)', 'Oil (%)', 'Sediment (%)', 'Temp (°C)', 'Status'];
  applyHeaderStyle(sheet.getRow(3));

  data.feedTanks.forEach((tank, idx) => {
    const row = sheet.addRow([
      tank.id,
      tank.level,
      tank.water,
      tank.oil,
      tank.sediment,
      tank.temp,
      tank.status.toUpperCase(),
    ]);
    applyDataStyle(row, idx % 2 === 1);
  });

  // Oil Tanks Section
  const oilStartRow = data.feedTanks.length + 6;
  sheet.mergeCells(`A${oilStartRow}:E${oilStartRow}`);
  const oilHeader = sheet.getCell(`A${oilStartRow}`);
  oilHeader.value = '🛢️ OIL STORAGE TANKS (HT-001 to HT-006)';
  oilHeader.font = FONTS.subtitle;
  oilHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE4D6' } };

  const oilHeaderRow = sheet.getRow(oilStartRow + 2);
  oilHeaderRow.values = ['Tank ID', 'Level (%)', 'Temp (°C)', 'Status'];
  applyHeaderStyle(oilHeaderRow);

  data.oilTanks.forEach((tank, idx) => {
    const row = sheet.addRow([
      tank.id,
      tank.level,
      tank.temp,
      tank.status.toUpperCase(),
    ]);
    applyDataStyle(row, idx % 2 === 1);
  });

  // Evaporation Pond Section
  const pondStartRow = oilStartRow + data.oilTanks.length + 5;
  sheet.mergeCells(`A${pondStartRow}:E${pondStartRow}`);
  const pondHeader = sheet.getCell(`A${pondStartRow}`);
  pondHeader.value = '🌊 EVAPORATION POND (8 ML)';
  pondHeader.font = FONTS.subtitle;
  pondHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };

  const pondData = [
    ['Current Volume', `${data.pond.volume.toFixed(0)} m³`],
    ['Level', `${data.pond.level.toFixed(1)}%`],
    ['pH', data.pond.pH.toFixed(1)],
    ['Turbidity', `${data.pond.turbidity.toFixed(0)} NTU`],
    ['Oil in Water', `${data.pond.oilInWater.toFixed(1)} ppm`],
    ['Temperature', `${data.pond.temperature.toFixed(1)} °C`],
    ['Evaporation Rate', `${data.pond.evaporationRate} mm/day`],
    ['Total Inflow', `${data.pond.totalInflow.toFixed(1)} m³`],
    ['Total Evaporated', `${data.pond.totalEvaporated.toFixed(1)} m³`],
  ];

  let pondRow = pondStartRow + 2;
  pondData.forEach(([label, value], idx) => {
    sheet.getCell(`A${pondRow}`).value = label;
    sheet.getCell(`B${pondRow}`).value = value;
    sheet.getCell(`B${pondRow}`).font = FONTS.value;
    pondRow++;
  });

  // Set column widths
  sheet.columns = [
    { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 15 },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND DATA SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createTrendDataSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Trend Data', {
    properties: { tabColor: { argb: COLORS.success } },
  });

  sheet.columns = [
    { header: 'Time (s)', key: 'time', width: 10 },
    { header: 'Feed Flow (m³/h)', key: 'feedFlow', width: 15 },
    { header: 'Heater Temp (°C)', key: 'heaterTemp', width: 15 },
    { header: 'Bowl Speed (RPM)', key: 'bowlSpeed', width: 15 },
    { header: 'Oil Eff (%)', key: 'oilEff', width: 12 },
    { header: 'Solids Eff (%)', key: 'solidsEff', width: 12 },
    { header: 'OiW (ppm)', key: 'waterQuality', width: 12 },
    { header: 'Vibration (mm/s)', key: 'vibration', width: 15 },
    { header: 'Power (kW)', key: 'totalPower', width: 12 },
    { header: 'pH', key: 'pH', width: 8 },
    { header: 'Turbidity (NTU)', key: 'turbidity', width: 15 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  // Add data rows
  data.trendData.forEach((point, idx) => {
    const row = sheet.addRow(point);
    applyDataStyle(row, idx % 2 === 1);
  });

  // Add note about data for charting
  const noteRow = data.trendData.length + 3;
  sheet.mergeCells(`A${noteRow}:K${noteRow}`);
  const note = sheet.getCell(`A${noteRow}`);
  note.value = '💡 Tip: Select this data to create charts in Excel (Insert > Charts)';
  note.font = FONTS.small;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM HISTORY SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createAlarmHistorySheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Alarm History', {
    properties: { tabColor: { argb: COLORS.danger } },
  });

  sheet.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 20 },
    { header: 'Tag', key: 'tag', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'State', key: 'state', width: 15 },
    { header: 'Value', key: 'value', width: 12 },
    { header: 'Limit', key: 'limit', width: 12 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  if (data.alarms.length === 0) {
    sheet.addRow(['No alarms recorded during this session']);
  } else {
    data.alarms.forEach((alarm, idx) => {
      const row = sheet.addRow({
        timestamp: formatDateTime(alarm.timestamp),
        tag: alarm.tag,
        description: alarm.description,
        priority: alarm.priority,
        state: alarm.state,
        value: alarm.value?.toFixed(1) ?? '-',
        limit: alarm.limit?.toFixed(1) ?? '-',
      });
      applyDataStyle(row, idx % 2 === 1);

      // Color code by priority
      const priorityCell = row.getCell('priority');
      switch (alarm.priority) {
        case 'CRITICAL':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
          priorityCell.font = { ...FONTS.normal, color: { argb: 'C00000' }, bold: true };
          break;
        case 'HIGH':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC99' } };
          priorityCell.font = { ...FONTS.normal, color: { argb: 'C65911' } };
          break;
        case 'MEDIUM':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } };
          break;
        case 'LOW':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BDD7EE' } };
          break;
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE SHEET
// ═══════════════════════════════════════════════════════════════════════════

function createComplianceSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
  const sheet = workbook.addWorksheet('Compliance', {
    properties: { tabColor: { argb: COLORS.warning } },
  });

  sheet.columns = [
    { width: 5 },
    { width: 30 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 20 },
  ];

  // Header
  sheet.mergeCells('B2:F2');
  const title = sheet.getCell('B2');
  title.value = '📋 DISCHARGE COMPLIANCE CHECK';
  title.font = FONTS.subtitle;

  // Compliance table
  const headers = ['Parameter', 'Current Value', 'Limit', 'Status', 'Margin'];
  sheet.getRow(4).values = ['', ...headers];
  applyHeaderStyle(sheet.getRow(4));

  const limits = data.dischargeLimits;
  const proc = data.proc;

  const complianceData = [
    {
      param: 'Oil in Water',
      current: proc.waterQuality,
      limit: limits.oilInWater,
      unit: 'ppm',
    },
    {
      param: 'TRH',
      current: proc.waterQuality * 1.3, // Approximation
      limit: limits.trh,
      unit: 'mg/L',
    },
    {
      param: 'COD',
      current: proc.waterQuality * 8, // Approximation
      limit: limits.cod,
      unit: 'mg/L',
    },
    {
      param: 'Turbidity',
      current: proc.turbidity,
      limit: limits.turbidity,
      unit: 'NTU',
    },
    {
      param: 'pH (min)',
      current: proc.pH,
      limit: limits.pH.min,
      unit: '-',
      isMin: true,
    },
    {
      param: 'pH (max)',
      current: proc.pH,
      limit: limits.pH.max,
      unit: '-',
    },
  ];

  let row = 5;
  complianceData.forEach((item, idx) => {
    const isCompliant = item.isMin
      ? item.current >= item.limit
      : item.current <= item.limit;
    const margin = item.isMin
      ? ((item.current - item.limit) / item.limit * 100)
      : ((item.limit - item.current) / item.limit * 100);

    const dataRow = sheet.getRow(row);
    dataRow.values = [
      '',
      item.param,
      `${item.current.toFixed(1)} ${item.unit}`,
      `${item.limit} ${item.unit}`,
      isCompliant ? '✓ COMPLIANT' : '✗ EXCEEDANCE',
      `${margin.toFixed(1)}%`,
    ];

    const statusCell = dataRow.getCell(5);
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isCompliant ? 'C6EFCE' : 'FFC7CE' },
    };
    statusCell.font = {
      ...FONTS.normal,
      color: { argb: isCompliant ? '006100' : 'C00000' },
      bold: true,
    };

    applyDataStyle(dataRow, idx % 2 === 1);
    row++;
  });

  // Summary
  row += 2;
  sheet.mergeCells(`B${row}:F${row}`);
  const allCompliant = complianceData.every(item =>
    item.isMin ? item.current >= item.limit : item.current <= item.limit
  );
  const summary = sheet.getCell(`B${row}`);
  summary.value = allCompliant
    ? '✅ ALL PARAMETERS WITHIN DISCHARGE LIMITS'
    : '⚠️ ONE OR MORE PARAMETERS EXCEED LIMITS - CORRECTIVE ACTION REQUIRED';
  summary.font = { ...FONTS.subtitle, color: { argb: allCompliant ? '006100' : 'C00000' } };
  summary.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: allCompliant ? 'C6EFCE' : 'FFC7CE' },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOWNLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════════

export async function downloadExcelReport(data: ReportData, filename?: string): Promise<void> {
  const blob = await generateExcelReport(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `WTP-Report-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  generateExcelReport,
  downloadExcelReport,
};
