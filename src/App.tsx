import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { LogIn, LogOut, Plus, Wallet, PieChart, History, Settings, TrendingUp, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, UserProfile, Budget, OperationType } from './types';
import { handleFirestoreError } from './lib/error-handler';
import { formatCurrency, cn } from './lib/utils';
import { format } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { parseExpenseAI } from './services/ai';

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Other'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'budgets'>('dashboard');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync Profile
        const profileRef = doc(db, 'users', u.uid);
        onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            setProfile({ id: doc.id, ...doc.data() } as UserProfile);
          } else {
            // Initial profile
            const newProfile = {
              email: u.email || '',
              displayName: u.displayName || 'User',
              totalIncome: 0,
              currency: 'USD',
              updatedAt: serverTimestamp(),
            };
            setDoc(profileRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));

        // Real-time Expenses
        const expensesQuery = query(
          collection(db, 'expenses'),
          where('userId', '==', u.uid),
          orderBy('date', 'desc'),
          limit(50)
        );
        onSnapshot(expensesQuery, (snapshot) => {
          setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
        }, (err) => handleFirestoreError(err, OperationType.GET, 'expenses'));

        // Real-time Budgets
        const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', u.uid));
        onSnapshot(budgetsQuery, (snapshot) => {
          setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
        }, (err) => handleFirestoreError(err, OperationType.GET, 'budgets'));
      } else {
        setProfile(null);
        setExpenses([]);
        setBudgets([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAiAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || !user) return;
    setAiLoading(true);
    const data = await parseExpenseAI(aiInput);
    if (data) {
      try {
        const expenseRef = doc(collection(db, 'expenses'));
        await setDoc(expenseRef, {
          ...data,
          date: new Date(data.date),
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        setAiInput('');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'expenses');
      }
    }
    setAiLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-sans">SpendWise</h1>
            <p className="text-slate-500 font-sans">Effortless expense tracking & budgeting with AI.</p>
          </div>
          <button 
            id="google-login-btn"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 group"
          >
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const remainingBudget = (profile?.totalIncome || 0) - totalSpent;
  
  const categoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0)
  })).filter(d => d.value > 0);

  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = format(d, 'MMM dd');
    const amount = expenses
      .filter(e => format(new Date(e.date.toDate ? e.date.toDate() : e.date), 'MMM dd') === dayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { name: dayStr, amount };
  }).reverse();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 md:pl-64">
      {/* Sidebar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 md:top-0 md:left-0 md:w-64 md:h-full md:border-t-0 md:border-r flex md:flex-col items-center md:items-stretch justify-around md:justify-start px-2 py-4 z-50">
        <div className="hidden md:flex items-center gap-3 px-4 mb-8">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">SpendWise</span>
        </div>

        <div id="nav-items" className="flex md:flex-col w-full gap-1">
          <NavItem id="nav-dashboard" icon={PieChart} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem id="nav-history" icon={History} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem id="nav-budgets" icon={Settings} label="Budget" active={activeTab === 'budgets'} onClick={() => setActiveTab('budgets')} />
        </div>

        <div className="mt-auto hidden md:block px-4">
          <div className="p-4 bg-slate-100 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                {user.displayName?.[0]}
              </div>
              <div className="truncate">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header / AI Input */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight">
              {activeTab === 'dashboard' && "Overview"}
              {activeTab === 'history' && "Transaction History"}
              {activeTab === 'budgets' && "Budget Planner"}
            </h2>
            <form id="ai-expense-form" onSubmit={handleAiAddExpense} className="relative group w-full md:w-96">
              <input 
                id="ai-expense-input"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Spent $20 on coffee today..."
                className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
              <button 
                id="ai-submit-btn"
                disabled={aiLoading || !aiInput}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-400 transition-colors shadow-sm"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Stats Cards */}
                <Card className="md:col-span-1 bg-blue-600 text-white shadow-xl shadow-blue-200 border-none">
                  <p className="text-blue-100 text-sm font-medium mb-1">Monthly Budget</p>
                  <h3 className="text-3xl font-bold">{formatCurrency(profile?.totalIncome || 0, profile?.currency)}</h3>
                  <div className="mt-4 pt-4 border-t border-blue-500/30 flex items-center justify-between">
                    <span className="text-sm text-blue-100">Remaining</span>
                    <span className={cn("font-bold", remainingBudget < 0 ? "text-red-200" : "text-white")}>
                      {formatCurrency(remainingBudget, profile?.currency)}
                    </span>
                  </div>
                </Card>

                <Card className="md:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-slate-700">Spending Trends</h4>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Categories & Recent */}
                <Card className="md:col-span-1">
                  <h4 className="font-bold text-slate-700 mb-6">Categories</h4>
                  {categoryData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[CATEGORIES.indexOf(entry.name) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                          />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm italic">
                      No data to show
                    </div>
                  )}
                </Card>

                <Card className="md:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-slate-700">Recent Transactions</h4>
                    <button onClick={() => setActiveTab('history')} className="text-sm text-blue-600 font-medium hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                    {expenses.slice(0, 5).map(expense => (
                      <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            `bg-${COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length]}10`
                          )} style={{ backgroundColor: `${COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length]}15` }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length] }} />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-800">{expense.description}</p>
                            <p className="text-xs text-slate-500">{expense.category} • {format(new Date(expense.date.toDate ? expense.date.toDate() : expense.date), 'MMM dd')}</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-700">-{formatCurrency(expense.amount, profile?.currency)}</span>
                      </div>
                    ))}
                    {expenses.length === 0 && (
                      <p className="text-center text-slate-400 py-8 italic">No transactions found.</p>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <Card>
                  <div className="divide-y divide-slate-100">
                    {expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ backgroundColor: `${COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length]}15`, color: COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length] }}>
                             {expense.category[0]}
                           </div>
                           <div>
                             <p className="font-bold text-slate-800">{expense.description}</p>
                             <p className="text-xs text-slate-500 font-medium">{expense.category.toUpperCase()} • {format(new Date(expense.date?.toDate ? expense.date.toDate() : expense.date), 'PPPP')}</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">-{formatCurrency(expense.amount, profile?.currency)}</p>
                          <button 
                            onClick={async () => {
                              if (confirm('Delete this transaction?')) {
                                try {
                                  await deleteDoc(doc(db, 'expenses', expense.id));
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.DELETE, `expenses/${expense.id}`);
                                }
                              }
                            }}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'budgets' && (
              <motion.div 
                key="budgets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <Card className="space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2 font-sans">Monthly Income & Settings</h4>
                    <p className="text-sm text-slate-500 mb-4 font-sans">Set your expected monthly income to track remaining funds.</p>
                    <div className="flex gap-4">
                      <input 
                        type="number"
                        defaultValue={profile?.totalIncome}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) return;
                          setDoc(doc(db, 'users', user.uid), { totalIncome: val, updatedAt: serverTimestamp() }, { merge: true })
                            .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        placeholder="0.00"
                      />
                      <select 
                        defaultValue={profile?.currency || 'USD'}
                        onChange={(e) => {
                          setDoc(doc(db, 'users', user.uid), { currency: e.target.value, updatedAt: serverTimestamp() }, { merge: true })
                            .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
                        }}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                        <option value="JPY">JPY</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-bold text-slate-700">Category Budgets</h4>
                      <Plus className="w-4 h-4 text-blue-600 cursor-pointer" />
                    </div>
                    
                    <div className="space-y-6">
                      {CATEGORIES.map(cat => {
                        const budget = budgets.find(b => b.category === cat);
                        const spent = expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
                        const percent = budget ? (spent / budget.limit) * 100 : 0;
                        
                        return (
                          <div key={cat} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">{cat}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">{formatCurrency(spent, profile?.currency)} /</span>
                                <input 
                                  type="number"
                                  defaultValue={budget?.limit || 0}
                                  onBlur={async (e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;
                                    const budgetRef = budget ? doc(db, 'budgets', budget.id) : doc(collection(db, 'budgets'));
                                    await setDoc(budgetRef, {
                                      category: cat,
                                      limit: val,
                                      userId: user.uid,
                                      updatedAt: serverTimestamp(),
                                      period: 'monthly'
                                    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'budgets'));
                                  }}
                                  className="w-20 bg-transparent border-b border-slate-200 text-right font-bold focus:border-blue-500 outline-none"
                                />
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(percent, 100)}%` }}
                                className={cn(
                                  "h-full transition-all",
                                  percent > 90 ? "bg-red-500" : percent > 70 ? "bg-amber-500" : "bg-blue-500"
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action (Mobile Only) */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        <button 
          onClick={() => setAiInput('Spent $')}
          className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-400 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

function NavItem({ id, icon: Icon, label, active, onClick }: { id?: string, icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
      <span className="hidden md:block">{label}</span>
      {active && (
        <motion.div layoutId="activeNav" className="ml-auto hidden md:block w-1 h-4 bg-white/40 rounded-full" />
      )}
    </button>
  );
}

function Card({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-white border border-slate-200 rounded-3xl p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}
