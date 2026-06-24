"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface GenerateButtonProps {
    size?: "default" | "sm";
    disabled: boolean;
    isSubmitting: boolean;
    onSubmit: () => void;
    className?: string;
}

export function GenerateButton({
    size,
    disabled,
    isSubmitting,
    onSubmit,
    className,
} : GenerateButtonProps){
    return (
        <Button 
            size={size}
            className={className}
            onClick={onSubmit}
            disabled={disabled}
        >
            {isSubmitting ? (
                <>
                    <Spinner className="size-3" />
                    Generating...
                </>
            ) : (
                "Generate speech"
            )}
        </Button>
    )
}