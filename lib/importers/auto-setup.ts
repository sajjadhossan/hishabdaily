import { canonicalPerson, isPersonName } from "./canonical";
import { compactForMatch, normalizeText } from "./normalize";
import type { ParsedRow } from "./types";

/* ─────────────────────────────────────────────────────────────
   ইম্পোর্টের সময় ফোল্ডার / খাত / পার্সন / অনুষ্ঠান শনাক্ত
   সবই "অনুমান + রিভিউ" — ব্যবহারকারী চেকবক্সে বাছাই করেন।
   ───────────────────────────────────────────────────────────── */

export interface FolderPlan {
  name: string;
  emoji: string;
  color: string;
  /** parentName থাকলে এটা সাব-ফোল্ডার হবে */
  parentName?: string;
  /** কোন কোন নতুন খাত এই ফোল্ডারের অধীনে যাবে */
  categories: string[];
  kind: "group" | "ceremony" | "explicit";
}

export interface AutoSetupPlan {
  categories: string[];
  folders: FolderPlan[];
  persons: string[];
  /** রো-আইডি → শনাক্ত করা পার্সন (লেনদেনে familyMember বসানোর জন্য) */
  personByRowId: Record<string, string>;
}

export interface AutoSetupExisting {
  categories: string[];
  folders: string[];
  familyMembers: string[];
  contacts: string[];
}

type GroupRule = { name: string; emoji: string; color: string; re: RegExp };

/** খাত → ফোল্ডার গ্রুপ (PDF-এ ফোল্ডার কলাম না থাকলে) */
const GROUP_RULES: GroupRule[] = [
  { name: "খাবার ও বাজার", emoji: "🛒", color: "#f97316", re: /bazaar|grocery|market|food|household|নিত্য|খাবার|বাজার|হোটেল|গৃহ|^গৃ$|নাস্তা/i },
  { name: "যাতায়াত", emoji: "🚌", color: "#3b82f6", re: /transport|ট্রান্সপোর্ট|যাতায়াত|^যা$|^ভ$|ভাড়া|ভাড়া|auto|bus|taxi|ট্যাক্সি|বাস/i },
  { name: "স্বাস্থ্য", emoji: "🏥", color: "#ef4444", re: /medical|medicine|চিকিৎসা|^িচ$|^চি$|স্বাস্থ্য|ওষুধ|doctor|ফার্মাসি/i },
  { name: "পোশাক", emoji: "👕", color: "#a855f7", re: /cloth|পোশাক|কাপড়|গার্মেন্ট/i },
  { name: "বিল ও ইউটিলিটি", emoji: "💡", color: "#eab308", re: /utilit|বিদ্যুৎ|ইউটিলিটি|water|পানি|মোবাইল|ইন্টারনেট/i },
  { name: "দান ও উপহার", emoji: "🎁", color: "#14b8a6", re: /gift|donat|দান|^দা$|উপহার|জাকাত|সদকা/i },
  { name: "ব্যক্তিগত যত্ন", emoji: "💇", color: "#ec4899", re: /personal|parsonal|পারসনাল|বিউটি|সাবান|শ্যাম্পু|^পা$/i },
  { name: "খেলাধুলা", emoji: "⚽", color: "#22c55e", re: /sport|খেলা/i },
  { name: "অন্যান্য", emoji: "📦", color: "#64748b", re: /other|^অ$|^ই$|অন্য/i },
];

const CEREMONY_RULES: GroupRule[] = [
  { name: "ঈদ", emoji: "🕌", color: "#059669", re: /ঈদ|eid/i },
  { name: "বিয়ে ও দাওয়াত", emoji: "💍", color: "#d946ef", re: /বিয়ে|বিয়ে|দাওয়াত|দাওয়াত|wedding|marriage/i },
  { name: "বার্ষিকী", emoji: "🎂", color: "#f43f5e", re: /বার্ষিকী|anniversary/i },
  { name: "জন্মদিন", emoji: "🎂", color: "#fb923c", re: /জন্ম\s*দিন|জন্মদিন|birthday/i },
  { name: "ধর্মীয় অনুষ্ঠান", emoji: "🕊️", color: "#0ea5e9", re: /কোরবানি|কোরবানী|মিলাদ|আকিকা|খতম|হজ্জ|ওমরা|পুজা|পুজো|ধর্ম/i },
];

/** শুধু সম্পর্ক-শব্দ — নির্দিষ্ট নাম আগে থেকে অনুমান করি না */
const RELATIONS = [
  "মা", "পাপা", "বাবা", "মমি", "ভাই", "বোন", "কাকি", "চাচা", "খালা",
  "নানু", "নানা", "দাদা", "দাদি", "জামাই", "বউ", "বৌ",
];

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ফোল্ডার/সাব-ফোল্ডার কলাম থাকলে বের করি।
 * যেমন: "ফোল্ডার: বাড়ি | সাব ফোল্ডার: মেরামত | …"
 */
function extractPath(raw: string): { parent?: string; child?: string } {
  const t = normalizeText(raw);
  const clean = (v?: string | null) => {
    if (!v) return undefined;
    const name = v.replace(/[|৳]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    return name.length >= 2 && !/^\d+$/.test(name) ? name : undefined;
  };
  const subRe = /(?:সাব\s*ফোল্ডার|sub\s*folder|subfolder)\s*[:=|]\s*([^|]+)/gi;
  const child = clean(subRe.exec(t)?.[1]);
  // "সাব ফোল্ডার"-এর ভেতরের "ফোল্ডার" শব্দটিকে বাবা হিসেবে ধরি না
  const withoutSub = t.replace(subRe, " ");
  const parent = clean(withoutSub.match(/(?:ফোল্ডার|folder)\s*[:=|]\s*([^|]+)/i)?.[1]);
  // একই নাম বাবা আর ছেলে হতে পারে না
  if (child && parent && child.toLowerCase() === parent.toLowerCase()) return { parent };
  return child ? { parent, child } : parent ? { parent } : {};
}

function detectPersons(text: string, known: string[]): string[] {
  const found = new Set<string>();
  const normalized = normalizeText(text);
  const compact = compactForMatch(text);
  for (const name of [...known, ...RELATIONS]) {
    if (name.length < 2) continue;
    const escaped = escapeRe(name);
    const boundary = new RegExp(`(?:^|[\\s|])${escaped}(?=[\\s|]|$)`, "i");
    if (boundary.test(normalized)) found.add(name);
    else if (name.length >= 3 && compact.includes(compactForMatch(name))) found.add(name);
  }
  return [...found];
}

function matches(rule: GroupRule, text: string, compact: string): boolean {
  return rule.re.test(text) || rule.re.test(compact);
}

export function analyzeAutoSetup(
  rows: ParsedRow[],
  existing: AutoSetupExisting,
): AutoSetupPlan {
  const existingCats = new Set(existing.categories.map((c) => c.toLowerCase()));
  const existingFolders = new Set(existing.folders.map((f) => f.toLowerCase()));
  // families only — কন্টাক্টের নাম familyMember হিসেবে বসানো যাবে না
  const knownPersons = [...existing.familyMembers];
  const knownLower = new Set(knownPersons.map((p) => p.trim().toLowerCase()));

  const newCategoryNames = [
    ...new Set(rows.map((r) => r.category.trim()).filter((c) => c && !existingCats.has(c.toLowerCase()))),
  ];

  // ১) খাত → গ্রুপ ফোল্ডার
  const folderMap = new Map<string, FolderPlan>();
  const addFolder = (plan: FolderPlan) => {
    const key = `${plan.parentName || ""}›${plan.name}`.toLowerCase();
    if (!existingFolders.has(plan.name.toLowerCase()) && !folderMap.has(key)) folderMap.set(key, plan);
  };
  for (const category of newCategoryNames) {
    const compact = compactForMatch(category);
    const rule = GROUP_RULES.find((r) => matches(r, category, compact)) ?? GROUP_RULES[GROUP_RULES.length - 1];
    const key = `›${rule.name}`.toLowerCase();
    const plan = folderMap.get(key) ?? { name: rule.name, emoji: rule.emoji, color: rule.color, categories: [], kind: "group" as const };
    if (!plan.categories.includes(category)) plan.categories.push(category);
    folderMap.set(key, plan);
  }

  // ২) JSON/Excel-এর ফোল্ডার/সাব-ফোল্ডার কলাম, নাহলে raw টেক্সট থেকে পাথ
  for (const row of rows) {
    let parent = row.folder?.trim() || "";
    let child = row.subFolder?.trim() || "";
    if (!parent && !child) {
      const fromRaw = extractPath(row.raw);
      parent = fromRaw.parent || "";
      child = fromRaw.child || "";
    }
    if (child && parent && child.toLowerCase() === parent.toLowerCase()) child = "";
    if (parent) addFolder({ name: parent, emoji: "📁", color: "#0C906A", categories: [], kind: "explicit" });
    if (child) {
      addFolder({
        name: child,
        emoji: "📂",
        color: "#0C906A",
        parentName: parent || undefined,
        categories: newCategoryNames.includes(row.category) ? [row.category] : [],
        kind: "explicit",
      });
    }
  }

  // ৩) বিয়ে/বার্ষিকী/ঈদ জাতীয় অনুষ্ঠান
  const ceremonyHits = new Map<string, number>();
  const personByRowId: Record<string, string> = {};
  const personSet = new Set<string>();
  for (const row of rows) {
    const text = `${row.description} ${row.raw}`;
    const compact = compactForMatch(text);
    for (const rule of CEREMONY_RULES) {
      if (matches(rule, text, compact)) ceremonyHits.set(rule.name, (ceremonyHits.get(rule.name) || 0) + 1);
    }
    // JSON/Excel-এর familyMember/Person কলাম সবচেয়ে নির্ভরযোগ্য
    const explicit = row.person ? canonicalPerson(row.person) : "";
    const detected = detectPersons(row.description, knownPersons);
    const chosen = explicit && isPersonName(explicit) ? explicit : detected[0];
    if (chosen) {
      personByRowId[row.id] = chosen;
      personSet.add(chosen);
    }
  }
  for (const rule of CEREMONY_RULES) {
    if (!ceremonyHits.has(rule.name)) continue;
    const plan = folderMap.get(`›${rule.name}`.toLowerCase());
    if (plan) {
      plan.kind = "ceremony";
      continue;
    }
    addFolder({ name: rule.name, emoji: rule.emoji, color: rule.color, categories: [], kind: "ceremony" });
  }

  return {
    categories: newCategoryNames,
    folders: [...folderMap.values()],
    persons: [...personSet].filter((p) => !knownLower.has(p.trim().toLowerCase())),
    personByRowId,
  };
}
