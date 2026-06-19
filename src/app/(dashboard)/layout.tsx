import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/feature/dashboard/components/dashboard-sidebar";
import { cookies } from "next/headers"

export default async function DashboardLayout({ 
    children 
} : { 
    children : React.ReactNode
}) {
    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

    return (
        <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
            <DashboardSidebar />
            <SidebarInset className="min-h-0 min-w-0">
                <main className="flex flex-1 flex-col min-h-0">
                    { children }
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}