import { useState } from 'react';
import { Download, FileText, Printer, Share2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { CategoryBreakdownList } from '../components/charts/CategoryBreakdownList';
import { Button } from '../components/ui/Button';
import { BudgetStatusBadge, Card, CardHeader, Delta, PageHeader, ProgressBar, StatCard } from '../components/ui/Display';
import { ErrorState, Skeleton } from '../components/ui/Feedback';
import { MonthSwitcher } from '../components/ui/MonthSwitcher';
import { useMonthlyReport } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import { canPrint, saveFile } from '../platform/files';
import { getErrorMessage } from '../services/api';
import { isOfflineApp } from '../services/backend';
import { Capacitor } from '@capacitor/core';
import { currentPeriod, formatDate } from '../utils/format';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

export default function ReportsPage() {
  const { format } = useCurrency();
  const [period, setPeriod] = useState(currentPeriod);
  const { data: report, isLoading, isError, error, refetch, isFetching } = useMonthlyReport(period);
  const [exporting, setExporting] = useState(false);
  const mobile = Capacitor.isNativePlatform();

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      // Loaded on demand — the PDF library is only needed here
      const { buildReportPdf } = await import('../utils/reportPdf');
      const { filename, bytes } = buildReportPdf(report);
      const result = await saveFile({ filename, data: bytes, mimeType: 'application/pdf', filter: { name: 'PDF document', extensions: ['pdf'] } });
      if (result.status === 'saved') toast.success(result.location ? `Report saved to ${result.location}` : 'Report downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the PDF'));
    } finally {
      setExporting(false);
    }
  };

  const s = report?.summary;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Printable monthly report — income, expenses, savings, categories, budgets and transactions.${isOfflineApp() ? ' Generated on this device.' : ''}`}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <MonthSwitcher value={period} onChange={setPeriod} />
            {canPrint() && (
              <Button variant="outline" onClick={() => window.print()} disabled={!report}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            )}
            <Button onClick={exportPdf} loading={exporting} disabled={!report || isFetching}>
              {!exporting && (mobile ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />)}
              {mobile ? 'Share PDF' : 'Download PDF'}
            </Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !report || !s ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="print-sheet space-y-4">
          <div className="hidden print:block">
            <h1 className="text-xl font-semibold">Monthly financial report — {report.period.label}</h1>
            <p className="text-sm text-slate-500">{report.user.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Income" value={format(s.income)} icon={<Wallet className="h-5 w-5" />} iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" footer={<Delta value={s.incomeChange} />} />
            <StatCard label="Expenses" value={format(s.expenses)} icon={<Wallet className="h-5 w-5" />} iconClass="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" footer={<Delta value={s.expenseChange} invert />} />
            <StatCard label="Net savings" value={format(s.netSavings)} icon={<Wallet className="h-5 w-5" />} iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" footer={<Delta value={s.netSavingsChange} />} />
            <StatCard label="Savings rate" value={`${s.savingsRate.toFixed(1)}%`} icon={<FileText className="h-5 w-5" />} iconClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" footer={<span className="text-xs text-slate-500">{s.transactionCount} transactions</span>} />
          </div>

          <Card>
            <CardHeader title="Income vs expenses" subtitle="Last 6 months" />
            <div className="p-5">
              <IncomeExpenseChart data={report.trend} height={240} />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Spending by category" subtitle={`${formatDate(report.period.startDate)} – ${formatDate(report.period.endDate)}`} />
              <div className="p-5">
                <CategoryBreakdownList data={report.expenseCategories} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Income by source" />
              <div className="p-5">
                <CategoryBreakdownList data={report.incomeCategories} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Budget performance" subtitle="Near limit from 80%, exceeded above 100%" />
            <div className="p-5">
              {!report.budget ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No budget was set for this month.</p>
              ) : (
                <ul className="space-y-4">
                  {[{ key: 'total', name: 'Overall monthly budget', usage: report.budget }, ...report.budget.categories.map((c) => ({ key: c.id, name: c.category.name, usage: c }))].map(
                    ({ key, name, usage }) => (
                      <li key={key}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{name}</span>
                          <span className="flex items-center gap-2">
                            <span className="tabular text-slate-600 dark:text-slate-300">
                              {format(usage.spent)} of {format(usage.amount)} · {usage.usage.toFixed(1)}%
                            </span>
                            <BudgetStatusBadge status={usage.status} />
                          </span>
                        </div>
                        <ProgressBar value={usage.usage} status={usage.status} label={`${name} used`} />
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Transaction summary" />
              <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Income entries</dt>
                  <dd className="tabular mt-0.5 font-semibold">{report.transactions.incomeCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Expense entries</dt>
                  <dd className="tabular mt-0.5 font-semibold">{report.transactions.expenseCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Average expense</dt>
                  <dd className="tabular mt-0.5 font-semibold">{format(report.transactions.averageExpense)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Top payment method</dt>
                  <dd className="mt-0.5 font-semibold">
                    {report.transactions.byPaymentMethod[0] ? PAYMENT_LABELS[report.transactions.byPaymentMethod[0].method] : '—'}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card>
              <CardHeader title="Largest expenses" />
              <ul className="divide-y divide-slate-100 px-5 pb-3 dark:divide-slate-800">
                {report.transactions.largestExpenses.length ? (
                  report.transactions.largestExpenses.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800 dark:text-slate-200">{t.description}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(t.date)} · {t.category.name}
                        </span>
                      </span>
                      <span className="tabular shrink-0 font-medium">{format(t.amount)}</span>
                    </li>
                  ))
                ) : (
                  <li className="py-3 text-sm text-slate-500 dark:text-slate-400">No expenses this month.</li>
                )}
              </ul>
            </Card>
          </div>

          <p className="no-print text-center text-xs text-slate-500 dark:text-slate-400">
            The PDF also includes savings goals and the full list of this month’s {report.transactions.count} transactions.
          </p>
        </div>
      )}
    </>
  );
}
