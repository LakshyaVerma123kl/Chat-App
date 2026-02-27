"use client";

import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSearchParams } from "next/navigation";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

function ChatApp() {
  const storeUser = useMutation(api.users.store);
  const updateStatus = useMutation(api.users.updateStatus);
  const searchParams = useSearchParams();
  const currentChatId = searchParams.get("c") as Id<"conversations"> | null;

  useEffect(() => {
    storeUser();
    updateStatus({ isOnline: true });

    const handleWindowClose = () => {
      updateStatus({ isOnline: false });
    };

    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
      updateStatus({ isOnline: false });
    };
  }, [storeUser, updateStatus]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b shrink-0 z-20">
        <h1 className="text-xl font-bold">Tars Chat</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div
          className={`w-full md:w-80 md:flex flex-col h-full shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 
          ${currentChatId ? "hidden" : "flex"}`}
        >
          <Sidebar />
        </div>

        <div
          className={`flex-1 flex-col h-full bg-zinc-50 dark:bg-zinc-950
          ${currentChatId ? "flex" : "hidden md:flex"}`}
        >
          {currentChatId ? (
            <ChatArea conversationId={currentChatId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-full mb-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
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
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                Your Messages
              </h3>
              <p>Select a user from the sidebar to start a conversation.</p>
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
            <div className="flex h-screen items-center justify-center">
              Loading...
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
