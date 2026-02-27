"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, Suspense, useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSearchParams, useRouter } from "next/navigation";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

/** Custom avatar + sign-out button that sets offline BEFORE Clerk signs out */
function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const updateStatus = useMutation(api.users.updateStatus);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSignOut = async () => {
    // Mark offline FIRST, then sign out — this ensures the Convex mutation
    // completes before Clerk tears down the auth session
    try {
      await updateStatus({ isOnline: false });
    } finally {
      await signOut({ redirectUrl: "/" });
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="User menu"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback className="text-xs font-medium bg-blue-100 text-blue-700">
            {user?.firstName?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {user?.fullName}
            </p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ChatApp() {
  const storeUser = useMutation(api.users.store);
  const updateStatus = useMutation(api.users.updateStatus);
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentChatId = searchParams.get("c") as Id<"conversations"> | null;

  useEffect(() => {
    storeUser();
    updateStatus({ isOnline: true });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updateStatus({ isOnline: false });
      } else {
        updateStatus({ isOnline: true });
      }
    };

    const handleOffline = () => updateStatus({ isOnline: false });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleOffline);
    window.addEventListener("pagehide", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleOffline);
      window.removeEventListener("pagehide", handleOffline);
    };
  }, [storeUser, updateStatus]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-3">
          {currentChatId && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={() => router.push("/")}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
          )}
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Tars Chat
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: always visible on desktop, only shown on mobile when no chat is selected */}
        <div
          className={`
            w-full md:w-80 shrink-0
            border-r border-zinc-200 dark:border-zinc-800
            bg-white dark:bg-zinc-900
            flex flex-col h-full
            ${currentChatId ? "hidden md:flex" : "flex"}
          `}
        >
          <Sidebar />
        </div>

        {/* Chat area: always visible on desktop, only shown on mobile when a chat is selected */}
        <div
          className={`
            flex-1 flex flex-col h-full
            bg-zinc-50 dark:bg-zinc-950
            ${currentChatId ? "flex" : "hidden md:flex"}
          `}
        >
          {currentChatId ? (
            <ChatArea conversationId={currentChatId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-full mb-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <svg
                  className="w-12 h-12 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Your Messages
              </h3>
              <p className="text-sm text-center max-w-xs">
                Select a conversation from the sidebar or search for a user to
                start chatting.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
      <div className="bg-white dark:bg-zinc-900 p-8 md:p-12 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full flex flex-col items-center">
        <div className="bg-blue-600 p-4 rounded-2xl mb-6 shadow-lg shadow-blue-500/30">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
            />
          </svg>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          Welcome to Tars Chat
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-lg">
          A real-time messaging application built for seamless communication.
          Sign in to start connecting.
        </p>
        <SignInButton mode="modal">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-6 text-lg transition-transform active:scale-95"
          >
            Get Started
          </Button>
        </SignInButton>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SignedIn>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <ChatApp />
        </Suspense>
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </>
  );
}
