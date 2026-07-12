export const STAFF_TIERS: Record<number, {
  name: string;
  color: string;
  subscription: "street_runner" | "neon_syndicate" | "apex_sovereign";
  dailyDc: number;
  weeklyDc: number;
  monthlyDc: number;
  permissions: string[];
}> = {
  1: {
    name: "Watcher",
    color: "#64748b",
    subscription: "street_runner",
    dailyDc: 500,
    weeklyDc: 3500,
    monthlyDc: 15000,
    permissions: ["view_reports", "view_players", "issue_chat_warning"],
  },
  2: {
    name: "Moderator",
    color: "#39d353",
    subscription: "street_runner",
    dailyDc: 1000,
    weeklyDc: 7000,
    monthlyDc: 30000,
    permissions: ["view_reports", "view_players", "issue_chat_warning", "mute_player", "resolve_chat_report", "ban_player"],
  },
  3: {
    name: "Enforcer",
    color: "#00d4ff",
    subscription: "neon_syndicate",
    dailyDc: 2500,
    weeklyDc: 17500,
    monthlyDc: 75000,
    permissions: ["view_reports", "view_players", "issue_chat_warning", "mute_player", "resolve_chat_report", "ban_player", "unban_player", "handle_appeal", "close_ticket"],
  },
  4: {
    name: "Commander",
    color: "#a855f7",
    subscription: "neon_syndicate",
    dailyDc: 5000,
    weeklyDc: 35000,
    monthlyDc: 150000,
    permissions: ["view_reports", "view_players", "issue_chat_warning", "mute_player", "resolve_chat_report", "ban_player", "unban_player", "handle_appeal", "close_ticket", "adjust_dc", "adjust_nc", "grant_subscription", "set_level", "grant_keys"],
  },
  5: {
    name: "Director",
    color: "#ff6b35",
    subscription: "apex_sovereign",
    dailyDc: 10000,
    weeklyDc: 70000,
    monthlyDc: 300000,
    permissions: ["view_reports", "view_players", "issue_chat_warning", "mute_player", "resolve_chat_report", "ban_player", "unban_player", "handle_appeal", "close_ticket", "adjust_dc", "adjust_nc", "grant_subscription", "set_level", "grant_keys", "set_role", "mass_grant", "view_all_logs"],
  },
};

export const STAFF_TASKS: Record<number, { id: string; label: string; target: number }[]> = {
  1: [
    { id: "reports_viewed",   label: "Review player reports",   target: 10 },
    { id: "chat_warnings",    label: "Issue chat warnings",      target: 5  },
  ],
  2: [
    { id: "bans_processed",   label: "Process player bans",      target: 5  },
    { id: "chat_resolved",    label: "Resolve chat reports",     target: 10 },
  ],
  3: [
    { id: "tickets_closed",   label: "Close support tickets",   target: 10 },
    { id: "appeals_handled",  label: "Handle ban appeals",       target: 5  },
  ],
  4: [
    { id: "resources_granted", label: "Grant resources to players", target: 10 },
    { id: "accounts_managed",  label: "Process account actions",    target: 5  },
  ],
  5: [
    { id: "incidents_reviewed",   label: "Review major incidents",     target: 5 },
    { id: "maintenance_complete", label: "Complete maintenance tasks", target: 3 },
  ],
};

export function getSubscriptionExpiry(months = 1): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}
