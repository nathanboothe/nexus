import { useState, useEffect, useRef } from 'react';
import { airtable } from '../api.js';
import styles from './Finance.module.css';

// Add these table IDs to config.js
const TABLES = {
  accounts:     'accounts',
  transactions: 'transactions',
};

const CATEGORY_COLORS = [
  '#2E5FA3','#1D9E75','#BA7517','#993556','#7F77DD',
  '#c0392b','#639922','#5c6278','#0078D4','#EA4335',
];

function parseQuickenCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Find header row
  const headerIdx = lines.findIndex(l =>
    l.toLowerCase().includes('date') && l.toLowerCase().includes('amount')
  );
  if (headerIdx === -1) return [];

  const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const dateIdx    = headers.findIndex(h => h === 'date');
  const descIdx    = headers.findIndex(h => h.includes('description') || h.includes('payee') || h.includes('name'));
  const amountIdx  = headers.findIndex(h => h === 'amount');
  const categoryIdx= headers.findIndex(h => h.includes('category'));
  const memoIdx    = headers.findIndex(h => h.includes('memo') || h.includes('note'));
  const clearedIdx = headers.findIndex(h => h.includes('cleared') || h.includes('clr'));
  const accountIdx = headers.findIndex(h => h.includes('account'));

  const transactions = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;

    const amountStr = cols[amountIdx] || '0';
    const amount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0;
    if (isNaN(amount)) continue;

    const dateStr = cols[dateIdx] || '';
    let date = '';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d)) date = d.toISOString().split('T')[0];
    } catch {}

    transactions.push({
      Description: cols[descIdx] || 'Unknown',
      Date:        date,
      Amount:      amount,
      Category:    cols[categoryIdx] || '',
      Memo:        memoIdx >= 0 ? cols[memoIdx] : '',
      Cleared:     clearedIdx >= 0 ? cols[clearedIdx]?.toLowerCase() === 'x' || cols[clearedIdx]?.toLowerCase() === 'r' : false,
      accountName: accountIdx >= 0 ? cols[accountIdx] : '',
      Type:        amount >= 0 ? 'Income' : 'Expense',
    });
  }
  return transactions;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function groupByCategory(transactions) {
  const groups = {};
  transactions
    .filter(t => (t.fields?.Amount || t.Amount) < 0)
    .forEach(t => {
      const cat = t.fields?.Category || t.Category || 'Uncategorized';
      const amt = Math.abs(t.fields?.Amount || t.Amount || 0);
      groups[cat] = (groups[cat] || 0) + amt;
    });
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

export default function Finance() {
  const [tab, setTab] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [catFilter, setCatFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTx, setSearchTx] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ Name: '', Type: 'Checking', Balance: '', Institution: '' });
  const [addingAccount, setAddingAccount] = useState(false);
  const fileRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const [accData, txData] = await Promise.all([
        airtable.list('accounts', { maxRecords: 50 }),
        airtable.list('transactions', { maxRecords: 500, 'sort[0][field]': 'Date', 'sort[0][direction]': 'desc' }),
      ]);
      setAccounts(accData.records || []);
      setTransactions(txData.records || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const parsed = parseQuickenCSV(text);
      if (parsed.length === 0) {
        setImportResult({ ok: false, message: 'No transactions found. Check that the file is a Quicken CSV export.' });
        setImporting(false);
        return;
      }

      const batchId = new Date().toISOString();
      let imported = 0;
      let errors = 0;

      // Match account by name if present
      const accountMap = {};
      accounts.forEach(a => { accountMap[a.fields.Name?.toLowerCase()] = a.id; });

      for (const tx of parsed) {
        try {
          const fields = {
            Description:    tx.Description,
            Amount:         tx.Amount,
            Type:           tx.Type,
            'Import batch': batchId,
          };
          if (tx.Date)     fields.Date = tx.Date;
          if (tx.Category) fields.Category = tx.Category;
          if (tx.Memo)     fields.Memo = tx.Memo;
          if (tx.Cleared)  fields.Cleared = tx.Cleared;

          const accId = accountMap[tx.accountName?.toLowerCase()];
          if (accId) fields.Account = [accId];

          await airtable.create('transactions', fields);
          imported++;
        } catch {
          errors++;
        }
      }

      setImportResult({ ok: true, message: `Imported ${imported} transactions${errors > 0 ? `, ${errors} errors` : ''} from ${file.name}` });
      load();
    } catch (err) {
      setImportResult({ ok: false, message: `Parse error: ${err.message}` });
    }
    setImporting(false);
  }

  async function handleAddAccount(e) {
    e.preventDefault();
    if (!newAccount.Name.trim()) return;
    setAddingAccount(true);
    try {
      const fields = {
        Name:   newAccount.Name,
        Type:   newAccount.Type,
        Active: true,
      };
      if (newAccount.Balance)     fields.Balance = parseFloat(newAccount.Balance);
      if (newAccount.Institution) fields.Institution = newAccount.Institution;
      const rec = await airtable.create('accounts', fields);
      setAccounts(prev => [...prev, rec]);
      setNewAccount({ Name: '', Type: 'Checking', Balance: '', Institution: '' });
      setShowAddAccount(false);
    } catch {}
    setAddingAccount(false);
  }

  async function updateBalance(accountId, balance) {
    try {
      await airtable.update('accounts', accountId, {
        Balance:        parseFloat(balance),
        'Last updated': new Date().toISOString().split('T')[0],
      });
      setAccounts(prev => prev.map(a =>
        a.id === accountId ? { ...a, fields: { ...a.fields, Balance: parseFloat(balance) } } : a
      ));
    } catch {}
  }

  // Computed values
  const totalBalance = accounts
    .filter(a => a.fields.Active !== false)
    .reduce((sum, a) => sum + (a.fields.Balance || 0), 0);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const monthTx = transactions.filter(t => {
    const d = t.fields.Date ? new Date(t.fields.Date) : null;
    return d && d >= thisMonth;
  });

  const monthIncome  = monthTx.filter(t => (t.fields.Amount || 0) > 0).reduce((s, t) => s + (t.fields.Amount || 0), 0);
  const monthExpense = monthTx.filter(t => (t.fields.Amount || 0) < 0).reduce((s, t) => s + Math.abs(t.fields.Amount || 0), 0);

  const categories = ['All', ...new Set(transactions.map(t => t.fields.Category).filter(Boolean))];
  const spendingByCategory = groupByCategory(transactions.slice(0, 200));
  const maxSpend = spendingByCategory[0]?.[1] || 1;

  const filteredTx = transactions.filter(t => {
    const matchCat  = catFilter === 'All' || t.fields.Category === catFilter;
    const matchType = typeFilter === 'All' || t.fields.Type === typeFilter;
    const matchSearch = !searchTx || (t.fields.Description || '').toLowerCase().includes(searchTx.toLowerCase());
    return matchCat && matchType && matchSearch;
  });

  if (loading) return <div className="page"><p className="text-muted">Loading finance...</p></div>;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Finance</h1>
          <p className="text-muted text-sm">Accounts · transactions · spending</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.importBtn} onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? 'Importing...' : '⬆ Import Quicken CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.qif" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </div>

      {importResult && (
        <div className={`${styles.importResult} ${importResult.ok ? styles.importOk : styles.importErr}`}>
          {importResult.message}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {['overview', 'transactions', 'spending'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {/* Summary cards */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>Total balance</p>
              <p className={`${styles.summaryValue} ${totalBalance >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>This month — income</p>
              <p className={`${styles.summaryValue} ${styles.positive}`}>{formatCurrency(monthIncome)}</p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>This month — expenses</p>
              <p className={`${styles.summaryValue} ${styles.negative}`}>{formatCurrency(monthExpense)}</p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryLabel}>This month — net</p>
              <p className={`${styles.summaryValue} ${monthIncome - monthExpense >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(monthIncome - monthExpense)}
              </p>
            </div>
          </div>

          {/* Accounts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
            <h2 className={styles.sectionTitle}>Accounts</h2>
            <button className={styles.addBtn} onClick={() => setShowAddAccount(s => !s)}>+ Add account</button>
          </div>

          {showAddAccount && (
            <form onSubmit={handleAddAccount} className={styles.addForm}>
              <input type="text" placeholder="Account name" value={newAccount.Name}
                onChange={e => setNewAccount(a => ({ ...a, Name: e.target.value }))} style={{ flex: 2 }} />
              <select value={newAccount.Type} onChange={e => setNewAccount(a => ({ ...a, Type: e.target.value }))}
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
                {['Checking','Savings','Business','Credit Card','Investment'].map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="text" placeholder="Institution" value={newAccount.Institution}
                onChange={e => setNewAccount(a => ({ ...a, Institution: e.target.value }))} />
              <input type="number" placeholder="Balance" value={newAccount.Balance}
                onChange={e => setNewAccount(a => ({ ...a, Balance: e.target.value }))} style={{ width: 120 }} />
              <button type="submit" className={styles.addBtn} disabled={addingAccount}>{addingAccount ? '...' : 'Add'}</button>
              <button type="button" onClick={() => setShowAddAccount(false)}
                style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}

          <div className={styles.accountGrid}>
            {accounts.filter(a => a.fields.Active !== false).map(acc => {
              const f = acc.fields;
              return (
                <div key={acc.id} className={styles.accountCard}>
                  <div className={styles.accountTop}>
                    <div>
                      <p className={styles.accountName}>{f.Name}</p>
                      <p className="text-xs text-faint">{f.Institution || f.Type}</p>
                    </div>
                    <span className={`badge ${f.Type === 'Business' ? 'badge-blue' : f.Type === 'Savings' ? 'badge-green' : 'badge-gray'}`}>
                      {f.Type}
                    </span>
                  </div>
                  <div className={styles.accountBalance}>
                    <BalanceEditor
                      value={f.Balance || 0}
                      onSave={val => updateBalance(acc.id, val)}
                    />
                  </div>
                  {f['Last updated'] && (
                    <p className="text-xs text-faint">Updated {new Date(f['Last updated']).toLocaleDateString()}</p>
                  )}
                </div>
              );
            })}
            {accounts.length === 0 && (
              <p className="text-muted text-sm">No accounts yet — add one above</p>
            )}
          </div>

          {/* Recent transactions */}
          <h2 className={styles.sectionTitle} style={{ marginTop: 24, marginBottom: 10 }}>Recent transactions</h2>
          <div className={styles.txList}>
            {transactions.slice(0, 10).map(t => <TxRow key={t.id} tx={t} />)}
            {transactions.length === 0 && <p className="text-muted text-sm">No transactions — import a Quicken CSV to get started</p>}
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === 'transactions' && (
        <div>
          <div className={styles.txFilters}>
            <input type="text" placeholder="Search transactions..." value={searchTx}
              onChange={e => setSearchTx(e.target.value)} style={{ flex: 1, maxWidth: 280 }} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
              <option value="All">All types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Transfer">Transfer</option>
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="text-sm text-muted">{filteredTx.length} transactions</span>
          </div>
          <div className={styles.txList}>
            {filteredTx.slice(0, 100).map(t => <TxRow key={t.id} tx={t} />)}
            {filteredTx.length === 0 && <p className="text-muted text-sm">No transactions match filters</p>}
            {filteredTx.length > 100 && <p className="text-muted text-sm">Showing first 100 — use filters to narrow down</p>}
          </div>
        </div>
      )}

      {/* ── SPENDING ── */}
      {tab === 'spending' && (
        <div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 16 }}>Spending by category</h2>
          {spendingByCategory.length === 0 ? (
            <p className="text-muted">No expense data yet — import transactions first</p>
          ) : (
            <div className={styles.spendingList}>
              {spendingByCategory.map(([cat, amount], i) => (
                <div key={cat} className={styles.spendingRow}>
                  <div className={styles.spendingCat}>
                    <span className={styles.spendingDot} style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className={styles.spendingLabel}>{cat}</span>
                  </div>
                  <div className={styles.spendingBar}>
                    <div className={styles.spendingFill}
                      style={{ width: `${(amount / maxSpend) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  </div>
                  <span className={styles.spendingAmount}>{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TxRow({ tx }) {
  const f = tx.fields;
  const amount = f.Amount || 0;
  const isIncome = amount >= 0;
  return (
    <div className={styles.txRow}>
      <div className={styles.txDate}>{f.Date ? new Date(f.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div>
      <div className={styles.txDesc}>
        <span className={styles.txName}>{f.Description || '—'}</span>
        {f.Category && <span className="text-xs text-faint">{f.Category}</span>}
      </div>
      <span className={`${styles.txAmount} ${isIncome ? styles.txIncome : styles.txExpense}`}>
        {isIncome ? '+' : ''}{formatCurrency(amount)}
      </span>
    </div>
  );
}

function BalanceEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value.toString());

  function save() {
    onSave(val);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="number" value={val} onChange={e => setVal(e.target.value)}
          style={{ width: 120, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', fontSize: 16 }}
          onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
        <button onClick={save} style={{ fontSize: 12, padding: '4px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Save</button>
        <button onClick={() => setEditing(false)} style={{ fontSize: 12, padding: '4px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setEditing(true)}>
      <span className={`${styles.balanceValue} ${value >= 0 ? styles.positive : styles.negative}`}>
        {formatCurrency(value)}
      </span>
      <span className="text-xs text-faint">✎</span>
    </div>
  );
}
