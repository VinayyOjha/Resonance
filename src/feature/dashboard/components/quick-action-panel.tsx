"use client";
import { cn } from "@/lib/utils";
import { quickActions } from "../data/quick-action";
import { QuickActionsCard } from "./quick-action-card";
import { useSidebar } from "@/components/ui/sidebar";

export function QuickActionsPanel(){
    const { open } = useSidebar();

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
            <div
  className={cn(
    "grid grid-cols-1 gap-4 md:grid-cols-3",
    open ? "lg:grid-cols-2" : "lg:grid-cols-3"
  )}
>
                {quickActions.map((action) => (
                    <QuickActionsCard 
                        key={action.title}
                        title={action.title}
                        description={action.description}
                        gradient={action.gradient}
                        href={action.href}
                    />
                ))}
            </div>
        </div>
    )
}