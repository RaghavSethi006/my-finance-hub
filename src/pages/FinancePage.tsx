import { useFinOS } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Search, Filter, X, Trash2, Edit2, Eye, EyeOff, Building2, CreditCard, TrendingUp, Bitcoin, Copy, ExternalLink, Users, Calendar, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useMemo } from "react";
import { CURRENCY_CONFIG, Currency, TransactionType, PaymentMethod, TaxTag, AccountType, Account, Transaction, Budget } from "@/lib/types";
import { toast } from "sonner";

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

export default function FinancePage() {
  const {
    transactions,
    accounts,
    categories,
    budgets,
    settings,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    addBudget,
    updateBudget,
    deleteBudget,
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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'tx' | 'acc' | 'bud'; id: string } | null>(null);
  const [showAccountNumbers, setShowAccountNumbers] = useState<Record<string, boolean>>({});

  // Transaction form state
  const [txForm, setTxForm] = useState({
    amount: '', type: 'expense' as TransactionType, categoryId: '', accountId: '',
    date: new Date().toISOString().split('T')[0], note: '', paymentMethod: 'card' as PaymentMethod,
    currency: settings.defaultCurrency as Currency, taxTag: 'untagged' as TaxTag, isDeductible: false, isRecurring: false,
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

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let txs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (search) txs = txs.filter(t => t.note.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== 'all') txs = txs.filter(t => t.type === filterType);
    if (filterCategory !== 'all') txs = txs.filter(t => t.categoryId === filterCategory);
    if (filterAccount !== 'all') txs = txs.filter(t => t.accountId === filterAccount);
    if (filterDateFrom) txs = txs.filter(t => t.date >= filterDateFrom);
    if (filterDateTo) txs = txs.filter(t => t.date <= filterDateTo);
    return txs;
  }, [transactions, search, filterType, filterCategory, filterAccount, filterDateFrom, filterDateTo]);

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
      accountId: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0], note: '',
      paymentMethod: 'card', currency: settings.defaultCurrency, taxTag: 'untagged', isDeductible: false, isRecurring: false,
    });
    setTxModalOpen(true);
  };
  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      amount: tx.amount.toString(), type: tx.type, categoryId: tx.categoryId, accountId: tx.accountId,
      date: tx.date, note: tx.note, paymentMethod: tx.paymentMethod, currency: tx.currency,
      taxTag: tx.taxTag, isDeductible: tx.isDeductible, isRecurring: tx.isRecurring,
    });
    setTxModalOpen(true);
  };
  const saveTx = () => {
    const amount = parseFloat(txForm.amount);
    if (!amount || amount <= 0 || !txForm.note.trim()) { toast.error('Please fill all required fields'); return; }
    if (editingTx) {
      updateTransaction(editingTx.id, { ...txForm, amount });
      toast.success('Transaction updated');
    } else {
      addTransaction({ id: generateId(), ...txForm, amount });
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

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'tx') { deleteTransaction(deleteTarget.id); toast.success('Transaction deleted'); }
    if (deleteTarget.type === 'acc') { deleteAccount(deleteTarget.id); toast.success('Account deleted'); }
    if (deleteTarget.type === 'bud') { deleteBudget(deleteTarget.id); toast.success('Budget deleted'); }
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const toggleShowNumber = (accId: string) => {
    setShowAccountNumbers(prev => ({ ...prev, [accId]: !prev[accId] }));
  };

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const filteredCategories = txForm.type === 'income' ? incomeCats : expenseCats;

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
          <p className="text-sm text-muted-foreground">Transactions, accounts & budgets</p>
        </div>
        <Button className="gap-2" onClick={openAddTx}><Plus className="h-4 w-4" /> Add Transaction</Button>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
        </TabsList>

        {/* ========== TRANSACTIONS ========== */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
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
                      const isIncome = tx.type === 'income';
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? 'bg-profit-muted' : 'bg-secondary'}`}>
                              {isIncome ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{tx.note}</p>
                              <p className="text-xs text-muted-foreground">
                                {cat?.name} · {acc?.name} · {tx.paymentMethod} · {tx.currency}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-profit' : ''}`}>
                                {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                              </span>
                              <div className="flex gap-1 mt-0.5 justify-end">
                                {tx.isRecurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                                {tx.taxTag !== 'untagged' && <Badge variant="outline" className="text-[10px] capitalize">{tx.taxTag}</Badge>}
                                {tx.isDeductible && <Badge variant="outline" className="text-[10px] text-profit border-profit/30">Deductible</Badge>}
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
              const accTxCount = transactions.filter(t => t.accountId === acc.id).length;
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
                      <span className="text-xs text-muted-foreground">{accTxCount} txns</span>
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
                      categoryId: categories.find(c => c.type === (t === 'income' ? 'income' : 'expense'))?.id || f.categoryId
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
                <Label className="text-xs">Category</Label>
                <Select value={txForm.categoryId} onValueChange={v => setTxForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Account</Label>
                <Select value={txForm.accountId} onValueChange={v => setTxForm(f => ({ ...f, accountId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
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
