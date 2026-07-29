"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

type SortableHeaderProps = {
  label: string;
  column: string;
  activeColumn: string;
  direction: SortDirection;
  onSort: (column: string) => void;
  align?: "left" | "right";
};

export default function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  align = "left",
}: SortableHeaderProps) {
  const isActive = activeColumn === column;
  const Icon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      className={align === "right" ? "text-right" : undefined}
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`inline-flex w-full items-center gap-1 whitespace-nowrap hover:text-brand-700 ${align === "right" ? "justify-end" : "justify-start"}`}
        onClick={() => onSort(column)}
        title={`Sắp xếp theo ${label}`}
      >
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-brand-600" : "text-gray-400"}`} />
      </button>
    </th>
  );
}
