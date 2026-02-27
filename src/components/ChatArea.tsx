"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, AlertCircle, RefreshCcw, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😲", "😢"];

function formatMessageTime(creationTime: number) {
  const date = new Date(creationTime);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  if (isThisYear)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupReactions(
  reactions: { emoji: string; userId: string }[] | undefined,
) {
  if (!reactions) return {};
  const grouped: Record<string, string[]> = {};
  reactions.forEach((r) => {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.userId);
  });
  return grouped;
}

export default function ChatArea({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const { user } = useUser();

  const [newMessage, setNewMessage] = useState("");
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [failedMessages, setFailedMessages] = useState<
    Array<{ id: number; text: string }>
  >([]);
  // Which message currently has its action toolbar open (tap on mobile, hover on desktop)
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef(0);

  const messages = useQuery(api.messages.list, { conversationId });
  const sidebarData = useQuery(api.sidebar.getSidebarData);
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const setTyping = useMutation(api.typing.set);
  const activeTypers = useQuery(api.typing.getActive, { conversationId });
  const markRead = useMutation(api.sidebar.markRead);

  const conversationInfo = sidebarData?.find(
    (item) => item.conversationId === conversationId,
  );

  useEffect(() => {
    markRead({ conversationId });
  }, [conversationId, messages?.length, markRead]);

  useEffect(() => {
    if (messages === undefined) return;
    const newCount = messages.length + failedMessages.length;
    const wasAtBottom = prevMessageCountRef.current === 0 || !isUserScrolledUp;
    if (newCount > prevMessageCountRef.current && wasAtBottom) {
      scrollToBottom("smooth");
    }
    prevMessageCountRef.current = newCount;
  }, [messages, failedMessages, isUserScrolledUp]);

  // Scroll to bottom and reset toolbar when switching conversations
  useEffect(() => {
    setActiveMessageId(null);
    setIsUserScrolledUp(false);
    if (messages && messages.length > 0) {
      scrollToBottom("instant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      80;
    setIsUserScrolledUp(!isAtBottom);
  }, []);

  // Dismiss toolbar on outside click/tap
  useEffect(() => {
    if (!activeMessageId) return;
    const dismiss = () => setActiveMessageId(null);
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, [activeMessageId]);

  // Clean up typing on unmount / conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping({ conversationId, isTyping: false });
    };
  }, [conversationId, setTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    setTyping({ conversationId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping({ conversationId, isTyping: false });
    }, 2000);
  };

  const handleSendMessage = async (e?: React.FormEvent, retryText?: string) => {
    if (e) e.preventDefault();
    const textToSend = retryText ?? newMessage;
    if (!textToSend.trim()) return;

    if (!retryText) setNewMessage("");
    setIsUserScrolledUp(false);
    scrollToBottom("smooth");

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping({ conversationId, isTyping: false });

    try {
      await sendMessage({ conversationId, text: textToSend });
      if (retryText) {
        setFailedMessages((prev) => prev.filter((m) => m.text !== retryText));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      if (!retryText) {
        setFailedMessages((prev) => [
          ...prev,
          { id: Date.now(), text: textToSend },
        ]);
      }
    }
  };

  // --- Touch / tap handlers ---
  const handleTouchStart = (messageId: string) => {
    // Long press (400ms) opens toolbar
    longPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(messageId);
    }, 400);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  // Short tap toggles toolbar too (more accessible on mobile)
  const handleBubbleTap = (
    e: React.MouseEvent,
    messageId: string,
    isDeleted: boolean,
  ) => {
    if (isDeleted) return;
    e.stopPropagation();
    setActiveMessageId((prev) => (prev === messageId ? null : messageId));
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-950 overflow-hidden relative">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3 shrink-0">
        {conversationInfo ? (
          conversationInfo.isGroup ? (
            <>
              <div className="h-9 w-9 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {conversationInfo.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {conversationInfo.memberCount} members
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={conversationInfo.imageUrl} />
                  <AvatarFallback>
                    {conversationInfo.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {conversationInfo.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {conversationInfo.name}
                </p>
                <p
                  className={`text-xs ${conversationInfo.isOnline ? "text-green-500" : "text-zinc-400"}`}
                >
                  {conversationInfo.isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </>
          )
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-950/50"
      >
        <div className="space-y-3 flex flex-col">
          {/* Loading */}
          {messages === undefined && (
            <div className="space-y-4">
              {[
                { w: "40%", side: "start" },
                { w: "52%", side: "end" },
                { w: "58%", side: "start" },
                { w: "36%", side: "end" },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex ${s.side === "end" ? "justify-end" : "justify-start"}`}
                >
                  <Skeleton
                    className={`h-10 rounded-2xl ${s.side === "end" ? "rounded-br-none" : "rounded-bl-none"}`}
                    style={{ width: s.w }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {messages !== undefined &&
            messages.length === 0 &&
            failedMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center text-zinc-500 py-12">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-full mb-4 border border-zinc-200 dark:border-zinc-800">
                  <svg
                    className="w-8 h-8 text-zinc-400"
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
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  No messages yet
                </p>
                <p className="text-sm mt-1">
                  Be the first to say something! 👋
                </p>
              </div>
            )}

          {/* Message list */}
          {messages !== undefined &&
            (messages.length > 0 || failedMessages.length > 0) && (
              <>
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const groupedReactions = groupReactions(msg.reactions);
                  const isActive = activeMessageId === msg._id;

                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      {/*
                       * ACTION TOOLBAR
                       * Mobile: rendered above the bubble, visible when isActive
                       * Desktop: also shown when isActive (triggered by click)
                       * The toolbar is always in the DOM when active so it doesn't flicker
                       */}
                      {isActive && !msg.isDeleted && (
                        <div
                          className={`flex items-center gap-1.5 mb-2 z-10 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Emoji row */}
                          <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-xl px-2 py-1.5 gap-0.5">
                            {ALLOWED_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  toggleReaction({
                                    messageId: msg._id,
                                    emoji,
                                  });
                                  setActiveMessageId(null);
                                }}
                                className="p-1.5 rounded-full text-lg active:scale-125 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform leading-none"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          {/* Delete — only own messages */}
                          {isMe && (
                            <button
                              onClick={() => {
                                deleteMessage({ messageId: msg._id });
                                setActiveMessageId(null);
                              }}
                              className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl text-red-400 hover:text-red-600 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Close */}
                          <button
                            onClick={() => setActiveMessageId(null)}
                            className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl text-zinc-400 hover:text-zinc-600 transition-colors"
                            aria-label="Close"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`flex items-end gap-2 max-w-[82%] sm:max-w-[68%] ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div className="flex flex-col">
                          <div
                            /* Tap = open toolbar. Long-press also works on touch. */
                            onClick={(e) =>
                              handleBubbleTap(
                                e,
                                msg._id,
                                msg.isDeleted ?? false,
                              )
                            }
                            onTouchStart={() =>
                              !msg.isDeleted && handleTouchStart(msg._id)
                            }
                            onTouchEnd={cancelLongPress}
                            onTouchMove={cancelLongPress}
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
                              ${
                                msg.isDeleted
                                  ? "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 italic border border-zinc-200 dark:border-zinc-700 cursor-default select-none"
                                  : isMe
                                    ? `bg-blue-600 text-white rounded-br-none cursor-pointer select-none transition-opacity ${isActive ? "opacity-70" : "active:opacity-75"}`
                                    : `bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none shadow-sm border border-zinc-100 dark:border-zinc-700 cursor-pointer select-none transition-opacity ${isActive ? "opacity-70" : "active:opacity-75"}`
                              }`}
                          >
                            {msg.isDeleted
                              ? "This message was deleted"
                              : msg.text}
                          </div>

                          {/* Reaction chips */}
                          {Object.keys(groupedReactions).length > 0 && (
                            <div
                              className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? "justify-end" : "justify-start"}`}
                            >
                              {Object.entries(groupedReactions).map(
                                ([emoji, users]) => {
                                  const hasReacted = users.includes(
                                    user?.id ?? "",
                                  );
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() =>
                                        toggleReaction({
                                          messageId: msg._id,
                                          emoji,
                                        })
                                      }
                                      className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all active:scale-110 ${
                                        hasReacted
                                          ? "bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                                          : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-zinc-500 dark:text-zinc-400 font-medium text-[11px]">
                                        {users.length}
                                      </span>
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                        {formatMessageTime(msg._creationTime)}
                      </span>
                    </div>
                  );
                })}

                {/* Failed messages */}
                {failedMessages.map((fm) => (
                  <div key={fm.id} className="flex flex-col items-end">
                    <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm bg-blue-600 text-white rounded-br-none opacity-60">
                      {fm.text}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-red-500 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>Failed to send</span>
                      <button
                        onClick={() => handleSendMessage(undefined, fm.text)}
                        className="flex items-center gap-1 ml-1 text-blue-500 hover:underline font-medium"
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Retry
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Typing indicator ── */}
      {activeTypers && activeTypers.length > 0 && (
        <div className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 italic bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
            {activeTypers.join(", ")} {activeTypers.length === 1 ? "is" : "are"}{" "}
            typing...
          </span>
        </div>
      )}

      {/* ── New messages button ── */}
      {isUserScrolledUp && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 pointer-events-auto"
            onClick={() => {
              setIsUserScrolledUp(false);
              scrollToBottom("smooth");
            }}
          >
            ↓ New messages
          </Button>
        </div>
      )}

      {/* ── Input ── */}
      <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form className="flex gap-2 items-center" onSubmit={handleSendMessage}>
          <Input
            placeholder="Type a message..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-4 h-10 focus-visible:ring-1 focus-visible:ring-blue-500"
            value={newMessage}
            onChange={handleInputChange}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white shrink-0 disabled:opacity-40"
            disabled={!newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
