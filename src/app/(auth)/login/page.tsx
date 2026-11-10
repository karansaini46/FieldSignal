"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Sun, Lock, Phone, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("+919876500002");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    {
      role: "TECHNICIAN",
      name: "Rajesh Meena",
      phone: "+919876500002",
      site: "Bhadla Solar (50 MW)",
      org: "Sunrise Solar",
      badgeVariant: "secondary" as const,
    },
    {
      role: "SUPERVISOR",
      name: "Vikramaditya Rathore",
      phone: "+919876500001",
      site: "Bhadla Solar (50 MW)",
      org: "Sunrise Solar",
      badgeVariant: "outline" as const,
    },
    {
      role: "ADMIN",
      name: "Pooja Sharma",
      phone: "+919876500000",
      site: "Portfolio (All Sites)",
      org: "Sunrise Solar",
      badgeVariant: "default" as const,
    },
    {
      role: "TECHNICIAN",
      name: "Amit Patel",
      phone: "+919876599999",
      site: "Rewa Solar (25 MW)",
      org: "Apex Clean Energy (Other Org)",
      badgeVariant: "destructive" as const,
    },
  ];

  async function handleLogin(e?: React.FormEvent, customPhone?: string) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const targetIdentifier = customPhone || identifier;

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: targetIdentifier,
          password: customPhone ? "password123" : password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to sign in");
      }

      // Route based on role with full document navigation to guarantee session cookie attachment
      if (data.data.user.role === "TECHNICIAN") {
        window.location.href = "/field";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
            <Sun className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign In to FieldSignal
          </h1>
          <p className="text-xs text-muted-foreground">
            Voice-First Maintenance Fault Intelligence for Solar Plant O&M
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Authentication</CardTitle>
            <CardDescription className="text-xs">
              Enter registered mobile phone number or email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Phone Number / Email</span>
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="+919876500002"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Password</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <Button
                id="sign-in-submit-btn"
                type="button"
                onClick={() => handleLogin()}
                disabled={loading}
                className="w-full gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{loading ? "Authenticating..." : "Sign In"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Demo Fast-Login Cards for Role Testing */}
        <div className="space-y-3">
          <p className="text-center text-xs font-medium text-muted-foreground">
            ⚡ Quick-Login Demo Accounts (Password: <code>password123</code>)
          </p>

          <div className="grid grid-cols-1 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.phone}
                type="button"
                onClick={() => {
                  setIdentifier(account.phone);
                  handleLogin(undefined, account.phone);
                }}
                disabled={loading}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition hover:bg-muted/50 hover:border-foreground/20 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{account.name}</span>
                    <Badge variant={account.badgeVariant} className="text-[10px] py-0 px-1.5">
                      {account.role}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {account.org} • {account.site}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
