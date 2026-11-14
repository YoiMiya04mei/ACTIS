import React from "react";
import { Clock, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Ban } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, className = "", size = "md" }: StatusBadgeProps) {
  let badgeStyle = "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
  let icon = <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />;

  switch (status) {
    case "Antrian Aktivasi":
      badgeStyle = "bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      icon = <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />;
      break;
    case "In Progress":
      badgeStyle = "bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      icon = <PlayCircle className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />;
      break;
    case "Pending Issue":
      badgeStyle = "bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      icon = <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />;
      break;
    case "Completed":
      badgeStyle = "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />;
      break;
    case "Terminated":
      badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700";
      icon = <XCircle className="w-3.5 h-3.5 mr-1 text-slate-600 dark:text-slate-400" />;
      break;
    case "Cancelled":
    case "Dibatalkan":
      badgeStyle = "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      icon = <Ban className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />;
      break;
    default:
      badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";
      icon = <Clock className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />;
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
    lg: "px-3.5 py-1.5 text-sm font-semibold",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${badgeStyle} ${sizeClasses} ${className}`}
    >
      {icon}
      {status}
    </span>
  );
}

