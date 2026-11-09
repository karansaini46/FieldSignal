"use client";

import React, { useState, useEffect } from "react";
import { ShellUserSession, SiteSummary } from "./types";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { MobileNav } from "./mobile-nav";
import { QuickJumpModal } from "./quick-jump-modal";

interface AppShellProps {
  children: React.ReactNode;
  session: ShellUserSession;
  sites: SiteSummary[];
  openTicketsCount?: number;
  criticalTicketsCount?: number;
}

export function AppShell({
  children,
  session,
  sites,
  openTicketsCount = 0,
  criticalTicketsCount = 0,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);

  // Global keyboard shortcut: Press "/" to trigger Quick Jump search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setQuickJumpOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 font-sans antialiased">
      {/* 1. Desktop & Tablet Responsive Sidebar */}
      <Sidebar
        session={session}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        openTicketsCount={openTicketsCount}
        criticalTicketsCount={criticalTicketsCount}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Operational Navigation */}
        <TopNav
          session={session}
          sites={sites}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenQuickJump={() => setQuickJumpOpen(true)}
        />

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* 3. Mobile Drawer & Bottom Thumb Navigation */}
      <MobileNav
        session={session}
        sites={sites}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        openTicketsCount={openTicketsCount}
      />

      {/* 4. Equipment Quick Jump Dialog */}
      <QuickJumpModal
        isOpen={quickJumpOpen}
        onClose={() => setQuickJumpOpen(false)}
        siteId={session.siteId}
      />
    </div>
  );
}
