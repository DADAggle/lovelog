"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type HappyRecord = {
  id: string;
  date: string;
  title: string;
  note?: string;
  photoDataUrl?: string;
  createdAt: number;
};

const STORAGE_KEY = "lovelog:happy";
const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidRecord(item: unknown): item is HappyRecord {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<HappyRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "number"
  );
}

function sortRecords(records: HappyRecord[]): HappyRecord[] {
  return [...records].sort((a, b) => b.createdAt - a.createdAt);
}

function loadRecords(): HappyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortRecords(parsed.filter(isValidRecord));
  } catch {
    return [];
  }
}

function saveRecords(records: HappyRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export default function HappyPage() {
  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState<string>(formatDateLocal(today));
  const [title, setTitle] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [records, setRecords] = useState<HappyRecord[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return loadRecords();
  });

  const monthYearLabel = `${today.getFullYear()} 年 ${String(today.getMonth() + 1).padStart(2, "0")} 月`;
  const monthPrefix = formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)).slice(0, 7);

  const monthlyRecords = useMemo(
    () => records.filter((item) => item.date.startsWith(monthPrefix)),
    [monthPrefix, records],
  );

  const recordCountByDate = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of monthlyRecords) {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    }

    return map;
  }, [monthlyRecords]);

  const selectedDateRecords = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return sortRecords(records.filter((item) => item.date === selectedDate));
  }, [records, selectedDate]);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const mondayBasedOffset = (monthStart.getDay() + 6) % 7;

  const calendarCells = useMemo(() => {
    const cells: Array<{ date: string | null; day: number | null }> = [];

    for (let i = 0; i < mondayBasedOffset; i += 1) {
      cells.push({ date: null, day: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayDate = formatDateLocal(new Date(today.getFullYear(), today.getMonth(), day));
      cells.push({ date: dayDate, day });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, day: null });
    }

    return cells;
  }, [daysInMonth, mondayBasedOffset, today]);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPhotoFile(event.target.files?.[0] ?? null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!date) {
      setError("日期不能为空");
      return;
    }

    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }

    let photoDataUrl: string | undefined;

    if (photoFile) {
      try {
        photoDataUrl = await fileToDataUrl(photoFile);
      } catch {
        setError("图片读取失败，请重新选择");
        return;
      }
    }

    const nextRecord: HappyRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      title: title.trim(),
      note: note.trim() || undefined,
      photoDataUrl,
      createdAt: Date.now(),
    };

    const nextRecords = sortRecords([nextRecord, ...records]);
    setRecords(nextRecords);
    saveRecords(nextRecords);

    setTitle("");
    setNote("");
    setPhotoFile(null);
    setError("");
  };

  const handleDelete = (id: string) => {
    const nextRecords = records.filter((item) => item.id !== id);
    setRecords(nextRecords);
    saveRecords(nextRecords);

    if (selectedDate) {
      const hasMore = nextRecords.some((item) => item.date === selectedDate);
      if (!hasMore) {
        setSelectedDate(null);
      }
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">快乐一刻</h1>
        <p className="text-slate-600">随手记录今天的小确幸</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">新增记录</h2>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">日期</span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">标题</span>
              <input
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：下班路上看到超美晚霞"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">内容（可选）</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="记录一下当时的感受"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">照片（可选）</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              保存快乐一刻
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">最近一个月日历</h2>
          <p className="mt-1 text-sm text-slate-600">{monthYearLabel}</p>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
            {WEEK_DAYS.map((dayLabel) => (
              <div key={dayLabel}>{dayLabel}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return <div key={`empty-${index}`} className="h-16 rounded-md bg-slate-50" />;
              }

              const count = recordCountByDate.get(cell.date) ?? 0;
              const hasRecord = count > 0;

              return (
                <button
                  type="button"
                  key={cell.date}
                  onClick={() => hasRecord && setSelectedDate(cell.date)}
                  className={`relative h-16 rounded-md border text-sm transition-colors ${
                    hasRecord
                      ? "cursor-pointer border-slate-300 bg-white text-slate-900 hover:border-sky-400"
                      : "cursor-default border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <span>{cell.day}</span>
                  {hasRecord ? <span className="absolute bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-sky-500" /> : null}
                </button>
              );
            })}
          </div>

          {monthlyRecords.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">这个月还没有快乐一刻，快写下今天的小确幸吧～</p>
          ) : null}
        </div>
      </div>

      {selectedDate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{selectedDate} 的快乐一刻</h3>
                <p className="mt-1 text-sm text-slate-600">共 {selectedDateRecords.length} 条记录</p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setSelectedDate(null)}
                className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {selectedDateRecords.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
                  {item.note ? <p className="mt-2 text-sm text-slate-700">{item.note}</p> : null}
                  {item.photoDataUrl ? (
                    <Image
                      src={item.photoDataUrl}
                      alt={item.title}
                      width={800}
                      height={288}
                      unoptimized
                      className="mt-3 h-36 w-full rounded-md border border-slate-200 object-cover"
                    />
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      删除
                    </button>
                    <button
                      type="button"
                      onClick={() => window.alert("敬请期待")}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      编辑
                    </button>
                  </div>

                  <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-3">
                    <h5 className="text-sm font-semibold text-slate-900">AI 明信片（占位）</h5>
                    <p className="mt-2 text-sm text-slate-700">AI 文案：（后续接入大模型自动润色）</p>
                    <div className="mt-2 h-24 rounded-md bg-slate-200" />
                    <p className="mt-2 text-xs text-slate-500">图片：占位图（后续接入生图或照片风格化）</p>
                    <button
                      type="button"
                      className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                    >
                      生成明信片（即将上线）
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
