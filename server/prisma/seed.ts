/**
 * Development seed — creates a demo user with ~6 months of realistic INR data.
 * Safe to re-run: the demo user is deleted and recreated each time.
 *
 *   Email:    demo@finance.app
 *   Password: Demo@1234
 */
import {
  authService,
  budgetService,
  categoryService,
  goalService,
  recurringService,
  toPaise,
  type PaymentMethod,
  type TransactionType,
} from '@finora/core';
import { core, db } from '../src/config/db';

const DEMO_EMAIL = 'demo@finance.app';
const DEMO_PASSWORD = 'Demo@1234';
const MONTHS = 6;

// Deterministic pseudo-random generator so the seed is reproducible
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];

const isoDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);

interface SeedTx {
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  day: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

/** One-off transactions; salary, rent and broadband come from recurring rules below. */
function monthTransactions(monthOffset: number): SeedTx[] {
  const txs: SeedTx[] = [
    { type: 'EXPENSE', category: 'Bills', description: 'Electricity bill', amount: between(1200, 1900), day: 8, paymentMethod: 'UPI' },
    { type: 'EXPENSE', category: 'Bills', description: 'Water & maintenance', amount: between(800, 1300), day: 12, paymentMethod: 'UPI' },
  ];

  if (monthOffset % 2 === 0) {
    txs.push({ type: 'INCOME', category: 'Freelance', description: 'Freelance web project', amount: 8000, day: 18, paymentMethod: 'BANK_TRANSFER', notes: 'Landing page for a local bakery' });
  }
  if (monthOffset === 3) {
    txs.push({ type: 'INCOME', category: 'Investments', description: 'Mutual fund dividend', amount: 2400, day: 22, paymentMethod: 'BANK_TRANSFER' });
  }

  const food = ['Swiggy order', 'Zomato dinner', 'Groceries — BigBasket', 'Cafe Coffee Day', 'Lunch with team', 'Vegetables & fruits'];
  for (let i = 0; i < 6; i++) {
    txs.push({ type: 'EXPENSE', category: 'Food', description: pick(food), amount: between(350, 1100), day: between(2, 27), paymentMethod: pick<PaymentMethod>(['UPI', 'UPI', 'DEBIT_CARD', 'CASH']) });
  }
  const transport = ['Uber ride', 'Metro card recharge', 'Petrol', 'Ola auto'];
  for (let i = 0; i < 4; i++) {
    txs.push({ type: 'EXPENSE', category: 'Transport', description: pick(transport), amount: between(300, 900), day: between(2, 27), paymentMethod: pick<PaymentMethod>(['UPI', 'CASH', 'CREDIT_CARD']) });
  }
  txs.push({ type: 'EXPENSE', category: 'Shopping', description: pick(['Amazon order', 'Myntra — clothing', 'Flipkart electronics']), amount: between(1500, 3200), day: between(5, 25), paymentMethod: 'CREDIT_CARD' });
  txs.push({ type: 'EXPENSE', category: 'Entertainment', description: pick(['Movie tickets — PVR', 'Netflix subscription', 'Concert tickets']), amount: between(499, 1500), day: between(5, 25), paymentMethod: pick<PaymentMethod>(['CREDIT_CARD', 'UPI']) });
  if (rand() > 0.4) {
    txs.push({ type: 'EXPENSE', category: 'Health', description: pick(['Pharmacy', 'Gym membership', 'Doctor consultation']), amount: between(400, 1800), day: between(5, 25), paymentMethod: 'UPI' });
  }
  if (monthOffset === 1) {
    txs.push({ type: 'EXPENSE', category: 'Travel', description: 'Weekend trip to Pondicherry', amount: 6800, day: 14, paymentMethod: 'CREDIT_CARD', notes: 'Bus + homestay' });
  }
  if (monthOffset === 4) {
    txs.push({ type: 'EXPENSE', category: 'Education', description: 'Online course — Udemy', amount: 1299, day: 9, paymentMethod: 'DEBIT_CARD' });
  }
  return txs;
}

async function main() {
  console.log('🌱 Seeding database...');
  await db.deleteFrom('User').where('email', '=', DEMO_EMAIL).execute();

  const user = await authService.register(core, { name: 'Arjun Sharma', email: DEMO_EMAIL, password: DEMO_PASSWORD });
  const categories = await categoryService.listCategories(core, user.id);
  const categoryId = (type: TransactionType, name: string) => {
    const c = categories.find((x) => x.type === type && x.name === name);
    if (!c) throw new Error(`Missing category ${type}/${name}`);
    return c.id;
  };

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));
  const firstYear = first.getUTCFullYear();
  const firstMonth = first.getUTCMonth() + 1;

  // Recurring rules back-fill their past occurrences on creation
  const rules = [
    { type: 'INCOME' as const, category: 'Salary', description: 'Monthly salary', amount: 45000, day: 1, paymentMethod: 'BANK_TRANSFER' as const },
    { type: 'EXPENSE' as const, category: 'Rent', description: 'House rent', amount: 12000, day: 3, paymentMethod: 'BANK_TRANSFER' as const },
    { type: 'EXPENSE' as const, category: 'Bills', description: 'Mobile & broadband', amount: 999, day: 10, paymentMethod: 'UPI' as const },
  ];
  for (const r of rules) {
    await recurringService.createRecurring(core, user.id, {
      type: r.type,
      amount: r.amount,
      categoryId: categoryId(r.type, r.category),
      description: r.description,
      paymentMethod: r.paymentMethod,
      notes: null,
      frequency: 'MONTHLY',
      interval: 1,
      startDate: isoDate(firstYear, firstMonth, r.day),
      endDate: null,
      isActive: true,
    });
  }

  const rows = [];
  const createdAt = now.toISOString();
  for (let offset = MONTHS - 1; offset >= 0; offset--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const year = ref.getUTCFullYear();
    const month = ref.getUTCMonth() + 1;

    for (const tx of monthTransactions(offset)) {
      const date = isoDate(year, month, tx.day);
      if (date > today) continue; // never create future-dated transactions
      rows.push({
        id: core.newId(),
        userId: user.id,
        type: tx.type,
        amount: toPaise(tx.amount),
        description: tx.description,
        date,
        paymentMethod: tx.paymentMethod,
        notes: tx.notes ?? null,
        categoryId: categoryId(tx.type, tx.category),
        recurringId: null,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  await db.insertInto('Transaction').values(rows).execute();

  // Monthly budgets for the last 3 months
  for (let offset = 2; offset >= 0; offset--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    await budgetService.createBudget(core, user.id, {
      year: ref.getUTCFullYear(),
      month: ref.getUTCMonth() + 1,
      totalAmount: 30000,
      notes: 'Keep discretionary spending in check',
      categories: [
        { categoryId: categoryId('EXPENSE', 'Rent'), amount: 12000 },
        { categoryId: categoryId('EXPENSE', 'Food'), amount: 5000 },
        { categoryId: categoryId('EXPENSE', 'Bills'), amount: 4000 },
        { categoryId: categoryId('EXPENSE', 'Transport'), amount: 2500 },
        { categoryId: categoryId('EXPENSE', 'Shopping'), amount: 3000 },
        { categoryId: categoryId('EXPENSE', 'Entertainment'), amount: 1500 },
      ],
    });
  }

  const inMonths = (m: number) => isoDate(now.getUTCFullYear(), now.getUTCMonth() + 1 + m, 1);
  const goals = [
    { name: 'New Laptop', targetAmount: 80000, currentAmount: 35000, targetDate: inMonths(5), description: 'MacBook Air for work and side projects', color: '#4f46e5' },
    { name: 'Emergency Fund', targetAmount: 150000, currentAmount: 92000, targetDate: inMonths(10), description: '6 months of essential expenses', color: '#059669' },
    { name: 'Goa Vacation', targetAmount: 40000, currentAmount: 12500, targetDate: inMonths(3), description: 'Trip with friends in winter', color: '#d97706' },
  ];
  for (const goal of goals) await goalService.createGoal(core, user.id, goal);

  const recurringCount = await db
    .selectFrom('Transaction')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('userId', '=', user.id)
    .where('recurringId', 'is not', null)
    .executeTakeFirstOrThrow();

  console.log(`✅ Seeded ${rows.length + Number(recurringCount.n)} transactions (${recurringCount.n} from 3 recurring rules), 3 budgets and 3 goals.`);
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
