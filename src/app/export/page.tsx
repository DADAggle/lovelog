"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type RangeMode = "1m" | "3m" | "custom";
type BookSize = "A5" | "A4" | "SQUARE";
type BookTheme = "fresh" | "minimal";
type PageType = "cover" | "summary" | "moments" | "chat" | "mood" | "back";

type MoodRecord = {
  id: string;
  person: "me" | "partner";
  date: string;
  score: number;
  note?: string;
};

type HappyRecord = {
  id: string;
  date: string;
  title: string;
  note?: string;
  photoDataUrl?: string;
  createdAt: number;
};

type ChatFight = { line: string; score: number };
type ChatGift = { line: string; tags: string[] };
type ChatSweet = { line: string };

type ChatEntry = {
  id: string;
  date: string;
  createdAt: number;
  rawText: string;
  extracted: {
    fights: ChatFight[];
    gifts: ChatGift[];
    sweet: ChatSweet[];
  };
};

type BookPage = {
  id: string;
  type: PageType;
  title: string;
  body: string;
  images: string[];
};

type Book = {
  id: string;
  createdAt: number;
  options: {
    range: {
      mode: RangeMode;
      startDate: string;
      endDate: string;
    };
    pagesCount: number;
    size: BookSize;
    theme: BookTheme;
  };
  pages: BookPage[];
};

const BOOK_DRAFT_KEY = "lovelog:book:draft";
const MOODS_KEY = "lovelog:moods";
const HAPPY_KEY = "lovelog:happy";
const CHAT_ENTRIES_KEY = "lovelog:chat:entries";
const CHAT_LEGACY_KEY = "lovelog:chat";
const API_KEY_STORAGE = "lovelog:apiKey";

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
}

function inDateRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function parseJsonArray<T>(key: string, validator: (item: unknown) => item is T): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(validator);
  } catch {
    return [];
  }
}

function isMoodRecord(item: unknown): item is MoodRecord {
  if (!item || typeof item !== "object") return false;
  const v = item as Partial<MoodRecord>;
  return (
    typeof v.id === "string" &&
    (v.person === "me" || v.person === "partner") &&
    typeof v.date === "string" &&
    typeof v.score === "number"
  );
}

function isHappyRecord(item: unknown): item is HappyRecord {
  if (!item || typeof item !== "object") return false;
  const v = item as Partial<HappyRecord>;
  return (
    typeof v.id === "string" &&
    typeof v.date === "string" &&
    typeof v.title === "string" &&
    typeof v.createdAt === "number"
  );
}

function isChatEntry(item: unknown): item is ChatEntry {
  if (!item || typeof item !== "object") return false;
  const v = item as Partial<ChatEntry>;
  return (
    typeof v.id === "string" &&
    typeof v.date === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.rawText === "string" &&
    !!v.extracted &&
    Array.isArray(v.extracted.fights) &&
    Array.isArray(v.extracted.gifts) &&
    Array.isArray(v.extracted.sweet)
  );
}

function normalizeLegacyChatEntry(item: unknown): ChatEntry | null {
  if (!item || typeof item !== "object") return null;
  const v = item as Record<string, unknown>;

  if (typeof v.date !== "string") return null;

  const fightsRaw = Array.isArray(v.fights)
    ? v.fights
    : Array.isArray((v.extracted as Record<string, unknown> | undefined)?.fights)
      ? ((v.extracted as Record<string, unknown>).fights as unknown[])
      : [];

  const giftsRaw = Array.isArray(v.gifts)
    ? v.gifts
    : Array.isArray((v.extracted as Record<string, unknown> | undefined)?.gifts)
      ? ((v.extracted as Record<string, unknown>).gifts as unknown[])
      : [];

  const sweetRaw = Array.isArray(v.sweet)
    ? v.sweet
    : Array.isArray((v.extracted as Record<string, unknown> | undefined)?.sweet)
      ? ((v.extracted as Record<string, unknown>).sweet as unknown[])
      : [];

  const fights: ChatFight[] = fightsRaw
    .map((x) => {
      if (typeof x === "string") return { line: x, score: 2 };
      if (x && typeof x === "object" && typeof (x as { line?: unknown }).line === "string") {
        return {
          line: (x as { line: string }).line,
          score: typeof (x as { score?: unknown }).score === "number" ? (x as { score: number }).score : 2,
        };
      }
      return null;
    })
    .filter((x): x is ChatFight => x !== null);

  const gifts: ChatGift[] = giftsRaw
    .map((x) => {
      if (typeof x === "string") return { line: x, tags: [] };
      if (x && typeof x === "object" && typeof (x as { line?: unknown }).line === "string") {
        return {
          line: (x as { line: string }).line,
          tags: Array.isArray((x as { tags?: unknown }).tags)
            ? ((x as { tags: unknown[] }).tags.filter((tag): tag is string => typeof tag === "string"))
            : [],
        };
      }
      return null;
    })
    .filter((x): x is ChatGift => x !== null);

  const sweet: ChatSweet[] = sweetRaw
    .map((x) => {
      if (typeof x === "string") return { line: x };
      if (x && typeof x === "object" && typeof (x as { line?: unknown }).line === "string") {
        return { line: (x as { line: string }).line };
      }
      return null;
    })
    .filter((x): x is ChatSweet => x !== null);

  return {
    id: typeof v.id === "string" ? v.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: v.date,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    rawText: typeof v.rawText === "string" ? v.rawText : "",
    extracted: { fights, gifts, sweet },
  };
}

function loadChatEntries(): ChatEntry[] {
  const current = parseJsonArray(CHAT_ENTRIES_KEY, isChatEntry);
  if (current.length > 0) {
    return current.sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const legacyRaw = localStorage.getItem(CHAT_LEGACY_KEY);
    if (!legacyRaw) {
      return [];
    }

    const parsed = JSON.parse(legacyRaw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeLegacyChatEntry(item))
      .filter((item): item is ChatEntry => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function chunkItems<T>(items: T[], parts: number): T[][] {
  if (parts <= 0) return [];
  const buckets: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((item, index) => {
    buckets[index % parts].push(item);
  });
  return buckets;
}

function getPageSizeStyle(size: BookSize): { width: string; minHeight: string } {
  if (size === "A4") return { width: "210mm", minHeight: "297mm" };
  if (size === "SQUARE") return { width: "210mm", minHeight: "210mm" };
  return { width: "148mm", minHeight: "210mm" };
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateLocal(today), [today]);

  const [rangeMode, setRangeMode] = useState<RangeMode>("1m");
  const [customStartDate, setCustomStartDate] = useState<string>(formatDateLocal(subtractMonths(today, 1)));
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);
  const [pagesCount, setPagesCount] = useState<number>(8);
  const [size, setSize] = useState<BookSize>("A5");
  const [theme, setTheme] = useState<BookTheme>("fresh");

  const [book, setBook] = useState<Book | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const range = useMemo(() => {
    if (rangeMode === "custom") {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    const startDate = rangeMode === "3m" ? formatDateLocal(subtractMonths(today, 3)) : formatDateLocal(subtractMonths(today, 1));
    return { startDate, endDate: todayStr };
  }, [customEndDate, customStartDate, rangeMode, today, todayStr]);

  const generateBook = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!range.startDate || !range.endDate) {
      setError("请选择完整日期范围");
      return;
    }

    if (range.startDate > range.endDate) {
      setError("起始日期不能晚于结束日期");
      return;
    }

    const moods = parseJsonArray(MOODS_KEY, isMoodRecord)
      .filter((item) => inDateRange(item.date, range.startDate, range.endDate))
      .sort((a, b) => b.date.localeCompare(a.date));

    const happy = parseJsonArray(HAPPY_KEY, isHappyRecord)
      .filter((item) => inDateRange(item.date, range.startDate, range.endDate))
      .sort((a, b) => b.createdAt - a.createdAt);

    const chats = loadChatEntries()
      .filter((item) => inDateRange(item.date, range.startDate, range.endDate))
      .sort((a, b) => b.createdAt - a.createdAt);

    const momentImages = happy.map((item) => item.photoDataUrl).filter((img): img is string => typeof img === "string");

    const distinctChatDays = new Set(chats.map((entry) => entry.date)).size;
    const moodMe = moods.filter((x) => x.person === "me").map((x) => x.score);
    const moodPartner = moods.filter((x) => x.person === "partner").map((x) => x.score);

    const avg = (nums: number[]) => {
      if (nums.length === 0) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const summaryBody = [
      `统计区间：${range.startDate} 至 ${range.endDate}`,
      `快乐一刻：${happy.length} 条`,
      `聊天上传天数：${distinctChatDays} 天`,
      `心情记录：${moods.length} 条`,
    ].join("\n");

    const moodBody = [
      `记录条数：${moods.length}`,
      `我 的平均分：${avg(moodMe).toFixed(1)}`,
      `TA 的平均分：${avg(moodPartner).toFixed(1)}`,
      "趋势图占位：后续可渲染真实折线图。",
    ].join("\n");

    const allFightLines = chats.flatMap((entry) => entry.extracted.fights.map((item) => `${entry.date}｜${item.line}`));
    const allGiftLines = chats.flatMap((entry) =>
      entry.extracted.gifts.map((item) => `${entry.date}｜${item.line}${item.tags.length ? `（${item.tags.join("/")}）` : ""}`),
    );
    const allSweetLines = chats.flatMap((entry) => entry.extracted.sweet.map((item) => `${entry.date}｜${item.line}`));

    const basePages: BookPage[] = [
      {
        id: `cover-${Date.now()}`,
        type: "cover",
        title: "我们的纪念册",
        body: `时间范围：${range.startDate} 至 ${range.endDate}`,
        images: [],
      },
      {
        id: `summary-${Date.now()}`,
        type: "summary",
        title: "这段日子的总览",
        body: summaryBody,
        images: [],
      },
      {
        id: `mood-${Date.now()}`,
        type: "mood",
        title: "心情轨迹",
        body: moodBody,
        images: [],
      },
      {
        id: `moments-${Date.now()}`,
        type: "moments",
        title: "快乐一刻精选",
        body: "本页将收录快乐一刻记录。",
        images: momentImages.slice(0, 1),
      },
      {
        id: `chat-${Date.now()}`,
        type: "chat",
        title: "对话摘要",
        body: [
          `算账本 Top：${allFightLines.slice(0, 3).join("；") || "暂无"}`,
          `礼物单 Top：${allGiftLines.slice(0, 3).join("；") || "暂无"}`,
          `高甜瞬间 Top：${allSweetLines.slice(0, 3).join("；") || "暂无"}`,
        ].join("\n"),
        images: [],
      },
      {
        id: `back-${Date.now()}`,
        type: "back",
        title: "封底",
        body: "愿每一次对话，都成为更靠近彼此的路。",
        images: [],
      },
    ];

    const extraCount = Math.max(0, pagesCount - basePages.length);
    const extraMoments = Math.ceil(extraCount * 0.5);
    const extraChat = Math.floor(extraCount * 0.3);
    const extraMood = extraCount - extraMoments - extraChat;

    const momentItems = happy.map((item) => `${item.date}｜${item.title}${item.note ? `：${item.note}` : ""}`);
    const momentChunks = chunkItems(momentItems, 1 + extraMoments);

    const momentsPages = momentChunks.map((chunk, idx) => ({
      id: `moments-extra-${Date.now()}-${idx}`,
      type: "moments" as const,
      title: idx === 0 ? "快乐一刻精选" : `快乐一刻精选（续 ${idx}）`,
      body: chunk.length ? chunk.map((line) => `- ${line}`).join("\n") : "暂无快乐一刻内容。",
      images: [momentImages[idx] ?? ""].filter(Boolean),
    }));

    const chatMixLines = [
      ...allFightLines.slice(0, 8),
      ...allGiftLines.slice(0, 8),
      ...allSweetLines.slice(0, 8),
    ];
    const chatChunks = chunkItems(chatMixLines, 1 + extraChat);

    const chatPages = chatChunks.map((chunk, idx) => ({
      id: `chat-extra-${Date.now()}-${idx}`,
      type: "chat" as const,
      title: idx === 0 ? "对话摘要" : `对话摘要（续 ${idx}）`,
      body: chunk.length ? chunk.map((line) => `- ${line}`).join("\n") : "暂无对话摘要。",
      images: [],
    }));

    const moodPages = Array.from({ length: 1 + extraMood }).map((_, idx) => ({
      id: `mood-extra-${Date.now()}-${idx}`,
      type: "mood" as const,
      title: idx === 0 ? "心情轨迹" : `心情轨迹（续 ${idx}）`,
      body: moodBody,
      images: [],
    }));

    const pages: BookPage[] = [
      basePages[0],
      basePages[1],
      ...moodPages,
      ...momentsPages,
      ...chatPages,
      basePages[5],
    ].slice(0, pagesCount);

    const nextBook: Book = {
      id: `book-${Date.now()}`,
      createdAt: Date.now(),
      options: {
        range: {
          mode: rangeMode,
          startDate: range.startDate,
          endDate: range.endDate,
        },
        pagesCount,
        size,
        theme,
      },
      pages,
    };

    setBook(nextBook);
    setMessage("初稿已生成，可继续编辑后保存或导出");
  };

  const movePage = (index: number, direction: -1 | 1) => {
    if (!book) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= book.pages.length) return;

    const pages = [...book.pages];
    const [target] = pages.splice(index, 1);
    pages.splice(nextIndex, 0, target);
    setBook({ ...book, pages });
  };

  const deletePage = (index: number) => {
    if (!book) return;
    const page = book.pages[index];
    if (page.type === "cover" || page.type === "back") return;

    const pages = book.pages.filter((_, idx) => idx !== index);
    setBook({ ...book, pages });
  };

  const updatePageField = (index: number, key: "title" | "body", value: string) => {
    if (!book) return;
    const pages = [...book.pages];
    pages[index] = { ...pages[index], [key]: value };
    setBook({ ...book, pages });
  };

  const updateMomentImage = (index: number, value: string) => {
    if (!book) return;
    const pages = [...book.pages];
    pages[index] = { ...pages[index], images: value ? [value] : [] };
    setBook({ ...book, pages });
  };

  const saveDraft = () => {
    if (!book) {
      setError("请先生成初稿");
      return;
    }

    localStorage.setItem(BOOK_DRAFT_KEY, JSON.stringify(book));
    setMessage("草稿已保存到本地");
  };

  const downloadJson = () => {
    if (!book) {
      setError("请先生成初稿");
      return;
    }

    downloadTextFile(`lovelog-book-${book.id}.json`, JSON.stringify(book, null, 2), "application/json");
  };

  const callAiLayout = async () => {
    if (!book) {
      setError("请先生成初稿");
      return;
    }

    const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? "";
    const response = await fetch("/api/ai/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, apiKey }),
    });

    const data = (await response.json()) as { message?: string };
    setMessage(data.message ?? "即将上线");
  };

  const callAiPostcard = async () => {
    if (!book) {
      setError("请先生成初稿");
      return;
    }

    const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? "";
    const response = await fetch("/api/ai/postcard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, apiKey }),
    });

    const data = (await response.json()) as { message?: string };
    setMessage(data.message ?? "即将上线");
  };

  const pageStyle = getPageSizeStyle(size);

  const availableMomentImages = useMemo(() => {
    return parseJsonArray(HAPPY_KEY, isHappyRecord)
      .map((item) => item.photoDataUrl)
      .filter((img): img is string => typeof img === "string");
  }, []);

  return (
    <section className="space-y-6">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          .print-page {
            margin: 0 auto 0 auto !important;
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            break-after: page;
          }
        }
      `}</style>

      <div className="space-y-2 no-print">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">我们的纪念册</h1>
        <p className="text-slate-600">把这一段日子，做成可以打印的礼物</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm no-print">
        <h2 className="text-lg font-semibold text-slate-900">生成参数</h2>

        <form className="mt-4 space-y-4" onSubmit={generateBook}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">选择范围</span>
              <select
                value={rangeMode}
                onChange={(event) => setRangeMode(event.target.value as RangeMode)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="1m">最近 1 个月</option>
                <option value="3m">最近 3 个月</option>
                <option value="custom">自定义起止日期</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">页数</span>
              <select
                value={pagesCount}
                onChange={(event) => setPagesCount(Number(event.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">纸张尺寸</span>
              <select
                value={size}
                onChange={(event) => setSize(event.target.value as BookSize)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="A5">A5</option>
                <option value="A4">A4</option>
                <option value="SQUARE">正方形（210mm）</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">模板</span>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as BookTheme)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="fresh">清新</option>
                <option value="minimal">极简</option>
              </select>
            </label>
          </div>

          {rangeMode === "custom" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">开始日期</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">结束日期</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              生成初稿
            </button>
            <button
              type="button"
              onClick={callAiLayout}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              AI生成排版（即将上线）
            </button>
            <button
              type="button"
              onClick={callAiPostcard}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              AI生成插图（即将上线）
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              保存草稿
            </button>
            <button
              type="button"
              onClick={downloadJson}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              下载 JSON 草稿
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              下载 PDF
            </button>
          </div>
        </form>
      </div>

      {book ? (
        <div className="grid gap-6 lg:grid-cols-2 no-print">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">页面列表（可编辑）</h2>
            <div className="mt-4 space-y-4">
              {book.pages.map((page, index) => (
                <div key={page.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      第 {index + 1} 页 · {page.type}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => movePage(index, -1)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(index, 1)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={page.type === "cover" || page.type === "back"}
                        onClick={() => deletePage(index)}
                        className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <label className="mt-3 block space-y-1">
                    <span className="text-xs text-slate-600">标题</span>
                    <input
                      type="text"
                      value={page.title}
                      onChange={(event) => updatePageField(index, "title", event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <label className="mt-2 block space-y-1">
                    <span className="text-xs text-slate-600">正文</span>
                    <textarea
                      rows={4}
                      value={page.body}
                      onChange={(event) => updatePageField(index, "body", event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  {page.type === "moments" ? (
                    <label className="mt-2 block space-y-1">
                      <span className="text-xs text-slate-600">替换图片</span>
                      <select
                        value={page.images[0] ?? ""}
                        onChange={(event) => updateMomentImage(index, event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="">不使用图片</option>
                        {availableMomentImages.map((img, imgIndex) => (
                          <option key={`${imgIndex}-${img.slice(0, 24)}`} value={img}>
                            图片 {imgIndex + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">册子预览</h2>
            <p className="mt-1 text-sm text-slate-600">下面为打印版内容预览。</p>
            <div className="mt-4 max-h-[70vh] space-y-4 overflow-auto bg-slate-100 p-4">
              {book.pages.map((page, idx) => (
                <article
                  key={page.id}
                  className={`mx-auto rounded-lg border p-6 shadow-sm ${theme === "fresh" ? "border-sky-100 bg-white" : "border-slate-300 bg-white"}`}
                  style={{ width: pageStyle.width, minHeight: pageStyle.minHeight }}
                >
                  <p className="text-xs text-slate-500">第 {idx + 1} 页</p>
                  <h3 className={`mt-2 text-2xl font-semibold ${theme === "fresh" ? "text-sky-700" : "text-slate-900"}`}>{page.title}</h3>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{page.body}</p>
                  {page.images[0] ? (
                    <Image
                      src={page.images[0]}
                      alt={page.title}
                      width={1200}
                      height={600}
                      unoptimized
                      className="mt-4 h-44 w-full rounded-md object-cover"
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {book ? (
        <div className="hidden print:block">
          {book.pages.map((page, idx) => (
            <article
              key={`${page.id}-print`}
              className="print-page bg-white p-6"
              style={{ width: pageStyle.width, minHeight: pageStyle.minHeight }}
            >
              <p style={{ fontSize: "10px", color: "#64748b" }}>第 {idx + 1} 页</p>
              <h3 style={{ marginTop: "8px", fontSize: "24px", fontWeight: 600 }}>{page.title}</h3>
              <p style={{ marginTop: "12px", whiteSpace: "pre-line", fontSize: "14px", lineHeight: 1.7 }}>{page.body}</p>
              {page.images[0] ? (
                <Image
                  src={page.images[0]}
                  alt={page.title}
                  width={1200}
                  height={600}
                  unoptimized
                  style={{ marginTop: "16px", width: "100%", maxHeight: "220px", objectFit: "cover" }}
                />
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
