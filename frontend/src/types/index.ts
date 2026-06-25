export interface User {
  id: string
  email: string
  name?: string
  createdAt: string
}

export interface Account {
  id: string
  name: string
  currency: string
  initialBalance: number
  balance?: number
  icon?: string
  color?: string
  type?: string
  isArchived?: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  icon?: string
  color?: string
  type: 'income' | 'expense'
  parentId?: string
  parent?: Category
  isSystem?: boolean
  children?: Category[]
}

export interface Transaction {
  id: string
  accountId: string
  categoryId?: string
  amount: number
  date: string
  note?: string
  tags: string[]
  isExcludedFromBudget: boolean
  isScheduled: boolean
  account?: Account
  category?: Category
  createdAt: string
  updatedAt: string
}

export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  convertedAmount?: number
  fee: number
  date: string
  note?: string
  status: string
  fromAccount?: Account
  toAccount?: Account
}

export interface ScheduledTransaction {
  id: string
  accountId: string
  categoryId?: string
  title: string
  amount: number
  type: 'income' | 'expense'
  startDate: string
  endDate?: string
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom'
  customDays?: number
  nextExecutionDate: string
  isActive: boolean
  note?: string
  lastExecutedDate?: string
  account?: Account
  category?: Category
}

export interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  note?: string
  avatarData?: string
  isFavorite: boolean
  debts?: Debt[]
}

export interface Debt {
  id: string
  contactId: string
  accountId?: string
  amount: number
  paidAmount?: number
  remainingAmount?: number
  currency: string
  type: 'iOwe' | 'owedToMe'
  status: 'active' | 'overdue' | 'settled' | 'writtenOff'
  dateTaken: string
  dueDate?: string
  settledDate?: string
  purpose?: string
  interestRate?: number
  isInBudget: boolean
  reminderDays: number
  contact?: Contact
  account?: Account
  payments?: DebtPayment[]
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  date: string
  note?: string
  transactionId?: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ReportSummary {
  totalIncome: number
  totalExpense: number
  netFlow: number
  averageDailyExpense: number
  transactionCount: number
  incomeCount: number
  expenseCount: number
  savingsRate: number
}
