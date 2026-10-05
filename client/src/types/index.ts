export type TransactionType = 'INCOME' | 'EXPENSE';
export type PaymentMethod = 'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
export type BudgetStatus = 'ON_TRACK' | 'WARNING' | 'EXCEEDED';
export type GoalStatus = 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
export type NotificationType = 'BUDGET_EXCEEDED' | 'BUDGET_WARNING' | 'GOAL_MILESTONE' | 'MONTHLY_SUMMARY' | 'SYSTEM';

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  theme: ThemePreference;
  notifyBudgetAlerts: boolean;
  notifyGoalMilestones: boolean;
  notifyMonthlySummary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  isDefault: boolean;
  transactionCount?: number;
}

export type CategoryRef = Pick<Category, 'id' | 'name' | 'color' | 'icon'> & { type?: TransactionType };

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
  categoryId: string;
  category: CategoryRef;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
}

export interface TransactionFilters {
  page: number;
  pageSize: number;
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  sortBy: 'date' | 'amount' | 'description' | 'category' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  totals: { income: number; expense: number; net: number };
}

export interface UsageFigures {
  amount: number;
  spent: number;
  remaining: number;
  usage: number;
  status: BudgetStatus;
}

export interface BudgetCategoryUsage extends UsageFigures {
  id: string;
  categoryId: string;
  category: CategoryRef;
}

export interface Budget extends UsageFigures {
  id: string;
  month: number;
  year: number;
  totalAmount: number;
  notes: string | null;
  allocated: number;
  categories: BudgetCategoryUsage[];
}

export interface BudgetInput {
  month: number;
  year: number;
  totalAmount: number;
  notes?: string | null;
  categories: { categoryId: string; amount: number }[];
}

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  progress: number;
  remaining: number;
  daysLeft: number | null;
  monthlyRequired: number | null;
  status: GoalStatus;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  description?: string | null;
  color: string;
}

export interface Summary {
  period: { year: number; month: number };
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  month: {
    income: number;
    expenses: number;
    netSavings: number;
    savingsRate: number;
    transactionCount: number;
    incomeChange: number | null;
    expenseChange: number | null;
    netSavingsChange: number | null;
  };
  budget: (UsageFigures & { id: string; categories: BudgetCategoryUsage[] }) | null;
  goals: { count: number; completed: number; totalTarget: number; totalSaved: number; progress: number };
  recentTransactions: Transaction[];
}

export interface MonthlyPoint {
  month: string;
  year: number;
  monthIndex: number;
  income: number;
  expense: number;
  savings: number;
  cumulativeSavings: number;
  savingsRate: number;
  budget: number | null;
  budgetUsage: number | null;
}

export interface CategoryBreakdown {
  type: TransactionType;
  startDate: string;
  endDate: string;
  total: number;
  data: { categoryId: string; name: string; color: string; icon: string; total: number; count: number; percentage: number }[];
}

export interface DailyPoint {
  date: string;
  day: number;
  income: number;
  expense: number;
  cumulativeExpense: number;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
