"use client";

import { FormEvent, useState } from "react";

type Profile = {
  name: string;
  partnerName: string;
  anniversary: string;
};

const PROFILE_KEY = "lovelog:profile";
const API_KEY = "lovelog:apiKey";

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return { name: "", partnerName: "", anniversary: "" };
    }

    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      partnerName: typeof parsed.partnerName === "string" ? parsed.partnerName : "",
      anniversary: typeof parsed.anniversary === "string" ? parsed.anniversary : "",
    };
  } catch {
    return { name: "", partnerName: "", anniversary: "" };
  }
}

function loadApiKey(): string {
  return localStorage.getItem(API_KEY) ?? "";
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window === "undefined") {
      return { name: "", partnerName: "", anniversary: "" };
    }
    return loadProfile();
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return loadApiKey();
  });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(API_KEY, apiKey);
    setError("");
    setMessage("设置已保存到本地浏览器。");
  };

  const handleClear = () => {
    const confirmed = window.confirm("确定要清除本地所有 LoveLog 数据吗？");
    if (!confirmed) {
      return;
    }

    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("lovelog:")) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
    setProfile({ name: "", partnerName: "", anniversary: "" });
    setApiKey("");
    setError("");
    setMessage("本地数据已清除。");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">个人空间</h1>
        <p className="text-slate-600">你的信息只保存在本地浏览器中</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSave}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">你的昵称</span>
            <input
              type="text"
              value={profile.name}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">TA 的称呼</span>
            <input
              type="text"
              value={profile.partnerName}
              onChange={(event) => setProfile({ ...profile, partnerName: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">纪念日</span>
            <input
              type="date"
              value={profile.anniversary}
              onChange={(event) => setProfile({ ...profile, anniversary: event.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">大模型 API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500">仅保存在本地，不会上传（MVP）</p>
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              保存设置
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 transition-colors hover:bg-rose-100"
            >
              清除本地数据
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
