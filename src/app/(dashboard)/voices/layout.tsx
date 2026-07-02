import { VoicesLayout } from "@/feature/voices/views/voices-layout";
import React from "react";

export default function Layout({ children }:{ children: React.ReactNode }){
    return (
        <VoicesLayout>
            {children}
        </VoicesLayout>
    )
}