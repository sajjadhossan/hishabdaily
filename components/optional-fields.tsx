"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button, Input, useToast } from "./ui";

/**
 * লেনদেন ও নিয়মিত দুই ফর্মেই ব্যবহৃত ঐচ্ছিক তিনটি ঘর —
 * কোয়ান্টিটি, একক ও পরিবারের সদস্য। কিছুই না দিলেও সেভ হয়।
 * ইউনিট/সদস্যের পাশের "+" বাটন দিয়ে নতুন যোগ করা যায়।
 */
export function OptionalFields({
  quantity,
  unit,
  familyMember,
  onQuantity,
  onUnit,
  onFamilyMember,
}: {
  quantity: string;
  unit: string;
  familyMember: string;
  onQuantity: (value: string) => void;
  onUnit: (value: string) => void;
  onFamilyMember: (value: string) => void;
}) {
  const { settings, updateSettings } = useData();
  const toast = useToast();
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState("");

  async function addUnit() {
    const value = newUnit.trim();
    if (!value) {
      toast("ইউনিটের নাম দিন", "error");
      return;
    }
    if (settings.units.some((u) => u === value)) {
      toast("এই ইউনিট আগেই আছে", "error");
      return;
    }
    await updateSettings({ units: [...settings.units, value] });
    onUnit(value);
    setNewUnit("");
    setAddingUnit(false);
    toast("নতুন ইউনিট যোগ হয়েছে");
  }

  async function addMember() {
    const value = newMember.trim();
    if (!value) {
      toast("সদস্যের নাম দিন", "error");
      return;
    }
    if (settings.familyMembers.some((m) => m === value)) {
      toast("এই সদস্য আগেই আছে", "error");
      return;
    }
    await updateSettings({ familyMembers: [...settings.familyMembers, value] });
    onFamilyMember(value);
    setNewMember("");
    setAddingMember(false);
    toast("সদস্য যোগ হয়েছে");
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface-2/40 p-3.5">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink/80">কোয়ান্টিটি (ঐচ্ছিক)</p>
        <Input
          inputMode="decimal"
          value={quantity}
          onChange={(e) => onQuantity(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="যেমন: ২.৫ — না দিলেও সেভ হবে"
        />
      </div>

      <ChipPicker
        label="একক (ঐচ্ছিক)"
        hint="টাকা, কেজি, এমএল… + দিয়ে নতুন যোগ করুন"
        items={settings.units}
        value={unit}
        onSelect={(v) => onUnit(unit === v ? "" : v)}
        adding={addingUnit}
        onToggleAdd={() => setAddingUnit((v) => !v)}
        draft={newUnit}
        onDraft={setNewUnit}
        onAdd={addUnit}
        addLabel="নতুন ইউনিট"
        placeholder="যেমন: বক্স"
      />

      <ChipPicker
        label="কার জন্য খরচ (ঐচ্ছিক)"
        hint="পরিবারের সদস্য বাছুন, + দিয়ে নতুন যোগ করুন"
        items={settings.familyMembers}
        value={familyMember}
        onSelect={(v) => onFamilyMember(familyMember === v ? "" : v)}
        adding={addingMember}
        onToggleAdd={() => setAddingMember((v) => !v)}
        draft={newMember}
        onDraft={setNewMember}
        onAdd={addMember}
        addLabel="নতুন সদস্য"
        placeholder="যেমন: মা"
        emptyText="এখনো কোনো সদস্য যোগ করা হয়নি"
      />
    </div>
  );
}

function ChipPicker({
  label,
  hint,
  items,
  value,
  onSelect,
  adding,
  onToggleAdd,
  draft,
  onDraft,
  onAdd,
  addLabel,
  placeholder,
  emptyText,
}: {
  label: string;
  hint?: string;
  items: string[];
  value: string;
  onSelect: (value: string) => void;
  adding: boolean;
  onToggleAdd: () => void;
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  addLabel: string;
  placeholder: string;
  emptyText?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-ink/80">{label}</p>
      {hint ? <p className="mb-2 text-[11px] text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const selected = value === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition",
                selected
                  ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
              {item}
            </button>
          );
        })}
        {!items.length && emptyText ? (
          <span className="text-[11.5px] text-muted">{emptyText}</span>
        ) : null}
        <button
          type="button"
          onClick={onToggleAdd}
          aria-label={addLabel}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/50 px-2.5 py-1.5 text-[11.5px] font-bold text-brand transition hover:bg-brand-soft"
        >
          {adding ? <X className="size-3" /> : <Plus className="size-3" />}
          {adding ? "বাতিল" : addLabel}
        </button>
      </div>
      {adding ? (
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
          <Button size="sm" variant="soft" onClick={onAdd}>
            যোগ
          </Button>
        </div>
      ) : null}
    </div>
  );
}
