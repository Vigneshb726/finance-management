import {
  Banknote,
  Briefcase,
  Car,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  type LucideIcon,
  PawPrint,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Baby,
  Coffee,
  Shirt,
} from 'lucide-react';
import type { PaymentMethod } from '../types';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark },
  { value: 'OTHER', label: 'Other', icon: Wallet },
];

export const paymentLabel = (value: PaymentMethod) => PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  'graduation-cap': GraduationCap,
  receipt: Receipt,
  film: Film,
  'heart-pulse': HeartPulse,
  plane: Plane,
  home: Home,
  tag: Tag,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  gift: Gift,
  fuel: Fuel,
  wifi: Wifi,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  baby: Baby,
  coffee: Coffee,
  shirt: Shirt,
  sparkles: Sparkles,
  wallet: Wallet,
};

export const COLOR_SWATCHES = [
  '#4f46e5', '#2a78d6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16',
  '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6', '#64748b',
];

export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
];
