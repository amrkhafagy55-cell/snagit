"use client";
import { createContext, useContext, type ReactNode } from "react";
import { STANDARD_CATEGORIES } from "@/lib/types";

type Categories = { labels: Record<string, string>; active: string[] };

const CategoryContext = createContext<Categories>({ labels: {}, active: [...STANDARD_CATEGORIES] });

/** Admin-managed defect categories for client components: labels in the UI language + the keys to offer. */
export function CategoryProvider({ labels, active, children }: Categories & { children: ReactNode }) {
  return <CategoryContext value={{ labels, active }}>{children}</CategoryContext>;
}

export function useCategories() {
  return useContext(CategoryContext);
}
