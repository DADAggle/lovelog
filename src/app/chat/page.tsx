"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type FightItem = { line: string; score: number };
type GiftItem = { line: string; tags: string[] };
type SweetItem = { line: string };

type ChatEntry = {
  id: string;
  date: string;
  createdAt: number;
  rawText: string;
  extracted: {
    fights: FightItem[];
    gifts: GiftItem[];
    sweet: SweetItem[];
  };
};

type TabKey = "overview" | "fights" | "gifts" | "sweet";
type CategoryKey = "fights" | "gifts" | "sweet";

const STORAGE_KEY = "lovelog:chat:entries";

const GIFT_KEYWORDS = [
  "想要",
  "喜欢",
  "想买",
  "需要",
  "种草",
  "链接",
  "多少钱",
  "价格",
  "尺码",
  "颜色",
  "牌子",
  "购物车",
  "下单",
];

const FIGHT_KEYWORDS = [
  "烦",
  "受不了",
  "凭什么",
  "你总是",
  "每次都",
  "别再",
  "分手",
  "冷静",
  "吵",
  "讨厌",
  "滚",
  "拉黑",
];

const SWEET_KEYWORDS = ["爱你", "想你", "抱抱", "亲亲", "开心", "谢谢", "辛苦了", "晚安", "早安", "好想", "喜欢你"];

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortEntries(entries: ChatEntry[]): ChatEntry[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt);
}

function isValidChatEntry(item: unknown): item is ChatEntry {
  if (!item || typeof item !== "object") {
    return false;
  }

  const entry = item as Partial<ChatEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.rawText === "string" &&
    !!entry.extracted &&
    Array.isArray(entry.extracted.fights) &&
    Array.isArray(entry.extracted.gifts) &&
    Array.isArray(entry.extracted.sweet)
  );
}

function loadEntries(): ChatEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortEntries(parsed.filter(isValidChatEntry));
  } catch {
    return [];
  }
}

function saveEntries(entries: ChatEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function parseChatText(rawText: string): ChatEntry["extracted"] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fights: FightItem[] = [];
  const gifts: GiftItem[] = [];
  const sweet: SweetItem[] = [];

  for (const line of lines) {
    const giftTags = GIFT_KEYWORDS.filter((keyword) => line.includes(keyword));
    if (giftTags.length > 0) {
      gifts.push({ line, tags: giftTags });
    }

    let fightScore = 0;
    for (const keyword of FIGHT_KEYWORDS) {
      if (line.includes(keyword)) {
        fightScore += 1;
      }
    }
    if (/[？！?!]/.test(line)) {
      fightScore += 1;
    }
    if (line.includes("…") || line.includes("...")) {
      fightScore += 1;
    }
    if (fightScore >= 2) {
      fights.push({ line, score: fightScore });
    }

    if (SWEET_KEYWORDS.some((keyword) => line.includes(keyword))) {
      sweet.push({ line });
    }
  }

  return { fights, gifts, sweet };
}

function inDateRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export default function ChatPage() {
  const today = useMemo(() => new Date(), []);
  const todayStr = formatDateLocal(today);

  const [tab, setTab] = useState<TabKey>("overview");
  const [date, setDate] = useState<string>(todayStr);
  const [textInput, setTextInput] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [entries, setEntries] = useState<ChatEntry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return loadEntries();
  });

  const recent7Start = useMemo(() => {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() - 6);
    return formatDateLocal(dateObj);
  }, [today]);

  const recent30Start = useMemo(() => {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() - 29);
    return formatDateLocal(dateObj);
  }, [today]);

  const overview = useMemo(() => {
    const entries7 = entries.filter((entry) => inDateRange(entry.date, recent7Start, todayStr));
    const entries30 = entries.filter((entry) => inDateRange(entry.date, recent30Start, todayStr));
    const monthPrefix = todayStr.slice(0, 7);
    const monthEntries = entries.filter((entry) => entry.date.startsWith(monthPrefix));

    return {
      upload7: entries7.length,
      upload30: entries30.length,
      todayUploaded: entries.some((entry) => entry.date === todayStr),
      fightsCount: monthEntries.reduce((sum, entry) => sum + entry.extracted.fights.length, 0),
      giftsCount: monthEntries.reduce((sum, entry) => sum + entry.extracted.gifts.length, 0),
      sweetCount: monthEntries.reduce((sum, entry) => sum + entry.extracted.sweet.length, 0),
    };
  }, [entries, recent7Start, recent30Start, todayStr]);

  const fightGroups = useMemo(() => {
    const map = new Map<string, Array<FightItem & { entryId: string; itemIndex: number; createdAt: number }>>();

    for (const entry of entries) {
      entry.extracted.fights.forEach((item, itemIndex) => {
        const group = map.get(entry.date) ?? [];
        group.push({ ...item, entryId: entry.id, itemIndex, createdAt: entry.createdAt });
        map.set(entry.date, group);
      });
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([groupDate, items]) => [
        groupDate,
        [...items].sort((a, b) => b.createdAt - a.createdAt),
      ] as const);
  }, [entries]);

  const giftItems = useMemo(() => {
    const items: Array<GiftItem & { entryId: string; itemIndex: number; date: string; createdAt: number }> = [];

    for (const entry of entries) {
      entry.extracted.gifts.forEach((item, itemIndex) => {
        items.push({ ...item, entryId: entry.id, itemIndex, date: entry.date, createdAt: entry.createdAt });
      });
    }

    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [entries]);

  const sweetItems = useMemo(() => {
    const items: Array<SweetItem & { entryId: string; itemIndex: number; date: string; createdAt: number }> = [];

    for (const entry of entries) {
      entry.extracted.sweet.forEach((item, itemIndex) => {
        items.push({ ...item, entryId: entry.id, itemIndex, date: entry.date, createdAt: entry.createdAt });
      });
    }

    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [entries]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!date) {
      setError("日期不能为空");
      return;
    }

    let rawText = textInput.trim();

    if (file) {
      try {
        rawText = (await file.text()).trim();
      } catch {
        setError("读取文件失败，请重试");
        return;
      }
    }

    if (!rawText) {
      setError("请上传 txt 文件或粘贴聊天文本");
      return;
    }

    const entry: ChatEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      createdAt: Date.now(),
      rawText,
      extracted: parseChatText(rawText),
    };

    const nextEntries = sortEntries([...entries, entry]);
    setEntries(nextEntries);
    saveEntries(nextEntries);

    setError("");
    setMessage("聊天记录已上传并完成规则提取");
    setTextInput("");
    setFile(null);
  };

  const handleDeleteExtracted = (entryId: string, category: CategoryKey, itemIndex: number) => {
    const nextEntries = entries.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      return {
        ...entry,
        extracted: {
          ...entry.extracted,
          [category]: entry.extracted[category].filter((_, idx) => idx !== itemIndex),
        },
      };
    });

    setEntries(nextEntries);
    saveEntries(nextEntries);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("已复制到剪贴板");
    } catch {
      setMessage("复制失败，请手动复制");
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">恋爱生活观察室</h1>
        <p className="text-slate-600">沉淀每一次对话，让关系更懂自己。</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">每日聊天上传</h2>
        <form className="mt-4 space-y-4" onSubmit={handleImport}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">日期</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">上传 .txt 文件（优先）</span>
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={handleFileChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">粘贴聊天文本（无文件时使用）</span>
            <textarea
              rows={5}
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
              placeholder="每行一条聊天内容"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            上传并解析
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "总览" },
          { key: "fights", label: "算账本" },
          { key: "gifts", label: "礼物单" },
          { key: "sweet", label: "高甜瞬间" },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key as TabKey)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === item.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">最近 7 天上传条数</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{overview.upload7}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">最近 30 天上传条数</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{overview.upload30}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">今日上传状态</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{overview.todayUploaded ? "今日已上传" : "今日未上传"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">本月算账本句子数</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{overview.fightsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">本月礼物单句子数</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{overview.giftsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">本月高甜瞬间句子数</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{overview.sweetCount}</p>
          </div>
        </div>
      ) : null}

      {tab === "fights" ? (
        <div className="space-y-4">
          {fightGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">暂无算账本内容。</div>
          ) : (
            fightGroups.map(([groupDate, items]) => (
              <div key={groupDate} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">{groupDate}</h3>
                  <button
                    type="button"
                    onClick={() => window.alert("后续接入用户的模型密钥")}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    AI 生成争议点总结（即将上线）
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {items.map((item) => (
                    <article key={`${item.entryId}-${item.itemIndex}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">{groupDate}</p>
                      <p className="mt-2 text-sm text-slate-800">{item.line}</p>
                      <p className="mt-1 text-xs text-slate-500">冲突分数：{item.score}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteExtracted(item.entryId, "fights", item.itemIndex)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                        >
                          删除该条
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.line)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          复制
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "gifts" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => window.alert("后续接入用户的模型密钥")}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              AI 分析潜在礼物清单（即将上线）
            </button>
          </div>

          {giftItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">暂无礼物单内容。</div>
          ) : (
            <div className="space-y-3">
              {giftItems.map((item) => (
                <article key={`${item.entryId}-${item.itemIndex}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">{item.date}</p>
                  <p className="mt-2 text-sm text-slate-800">{item.line}</p>
                  <p className="mt-2 text-xs text-slate-500">标签：{item.tags.join(" / ")}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteExtracted(item.entryId, "gifts", item.itemIndex)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      删除该条
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.line)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      复制
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "sweet" ? (
        <div className="space-y-3">
          {sweetItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">暂无高甜瞬间内容。</div>
          ) : (
            sweetItems.map((item) => (
              <article key={`${item.entryId}-${item.itemIndex}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">{item.date}</p>
                <p className="mt-2 text-sm text-slate-800">{item.line}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteExtracted(item.entryId, "sweet", item.itemIndex)}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                  >
                    删除该条
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.line)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    复制
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
