import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/select';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type GuarantorRelationshipOption = { id: string; label: string; sort_order: number };

const EDIT_SENTINEL = '__edit_relationship_types__';

/** Default list when Supabase is unavailable or table is empty (matches migration seed). */
export const DEFAULT_GUARANTOR_RELATIONSHIP_OPTIONS: GuarantorRelationshipOption[] = [
  { id: 'default-dad', label: 'Dad (父亲)', sort_order: 10 },
  { id: 'default-mom', label: 'Mom (母亲)', sort_order: 20 },
  { id: 'default-uncle', label: 'Uncle (叔叔/舅舅)', sort_order: 30 },
  { id: 'default-aunty', label: 'Aunty (阿姨/姑姑)', sort_order: 40 },
  { id: 'default-brother', label: 'Brother (兄弟)', sort_order: 50 },
  { id: 'default-sister', label: 'Sister (姐妹)', sort_order: 60 },
  { id: 'default-other', label: 'Other (其他)', sort_order: 70 },
];

/** Older forms stored short codes; map to the same labels as the dropdown. */
const LEGACY_CODE_TO_LABEL: Record<string, string> = {
  dad: 'Dad (父亲)',
  mom: 'Mom (母亲)',
  uncle: 'Uncle (叔叔/舅舅)',
  aunty: 'Aunty (阿姨/姑姑)',
  brother: 'Brother (兄弟)',
  sister: 'Sister (姐妹)',
  other: 'Other (其他)',
};

export function normalizeGuarantorRelationshipValue(
  stored: string | null | undefined,
  optionLabels: string[],
): string {
  if (!stored?.trim()) return '';
  const t = stored.trim();
  const fromLegacy = LEGACY_CODE_TO_LABEL[t];
  if (fromLegacy && optionLabels.includes(fromLegacy)) return fromLegacy;
  return t;
}

interface GuarantorRelationshipSelectProps {
  value: string;
  onChange: (label: string) => void;
  id?: string;
  disabled?: boolean;
}

export function GuarantorRelationshipSelect({ value, onChange, id, disabled }: GuarantorRelationshipSelectProps) {
  const [options, setOptions] = useState<GuarantorRelationshipOption[]>(DEFAULT_GUARANTOR_RELATIONSHIP_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const loadOptions = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setOptions(DEFAULT_GUARANTOR_RELATIONSHIP_OPTIONS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guarantor_relationship_options')
        .select('id,label,sort_order')
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true });
      if (!error && data?.length) {
        setOptions(data as GuarantorRelationshipOption[]);
      } else {
        setOptions(DEFAULT_GUARANTOR_RELATIONSHIP_OPTIONS);
      }
    } catch {
      setOptions(DEFAULT_GUARANTOR_RELATIONSHIP_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const optionLabels = options.map((o) => o.label);
  const raw = value.trim();
  const resolved = normalizeGuarantorRelationshipValue(value, optionLabels);
  let selectValue: string | undefined;
  if (!raw) {
    selectValue = undefined;
  } else if (optionLabels.includes(resolved)) {
    selectValue = resolved;
  } else if (optionLabels.includes(raw)) {
    selectValue = raw;
  } else {
    selectValue = raw;
  }

  const handleSelectChange = (v: string) => {
    if (v === EDIT_SENTINEL) {
      setManageOpen(true);
      return;
    }
    onChange(v);
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    if (options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      alert('This relationship is already in the list.');
      return;
    }
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const nextOrder =
          options.length > 0 ? Math.max(...options.map((o) => o.sort_order)) + 10 : 10;
        const { data, error } = await supabase
          .from('guarantor_relationship_options')
          .insert({ label, sort_order: nextOrder })
          .select('id,label,sort_order')
          .single();
        if (error) throw error;
        if (data) {
          setOptions((prev) => [...prev, data as GuarantorRelationshipOption].sort((a, b) => a.sort_order - b.sort_order));
        }
      } else {
        const synthetic: GuarantorRelationshipOption = {
          id: `local-${Date.now()}`,
          label,
          sort_order: options.length ? Math.max(...options.map((o) => o.sort_order)) + 10 : 10,
        };
        setOptions((prev) => [...prev, synthetic].sort((a, b) => a.sort_order - b.sort_order));
      }
      setNewLabel('');
      onChange(label);
    } catch (e: any) {
      alert(e?.message || 'Could not add relationship.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (opt: GuarantorRelationshipOption) => {
    if (!window.confirm(`Remove "${opt.label}" from the list? Existing student records keep their saved value.`)) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase && !opt.id.startsWith('default-') && !opt.id.startsWith('local-')) {
        const { error } = await supabase.from('guarantor_relationship_options').delete().eq('id', opt.id);
        if (error) throw error;
      }
      setOptions((prev) => prev.filter((o) => o.id !== opt.id));
      if (
        opt.label === value.trim() ||
        opt.label === resolved ||
        LEGACY_CODE_TO_LABEL[value.trim()] === opt.label
      ) {
        onChange('');
      }
    } catch (e: any) {
      alert(e?.message || 'Could not remove.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (opt: GuarantorRelationshipOption) => {
    setEditingId(opt.id);
    setEditingLabel(opt.label);
  };

  const handleSaveEdit = async (opt: GuarantorRelationshipOption) => {
    const next = editingLabel.trim();
    if (!next) return;
    if (options.some((o) => o.id !== opt.id && o.label.toLowerCase() === next.toLowerCase())) {
      alert('This relationship is already in the list.');
      return;
    }
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase && !opt.id.startsWith('default-') && !opt.id.startsWith('local-')) {
        const { error } = await supabase
          .from('guarantor_relationship_options')
          .update({ label: next })
          .eq('id', opt.id);
        if (error) throw error;
      }
      setOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, label: next } : o)));
      if (
        opt.label === value.trim() ||
        opt.label === resolved ||
        LEGACY_CODE_TO_LABEL[value.trim()] === opt.label
      ) {
        onChange(next);
      }
      setEditingId(null);
      setEditingLabel('');
    } catch (e: any) {
      alert(e?.message || 'Could not update relationship.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {id ? <Label htmlFor={id}>Guarantor relationship *</Label> : <Label>Guarantor relationship *</Label>}
        <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled || loading}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={loading ? 'Loading…' : 'Select relationship'} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
            {options.map((o) => (
              <SelectItem key={o.id} value={o.label}>
                {o.label}
              </SelectItem>
            ))}
            {raw && !optionLabels.includes(resolved) && !optionLabels.includes(raw) ? (
              <SelectItem value={raw}>{raw} (saved)</SelectItem>
            ) : null}
            <SelectSeparator />
            <SelectItem value={EDIT_SENTINEL} className="text-blue-700 font-medium cursor-pointer">
              Edit relationship types…
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Choose from the list. Scroll to the bottom and use Edit to add or remove types (saved to the database when online).</p>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Edit relationship types</DialogTitle>
            <DialogDescription>
              Add or remove options for the guarantor relationship dropdown. Changes apply when you add new students or edit existing ones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-guarantor-rel">New relationship</Label>
              <div className="flex gap-2">
                <Input
                  id="new-guarantor-rel"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder='e.g. Grandfather (祖父)'
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                />
                <Button type="button" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Current options</p>
              <ul className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    {editingId === o.id ? (
                      <>
                        <Input
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSaveEdit(o))}
                        />
                        <div className="flex items-center gap-1">
                          <Button type="button" size="sm" onClick={() => handleSaveEdit(o)} disabled={saving || !editingLabel.trim()}>
                            Save
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(null); setEditingLabel(''); }}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="truncate">{o.label}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-blue-700 hover:text-blue-800"
                            onClick={() => startEdit(o)}
                            disabled={saving}
                            aria-label={`Edit ${o.label}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-red-600 hover:text-red-700"
                            onClick={() => handleRemove(o)}
                            disabled={saving}
                            aria-label={`Remove ${o.label}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
