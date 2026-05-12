import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { parseNaturalLanguageTransaction } from "@/lib/quick-add";
import { StatementImportDialog } from "@/components/StatementImportDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Search, Filter, X, Trash2, Edit2, Eye, EyeOff, Building2, CreditCard, TrendingUp, Bitcoin, Copy, ExternalLink, Users, Calendar, Hash, Repeat, Tags, FileText, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import { CURRENCY_CONFIG, Currency, TransactionType, PaymentMethod, TaxTag, AccountType, Account, Transaction, Budget, RecurringFrequency, RecurringTemplate, Category, VaultDocument } from "@/lib/types";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  cash: <Wallet className="h-4 w-4" />,
  bank: <Building2 className="h-4 w-4" />,
  credit_card: <CreditCard className="h-4 w-4" />,
  investment: <TrendingUp className="h-4 w-4" />,
  crypto: <Bitcoin className="h-4 w-4" />,
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function advanceRecurringDate(date: string, frequency: RecurringFrequency): string {
  const next = new Date(`${date}T00:00:00`);

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }

  return next.toISOString().split('T')[0];
}

export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    transactions,
    accounts,
    categories,
    budgets,
    recurringTemplates,
    documents,
    settings,
    addRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
    addTransaction,
    importTransactions,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    addBudget,
    updateBudget,
    deleteBudget,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useFinOS();

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [accDetailOpen, setAccDetailOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTemplate | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'tx' | 'acc' | 'bud' | 'recurring' | 'category'; id: string } | null>(null);
  const [showAccountNumbers, setShowAccountNumbers] = useState<Record<string, boolean>>({});
  const [quickAddInput, setQuickAddInput] = useState('');

  // Transaction form state
  const [txForm, setTxForm] = useState({
    amount: '', type: 'expense' as TransactionType, categoryId: '', accountId: '', toAccountId: '',
    date: new Date().toISOString().split('T')[0], note: '', paymentMethod: 'card' as PaymentMethod,
    currency: settings.defaultCurrency as Currency, taxTag: 'untagged' as TaxTag, isDeductible: false, isRecurring: false, frequency: 'monthly' as RecurringFrequency,
  });

  // Account form state
  const [accForm, setAccForm] = useState({
    name: '', type: 'bank' as AccountType, balance: '', currency: settings.defaultCurrency as Currency,
    bankName: '', accountNumber: '', ifscCode: '', branchName: '', nominees: '', loginUrl: '', notes: '',
  });
  const [budgetForm, setBudgetForm] = useState({
    categoryId: '',
    amount: '',
    currency: settings.defaultCurrency as Currency,
    alertThreshold: '80',
  });
  const [recurringForm, setRecurringForm] = useState({
    amount: '',
    type: 'expense' as TransactionType,
    categoryId: '',
    accountId: '',
    toAccountId: '',
    nextDate: new Date().toISOString().split('T')[0],
    note: '',
    paymentMethod: 'card' as PaymentMethod,
    currency: settings.defaultCurrency as Currency,
    taxTag: 'untagged' as TaxTag,
    isDeductible: false,
    frequency: 'monthly' as RecurringFrequency,
    isPaused: false,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'expense' as Category['type'],
    color: '#2563eb',
    icon: 'tag',
    parentId: '',
  });

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let txs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (search) txs = txs.filter(t => t.note.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== 'all') txs = txs.filter(t => t.type === filterType);
    if (filterCategory !== 'all') txs = txs.filter(t => t.categoryId === filterCategory);
    if (filterAccount !== 'all') txs = txs.filter(t => t.accountId === filterAccount || t.toAccountId === filterAccount);
    if (filterDateFrom) txs = txs.filter(t => t.date >= filterDateFrom);
    if (filterDateTo) txs = txs.filter(t => t.date <= filterDateTo);
    return txs;
  }, [transactions, search, filterType, filterCategory, filterAccount, filterDateFrom, filterDateTo]);

  const transactionDocumentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((document) => {
      if (document.linkedEntityType === 'transaction' && document.linkedEntityId) {
        counts[document.linkedEntityId] = (counts[document.linkedEntityId] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const accountDocumentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((document) => {
      if (document.linkedEntityType === 'account' && document.linkedEntityId) {
        counts[document.linkedEntityId] = (counts[document.linkedEntityId] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const selectedAccountDocuments = useMemo(
    () =>
      selectedAccount
        ? documents.filter(
            (document) => document.linkedEntityType === 'account' && document.linkedEntityId === selectedAccount.id
          )
        : [],
    [documents, selectedAccount]
  );

  const clearFilters = () => {
    setSearch(''); setFilterType('all'); setFilterCategory('all'); setFilterAccount('all');
    setFilterDateFrom(''); setFilterDateTo('');
  };
  const hasActiveFilters = filterType !== 'all' || filterCategory !== 'all' || filterAccount !== 'all' || filterDateFrom || filterDateTo;

  // TX modal handlers
  const openAddTx = () => {
    setEditingTx(null);
    setTxForm({
      amount: '', type: 'expense', categoryId: categories.find(c => c.type === 'expense')?.id || '',
      accountId: accounts[0]?.id || '', toAccountId: accounts[1]?.id || '', date: new Date().toISOString().split('T')[0], note: '',
      paymentMethod: 'card', currency: settings.defaultCurrency, taxTag: 'untagged', isDeductible: false, isRecurring: false, frequency: 'monthly',
    });
    setTxModalOpen(true);
  };
  const openEditTx = (tx: Transaction) => {
    const recurringTemplate = tx.recurringTemplateId ? recurringTemplates.find((template) => template.id === tx.recurringTemplateId) : undefined;
    setEditingTx(tx);
    setTxForm({
      amount: tx.amount.toString(), type: tx.type, categoryId: tx.categoryId, accountId: tx.accountId, toAccountId: tx.toAccountId || '',
      date: tx.date, note: tx.note, paymentMethod: tx.paymentMethod, currency: tx.currency,
      taxTag: tx.taxTag, isDeductible: tx.isDeductible, isRecurring: tx.isRecurring, frequency: recurringTemplate?.frequency || 'monthly',
    });
    setTxModalOpen(true);
  };

  const buildRecurringTemplate = (templateId: string, createdAt: string): RecurringTemplate => ({
    id: templateId,
    amount: parseFloat(txForm.amount),
    type: txForm.type,
    categoryId: txForm.categoryId,
    accountId: txForm.accountId,
    toAccountId: txForm.type === 'transfer' ? txForm.toAccountId || undefined : undefined,
    note: txForm.note.trim(),
    paymentMethod: txForm.paymentMethod,
    currency: txForm.currency,
    taxTag: txForm.taxTag,
    isDeductible: txForm.isDeductible,
    frequency: txForm.frequency,
    nextDate: advanceRecurringDate(txForm.date, txForm.frequency),
    isPaused: false,
    createdAt,
    updatedAt: new Date().toISOString(),
  });

  const buildRecurringTemplateFromValues = (
    values: {
      amount: number;
      type: TransactionType;
      categoryId: string;
      accountId: string;
      toAccountId?: string;
      note: string;
      paymentMethod: PaymentMethod;
      currency: Currency;
      taxTag: TaxTag;
      isDeductible: boolean;
      frequency: RecurringFrequency;
      date: string;
    },
    templateId: string,
    createdAt: string
  ): RecurringTemplate => ({
    id: templateId,
    amount: values.amount,
    type: values.type,
    categoryId: values.categoryId,
    accountId: values.accountId,
    toAccountId: values.type === 'transfer' ? values.toAccountId || undefined : undefined,
    note: values.note.trim(),
    paymentMethod: values.paymentMethod,
    currency: values.currency,
    taxTag: values.taxTag,
    isDeductible: values.isDeductible,
    frequency: values.frequency,
    nextDate: advanceRecurringDate(values.date, values.frequency),
    isPaused: false,
    createdAt,
    updatedAt: new Date().toISOString(),
  });

  const applyParsedQuickAddToForm = (input: string, openModal = true) => {
    const parsed = parseNaturalLanguageTransaction({
      input,
      accounts,
      categories,
      defaultCurrency: settings.defaultCurrency,
    });

    const fallbackExpenseCategory = categories.find((category) => category.type === 'expense')?.id || '';
    const fallbackIncomeCategory = categories.find((category) => category.type === 'income')?.id || '';
    const fallbackAccountId = accounts[0]?.id || '';
    const fallbackToAccountId = accounts.find((account) => account.id !== (parsed.accountId || fallbackAccountId))?.id || '';

    setEditingTx(null);
    setTxForm({
      amount: parsed.amount ? parsed.amount.toString() : '',
      type: parsed.type,
      categoryId:
        parsed.type === 'transfer'
          ? fallbackExpenseCategory
          : parsed.categoryId || (parsed.type === 'income' ? fallbackIncomeCategory : fallbackExpenseCategory),
      accountId: parsed.accountId || fallbackAccountId,
      toAccountId: parsed.type === 'transfer' ? parsed.toAccountId || fallbackToAccountId : '',
      date: parsed.date,
      note: parsed.note,
      paymentMethod: parsed.paymentMethod,
      currency: parsed.currency,
      taxTag: parsed.taxTag,
      isDeductible: parsed.isDeductible,
      isRecurring: parsed.isRecurring,
      frequency: parsed.frequency,
    });

    if (openModal) {
      setTxModalOpen(true);
    }

    return parsed;
  };

  const handleQuickAdd = (mode: 'save' | 'review') => {
    if (!quickAddInput.trim()) {
      toast.error('Describe the transaction first');
      return;
    }

    const parsed = applyParsedQuickAddToForm(quickAddInput, mode === 'review');

    if (mode === 'review') {
      toast.success('Quick add parsed. Review the form and save.');
      return;
    }

    if (parsed.warnings.length > 0 || !parsed.amount || !parsed.accountId || (parsed.type === 'transfer' && !parsed.toAccountId)) {
      setTxModalOpen(true);
      toast.info(parsed.warnings[0] || 'Quick add parsed most of it. Review before saving.');
      return;
    }

    const fallbackExpenseCategory = categories.find((category) => category.type === 'expense')?.id || '';
    const fallbackIncomeCategory = categories.find((category) => category.type === 'income')?.id || '';
    const recurringTemplateId = parsed.isRecurring ? generateId() : undefined;
    const categoryId =
      parsed.type === 'transfer'
        ? fallbackExpenseCategory
        : parsed.categoryId || (parsed.type === 'income' ? fallbackIncomeCategory : fallbackExpenseCategory);

    addTransaction({
      id: generateId(),
      amount: parsed.amount,
      type: parsed.type,
      categoryId,
      accountId: parsed.accountId,
      toAccountId: parsed.type === 'transfer' ? parsed.toAccountId : undefined,
      date: parsed.date,
      note: parsed.note,
      paymentMethod: parsed.paymentMethod,
      currency: parsed.currency,
      taxTag: parsed.taxTag,
      isDeductible: parsed.isDeductible,
      isRecurring: parsed.isRecurring,
      recurringTemplateId,
    });

    if (parsed.isRecurring && recurringTemplateId) {
      addRecurringTemplate(
        buildRecurringTemplateFromValues(
          {
            amount: parsed.amount,
            type: parsed.type,
            categoryId,
            accountId: parsed.accountId,
            toAccountId: parsed.toAccountId,
            note: parsed.note,
            paymentMethod: parsed.paymentMethod,
            currency: parsed.currency,
            taxTag: parsed.taxTag,
            isDeductible: parsed.isDeductible,
            frequency: parsed.frequency,
            date: parsed.date,
          },
          recurringTemplateId,
          new Date().toISOString()
        )
      );
    }

    setQuickAddInput('');
    toast.success(parsed.isRecurring ? 'Recurring transaction added from quick add' : 'Transaction added from quick add');
  };

  const handleStatementImport = (importedTransactions: Transaction[]) => {
    if (importedTransactions.length === 0) {
      return;
    }

    importTransactions(importedTransactions);
  };

  const saveTx = () => {
    const amount = parseFloat(txForm.amount);
    if (!amount || amount <= 0 || !txForm.note.trim()) { toast.error('Please fill all required fields'); return; }
    if (!txForm.accountId) { toast.error('Select an account'); return; }
    if (txForm.type === 'transfer') {
      if (!txForm.toAccountId) { toast.error('Select a destination account'); return; }
      if (txForm.toAccountId === txForm.accountId) { toast.error('Transfer accounts must be different'); return; }
    }
    const existingTemplate = editingTx?.recurringTemplateId
      ? recurringTemplates.find((template) => template.id === editingTx.recurringTemplateId)
      : undefined;
    const recurringTemplateId = txForm.isRecurring ? (existingTemplate?.id || generateId()) : undefined;
    const transactionPayload = {
      amount,
      type: txForm.type,
      categoryId: txForm.categoryId,
      accountId: txForm.accountId,
      toAccountId: txForm.type === 'transfer' ? txForm.toAccountId : undefined,
      date: txForm.date,
      note: txForm.note.trim(),
      paymentMethod: txForm.paymentMethod,
      currency: txForm.currency,
      taxTag: txForm.taxTag,
      isDeductible: txForm.isDeductible,
      isRecurring: txForm.isRecurring,
      recurringTemplateId,
    };
    if (editingTx) {
      updateTransaction(editingTx.id, transactionPayload);
      if (!txForm.isRecurring && existingTemplate) {
        deleteRecurringTemplate(existingTemplate.id);
      } else if (txForm.isRecurring && recurringTemplateId) {
        const template = buildRecurringTemplate(recurringTemplateId, existingTemplate?.createdAt || new Date().toISOString());
        if (existingTemplate) {
          updateRecurringTemplate(recurringTemplateId, template);
        } else {
          addRecurringTemplate(template);
        }
      }
      toast.success('Transaction updated');
    } else {
      addTransaction({ id: generateId(), ...transactionPayload });
      if (txForm.isRecurring && recurringTemplateId) {
        addRecurringTemplate(buildRecurringTemplate(recurringTemplateId, new Date().toISOString()));
      }
      toast.success('Transaction added');
    }
    setTxModalOpen(false);
  };

  // Account modal handlers
  const openAddAcc = () => {
    setEditingAcc(null);
    setAccForm({ name: '', type: 'bank', balance: '', currency: settings.defaultCurrency, bankName: '', accountNumber: '', ifscCode: '', branchName: '', nominees: '', loginUrl: '', notes: '' });
    setAccModalOpen(true);
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });

    if (action === 'add-transaction') {
      openAddTx();
      return;
    }

    if (action === 'quick-add') {
      setQuickAddInput('');
      return;
    }

    if (action === 'add-account') {
      openAddAcc();
    }
  }, [openAddTx, openAddAcc, searchParams, setSearchParams]);

  const openEditAcc = (acc: Account) => {
    setEditingAcc(acc);
    setAccForm({
      name: acc.name, type: acc.type, balance: acc.balance.toString(), currency: acc.currency,
      bankName: acc.bankName || '', accountNumber: acc.accountNumber || '', ifscCode: acc.ifscCode || '',
      branchName: acc.branchName || '', nominees: (acc.nominees || []).join(', '), loginUrl: acc.loginUrl || '', notes: acc.notes || '',
    });
    setAccModalOpen(true);
  };
  const saveAcc = () => {
    if (!accForm.name.trim()) { toast.error('Account name is required'); return; }
    const balance = parseFloat(accForm.balance) || 0;
    const nominees = accForm.nominees ? accForm.nominees.split(',').map(n => n.trim()).filter(Boolean) : [];
    const color = `hsl(${Math.floor(Math.random() * 360)} 60% 50%)`;
    if (editingAcc) {
      updateAccount(editingAcc.id, { ...accForm, balance, nominees, color: editingAcc.color, icon: editingAcc.icon, isActive: true });
      toast.success('Account updated');
    } else {
      addAccount({ id: generateId(), ...accForm, balance, nominees, color, icon: 'wallet', createdAt: new Date().toISOString().split('T')[0], isActive: true });
      toast.success('Account added');
    }
    setAccModalOpen(false);
  };

  const openAddBudget = () => {
    setEditingBudget(null);
    setBudgetForm({
      categoryId: budgets[0]?.categoryId || expenseCats[0]?.id || '',
      amount: '',
      currency: settings.defaultCurrency,
      alertThreshold: '80',
    });
    setBudgetModalOpen(true);
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetForm({
      categoryId: budget.categoryId,
      amount: budget.amount.toString(),
      currency: budget.currency,
      alertThreshold: budget.alertThreshold.toString(),
    });
    setBudgetModalOpen(true);
  };

  const saveBudget = () => {
    const amount = parseFloat(budgetForm.amount);
    const alertThreshold = parseFloat(budgetForm.alertThreshold);

    if (!budgetForm.categoryId) { toast.error('Select a category'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid budget amount'); return; }
    if (!Number.isFinite(alertThreshold) || alertThreshold <= 0 || alertThreshold > 100) { toast.error('Alert threshold must be between 1 and 100'); return; }

    const duplicateBudget = budgets.find((budget) => budget.categoryId === budgetForm.categoryId && budget.id !== editingBudget?.id);
    if (duplicateBudget) { toast.error('A budget already exists for that category'); return; }

    if (editingBudget) {
      updateBudget(editingBudget.id, {
        categoryId: budgetForm.categoryId,
        amount,
        currency: budgetForm.currency,
        alertThreshold,
      });
      toast.success('Budget updated');
    } else {
      addBudget({
        id: generateId(),
        categoryId: budgetForm.categoryId,
        amount,
        currency: budgetForm.currency,
        spent: 0,
        alertThreshold,
        period: 'monthly',
      });
      toast.success('Budget added');
    }

    setBudgetModalOpen(false);
  };

  const openAddRecurring = () => {
    const defaultExpenseCategory = categories.find((category) => category.type === 'expense');
    setEditingRecurring(null);
    setRecurringForm({
      amount: '',
      type: 'expense',
      categoryId: defaultExpenseCategory?.id || '',
      accountId: accounts[0]?.id || '',
      toAccountId: accounts.find((account) => account.id !== accounts[0]?.id)?.id || '',
      nextDate: new Date().toISOString().split('T')[0],
      note: '',
      paymentMethod: 'card',
      currency: settings.defaultCurrency,
      taxTag: 'untagged',
      isDeductible: false,
      frequency: 'monthly',
      isPaused: false,
    });
    setRecurringModalOpen(true);
  };

  const openEditRecurring = (template: RecurringTemplate) => {
    setEditingRecurring(template);
    setRecurringForm({
      amount: template.amount.toString(),
      type: template.type,
      categoryId: template.categoryId,
      accountId: template.accountId,
      toAccountId: template.toAccountId || '',
      nextDate: template.nextDate,
      note: template.note,
      paymentMethod: template.paymentMethod,
      currency: template.currency,
      taxTag: template.taxTag,
      isDeductible: template.isDeductible,
      frequency: template.frequency,
      isPaused: template.isPaused,
    });
    setRecurringModalOpen(true);
  };

  const saveRecurring = () => {
    const amount = parseFloat(recurringForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid recurring amount'); return; }
    if (!recurringForm.note.trim()) { toast.error('Recurring note is required'); return; }
    if (!recurringForm.accountId) { toast.error('Select an account'); return; }
    if (recurringForm.type !== 'transfer' && !recurringForm.categoryId) { toast.error('Select a category'); return; }
    if (recurringForm.type === 'transfer') {
      if (!recurringForm.toAccountId) { toast.error('Select a destination account'); return; }
      if (recurringForm.toAccountId === recurringForm.accountId) { toast.error('Transfer accounts must be different'); return; }
    }

    const payload: RecurringTemplate = {
      id: editingRecurring?.id || generateId(),
      amount,
      type: recurringForm.type,
      categoryId:
        recurringForm.type === 'transfer'
          ? recurringForm.categoryId || categories.find((category) => category.type === 'expense')?.id || ''
          : recurringForm.categoryId,
      accountId: recurringForm.accountId,
      toAccountId: recurringForm.type === 'transfer' ? recurringForm.toAccountId || undefined : undefined,
      note: recurringForm.note.trim(),
      paymentMethod: recurringForm.paymentMethod,
      currency: recurringForm.currency,
      taxTag: recurringForm.taxTag,
      isDeductible: recurringForm.isDeductible,
      frequency: recurringForm.frequency,
      nextDate: recurringForm.nextDate,
      isPaused: recurringForm.isPaused,
      createdAt: editingRecurring?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingRecurring) {
      updateRecurringTemplate(editingRecurring.id, payload);
      toast.success('Recurring template updated');
    } else {
      addRecurringTemplate(payload);
      toast.success('Recurring template added');
    }

    setRecurringModalOpen(false);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      type: 'expense',
      color: '#2563eb',
      icon: 'tag',
      parentId: '',
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      parentId: category.parentId || '',
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = () => {
    const normalizedName = categoryForm.name.trim();
    if (!normalizedName) { toast.error('Category name is required'); return; }

    const duplicateCategory = categories.find(
      (category) =>
        category.id !== editingCategory?.id &&
        category.type === categoryForm.type &&
        category.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicateCategory) { toast.error('A category with that name already exists'); return; }

    const payload = {
      name: normalizedName,
      type: categoryForm.type,
      color: categoryForm.color,
      icon: categoryForm.icon.trim() || 'tag',
      parentId: categoryForm.parentId || undefined,
    };

    if (editingCategory) {
      updateCategory(editingCategory.id, payload);
      toast.success('Category updated');
    } else {
      addCategory({
        id: generateId(),
        ...payload,
      });
      toast.success('Category added');
    }

    setCategoryModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'tx') { deleteTransaction(deleteTarget.id); toast.success('Transaction deleted'); }
    if (deleteTarget.type === 'acc') { deleteAccount(deleteTarget.id); toast.success('Account deleted'); }
    if (deleteTarget.type === 'bud') { deleteBudget(deleteTarget.id); toast.success('Budget deleted'); }
    if (deleteTarget.type === 'recurring') { deleteRecurringTemplate(deleteTarget.id); toast.success('Recurring template deleted'); }
    if (deleteTarget.type === 'category') {
      const hasTransactions = transactions.some((transaction) => transaction.categoryId === deleteTarget.id);
      const hasBudgets = budgets.some((budget) => budget.categoryId === deleteTarget.id);
      const hasRecurringTemplates = recurringTemplates.some((template) => template.categoryId === deleteTarget.id);
      const hasChildren = categories.some((category) => category.parentId === deleteTarget.id);

      if (hasTransactions || hasBudgets || hasRecurringTemplates || hasChildren) {
        toast.error('This category is still being used. Reassign related items before deleting it.');
      } else {
        deleteCategory(deleteTarget.id);
        toast.success('Category deleted');
      }
    }
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const toggleShowNumber = (accId: string) => {
    setShowAccountNumbers(prev => ({ ...prev, [accId]: !prev[accId] }));
  };

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const filteredCategories = txForm.type === 'income' ? incomeCats : expenseCats;
  const recurringCategories = recurringForm.type === 'income' ? incomeCats : expenseCats;
  const groupedCategories = {
    expense: categories.filter((category) => category.type === 'expense'),
    income: categories.filter((category) => category.type === 'income'),
  };
  const categoryParents = categories.filter(
    (category) => category.type === categoryForm.type && category.id !== editingCategory?.id
  );

  // Group transactions by date
  const groupedTx = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTx.forEach(tx => {
      const dateLabel = getDateLabel(tx.date);
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(tx);
    });
    return groups;
  }, [filteredTx]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Tracker</h1>
          <p className="text-sm text-muted-foreground">Transactions, accounts, budgets, recurring schedules and categories</p>
        </div>
        <div className="flex gap-2">
          <StatementImportDialog
            accounts={accounts}
            categories={categories}
            defaultCurrency={settings.defaultCurrency}
            onImport={handleStatementImport}
          />
          <Button variant="outline" className="gap-2" onClick={() => handleQuickAdd('review')}>
            <Sparkles className="h-4 w-4" /> Quick Add
          </Button>
          <Button className="gap-2" onClick={openAddTx}><Plus className="h-4 w-4" /> Add Transaction</Button>
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="recurring">Recurring ({recurringTemplates.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>

        {/* ========== TRANSACTIONS ========== */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          <Card className="border-dashed">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Natural-Language Quick Add
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try: "spent 45 on groceries from Chase yesterday", "salary 7500 to checking", or "monthly Netflix 18 from Amex".
                  </p>
                  <Input
                    className="mt-3"
                    placeholder="Describe a transaction in plain English..."
                    value={quickAddInput}
                    onChange={(event) => setQuickAddInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleQuickAdd('save');
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleQuickAdd('review')}>Review</Button>
                  <Button className="gap-2" onClick={() => handleQuickAdd('save')}>
                    <Sparkles className="h-4 w-4" /> Add Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant={showFilters ? 'default' : 'outline'} size="icon" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account</Label>
                    <Select value={filterAccount} onValueChange={setFilterAccount}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" className="h-8 text-xs" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" className="h-8 text-xs" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground">{filteredTx.length} of {transactions.length} transactions</div>

          <Card>
            <CardContent className="p-0">
              {Object.entries(groupedTx).map(([dateLabel, txs]) => (
                <div key={dateLabel}>
                  <div className="px-4 py-2 bg-secondary/30 text-xs font-medium text-muted-foreground sticky top-0">{dateLabel}</div>
                  <div className="divide-y">
                    {txs.map((tx) => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      const acc = accounts.find(a => a.id === tx.accountId);
                      const destinationAccount = tx.toAccountId ? accounts.find(a => a.id === tx.toAccountId) : null;
                      const isIncome = tx.type === 'income';
                      const isTransfer = tx.type === 'transfer';
                      const linkedDocCount = transactionDocumentCounts[tx.id] || 0;
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? 'bg-profit-muted' : 'bg-secondary'}`}>
                              {isTransfer ? <ArrowUpRight className="h-4 w-4 rotate-45 text-muted-foreground" /> : isIncome ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{tx.note}</p>
                              {isTransfer ? (
                                <p className="text-xs text-muted-foreground">
                                  {`Transfer ${acc?.name ?? 'Unknown'} -> ${destinationAccount?.name ?? 'Unknown'}`}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                {cat?.name} / {acc?.name} / {tx.paymentMethod} / {tx.currency}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-profit' : ''}`}>
                                {isTransfer ? formatCurrency(tx.amount, tx.currency) : `${isIncome ? '+' : '-'}${formatCurrency(tx.amount, tx.currency)}`}
                              </span>
                              <div className="flex gap-1 mt-0.5 justify-end">
                                {tx.isRecurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                                {tx.taxTag !== 'untagged' && <Badge variant="outline" className="text-[10px] capitalize">{tx.taxTag}</Badge>}
                                {tx.isDeductible && <Badge variant="outline" className="text-[10px] text-profit border-profit/30">Deductible</Badge>}
                                {linkedDocCount > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {linkedDocCount} doc{linkedDocCount === 1 ? '' : 's'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="hidden group-hover:flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTx(tx)}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={() => { setDeleteTarget({ type: 'tx', id: tx.id }); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredTx.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No transactions found</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={openAddTx}>Add your first transaction</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ACCOUNTS ========== */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={openAddAcc}><Plus className="h-4 w-4" /> Add Account</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => {
              const accTxCount = transactions.filter(t => t.accountId === acc.id || t.toAccountId === acc.id).length;
              const accDocCount = accountDocumentCounts[acc.id] || 0;
              const showNum = showAccountNumbers[acc.id];
              return (
                <Card key={acc.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setSelectedAccount(acc); setAccDetailOpen(true); }}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground" style={{ backgroundColor: `${acc.color}20` }}>
                          {ACCOUNT_TYPE_ICONS[acc.type] || <Wallet className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className="text-sm font-medium">{acc.name}</span>
                          {acc.bankName && <p className="text-xs text-muted-foreground">{acc.bankName}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] capitalize">{acc.type.replace('_', ' ')}</Badge>
                        <div className="hidden group-hover:flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditAcc(acc); }}><Edit2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                    <p className={`text-xl font-bold font-mono ${acc.balance < 0 ? 'text-loss' : ''}`}>
                      {formatCurrency(acc.balance, acc.currency)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{acc.currency}</Badge>
                        {acc.accountNumber && (
                          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={(e) => { e.stopPropagation(); toggleShowNumber(acc.id); }}>
                            {showNum ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            <span className="font-mono">{showNum ? acc.accountNumber : '••••'}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{accTxCount} txns</span>
                        {accDocCount > 0 && <span>{accDocCount} docs</span>}
                      </div>
                    </div>
                    {acc.nominees && acc.nominees.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{acc.nominees.join(', ')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center min-h-[160px]" onClick={openAddAcc}>
              <div className="text-center text-muted-foreground">
                <Plus className="h-6 w-6 mx-auto mb-1" />
                <span className="text-sm">Add Account</span>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ========== BUDGETS ========== */}
        <TabsContent value="budgets" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={openAddBudget}><Plus className="h-4 w-4" /> Add Budget</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map(b => {
              const cat = categories.find(c => c.id === b.categoryId);
              const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
              const remaining = b.amount - b.spent;
              return (
                <Card key={b.id} className="group">
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium">{cat?.name}</span>
                        <p className="text-xs text-muted-foreground mt-1">Alert at {b.alertThreshold}%</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pct >= 90 ? 'destructive' : 'secondary'} className="text-xs">{pct.toFixed(0)}%</Badge>
                        <div className="hidden group-hover:flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBudget(b)}><Edit2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={() => { setDeleteTarget({ type: 'bud', id: b.id }); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-loss' : pct >= 70 ? 'bg-warning' : 'bg-profit'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(b.spent, b.currency)} spent</span>
                      <span>{formatCurrency(remaining, b.currency)} left</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-mono font-medium">{formatCurrency(b.amount, b.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {budgets.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="min-h-[180px] flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <p className="text-sm">No budgets configured yet</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openAddBudget}>Create your first budget</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recurring" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Active templates</p>
                <p className="mt-2 text-2xl font-bold">{recurringTemplates.filter((template) => !template.isPaused).length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Templates that can create the next scheduled entry.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Paused templates</p>
                <p className="mt-2 text-2xl font-bold">{recurringTemplates.filter((template) => template.isPaused).length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Paused templates stay visible and can be resumed anytime.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex h-full items-center justify-between gap-4 pt-5">
                <div>
                  <p className="text-sm font-medium">Manage recurring transactions</p>
                  <p className="mt-1 text-xs text-muted-foreground">Create, edit, pause, resume, or delete your schedules.</p>
                </div>
                <Button className="gap-2" onClick={openAddRecurring}>
                  <Plus className="h-4 w-4" /> Add recurring
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            {recurringTemplates.map((template) => {
              const account = accounts.find((item) => item.id === template.accountId);
              const toAccount = template.toAccountId ? accounts.find((item) => item.id === template.toAccountId) : null;
              const category = categories.find((item) => item.id === template.categoryId);

              return (
                <Card key={template.id} className="group">
                  <CardContent className="pt-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{template.note}</p>
                          <Badge variant={template.isPaused ? 'outline' : 'secondary'}>
                            {template.isPaused ? 'Paused' : 'Active'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{template.frequency}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{template.type === 'transfer' ? `Transfer to ${toAccount?.name ?? 'Unknown account'}` : category?.name || 'Uncategorized'}</span>
                          <span>{account?.name || 'Unknown account'}</span>
                          <span>Next on {template.nextDate}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{template.paymentMethod}</span>
                          <span>{template.taxTag}</span>
                          {template.isDeductible && <span>Deductible</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        <p className="font-mono text-lg font-semibold">{formatCurrency(template.amount, template.currency)}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateRecurringTemplate(template.id, {
                                isPaused: !template.isPaused,
                                updatedAt: new Date().toISOString(),
                              })
                            }
                          >
                            {template.isPaused ? 'Resume' : 'Pause'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditRecurring(template)}>
                            <Edit2 className="mr-1 h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-loss"
                            onClick={() => {
                              setDeleteTarget({ type: 'recurring', id: template.id });
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {recurringTemplates.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex min-h-[200px] items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-medium">No recurring schedules yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Set one up to automate salary, rent, subscriptions, or transfers.</p>
                    <Button variant="outline" className="mt-4" onClick={openAddRecurring}>
                      Create your first schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={openAddCategory}>
              <Plus className="h-4 w-4" /> Add Category
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(['expense', 'income'] as Array<Category['type']>).map((type) => (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tags className="h-4 w-4" />
                    {type === 'expense' ? 'Expense Categories' : 'Income Categories'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedCategories[type].map((category) => {
                    const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
                    const usageCount =
                      transactions.filter((transaction) => transaction.categoryId === category.id).length +
                      budgets.filter((budget) => budget.categoryId === category.id).length +
                      recurringTemplates.filter((template) => template.categoryId === category.id).length;

                    return (
                      <div key={category.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 h-3 w-3 rounded-full border"
                            style={{ backgroundColor: category.color }}
                          />
                          <div>
                            <p className="text-sm font-medium">{category.name}</p>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>Icon: {category.icon}</span>
                              {parent && <span>Parent: {parent.name}</span>}
                              <span>{usageCount} linked items</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(category)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-loss"
                            onClick={() => {
                              setDeleteTarget({ type: 'category', id: category.id });
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {groupedCategories[type].length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No {type} categories yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== ADD/EDIT TRANSACTION MODAL ========== */}
      <Dialog open={txModalOpen} onOpenChange={setTxModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
            <DialogDescription>Fill in the transaction details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
                <Button key={t} variant={txForm.type === t ? 'default' : 'outline'} size="sm" className="capitalize"
                  onClick={() => {
                    setTxForm(f => ({
                      ...f, type: t,
                      categoryId: categories.find(c => c.type === (t === 'income' ? 'income' : 'expense'))?.id || f.categoryId,
                      toAccountId: t === 'transfer' ? (f.toAccountId || accounts.find(a => a.id !== f.accountId)?.id || '') : '',
                    }));
                  }}>{t}</Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={txForm.currency} onValueChange={v => setTxForm(f => ({ ...f, currency: v as Currency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(CURRENCY_CONFIG) as Currency[]).map(c => <SelectItem key={c} value={c}>{CURRENCY_CONFIG[c].symbol} {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Note / Description *</Label>
              <Input placeholder="What was this for?" value={txForm.note} onChange={e => setTxForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{txForm.type === 'transfer' ? 'From Account' : 'Category'}</Label>
                {txForm.type === 'transfer' ? (
                  <Select value={txForm.accountId} onValueChange={v => setTxForm(f => ({
                    ...f,
                    accountId: v,
                    toAccountId: f.toAccountId === v ? accounts.find(a => a.id !== v)?.id || '' : f.toAccountId,
                  }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={txForm.categoryId} onValueChange={v => setTxForm(f => ({ ...f, categoryId: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs">{txForm.type === 'transfer' ? 'To Account' : 'Account'}</Label>
                <Select value={txForm.type === 'transfer' ? txForm.toAccountId : txForm.accountId} onValueChange={v => setTxForm(f => ({
                  ...f,
                  [txForm.type === 'transfer' ? 'toAccountId' : 'accountId']: v,
                }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(txForm.type === 'transfer' ? accounts.filter(a => a.id !== txForm.accountId) : accounts).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={txForm.paymentMethod} onValueChange={v => setTxForm(f => ({ ...f, paymentMethod: v as PaymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="netbanking">Netbanking</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tax Tag</Label>
                <Select value={txForm.taxTag} onValueChange={v => setTxForm(f => ({ ...f, taxTag: v as TaxTag }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="untagged">Untagged</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={txForm.isDeductible} onCheckedChange={(c) => setTxForm(f => ({ ...f, isDeductible: !!c }))} />
                  Deductible
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={txForm.isRecurring} onCheckedChange={(c) => setTxForm(f => ({ ...f, isRecurring: !!c }))} />
                  Recurring
                </label>
              </div>
            </div>
            {txForm.isRecurring && (
              <div>
                <Label className="text-xs">Recurring Frequency</Label>
                <Select value={txForm.frequency} onValueChange={v => setTxForm(f => ({ ...f, frequency: v as RecurringFrequency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  The next scheduled entry will be created for {advanceRecurringDate(txForm.date, txForm.frequency)}.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxModalOpen(false)}>Cancel</Button>
            <Button onClick={saveTx}>{editingTx ? 'Update' : 'Add'} Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ADD/EDIT ACCOUNT MODAL ========== */}
      <Dialog open={accModalOpen} onOpenChange={setAccModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAcc ? 'Edit Account' : 'Add Account'}</DialogTitle>
            <DialogDescription>Configure your account details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Account Name *</Label>
                <Input placeholder="e.g. HDFC Savings" value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={accForm.type} onValueChange={v => setAccForm(f => ({ ...f, type: v as AccountType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Opening Balance</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={accForm.balance} onChange={e => setAccForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={accForm.currency} onValueChange={v => setAccForm(f => ({ ...f, currency: v as Currency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(CURRENCY_CONFIG) as Currency[]).map(c => <SelectItem key={c} value={c}>{CURRENCY_CONFIG[c].symbol} {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Bank / Institution Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bank / Institution Name</Label>
                <Input placeholder="e.g. Chase Bank" value={accForm.bankName} onChange={e => setAccForm(f => ({ ...f, bankName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Account Number (masked)</Label>
                <Input placeholder="e.g. ****1234" value={accForm.accountNumber} onChange={e => setAccForm(f => ({ ...f, accountNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">IFSC / SWIFT Code</Label>
                <Input placeholder="e.g. CHASUS33" value={accForm.ifscCode} onChange={e => setAccForm(f => ({ ...f, ifscCode: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Branch</Label>
                <Input placeholder="e.g. Downtown Manhattan" value={accForm.branchName} onChange={e => setAccForm(f => ({ ...f, branchName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nominees (comma-separated)</Label>
              <Input placeholder="e.g. Jane Doe, John Doe" value={accForm.nominees} onChange={e => setAccForm(f => ({ ...f, nominees: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Login URL</Label>
              <Input placeholder="https://bank.com/login" value={accForm.loginUrl} onChange={e => setAccForm(f => ({ ...f, loginUrl: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Any additional notes..." value={accForm.notes} onChange={e => setAccForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccModalOpen(false)}>Cancel</Button>
            <Button onClick={saveAcc}>{editingAcc ? 'Update' : 'Add'} Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ACCOUNT DETAIL SHEET ========== */}
      <Dialog open={accDetailOpen} onOpenChange={setAccDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAccount && ACCOUNT_TYPE_ICONS[selectedAccount.type]}
              {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>{selectedAccount?.bankName || selectedAccount?.type.replace('_', ' ')}</DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className={`text-3xl font-bold font-mono ${selectedAccount.balance < 0 ? 'text-loss' : ''}`}>
                  {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                </p>
                <Badge variant="outline" className="mt-1">{selectedAccount.currency}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedAccount.bankName && (
                  <div><span className="text-xs text-muted-foreground">Bank</span><p>{selectedAccount.bankName}</p></div>
                )}
                {selectedAccount.accountNumber && (
                  <div><span className="text-xs text-muted-foreground">Account #</span><p className="font-mono">{selectedAccount.accountNumber}</p></div>
                )}
                {selectedAccount.ifscCode && (
                  <div><span className="text-xs text-muted-foreground">IFSC/SWIFT</span><p className="font-mono">{selectedAccount.ifscCode}</p></div>
                )}
                {selectedAccount.branchName && (
                  <div><span className="text-xs text-muted-foreground">Branch</span><p>{selectedAccount.branchName}</p></div>
                )}
                <div><span className="text-xs text-muted-foreground">Type</span><p className="capitalize">{selectedAccount.type.replace('_', ' ')}</p></div>
                <div><span className="text-xs text-muted-foreground">Since</span><p>{selectedAccount.createdAt}</p></div>
                {selectedAccount.nominees && selectedAccount.nominees.length > 0 && (
                  <div className="col-span-2"><span className="text-xs text-muted-foreground">Nominees</span><p>{selectedAccount.nominees.join(', ')}</p></div>
                )}
                {selectedAccount.notes && (
                  <div className="col-span-2"><span className="text-xs text-muted-foreground">Notes</span><p>{selectedAccount.notes}</p></div>
                )}
              </div>
              {selectedAccountDocuments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Linked Documents
                    </div>
                    <div className="space-y-2">
                      {selectedAccountDocuments.map((document) => (
                        <LinkedDocumentRow key={document.id} document={document} />
                      ))}
                    </div>
                  </div>
                </>
              )}
              {selectedAccount.loginUrl && (
                <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => window.open(selectedAccount.loginUrl, '_blank')}>
                  <ExternalLink className="h-3 w-3" /> Open Bank Login
                </Button>
              )}
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setAccDetailOpen(false); openEditAcc(selectedAccount); }}>
                  <Edit2 className="h-3 w-3" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="gap-1" onClick={() => { setAccDetailOpen(false); setDeleteTarget({ type: 'acc', id: selectedAccount.id }); setDeleteConfirmOpen(true); }}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
            <DialogDescription>Set a monthly spending target for one category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={budgetForm.categoryId} onValueChange={value => setBudgetForm(form => ({ ...form, categoryId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {expenseCats.map(category => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" value={budgetForm.amount} onChange={event => setBudgetForm(form => ({ ...form, amount: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={budgetForm.currency} onValueChange={value => setBudgetForm(form => ({ ...form, currency: value as Currency }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CURRENCY_CONFIG) as Currency[]).map(currency => (
                      <SelectItem key={currency} value={currency}>{CURRENCY_CONFIG[currency].symbol} {currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Alert Threshold (%)</Label>
              <Input type="number" min="1" max="100" step="1" value={budgetForm.alertThreshold} onChange={event => setBudgetForm(form => ({ ...form, alertThreshold: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetModalOpen(false)}>Cancel</Button>
            <Button onClick={saveBudget}>{editingBudget ? 'Update' : 'Add'} Budget</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringModalOpen} onOpenChange={setRecurringModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecurring ? 'Edit recurring template' : 'Add recurring template'}</DialogTitle>
            <DialogDescription>Manage the schedule that creates future transactions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(['expense', 'income', 'transfer'] as TransactionType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={recurringForm.type === type ? 'default' : 'outline'}
                  className="capitalize"
                  onClick={() =>
                    setRecurringForm((form) => ({
                      ...form,
                      type,
                      categoryId:
                        type === 'transfer'
                          ? form.categoryId || expenseCats[0]?.id || ''
                          : categories.find((category) => category.type === (type === 'income' ? 'income' : 'expense'))?.id || '',
                      toAccountId:
                        type === 'transfer'
                          ? form.toAccountId || accounts.find((account) => account.id !== form.accountId)?.id || ''
                          : '',
                    }))
                  }
                >
                  {type}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={recurringForm.amount}
                  onChange={(event) => setRecurringForm((form) => ({ ...form, amount: event.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select
                  value={recurringForm.currency}
                  onValueChange={(value) => setRecurringForm((form) => ({ ...form, currency: value as Currency }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CURRENCY_CONFIG) as Currency[]).map((currency) => (
                      <SelectItem key={currency} value={currency}>{CURRENCY_CONFIG[currency].symbol} {currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Note *</Label>
              <Input
                value={recurringForm.note}
                onChange={(event) => setRecurringForm((form) => ({ ...form, note: event.target.value }))}
                placeholder="Monthly rent, salary, SIP, subscription..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{recurringForm.type === 'transfer' ? 'From Account' : 'Category'}</Label>
                {recurringForm.type === 'transfer' ? (
                  <Select
                    value={recurringForm.accountId}
                    onValueChange={(value) =>
                      setRecurringForm((form) => ({
                        ...form,
                        accountId: value,
                        toAccountId: form.toAccountId === value ? accounts.find((account) => account.id !== value)?.id || '' : form.toAccountId,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={recurringForm.categoryId}
                    onValueChange={(value) => setRecurringForm((form) => ({ ...form, categoryId: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {recurringCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs">{recurringForm.type === 'transfer' ? 'To Account' : 'Account'}</Label>
                <Select
                  value={recurringForm.type === 'transfer' ? recurringForm.toAccountId : recurringForm.accountId}
                  onValueChange={(value) =>
                    setRecurringForm((form) => ({
                      ...form,
                      [recurringForm.type === 'transfer' ? 'toAccountId' : 'accountId']: value,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(recurringForm.type === 'transfer'
                      ? accounts.filter((account) => account.id !== recurringForm.accountId)
                      : accounts
                    ).map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First / next date</Label>
                <Input
                  type="date"
                  value={recurringForm.nextDate}
                  onChange={(event) => setRecurringForm((form) => ({ ...form, nextDate: event.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Frequency</Label>
                <Select
                  value={recurringForm.frequency}
                  onValueChange={(value) => setRecurringForm((form) => ({ ...form, frequency: value as RecurringFrequency }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={recurringForm.paymentMethod}
                  onValueChange={(value) => setRecurringForm((form) => ({ ...form, paymentMethod: value as PaymentMethod }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="netbanking">Netbanking</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tax Tag</Label>
                <Select
                  value={recurringForm.taxTag}
                  onValueChange={(value) => setRecurringForm((form) => ({ ...form, taxTag: value as TaxTag }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="untagged">Untagged</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={recurringForm.isDeductible}
                  onCheckedChange={(checked) => setRecurringForm((form) => ({ ...form, isDeductible: !!checked }))}
                />
                Deductible
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={recurringForm.isPaused}
                  onCheckedChange={(checked) => setRecurringForm((form) => ({ ...form, isPaused: !!checked }))}
                />
                Start paused
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringModalOpen(false)}>Cancel</Button>
            <Button onClick={saveRecurring}>{editingRecurring ? 'Update' : 'Add'} recurring template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit category' : 'Add category'}</DialogTitle>
            <DialogDescription>Create custom income and expense categories for transactions and budgets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="Groceries, Bonus, Brokerage..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={categoryForm.type}
                  onValueChange={(value) =>
                    setCategoryForm((form) => ({
                      ...form,
                      type: value as Category['type'],
                      parentId: '',
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Parent category</Label>
                <Select
                  value={categoryForm.parentId || 'none'}
                  onValueChange={(value) => setCategoryForm((form) => ({ ...form, parentId: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categoryParents.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Color</Label>
                <Input
                  type="color"
                  value={categoryForm.color}
                  onChange={(event) => setCategoryForm((form) => ({ ...form, color: event.target.value }))}
                  className="h-10 p-1"
                />
              </div>
              <div>
                <Label className="text-xs">Icon label</Label>
                <Input
                  value={categoryForm.icon}
                  onChange={(event) => setCategoryForm((form) => ({ ...form, icon: event.target.value }))}
                  placeholder="tag"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory}>{editingCategory ? 'Update' : 'Add'} category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DELETE CONFIRMATION ========== */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>This action cannot be undone. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function LinkedDocumentRow({ document }: { document: VaultDocument }) {
  return (
    <div className="rounded-lg border bg-secondary/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{document.name}</p>
          <p className="text-xs text-muted-foreground">
            {document.fileType.toUpperCase()} · {document.category}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {document.updatedAt.slice(0, 10)}
        </Badge>
      </div>
    </div>
  );
}
