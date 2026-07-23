"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Show text wordmark next to the logo icon */
  showText?: boolean;
  /** Custom badge text or subtitle */
  subtitle?: string;
  /** Additional custom class for outer container */
  className?: string;
  /** Custom class for icon container */
  iconClassName?: string;
  /** Custom class for text wordmark */
  textClassName?: string;
  /** Whether logo links to home page */
  href?: string | null;
  /** Optional interactive hover scale effect */
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = "md",
  showText = true,
  subtitle,
  className = "",
  iconClassName = "",
  textClassName = "",
  href = "/",
  animated = true,
}) => {
  // Sizing mappings
  const dimensions = {
    sm: { box: "w-7 h-7 rounded-lg", icon: 16, text: "text-xs font-semibold" },
    md: { box: "w-9 h-9 rounded-xl", icon: 20, text: "text-sm font-semibold" },
    lg: { box: "w-12 h-12 rounded-2xl", icon: 28, text: "text-base font-bold" },
    xl: { box: "w-16 h-16 rounded-2xl", icon: 38, text: "text-xl font-extrabold" },
  }[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 group select-none",
        animated && "transition-transform duration-200 hover:scale-[1.02]",
        className
      )}
    >
      {/* Icon emblem container with subtle glow */}
      <div
        className={cn(
          "relative flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-glow-sm transition-all duration-300 group-hover:shadow-glow",
          dimensions.box,
          iconClassName
        )}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
          style={{ width: "80%", height: "80%" }}
        >
          {/* Document Base */}
          <path
            d="M 136 112 C 136 100.954 144.954 92 156 92 H 290 L 376 178 V 390 C 376 401.046 367.046 410 356 410 H 156 C 144.954 410 136 401.046 136 390 V 112 Z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Folded Corner */}
          <path
            d="M 290 92 V 162 C 290 170.837 297.163 178 306 178 H 376 Z"
            fill="#E5E7EB"
          />
          {/* Document Content Lines */}
          <rect x="176" y="210" width="160" height="14" rx="7" fill="#6366F1" />
          <rect x="176" y="244" width="120" height="12" rx="6" fill="#9CA3AF" fillOpacity="0.7" />
          <rect x="176" y="272" width="140" height="12" rx="6" fill="#D1D5DB" fillOpacity="0.8" />
          <rect x="176" y="310" width="160" height="14" rx="7" fill="#8B5CF6" />
          <rect x="176" y="344" width="110" height="12" rx="6" fill="#9CA3AF" fillOpacity="0.7" />

          {/* AI Sparkle Icon */}
          <path
            d="M 370 70 Q 370 110 410 110 Q 370 110 370 150 Q 370 110 330 110 Q 370 110 370 70 Z"
            fill="#06B6D4"
          />
        </svg>
      </div>

      {/* Wordmark Text */}
      {showText && (
        <div className="flex flex-col">
          <div className={cn("flex items-center gap-1.5 leading-none", textClassName)}>
            <span className="tracking-tight font-bold text-foreground">
              AI <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">CV</span> Builder
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] font-medium text-muted-foreground tracking-normal mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="AI CV Builder - Home">
        {content}
      </Link>
    );
  }

  return content;
};
