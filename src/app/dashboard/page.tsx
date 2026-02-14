"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Person = "me" | "partner";

type MoodRecord = {
  id: string;
  person: Person;
  date: string;
  score: number;
  note?: string;
};

const STORAGE_KEY = "lovelog:moods";

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCreatedAt(record: MoodRecord): number {
  const [prefix] = record.id.split("-");
  const timestamp = Number(prefix);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortMoods(records: MoodRecord[]): MoodRecord[] {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }

    return getCreatedAt(b) - getCreatedAt(a);
  });
}

function isValidRecord(item: unknown): item is MoodRecord {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<MoodRecord>;
  return (
    typeof candidate.id === "string" &&
    (candidate.person === "me" || candidate.person === "partner") &&
    typeof candidate.date === "string" &&
    typeof candidate.score === "number" &&
    candidate.score >= 1 &&
    candidate.score <= 5
  );
}

function loadMoods(): MoodRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortMoods(parsed.filter(isValidRecord));
  } catch {
    return [];
  }
}

function saveMoods(records: MoodRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function DashboardPage() {
  const [person, setPerson] = useState<Person>("me");
  const [date, setDate] = useState<string>(formatDateLocal(new Date()));
  const [score, setScore] = useState<number>(3);
  const [note, setNote] = useState<string>("");
  const [moods, setMoods] = useState<MoodRecord[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return loadMoods();
  });
  const [error, setError] = useState<string>("");

  const chartData = useMemo(() => {
    const today = new Date();
    const endDate = formatDateLocal(today);
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - 6);
    const startDate = formatDateLocal(startDateObj);

    const recent = moods.filter((item) => item.date >= startDate && item.date <= endDate);
    const labels = Array.from(new Set(recent.map((item) => item.date))).sort((a, b) => a.localeCompare(b));

    const meByDate = new Map<string, MoodRecord>();
    const partnerByDate = new Map<string, MoodRecord>();

    for (const item of recent) {
      const targetMap = item.person === "me" ? meByDate : partnerByDate;
      const current = targetMap.get(item.date);

      if (!current || getCreatedAt(item) > getCreatedAt(current)) {
        targetMap.set(item.date, item);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: "我",
          data: labels.map((label) => meByDate.get(label)?.score ?? null),
          borderColor: "#0f172a",
          backgroundColor: "rgba(15, 23, 42, 0.2)",
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: "TA",
          data: labels.map((label) => partnerByDate.get(label)?.score ?? null),
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.2)",
          tension: 0.25,
          spanGaps: true,
        },
      ],
    };
  }, [moods]);

  const recentMoods = useMemo(() => moods.slice(0, 10), [moods]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!date) {
      setError("日期不能为空");
      return;
    }

    if (score < 1 || score > 5) {
      setError("心情分数必须在 1 到 5 之间");
      return;
    }

    const nextRecord: MoodRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      person,
      date,
      score,
      note: note.trim() || undefined,
    };

    const nextMoods = sortMoods([nextRecord, ...moods]);
    setMoods(nextMoods);
    saveMoods(nextMoods);
    setError("");
    setNote("");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">心情记录</h1>
        <p className="text-slate-600">每天两分钟，记录你们的情绪轨迹。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">新增心情</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">记录对象</span>
                <select
                  value={person}
                  onChange={(event) => setPerson(event.target.value as Person)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  <option value="me">我</option>
                  <option value="partner">TA</option>
                </select>
              </label>

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
                <span className="text-sm font-medium text-slate-700">心情分数（1-5）</span>
                <select
                  required
                  value={score}
                  onChange={(event) => setScore(Number(event.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">一句话记录（可选）</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="例如：今天下班后一起散步，心情很好"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                保存心情
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">最近 10 条记录</h2>
            {recentMoods.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">还没有心情记录，先保存第一条吧。</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recentMoods.map((item) => (
                  <li key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p>
                      <span className="font-medium text-slate-900">{item.person === "me" ? "我" : "TA"}</span>
                      <span className="mx-2 text-slate-400">|</span>
                      <span>{item.date}</span>
                      <span className="mx-2 text-slate-400">|</span>
                      <span>分数 {item.score}</span>
                    </p>
                    {item.note ? <p className="mt-1 text-slate-600">{item.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">最近 7 天心情折线图</h2>
          <p className="mt-2 text-sm text-slate-600">按日期展示我和 TA 的心情分数趋势。</p>
          {chartData.labels.length === 0 ? (
            <p className="mt-6 text-sm text-slate-600">最近 7 天还没有可展示的数据。</p>
          ) : (
            <div className="mt-4 h-72">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      min: 1,
                      max: 5,
                      ticks: { stepSize: 1 },
                    },
                  },
                  plugins: {
                    legend: {
                      position: "top",
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
