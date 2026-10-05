import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData, type UserOptions } from 'jspdf-autotable';
import type { MonthlyReport } from '../types';
import { formatDate, shortMonth } from './format';

/**
 * Builds the printable monthly report as a PDF entirely on the device — no server
 * involved, so it works in the browser, desktop and mobile apps alike.
 */

const PAGE = { width: 210, height: 297, margin: 14 };
const COLORS = {
  ink: [15, 23, 42] as const,
  muted: [100, 116, 139] as const,
  line: [226, 232, 240] as const,
  brand: [79, 70, 229] as const,
  income: [42, 120, 214] as const,
  expense: [235, 104, 52] as const,
  savings: [27, 175, 122] as const,
  good: [12, 163, 12] as const,
  warning: [178, 120, 0] as const,
  critical: [208, 59, 59] as const,
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

// Characters the built-in PDF fonts can draw (Latin-1 plus common WinAnsi punctuation)
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const pdfText = (value: string) =>
  [...value].map((ch) => (ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.has(ch) ? ch : '?')).join('');

type Rgb = readonly [number, number, number];

export function buildReportPdf(report: MonthlyReport): { filename: string; bytes: Uint8Array } {
  const currency = report.user.currency;
  // The standard PDF fonts have no ₹ glyph, so amounts use the ISO code ("INR 1,23,456.00")
  const money = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const fmt = (n: number) => pdfText(money.format(n).replace(/\u00a0/g, ' '));
  const pct = (n: number) => `${n.toFixed(1)}%`;
  const delta = (n: number | null) => (n === null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}% vs last month`);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Finora report — ${report.period.label}`, author: report.user.name, creator: 'Finora' });
  const contentWidth = PAGE.width - PAGE.margin * 2;
  let y = PAGE.margin;

  const setColor = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const ensureSpace = (height: number) => {
    if (y + height > PAGE.height - PAGE.margin - 8) {
      doc.addPage();
      y = PAGE.margin;
    }
  };
  const heading = (title: string, subtitle?: string) => {
    ensureSpace(18);
    y += 4;
    doc.setFont('helvetica', 'bold').setFontSize(12);
    setColor(COLORS.ink);
    doc.text(pdfText(title), PAGE.margin, y);
    y += 5;
    if (subtitle) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5);
      setColor(COLORS.muted);
      doc.text(pdfText(subtitle), PAGE.margin, y);
      y += 4;
    }
    y += 1;
  };
  const table = (options: UserOptions) => {
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [...COLORS.ink], lineColor: [...COLORS.line] },
      headStyles: { fontStyle: 'bold', textColor: [...COLORS.muted], fillColor: [248, 250, 252], lineWidth: { bottom: 0.2 } },
      bodyStyles: { lineWidth: { bottom: 0.1 } },
      ...options,
      // Header and footer cells follow their column's alignment (numbers right-aligned)
      didParseCell: (data: CellHookData) => {
        const align = options.columnStyles?.[data.column.index]?.halign;
        if (data.section !== 'body' && align) data.cell.styles.halign = align;
        options.didParseCell?.(data);
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  };

  // ---------- Header ----------
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, PAGE.width, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text('Monthly financial report', PAGE.margin, 12);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(pdfText(`${report.period.label} · ${report.user.name}`), PAGE.margin, 19);
  doc.setFontSize(8);
  doc.text(
    pdfText(`Generated ${new Date(report.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`),
    PAGE.width - PAGE.margin,
    19,
    { align: 'right' },
  );
  y = 34;

  // ---------- Summary tiles ----------
  const s = report.summary;
  const tiles: { label: string; value: string; note: string; color: Rgb }[] = [
    { label: 'Income', value: fmt(s.income), note: delta(s.incomeChange), color: COLORS.income },
    { label: 'Expenses', value: fmt(s.expenses), note: delta(s.expenseChange), color: COLORS.expense },
    { label: 'Net savings', value: fmt(s.netSavings), note: delta(s.netSavingsChange), color: COLORS.savings },
    { label: 'Savings rate', value: pct(s.savingsRate), note: `${s.transactionCount} transactions`, color: COLORS.brand },
  ];
  const tileWidth = (contentWidth - 3 * 4) / 4;
  tiles.forEach((tile, i) => {
    const x = PAGE.margin + i * (tileWidth + 4);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(x, y, tileWidth, 22, 2, 2, 'S');
    doc.setFillColor(...tile.color);
    doc.rect(x, y + 2, 1.2, 18, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8);
    setColor(COLORS.muted);
    doc.text(tile.label, x + 4, y + 6);
    doc.setFont('helvetica', 'bold').setFontSize(10.5);
    setColor(COLORS.ink);
    doc.text(tile.value, x + 4, y + 12.5, { maxWidth: tileWidth - 6 });
    doc.setFont('helvetica', 'normal').setFontSize(7);
    setColor(COLORS.muted);
    doc.text(pdfText(tile.note), x + 4, y + 18, { maxWidth: tileWidth - 6 });
  });
  y += 28;

  // ---------- Six-month trend ----------
  heading('Income, expenses and savings', 'Last 6 months, ending with this report’s month');
  const maxValue = Math.max(1, ...report.trend.map((m) => Math.max(m.income, m.expense)));
  table({
    head: [['Month', 'Income', 'Expenses', 'Net savings', 'Savings rate', 'Budget', '']],
    body: report.trend.map((m) => [
      shortMonth(m.month, true),
      fmt(m.income),
      fmt(m.expense),
      fmt(m.savings),
      pct(m.savingsRate),
      m.budget === null ? '—' : fmt(m.budget),
      '',
    ]),
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { cellWidth: 34 },
    },
    // Paired mini bars: income (blue) over expenses (orange), on one shared scale
    didDrawCell: (data: CellHookData) => {
      if (data.section !== 'body' || data.column.index !== 6) return;
      const m = report.trend[data.row.index];
      const width = data.cell.width - 4;
      const x = data.cell.x + 2;
      const barH = 1.6;
      const mid = data.cell.y + data.cell.height / 2;
      doc.setFillColor(...COLORS.income);
      doc.rect(x, mid - barH - 0.3, Math.max((m.income / maxValue) * width, 0.3), barH, 'F');
      doc.setFillColor(...COLORS.expense);
      doc.rect(x, mid + 0.3, Math.max((m.expense / maxValue) * width, 0.3), barH, 'F');
    },
  });
  doc.setFontSize(7);
  setColor(COLORS.muted);
  doc.setFillColor(...COLORS.income);
  doc.rect(PAGE.width - PAGE.margin - 46, y - 3.2, 2.5, 2, 'F');
  doc.text('Income', PAGE.width - PAGE.margin - 42.5, y - 1.5);
  doc.setFillColor(...COLORS.expense);
  doc.rect(PAGE.width - PAGE.margin - 26, y - 3.2, 2.5, 2, 'F');
  doc.text('Expenses', PAGE.width - PAGE.margin - 22.5, y - 1.5);
  y += 2;

  // ---------- Category breakdown ----------
  const categoryTable = (rows: MonthlyReport['expenseCategories'], color: Rgb, empty: string) => {
    if (!rows.data.length) {
      doc.setFont('helvetica', 'italic').setFontSize(8.5);
      setColor(COLORS.muted);
      doc.text(empty, PAGE.margin, y + 2);
      y += 8;
      return;
    }
    const top = Math.max(...rows.data.map((c) => c.total));
    table({
      head: [['Category', 'Amount', 'Share', 'Transactions', '']],
      body: rows.data.map((c) => [pdfText(c.name), fmt(c.total), pct(c.percentage), String(c.count), '']),
      foot: [['Total', fmt(rows.total), '100%', String(rows.data.reduce((n, c) => n + c.count, 0)), '']],
      footStyles: { fontStyle: 'bold', lineWidth: { top: 0.2 } },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { cellWidth: 50 } },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== 'body' || data.column.index !== 4) return;
        const c = rows.data[data.row.index];
        doc.setFillColor(...color);
        doc.rect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 1, Math.max(((data.cell.width - 4) * c.total) / top, 0.3), 2, 'F');
      },
    });
  };
  heading('Spending by category', `${formatDate(report.period.startDate)} – ${formatDate(report.period.endDate)}`);
  categoryTable(report.expenseCategories, COLORS.expense, 'No expenses recorded this month.');
  heading('Income by source');
  categoryTable(report.incomeCategories, COLORS.income, 'No income recorded this month.');

  // ---------- Budget performance ----------
  heading('Budget performance', 'Warning at 80% of a budget; exceeded above 100%');
  const budget = report.budget;
  if (!budget) {
    doc.setFont('helvetica', 'italic').setFontSize(8.5);
    setColor(COLORS.muted);
    doc.text('No budget was set for this month.', PAGE.margin, y + 2);
    y += 8;
  } else {
    const statusLabel = { ON_TRACK: 'On track', WARNING: 'Near limit', EXCEEDED: 'Exceeded' } as const;
    const statusColor = { ON_TRACK: COLORS.good, WARNING: COLORS.warning, EXCEEDED: COLORS.critical } as const;
    const rows = [
      { name: 'Overall monthly budget', ...budget, bold: true },
      ...budget.categories.map((c) => ({ ...c, name: c.category.name, bold: false })),
    ];
    table({
      head: [['Budget', 'Limit', 'Spent', 'Remaining', 'Used', 'Status']],
      body: rows.map((r) => [pdfText(r.name), fmt(r.amount), fmt(r.spent), fmt(r.remaining), pct(r.usage), statusLabel[r.status]]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: (data: CellHookData) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (row.bold) data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 5) data.cell.styles.textColor = [...statusColor[row.status]];
      },
    });
  }

  // ---------- Transaction summary ----------
  const t = report.transactions;
  heading('Transaction summary');
  table({
    body: [
      ['Transactions', String(t.count), 'Income entries', String(t.incomeCount)],
      ['Expense entries', String(t.expenseCount), 'Average expense', fmt(t.averageExpense)],
    ],
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    columnStyles: { 0: { textColor: [...COLORS.muted] }, 1: { fontStyle: 'bold' }, 2: { textColor: [...COLORS.muted] }, 3: { fontStyle: 'bold' } },
  });
  if (t.byPaymentMethod.length) {
    table({
      head: [['Spending by payment method', 'Transactions', 'Amount']],
      body: t.byPaymentMethod.map((p) => [PAYMENT_LABELS[p.method] ?? p.method, String(p.count), fmt(p.total)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
  }
  if (t.largestExpenses.length) {
    table({
      head: [['Largest expenses', 'Date', 'Category', 'Amount']],
      body: t.largestExpenses.map((e) => [pdfText(e.description), formatDate(e.date), pdfText(e.category.name), fmt(e.amount)]),
      columnStyles: { 3: { halign: 'right' } },
    });
  }

  // ---------- Goals ----------
  if (report.goals.length) {
    heading('Savings goals', 'Current progress');
    table({
      head: [['Goal', 'Saved', 'Target', 'Progress', 'Target date']],
      body: report.goals.map((g) => [
        pdfText(g.name),
        fmt(g.currentAmount),
        fmt(g.targetAmount),
        pct(g.progress),
        g.targetDate ? formatDate(g.targetDate) : '—',
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }

  // ---------- All transactions ----------
  heading(
    'All transactions',
    t.truncated ? `First ${t.list.length} of ${t.count} transactions — export CSV for the full list` : `${t.list.length} transactions`,
  );
  table({
    head: [['Date', 'Description', 'Category', 'Method', 'Amount']],
    body: t.list.map((tx) => [
      formatDate(tx.date, { day: '2-digit', month: 'short' }),
      pdfText(tx.description) + (tx.recurringId ? ' (recurring)' : ''),
      pdfText(tx.category.name),
      PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod,
      `${tx.type === 'INCOME' ? '+' : '-'}${fmt(tx.amount)}`,
    ]),
    columnStyles: { 0: { cellWidth: 16 }, 4: { halign: 'right', cellWidth: 36 } },
    didParseCell: (data: CellHookData) => {
      if (data.section === 'body' && data.column.index === 4 && t.list[data.row.index]?.type === 'INCOME') {
        data.cell.styles.textColor = [...COLORS.good];
      }
    },
  });

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    setColor(COLORS.muted);
    doc.text(pdfText(`Finora · ${report.period.label}`), PAGE.margin, PAGE.height - 8);
    doc.text(`Page ${i} of ${pages}`, PAGE.width - PAGE.margin, PAGE.height - 8, { align: 'right' });
  }

  const mm = String(report.period.month).padStart(2, '0');
  return { filename: `finora-report-${report.period.year}-${mm}.pdf`, bytes: new Uint8Array(doc.output('arraybuffer')) };
}
