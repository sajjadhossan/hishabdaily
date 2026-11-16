"use client";

import { useEffect, useState } from "react";
import { useData } from "@/lib/data";
import type { Contact } from "@/lib/types";
import { Button, Field, Input, Modal, Textarea, useToast } from "./ui";

export function ContactFormModal({
  open,
  onClose,
  editing,
  initialName,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Contact | null;
  initialName?: string;
}) {
  const { addContact, updateContact } = useData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || initialName || "");
    setPhone(editing?.phone || "");
    setNote(editing?.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  async function submit() {
    if (!name.trim()) {
      toast("নাম দিন", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateContact(editing.id, { name: name.trim(), phone: phone.trim(), note: note.trim() });
        toast("তথ্য আপডেট হয়েছে");
      } else {
        await addContact({ name: name.trim(), phone: phone.trim(), note: note.trim() });
        toast("নতুন ব্যক্তি যোগ হয়েছে");
      }
      onClose();
    } catch (err) {
      toast((err as Error).message || "সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "তথ্য সম্পাদনা" : "নতুন ব্যক্তি"}
      subtitle="যার সাথে দেনা-পাওনার হিসাব আছে"
      footer={
        <Button block size="lg" loading={saving} onClick={submit}>
          {editing ? "আপডেট করুন" : "যোগ করুন"}
        </Button>
      }
    >
      <div className="space-y-3.5">
        <Field label="নাম">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="যেমন: রফিক ভাই"
          />
        </Field>
        <Field label="মোবাইল নম্বর (ঐচ্ছিক)">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            inputMode="tel"
          />
        </Field>
        <Field label="নোট (ঐচ্ছিক)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="সম্পর্ক বা বিস্তারিত কিছু"
            className="min-h-[70px]"
          />
        </Field>
      </div>
    </Modal>
  );
}
