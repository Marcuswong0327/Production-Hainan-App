import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, BarChart3, Building2, Copy, PieChart, Users, Wallet } from 'lucide-react';
import type { LoanRecipient } from '../types/studyLoan';

interface LoanRecipientsStatsPageProps {
  recipients: LoanRecipient[];
  onBack: () => void;
}

type AssocBreakdown = {
  name: string;
  loan: number;
  paid: number;
  remaining: number;
  count: number;
  active: number;
  completed: number;
  collectionPct: number;
};

function aggregateByAssociation(list: LoanRecipient[]): AssocBreakdown[] {
  const map = new Map<string, Omit<AssocBreakdown, 'collectionPct'>>();
  for (const r of list) {
    const name = (r.association || 'Unknown').trim() || 'Unknown';
    const cur = map.get(name) ?? {
      name,
      loan: 0,
      paid: 0,
      remaining: 0,
      count: 0,
      active: 0,
      completed: 0,
    };
    cur.loan += r.loan_amount;
    cur.paid += r.total_paid;
    cur.count += 1;
    if (r.status === 'active') cur.active += 1;
    if (r.status === 'completed') cur.completed += 1;
    map.set(name, cur);
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      remaining: Math.max(0, row.loan - row.paid),
      collectionPct: row.loan > 0 ? (row.paid / row.loan) * 100 : 0,
    }))
    .sort((a, b) => b.loan - a.loan);
}

function rowRemaining(r: LoanRecipient) {
  return Math.max(0, r.loan_amount - r.total_paid);
}

function totalsFor(list: LoanRecipient[]) {
  const loan = list.reduce((s, r) => s + r.loan_amount, 0);
  const paid = list.reduce((s, r) => s + r.total_paid, 0);
  const remaining = Math.max(0, loan - paid);
  const collectionPct = loan > 0 ? (paid / loan) * 100 : 0;
  const active = list.filter((r) => r.status === 'active').length;
  const completed = list.filter((r) => r.status === 'completed').length;
  return { loan, paid, remaining, collectionPct, active, completed, count: list.length };
}

function sortRecipientsByName(list: LoanRecipient[]) {
  return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }));
}

function buildStudentListTsv(rows: LoanRecipient[], associationLabel: string) {
  const header = [
    'Association',
    'Name (English)',
    'Name (Chinese)',
    'Email',
    'Phone',
    'University',
    'Status',
    'Loan (RM)',
    'Paid (RM)',
    'Remaining (RM)',
  ];
  const lines = [
    header.join('\t'),
    ...rows.map((r) =>
      [
        (r.association || '').trim() || '—',
        r.full_name,
        r.full_name_chinese?.trim() || '—',
        r.email,
        r.phone_number,
        r.university,
        r.status,
        String(r.loan_amount),
        String(r.total_paid),
        String(rowRemaining(r)),
      ].join('\t'),
    ),
  ];
  return `Student list — ${associationLabel}\n${lines.join('\n')}`;
}

/** Stacked bar: paid (green) + remaining (amber) = full loan */
function LoanStackBar({ loan, paid, className }: { loan: number; paid: number; className?: string }) {
  const rem = Math.max(0, loan - paid);
  const pctPaid = loan > 0 ? (paid / loan) * 100 : 0;
  const pctRem = loan > 0 ? (rem / loan) * 100 : 0;
  return (
    <div className={className}>
      <div className="h-3 flex rounded-full overflow-hidden bg-gray-200/80 ring-1 ring-gray-200">
        <div
          className="bg-emerald-500 h-full min-w-0 transition-all"
          style={{ width: `${pctPaid}%` }}
          title={`Paid RM ${paid.toLocaleString()}`}
        />
        <div
          className="bg-amber-400 h-full min-w-0 transition-all"
          style={{ width: `${pctRem}%` }}
          title={`Remaining RM ${rem.toLocaleString()}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span className="text-emerald-700">Paid {pctPaid.toFixed(0)}%</span>
        <span className="text-amber-800">Due {pctRem.toFixed(0)}%</span>
      </div>
    </div>
  );
}

/** Compare loan sizes across associations (relative bar lengths) */
function AssociationLoanBars({ rows }: { rows: AssocBreakdown[] }) {
  const maxLoan = Math.max(...rows.map((r) => r.loan), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800 truncate pr-2">{row.name}</span>
            <span className="text-gray-600 shrink-0">RM {row.loan.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
              style={{ width: `${(row.loan / maxLoan) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoanRecipientsStatsPage({ recipients, onBack }: LoanRecipientsStatsPageProps) {
  const [associationFilter, setAssociationFilter] = useState<string>('all');

  const associationNames = useMemo(() => {
    const s = new Set<string>();
    recipients.forEach((r) => s.add((r.association || 'Unknown').trim() || 'Unknown'));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [recipients]);

  const filtered = useMemo(() => {
    if (associationFilter === 'all') return recipients;
    return recipients.filter((r) => (r.association || 'Unknown').trim() === associationFilter);
  }, [recipients, associationFilter]);

  const byAssoc = useMemo(() => aggregateByAssociation(recipients), [recipients]);
  const filteredBreakdown = useMemo(() => aggregateByAssociation(filtered), [filtered]);
  const t = useMemo(() => totalsFor(filtered), [filtered]);

  const filteredSorted = useMemo(() => sortRecipientsByName(filtered), [filtered]);

  const groupedAllByAssociation = useMemo(() => {
    const map = new Map<string, LoanRecipient[]>();
    for (const r of recipients) {
      const k = (r.association || 'Unknown').trim() || 'Unknown';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([name, list]) => [name, sortRecipientsByName(list)] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [recipients]);

  const showPerAssociationSection = associationFilter === 'all' && byAssoc.length > 0;

  const copyList = async (rows: LoanRecipient[], label: string) => {
    try {
      await navigator.clipboard.writeText(buildStudentListTsv(rows, label));
      alert('List copied to clipboard. You can paste into email or Excel.');
    } catch {
      alert('Could not copy. Select and copy the table manually.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Loan portfolio analytics</h1>
              <p className="text-sm text-slate-500">Overview, filters, and per-association breakdown</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="w-4 h-4" />
            <span>{recipients.length} student{recipients.length === 1 ? '' : 's'} on file</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Filter */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="space-y-2 flex-1 max-w-md">
              <Label htmlFor="assoc-filter">Filter by association</Label>
              <Select value={associationFilter} onValueChange={setAssociationFilter}>
                <SelectTrigger id="assoc-filter" className="bg-white">
                  <SelectValue placeholder="Choose association" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All associations</SelectItem>
                  {associationNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-600 pb-1">
              Showing <strong>{filtered.length}</strong> student{filtered.length === 1 ? '' : 's'}
              {associationFilter !== 'all' ? (
                <>
                  {' '}
                  for <strong>{associationFilter}</strong>
                </>
              ) : null}
              .
            </p>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-slate-500">
              No recipients match this filter.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardDescription className="text-blue-800/80 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> Total loan
                  </CardDescription>
                  <CardTitle className="text-2xl text-blue-900">RM {t.loan.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-emerald-800/80 flex items-center gap-1.5">
                    <PieChart className="w-4 h-4" /> Paid
                  </CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">RM {t.paid.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-amber-900/80 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" /> Remaining
                  </CardDescription>
                  <CardTitle className="text-2xl text-amber-950">RM {t.remaining.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-violet-100 bg-gradient-to-br from-violet-50 to-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-violet-800/80 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Students
                  </CardDescription>
                  <CardTitle className="text-2xl text-violet-900">{t.count}</CardTitle>
                  <p className="text-xs text-violet-700/90 mt-1">
                    Active {t.active} · Completed {t.completed}
                  </p>
                </CardHeader>
              </Card>
            </div>

            {/* Portfolio progress */}
            <Card className="shadow-sm border-slate-200/80">
              <CardHeader>
                <CardTitle className="text-lg">Collection progress</CardTitle>
                <CardDescription>Paid vs remaining for the current filter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{Math.round(t.collectionPct)}% collected</span>
                  <span>RM {t.paid.toLocaleString()} / RM {t.loan.toLocaleString()}</span>
                </div>
                <LoanStackBar loan={t.loan} paid={t.paid} />
              </CardContent>
            </Card>

            {/* Student list for branch contact (single association) */}
            {associationFilter !== 'all' && filteredSorted.length > 0 && (
              <Card className="shadow-sm border-indigo-100 bg-white ring-1 ring-indigo-100/80">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-lg">Student list · {associationFilter}</CardTitle>
                    <CardDescription>
                      Names and contacts for sharing with branch association officers (copy and paste into email or
                      Excel).
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => copyList(filteredSorted, associationFilter)}
                  >
                    <Copy className="w-4 h-4" />
                    Copy list
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="py-2 pr-3 font-medium">Name (English)</th>
                        <th className="py-2 pr-3 font-medium">中文</th>
                        <th className="py-2 pr-3 font-medium">Email</th>
                        <th className="py-2 pr-3 font-medium">Phone</th>
                        <th className="py-2 pr-3 font-medium">University</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-2 font-medium text-right">Loan</th>
                        <th className="py-2 pr-2 font-medium text-right">Paid</th>
                        <th className="py-2 font-medium text-right">Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSorted.map((r, i) => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="py-2.5 pr-3 text-slate-500">{i + 1}</td>
                          <td className="py-2.5 pr-3 font-medium text-slate-900">{r.full_name}</td>
                          <td className="py-2.5 pr-3 text-slate-700">{r.full_name_chinese?.trim() || '—'}</td>
                          <td className="py-2.5 pr-3 text-slate-700 break-all max-w-[10rem]">{r.email}</td>
                          <td className="py-2.5 pr-3 text-slate-700 whitespace-nowrap">{r.phone_number}</td>
                          <td className="py-2.5 pr-3 text-slate-600 max-w-[12rem] truncate" title={r.university}>
                            {r.university}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={
                                r.status === 'completed'
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-amber-800 font-medium'
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-right tabular-nums">RM {r.loan_amount.toLocaleString()}</td>
                          <td className="py-2.5 pr-2 text-right tabular-nums">RM {r.total_paid.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums text-amber-900">
                            RM {rowRemaining(r).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Single-association or filtered slice detail */}
            {associationFilter !== 'all' && filteredBreakdown[0] && (
              <Card className="shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="text-lg">{filteredBreakdown[0].name}</CardTitle>
                  <CardDescription>Loan health for this association</CardDescription>
                </CardHeader>
                <CardContent>
                  <LoanStackBar loan={filteredBreakdown[0].loan} paid={filteredBreakdown[0].paid} className="max-w-2xl" />
                  <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-500">Loan</div>
                      <div className="font-semibold text-slate-900">RM {filteredBreakdown[0].loan.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                      <div className="text-xs text-emerald-700">Paid</div>
                      <div className="font-semibold text-emerald-900">RM {filteredBreakdown[0].paid.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <div className="text-xs text-amber-800">Remaining</div>
                      <div className="font-semibold text-amber-950">RM {filteredBreakdown[0].remaining.toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All associations: comparison */}
            {showPerAssociationSection && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="shadow-sm border-slate-200/80">
                    <CardHeader>
                      <CardTitle className="text-lg">Loan volume by association</CardTitle>
                      <CardDescription>Relative size of total loan per association</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AssociationLoanBars rows={byAssoc} />
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-slate-200/80">
                    <CardHeader>
                      <CardTitle className="text-lg">Collection rate by association</CardTitle>
                      <CardDescription>% of loan already paid back</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {byAssoc.map((row) => (
                        <div key={row.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-800 truncate pr-2">{row.name}</span>
                            <span className="text-slate-600 shrink-0">{Math.round(row.collectionPct)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-teal-500"
                              style={{ width: `${Math.min(100, row.collectionPct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-sm border-slate-200/80">
                  <CardHeader>
                    <CardTitle className="text-lg">Per-association breakdown</CardTitle>
                    <CardDescription>Loan, paid, and remaining — with visual split</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {byAssoc.map((row) => (
                      <div
                        key={row.name}
                        className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-slate-900">{row.name}</h3>
                            <p className="text-xs text-slate-500">
                              {row.count} student{row.count === 1 ? '' : 's'} · Active {row.active} · Completed{' '}
                              {row.completed}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-slate-500 text-xs">Outstanding</div>
                            <div className="font-semibold text-amber-800">RM {row.remaining.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-md bg-blue-50 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-blue-700">Loan</div>
                            <div className="font-semibold text-blue-900">RM {row.loan.toLocaleString()}</div>
                          </div>
                          <div className="rounded-md bg-emerald-50 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-emerald-700">Paid</div>
                            <div className="font-semibold text-emerald-900">RM {row.paid.toLocaleString()}</div>
                          </div>
                          <div className="rounded-md bg-amber-50 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-amber-800">Remaining</div>
                            <div className="font-semibold text-amber-950">RM {row.remaining.toLocaleString()}</div>
                          </div>
                        </div>
                        <LoanStackBar loan={row.loan} paid={row.paid} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-indigo-100 ring-1 ring-indigo-100/80">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-lg">Student directory (all associations)</CardTitle>
                      <CardDescription>
                        Grouped by association — use copy to share a full tab-separated list with branches.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => copyList(sortRecipientsByName(recipients), 'All associations')}
                    >
                      <Copy className="w-4 h-4" />
                      Copy full list
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {groupedAllByAssociation.map(([assocName, list]) => (
                      <div key={assocName}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-slate-900">{assocName}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-indigo-700 h-8 gap-1"
                            onClick={() => copyList(list, assocName)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy this group
                          </Button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm text-left min-w-[640px]">
                            <thead className="bg-slate-50 text-slate-600 text-xs">
                              <tr>
                                <th className="py-2 px-3 font-medium">#</th>
                                <th className="py-2 px-3 font-medium">Name (EN)</th>
                                <th className="py-2 px-3 font-medium">中文</th>
                                <th className="py-2 px-3 font-medium">Email</th>
                                <th className="py-2 px-3 font-medium">Phone</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((r, i) => (
                                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                  <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                                  <td className="py-2 px-3 font-medium text-slate-900">{r.full_name}</td>
                                  <td className="py-2 px-3 text-slate-700">{r.full_name_chinese?.trim() || '—'}</td>
                                  <td className="py-2 px-3 text-slate-700 break-all max-w-[12rem]">{r.email}</td>
                                  <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{r.phone_number}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
