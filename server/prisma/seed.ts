/**
 * Development seed — creates a demo user with ~6 months of realistic INR data.
 * Safe to re-run: the demo user is deleted and recreated each time.
 *
 *   Email:    demo@finance.app
 *   Password: Demo@1234
 */
import { PrismaClient, type PaymentMethod, type TransactionType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_CATEGORIES } from '../src/config/defaultCategories';

const prisma = new PrismaClient();

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

const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

interface SeedTx {
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  day: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

function monthTransactions(monthOffset: number): SeedTx[] {
  const txs: SeedTx[] = [
    { type: 'INCOME', category: 'Salary', description: 'Monthly salary', amount: 45000, day: 1, paymentMethod: 'BANK_TRANSFER' },
    { type: 'EXPENSE', category: 'Rent', description: 'House rent', amount: 12000, day: 3, paymentMethod: 'BANK_TRANSFER' },
    { type: 'EXPENSE', category: 'Bills', description: 'Electricity bill', amount: between(1200, 1900), day: 8, paymentMethod: 'UPI' },
    { type: 'EXPENSE', category: 'Bills', description: 'Mobile & broadband', amount: 999, day: 10, paymentMethod: 'UPI' },
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
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      name: 'Arjun Sharma',
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      currency: 'INR',
      categories: { create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })) },
    },
    include: { categories: true },
  });

  const categoryId = (type: TransactionType, name: string) => {
    const c = user.categories.find((x) => x.type === type && x.name === name);
    if (!c) throw new Error(`Missing category ${type}/${name}`);
    return c.id;
  };

  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const rows = [];

  for (let offset = MONTHS - 1; offset >= 0; offset--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const year = ref.getUTCFullYear();
    const month = ref.getUTCMonth() + 1;

    for (const tx of monthTransactions(offset)) {
      const date = utcDate(year, month, tx.day);
      if (date > today) continue; // never create future-dated transactions
      rows.push({
        userId: user.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date,
        paymentMethod: tx.paymentMethod,
        notes: tx.notes ?? null,
        categoryId: categoryId(tx.type, tx.category),
      });
    }

    // Monthly budgets for the last 3 months
    if (offset <= 2) {
      await prisma.budget.create({
        data: {
          userId: user.id,
          year,
          month,
          totalAmount: 30000,
          notes: 'Keep discretionary spending in check',
          categories: {
            create: [
              { categoryId: categoryId('EXPENSE', 'Rent'), amount: 12000 },
              { categoryId: categoryId('EXPENSE', 'Food'), amount: 5000 },
              { categoryId: categoryId('EXPENSE', 'Bills'), amount: 4000 },
              { categoryId: categoryId('EXPENSE', 'Transport'), amount: 2500 },
              { categoryId: categoryId('EXPENSE', 'Shopping'), amount: 3000 },
              { categoryId: categoryId('EXPENSE', 'Entertainment'), amount: 1500 },
            ],
          },
        },
      });
    }
  }

  await prisma.transaction.createMany({ data: rows });

  const inMonths = (m: number) => utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1 + m, 1);
  await prisma.financialGoal.createMany({
    data: [
      { userId: user.id, name: 'New Laptop', targetAmount: 80000, currentAmount: 35000, targetDate: inMonths(5), description: 'MacBook Air for work and side projects', color: '#4f46e5' },
      { userId: user.id, name: 'Emergency Fund', targetAmount: 150000, currentAmount: 92000, targetDate: inMonths(10), description: '6 months of essential expenses', color: '#059669' },
      { userId: user.id, name: 'Goa Vacation', targetAmount: 40000, currentAmount: 12500, targetDate: inMonths(3), description: 'Trip with friends in winter', color: '#d97706' },
    ],
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'SYSTEM',
      title: 'Welcome to Finora 👋',
      message: 'Your demo account is loaded with 6 months of sample data. Explore the dashboard!',
    },
  });

  console.log(`✅ Seeded ${rows.length} transactions, 3 budgets and 3 goals.`);
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
