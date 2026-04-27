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
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#71717a'];

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
              currency: 'INR',
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="bg-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
            <Wallet className="w-8 h-8 text-black" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white font-sans uppercase">SpendWise</h1>
            <p className="text-zinc-500 font-sans text-sm tracking-wide">AI-Powered personal ledger for the modern era.</p>
          </div>
          <button 
            id="google-login-btn"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-50 text-black rounded-xl font-bold uppercase tracking-wide hover:bg-zinc-200 transition-all shadow-lg group"
          >
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            Connect Google Account
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
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-50 pb-20 md:pb-0 md:pl-64">
      {/* Sidebar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900 border-t border-zinc-800 md:top-0 md:left-0 md:w-64 md:h-full md:border-t-0 md:border-r flex md:flex-col items-center md:items-stretch justify-around md:justify-start px-2 py-6 z-50">
        <div className="hidden md:flex items-center gap-3 px-4 mb-10">
          <div className="bg-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center text-black font-black italic">S</div>
          <span className="font-black text-xl tracking-tighter uppercase italic">SpendWise</span>
        </div>

        <div id="nav-items" className="flex md:flex-col w-full gap-2 px-2">
          <NavItem id="nav-dashboard" icon={PieChart} label="Analytics" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem id="nav-history" icon={History} label="Transactions" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem id="nav-budgets" icon={Settings} label="Planner" active={activeTab === 'budgets'} onClick={() => setActiveTab('budgets')} />
        </div>

        <div className="mt-auto hidden md:block px-4">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-xs border border-zinc-700">
                {user.displayName?.[0]}
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                <p className="text-[10px] text-zinc-500 truncate uppercase font-bold tracking-widest">{profile?.currency || 'USD'}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4 md:p-10 space-y-10">
        {/* Header / AI Input */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">
              {activeTab === 'dashboard' && "Overview"}
              {activeTab === 'history' && "Ledger"}
              {activeTab === 'budgets' && "Allocations"}
            </h2>
            <h1 className="text-4xl font-bold tracking-tight">
              {activeTab === 'dashboard' && "Portfolio Trends"}
              {activeTab === 'history' && "Activity Log"}
              {activeTab === 'budgets' && "Budget Targets"}
            </h1>
          </div>
          <form id="ai-expense-form" onSubmit={handleAiAddExpense} className="relative group w-full md:w-96">
            <input 
              id="ai-expense-input"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Captured: $45 for dinner last night"
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-zinc-600 transition-all placeholder:text-zinc-600"
            />
            <button 
              id="ai-submit-btn"
              disabled={aiLoading || !aiInput}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-500 text-black text-xs font-bold rounded-full hover:bg-emerald-400 disabled:opacity-50 disabled:bg-zinc-800 transition-colors uppercase tracking-widest"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync"}
            </button>
          </form>
        </div>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-5"
              >
                {/* Stats Cards - Bento Grid Layout */}
                <Card className="md:col-span-4 bg-zinc-900/50 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Current Capital</p>
                    <h3 className="text-4xl font-semibold tracking-tight">{formatCurrency(profile?.totalIncome || 0, profile?.currency)}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3" />
                    <span>Verified Account Status</span>
                  </div>
                </Card>

                <Card className="md:col-span-8 bg-zinc-900/50 p-8">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Weekly Analytics</h4>
                      <p className="text-lg font-medium">Spending Velocity</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                    </div>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <XAxis dataKey="name" hide />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', color: '#fafafa' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest px-2">
                    {dailyData.map(d => <span key={d.name}>{d.name.split(' ')[0]}</span>)}
                  </div>
                </Card>

                {/* Categories & Recent */}
                <Card className="md:col-span-4 bg-zinc-900/50">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8">Category Weights</h4>
                  {categoryData.length > 0 ? (
                    <div className="h-48 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={85}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[CATEGORIES.indexOf(entry.name) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', color: '#fafafa' }}
                          />
                        </RePieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">Total</p>
                          <p className="text-lg font-bold">{categoryData.length}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-zinc-600 text-xs uppercase font-bold tracking-widest italic">
                      Static data null
                    </div>
                  )}
                </Card>

                <Card className="md:col-span-4 bg-zinc-900/50">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Latest Entries</h4>
                    <button onClick={() => setActiveTab('history')} className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest hover:underline">Full Log</button>
                  </div>
                  <div className="space-y-6">
                    {expenses.slice(0, 4).map(expense => (
                      <div key={expense.id} className="flex justify-between items-center group">
                        <div>
                          <p className="text-sm font-semibold group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{expense.description}</p>
                          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{format(new Date(expense.date.toDate ? expense.date.toDate() : expense.date), 'MMM dd, HH:mm')}</p>
                        </div>
                        <span className="text-sm font-black text-zinc-300">-{formatCurrency(expense.amount, profile?.currency)}</span>
                      </div>
                    ))}
                    {expenses.length === 0 && (
                      <p className="text-center text-zinc-600 py-8 text-[10px] font-bold uppercase tracking-widest italic">Empty database</p>
                    )}
                  </div>
                </Card>

                <Card className={cn(
                  "md:col-span-4 rounded-[40px] flex flex-col justify-between p-8 border-none",
                  remainingBudget < 0 ? "bg-red-500 text-white" : "bg-emerald-500 text-black"
                )}>
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", remainingBudget < 0 ? "text-white/60" : "text-black/60")}>Operational Runway</p>
                    <h4 className={cn("text-3xl font-black italic uppercase leading-none", remainingBudget < 0 ? "text-white" : "text-black")}>
                      {remainingBudget < 0 ? "Exceeded Limit" : "Safe Zone Access"}
                    </h4>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-4xl font-black tracking-tighter">
                      {Math.max(0, Math.round((remainingBudget / (profile?.totalIncome || 1)) * 100))}%
                    </div>
                    <AlertCircle className={cn("w-6 h-6", remainingBudget < 0 ? "text-white" : "text-black/40")} />
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
                <Card className="bg-zinc-900/50">
                  <div className="divide-y divide-zinc-800">
                    {expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between py-5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-6">
                           <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg italic bg-zinc-800 border border-zinc-700" style={{ color: COLORS[CATEGORIES.indexOf(expense.category) % COLORS.length] }}>
                             {expense.category[0]}
                           </div>
                           <div>
                             <p className="font-black text-lg text-zinc-100 uppercase italic tracking-tighter leading-tight">{expense.description}</p>
                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">{expense.category} • {format(new Date(expense.date?.toDate ? expense.date.toDate() : expense.date), 'PPPP')}</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-zinc-200">-{formatCurrency(expense.amount, profile?.currency)}</p>
                          <button 
                            onClick={async () => {
                              if (confirm('Permanently redact this entry?')) {
                                try {
                                  await deleteDoc(doc(db, 'expenses', expense.id));
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.DELETE, `expenses/${expense.id}`);
                                }
                              }
                            }}
                            className="text-[10px] text-zinc-600 hover:text-red-500 transition-colors uppercase font-black tracking-[0.2em]"
                          >
                            Redact
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
                <Card className="bg-zinc-900/50 space-y-10 p-10">
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-6">Financial Calibration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Baseline Income</label>
                         <input 
                          type="number"
                          defaultValue={profile?.totalIncome}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val)) return;
                            setDoc(doc(db, 'users', user.uid), { totalIncome: val, updatedAt: serverTimestamp() }, { merge: true })
                              .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
                          }}
                          className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-6 py-4 text-xl font-bold focus:border-emerald-500 outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest pl-1">Operating Currency</label>
                         <select 
                          value={profile?.currency || 'INR'}
                          onChange={(e) => {
                            setDoc(doc(db, 'users', user.uid), { currency: e.target.value, updatedAt: serverTimestamp() }, { merge: true })
                              .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
                          }}
                          className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-6 py-4 text-xl font-bold focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer text-zinc-300"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="JPY">JPY (¥)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-10 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-10">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Quota Management</h4>
                      <Plus className="w-4 h-4 text-emerald-500" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      {CATEGORIES.map(cat => {
                        const budget = budgets.find(b => b.category === cat);
                        const spent = expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
                        const percent = budget ? (spent / budget.limit) * 100 : 0;
                        
                        return (
                          <div key={cat} className="space-y-4">
                            <div className="flex items-end justify-between">
                              <div>
                                 <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-1">{cat}</p>
                                 <p className="text-sm font-bold text-zinc-300">{formatCurrency(spent, profile?.currency)} Used</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-1">Quota limit</p>
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
                                  className="w-24 bg-transparent border-b border-zinc-700 text-right font-black italic focus:border-emerald-500 outline-none text-lg"
                                />
                              </div>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(percent, 100)}%` }}
                                className={cn(
                                  "h-full transition-all",
                                  percent > 90 ? "bg-red-500" : percent > 70 ? "bg-amber-500" : "bg-emerald-500"
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
      </main>

      {/* Floating Action (Mobile Only) */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        <button 
          onClick={() => setAiInput('Spent $')}
          className="w-14 h-14 bg-emerald-500 text-black rounded-3xl flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
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
        "flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group",
        active 
          ? "bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-xl" 
          : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/50"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-emerald-400" : "text-zinc-700 group-hover:text-zinc-500")} />
      <span className="hidden md:block">{label}</span>
    </button>
  );
}

function Card({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-zinc-900 border border-zinc-800/50 rounded-[32px] p-8 shadow-sm backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}
