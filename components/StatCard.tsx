import { cn } from "@/lib/utils";

export default function StatCard({
  label, value, hint, tone = "default", icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "border-gray-200",
    good: "border-emerald-200 bg-emerald-50/40",
    warn: "border-amber-200 bg-amber-50/40",
    bad: "border-red-200 bg-red-50/40",
  };
  return (
    <div className={cn("card p-4", tones[tone])}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
