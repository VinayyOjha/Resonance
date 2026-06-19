import { PageHeader } from "@/components/page-header";
import { HeroPattern } from "../components/hero-pattern";
import { DashboardHeader } from "../components/dashboard-header";

export function DashboardView(){
    return (
        <div className="relative">
            <PageHeader className="lg:hidden" title="Dashboard" />
            <HeroPattern />

            <div className="relative space-y-8 p-4 lg:p-16">
                <DashboardHeader />
            </div>
        </div>
    )
}