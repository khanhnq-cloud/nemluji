import { Inbox } from "lucide-react";

export default function EmptyState({ title = "Chưa có dữ liệu", hint }: { title?: string; hint?: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Inbox className="h-10 w-10 mx-auto mb-2 text-gray-300" />
      <div className="text-sm font-medium text-gray-600">{title}</div>
      {hint && <div className="text-xs mt-1">{hint}</div>}
    </div>
  );
}
