"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShellUserSession } from "./types";
import {
  User,
  LogOut,
  ChevronDown,
  Shield,
  Radio,
  UserCheck,
  RefreshCw,
  Building,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  session: ShellUserSession;
  className?: string;
}

const DEMO_PERSONAS = [
  {
    role: "TECHNICIAN" as const,
    name: "Rajesh Meena",
    phone: "+919876500002",
    siteName: "Bhadla Solar (50 MW)",
    title: "Field Lead Technician",
  },
  {
    role: "SUPERVISOR" as const,
    name: "Vikramaditya Rathore",
    phone: "+919876500001",
    siteName: "Bhadla Solar (50 MW)",
    title: "Plant Operations Supervisor",
  },
  {
    role: "ADMIN" as const,
    name: "Pooja Sharma",
    phone: "+919876500000",
    siteName: "Portfolio (All Sites)",
    title: "VP Operations & Head of O&M",
  },
];

export function UserMenu({ session, className }: UserMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitchPersona(phone: string, targetRole: string) {
    setSwitching(phone);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: phone,
          password: "password123",
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        // Direct to appropriate route based on target role
        if (targetRole === "TECHNICIAN") {
          router.push("/field");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      } else {
        alert("Failed to switch demo persona.");
      }
    } catch (err) {
      console.error("Persona switch error:", err);
    } finally {
      setSwitching(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  const roleStyles = {
    ADMIN: "bg-purple-50 text-purple-800 border-purple-200",
    SUPERVISOR: "bg-blue-50 text-blue-800 border-blue-200",
    TECHNICIAN: "bg-amber-50 text-amber-800 border-amber-200",
  }[session.role];

  const initials = session.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={menuRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-400 shadow-2xs"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-900 text-white font-mono text-[11px] font-semibold">
          {initials}
        </div>

        <div className="hidden sm:flex flex-col items-start leading-tight text-left">
          <span className="font-semibold text-xs text-neutral-900 line-clamp-1">
            {session.name}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
            <span
              className={cn(
                "inline-block px-1 py-0.2 rounded text-[9px] font-bold border",
                roleStyles
              )}
            >
              {session.role}
            </span>
          </span>
        </div>

        <ChevronDown className="h-3.5 w-3.5 text-neutral-400 ml-0.5 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 origin-top-right rounded-md border border-neutral-200 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50 text-xs">
          {/* Header Info */}
          <div className="px-2 py-2 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-900 text-sm">{session.name}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border",
                  roleStyles
                )}
              >
                {session.role}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{session.phone}</p>
            <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-600">
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3 text-neutral-400" />
                <span>{session.organizationName || "Sunrise Solar"}</span>
              </span>
              <span className="font-mono text-neutral-500 text-[10px]">
                {session.siteName || (session.role === "ADMIN" ? "All Sites" : "Assigned Site")}
              </span>
            </div>
          </div>

          {/* Quick Demo Persona Switcher */}
          <div className="py-2 border-b border-neutral-100">
            <div className="px-2 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Switch Demo Persona
              </span>
              <span className="text-[9px] font-mono text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                Demo Mode
              </span>
            </div>

            <div className="space-y-1 mt-1">
              {DEMO_PERSONAS.map((persona) => {
                const isActive = session.phone === persona.phone;
                const isCurrentSwitching = switching === persona.phone;
                return (
                  <button
                    key={persona.phone}
                    type="button"
                    disabled={isActive || switching !== null}
                    onClick={() => handleSwitchPersona(persona.phone, persona.role)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors",
                      isActive
                        ? "bg-neutral-100 text-neutral-900 font-semibold cursor-default"
                        : "hover:bg-neutral-50 text-neutral-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-200 text-neutral-700 text-[10px] font-mono font-bold">
                        {persona.role[0]}
                      </div>
                      <div>
                        <div className="text-xs flex items-center gap-1.5">
                          <span>{persona.name}</span>
                          <span className="text-[9px] font-mono text-neutral-400">
                            ({persona.role})
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500">{persona.title}</div>
                      </div>
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-neutral-900 shrink-0" />
                    ) : isCurrentSwitching ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-500 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out Action */}
          <div className="pt-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-rose-700 hover:bg-rose-50 transition-colors text-xs font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out of session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
