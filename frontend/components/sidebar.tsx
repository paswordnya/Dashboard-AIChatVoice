"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowUpCircle,
  IconActivity,
  IconChevronDown,
  IconClock,
  IconCpu,
  IconDatabase,
  IconDollar,
  IconGrid,
  IconHash,
  IconHelpCircle,
  IconLogo,
  IconMic,
  IconShuffle,
  IconSettings,
  IconSliders,
  IconSmartphone,
  IconTag,
  IconTrendingUp,
  IconUsers,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: (p: { className?: string }) => React.ReactElement };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [{ href: "/", label: "Overview", icon: IconGrid }],
  },
  {
    label: "Analytics",
    items: [
      { href: "/voice-analytics", label: "Voice Analytics", icon: IconMic },
      { href: "/voice-trace", label: "Voice Trace", icon: IconClock },
      { href: "/models", label: "Model Usage", icon: IconCpu },
      { href: "/router-analytics", label: "Router Analytics", icon: IconShuffle },
      { href: "/knowledge-source", label: "Knowledge Source", icon: IconDatabase },
      { href: "/categories", label: "Categories", icon: IconTag },
      { href: "/topics", label: "Topics", icon: IconHash },
      { href: "/cost-savings", label: "Cost Savings", icon: IconDollar },
      { href: "/feature-adoption", label: "Feature Adoption", icon: IconTrendingUp },
      { href: "/confidence-distribution", label: "Confidence", icon: IconActivity },
      { href: "/escalation-analytics", label: "Escalation", icon: IconArrowUpCircle },
      { href: "/knowledge-gap", label: "Knowledge Gap", icon: IconHelpCircle },
      { href: "/top-failed-questions", label: "Top Failed Questions", icon: IconAlertTriangle },
    ],
  },
  {
    label: "People",
    items: [{ href: "/users", label: "Users", icon: IconUsers }],
  },
  {
    label: "Configuration",
    items: [
      { href: "/models/manage", label: "Model Management", icon: IconCpu },
      { href: "/config", label: "Config", icon: IconSliders },
      { href: "/bot-config", label: "Settings", icon: IconSettings },
      { href: "/pip-mobile-app", label: "Pip Mobile App", icon: IconSmartphone },
    ],
  },
];

// Remembers which nav sections the user collapsed, across reloads — only
// this dashboard's own preference, never anything server-derived, so
// missing/unreadable storage (private browsing, quota) just falls back to
// everything expanded rather than breaking navigation.
const COLLAPSE_STORAGE_KEY = "pip-dashboard-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const activeGroupLabel = NAV_GROUPS.find((g) => g.items.some((item) => item.href === pathname))?.label;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {
      // malformed/inaccessible storage — just start fully expanded
    }
  }, []);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — collapse still works, just won't persist
      }
      return next;
    });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col border-r border-white/[0.06] bg-slate-950">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white">
          <IconLogo className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight text-white">pip Voice AI</div>
          <div className="truncate text-xs leading-tight text-slate-500">Analytics Dashboard</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => {
          // The section containing the current page always renders expanded
          // regardless of saved/toggled state — collapsing your own current
          // section would hide the page you're already on.
          const isOpen = group.label === activeGroupLabel || !collapsed[group.label];
          return (
            <div key={group.label || "root"}>
              {group.label && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between rounded-lg px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-400"
                >
                  <span>{group.label}</span>
                  <IconChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                          active
                            ? "border-indigo-500/30 bg-indigo-500/10 font-medium text-white"
                            : "border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-slate-100"
                        }`}
                      >
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-indigo-400" : "text-slate-500"}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
