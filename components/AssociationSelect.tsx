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
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type AssociationOption = { id: string; label: string; sort_order: number };
const EDIT_SENTINEL = '__edit_association_options__';

export const DEFAULT_ASSOCIATION_OPTIONS: AssociationOption[] = [
  { id: 'default-selangor', label: 'Selangor Hainan Association', sort_order: 10 },
  { id: 'default-kuala-lumpur', label: 'Kuala Lumpur Hainan Association', sort_order: 20 },
  { id: 'default-perak', label: 'Perak Hainan Association', sort_order: 30 },
];

interface AssociationSelectProps {
  value: string;
  onChange: (label: string) => void;
  id?: string;
  disabled?: boolean;
}

export function AssociationSelect({ value, onChange, id, disabled }: AssociationSelectProps) {
  const [options, setOptions] = useState<AssociationOption[]>(DEFAULT_ASSOCIATION_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const loadOptions = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setOptions(DEFAULT_ASSOCIATION_OPTIONS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('association_options')
        .select('id,label,sort_order')
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true });
      if (!error && data?.length) setOptions(data as AssociationOption[]);
      else setOptions(DEFAULT_ASSOCIATION_OPTIONS);
    } catch {
      setOptions(DEFAULT_ASSOCIATION_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const optionLabels = options.map((o) => o.label);
  const raw = value.trim();
  const selectValue = raw ? raw : undefined;

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
      alert('This association already exists in the list.');
      return;
    }
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const nextOrder = options.length > 0 ? Math.max(...options.map((o) => o.sort_order)) + 10 : 10;
        const { data, error } = await supabase
          .from('association_options')
          .insert({ label, sort_order: nextOrder })
          .select('id,label,sort_order')
          .single();
        if (error) throw error;
        if (data) {
          setOptions((prev) => [...prev, data as AssociationOption].sort((a, b) => a.sort_order - b.sort_order));
        }
      } else {
        const synthetic: AssociationOption = {
          id: `local-${Date.now()}`,
          label,
          sort_order: options.length > 0 ? Math.max(...options.map((o) => o.sort_order)) + 10 : 10,
        };
        setOptions((prev) => [...prev, synthetic].sort((a, b) => a.sort_order - b.sort_order));
      }
      setNewLabel('');
      onChange(label);
    } catch (e: any) {
      alert(e?.message || 'Could not add association.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (opt: AssociationOption) => {
    if (!window.confirm(`Remove "${opt.label}" from the list? Existing student records keep their saved value.`)) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase && !opt.id.startsWith('default-') && !opt.id.startsWith('local-')) {
        const { error } = await supabase.from('association_options').delete().eq('id', opt.id);
        if (error) throw error;
      }
      setOptions((prev) => prev.filter((o) => o.id !== opt.id));
      if (value.trim() === opt.label) onChange('');
    } catch (e: any) {
      alert(e?.message || 'Could not remove association.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (opt: AssociationOption) => {
    setEditingId(opt.id);
    setEditingLabel(opt.label);
  };

  const handleSaveEdit = async (opt: AssociationOption) => {
    const next = editingLabel.trim();
    if (!next) return;
    if (
      options.some((o) => o.id !== opt.id && o.label.toLowerCase() === next.toLowerCase())
    ) {
      alert('This association already exists in the list.');
      return;
    }
    setSaving(true);
    try {
      if (isSupabaseConfigured() && supabase && !opt.id.startsWith('default-') && !opt.id.startsWith('local-')) {
        const { error } = await supabase
          .from('association_options')
          .update({ label: next })
          .eq('id', opt.id);
        if (error) throw error;
      }
      setOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, label: next } : o)));
      if (value.trim() === opt.label) onChange(next);
      setEditingId(null);
      setEditingLabel('');
    } catch (e: any) {
      alert(e?.message || 'Could not update association.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {id ? <Label htmlFor={id}>Association *</Label> : <Label>Association *</Label>}
        <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled || loading}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={loading ? 'Loading…' : 'Select association'} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(24rem,70vh)]">
            {options.map((o) => (
              <SelectItem key={o.id} value={o.label}>
                {o.label}
              </SelectItem>
            ))}
            {raw && !optionLabels.includes(raw) ? <SelectItem value={raw}>{raw} (saved)</SelectItem> : null}
            <SelectSeparator />
            <SelectItem value={EDIT_SENTINEL} className="text-blue-700 font-medium cursor-pointer">
              Edit associations…
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Edit associations</DialogTitle>
            <DialogDescription>
              Add or remove dropdown options for student association.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-association-option">New association</Label>
              <div className="flex gap-2">
                <Input
                  id="new-association-option"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Penang Hainan Association"
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
