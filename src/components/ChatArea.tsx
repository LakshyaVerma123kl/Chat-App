"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Trash2, AlertCircle, RefreshCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [failedMessages, setFailedMessages] = useState<
    Array<{ id: number; text: string }>
  >([]);

  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.messages.toggleReaction);

  const setTyping = useMutation(api.typing.set);
  const activeTypers = useQuery(api.typing.getActive, { conversationId });
  const markRead = useMutation(api.sidebar.markRead);

  useEffect(() => {
    markRead({ conversationId });
  }, [conversationId, messages, markRead]);

  useEffect(() => {
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, failedMessages, isUserScrolling]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setIsUserScrolling(!isAtBottom);
  };

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
    const textToSend = retryText || newMessage;
    if (!textToSend.trim()) return;

    if (!retryText) setNewMessage("");
    setIsUserScrolling(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    await setTyping({ conversationId, isTyping: false });

    try {
      await sendMessage({
        conversationId,
        text: textToSend,
      });
      if (retryText) {
        setFailedMessages((prev) =>
          prev.filter((msg) => msg.text !== retryText),
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (!retryText) {
        setFailedMessages((prev) => [
          ...prev,
          { id: Date.now(), text: textToSend },
        ]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-950 relative">
      <div className="p-4 border-b flex items-center bg-white dark:bg-zinc-900 shadow-sm z-10">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden mr-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold">Chat Room</h2>
      </div>

      <ScrollArea
        className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-950/50"
        onScrollCapture={handleScroll}
      >
        <div className="space-y-4 pb-4 flex flex-col">
          {messages === undefined ? (
            <div className="space-y-4">
              <div className="flex justify-start">
                <Skeleton className="h-10 w-[40%] rounded-2xl rounded-bl-none" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-[50%] rounded-2xl rounded-br-none" />
              </div>
              <div className="flex justify-start">
                <Skeleton className="h-16 w-[60%] rounded-2xl rounded-bl-none" />
              </div>
            </div>
          ) : messages.length === 0 && failedMessages.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm mt-4">
              No messages yet. Say hi!
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                const groupedReactions = groupReactions(msg.reactions);

                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className="flex flex-col">
                        <div
                          className={`max-w-[100%] px-4 py-2 rounded-2xl text-sm ${
                            msg.isDeleted
                              ? "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 italic border border-zinc-200 dark:border-zinc-800"
                              : isMe
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none"
                          }`}
                        >
                          {msg.isDeleted
                            ? "This message was deleted"
                            : msg.text}
                        </div>

                        {Object.keys(groupedReactions).length > 0 && (
                          <div
                            className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            {Object.entries(groupedReactions).map(
                              ([emoji, users]) => {
                                const hasReacted = users.includes(
                                  user?.id || "",
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
                                    className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-colors ${
                                      hasReacted
                                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800"
                                        : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                                      {users.length}
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>

                      {!msg.isDeleted && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm px-1 py-0.5">
                            {ALLOWED_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() =>
                                  toggleReaction({ messageId: msg._id, emoji })
                                }
                                className="hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 rounded-full text-sm transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          {isMe && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"
                              onClick={() =>
                                deleteMessage({ messageId: msg._id })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 px-1">
                      {formatMessageTime(msg._creationTime)}
                    </span>
                  </div>
                );
              })}

              {failedMessages.map((fm) => (
                <div key={fm.id} className="flex flex-col items-end opacity-70">
                  <div className="max-w-[70%] px-4 py-2 rounded-2xl text-sm bg-blue-600 text-white rounded-br-none">
                    {fm.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    <span>Failed to send</span>
                    <button
                      onClick={() => handleSendMessage(undefined, fm.text)}
                      className="flex items-center gap-1 ml-2 text-blue-500 hover:underline"
                    >
                      <RefreshCcw className="h-3 w-3" /> Retry
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {activeTypers && activeTypers.length > 0 && (
        <div className="absolute bottom-[80px] left-4 text-xs text-zinc-500 dark:text-zinc-400 italic bg-white/80 dark:bg-zinc-900/80 px-2 py-1 rounded-md z-10">
          {activeTypers.join(", ")} {activeTypers.length === 1 ? "is" : "are"}{" "}
          typing...
        </div>
      )}

      {isUserScrolling && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-md"
            onClick={() => {
              setIsUserScrolling(false);
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            ↓ New messages
          </Button>
        </div>
      )}

      <div className="p-4 bg-white dark:bg-zinc-900 border-t z-10">
        <form className="flex gap-2" onSubmit={handleSendMessage}>
          <Input
            placeholder="Type a message..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none"
            value={newMessage}
            onChange={handleInputChange}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
