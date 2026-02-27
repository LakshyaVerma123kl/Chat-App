"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, Plus, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatPreviewTime(creationTime: number) {
  const date = new Date(creationTime);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sidebarData = useQuery(api.sidebar.getSidebarData);
  const allUsers = useQuery(api.users.getAll);

  const getOrCreateConversation = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation(api.conversations.createGroup);

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentChatId = searchParams.get("c");

  const filteredData = sidebarData?.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleStartChat = async (otherUserId: string) => {
    const conversationId = await getOrCreateConversation({ otherUserId });
    router.push(`/?c=${conversationId}`);
  };

  const handleOpenGroup = (conversationId: string) => {
    router.push(`/?c=${conversationId}`);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const conversationId = await createGroup({
      groupName: groupName.trim(),
      participantIds: selectedUsers,
    });
    setGroupName("");
    setSelectedUsers([]);
    setIsDialogOpen(false);
    router.push(`/?c=${conversationId}`);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
            Messages
          </h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-full"
                title="New Group Chat"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Input
                  placeholder="Group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="focus-visible:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                    Add members
                    {selectedUsers.length > 0 && (
                      <span className="ml-2 text-blue-600 font-normal">
                        ({selectedUsers.length} selected)
                      </span>
                    )}
                  </p>
                  <div className="h-[200px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 space-y-1">
                    {allUsers?.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-4">
                        No other users found.
                      </p>
                    ) : (
                      allUsers?.map((user) => (
                        <div
                          key={user._id}
                          onClick={() => toggleUserSelection(user.clerkId)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            selectedUsers.includes(user.clerkId)
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={user.imageUrl} />
                            <AvatarFallback className="text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm flex-1 truncate text-zinc-900 dark:text-zinc-100">
                            {user.name}
                          </span>
                          {selectedUsers.includes(user.clerkId) && (
                            <div className="h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || selectedUsers.length === 0}
                >
                  Create Group ({selectedUsers.length} member
                  {selectedUsers.length !== 1 ? "s" : ""})
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 bg-zinc-100 dark:bg-zinc-800 border-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {/* Loading state */}
          {sidebarData === undefined && (
            <div className="space-y-1 p-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state — no conversations yet */}
          {sidebarData !== undefined &&
            sidebarData.length === 0 &&
            !searchQuery && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-zinc-500">
                <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-full mb-4">
                  <MessageSquare className="w-7 h-7 text-zinc-400" />
                </div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                  No conversations yet
                </p>
                <p className="text-xs mt-1">
                  Search for a user to start chatting
                </p>
              </div>
            )}

          {/* Empty state — search yields no results */}
          {filteredData !== undefined &&
            filteredData.length === 0 &&
            searchQuery && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-zinc-500">
                <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-3">
                  <Search className="w-6 h-6 text-zinc-400" />
                </div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs mt-1">Try a different name</p>
              </div>
            )}

          {/* Conversation items */}
          {filteredData?.map((item) => {
            const isActive = currentChatId === item.conversationId;

            return (
              <div
                key={item.id}
                onClick={() =>
                  item.isGroup && item.conversationId
                    ? handleOpenGroup(item.conversationId)
                    : handleStartChat(item.otherUserId!)
                }
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {/* Avatar */}
                {item.isGroup ? (
                  <div className="relative h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.imageUrl} />
                      <AvatarFallback className="text-sm font-medium">
                        {item.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online dot */}
                    {item.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                    )}
                  </div>
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <p
                      className={`text-sm truncate ${
                        item.unreadCount > 0 && !isActive
                          ? "font-semibold text-zinc-900 dark:text-zinc-50"
                          : "font-medium text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {item.name}
                      {item.isGroup && (
                        <span className="ml-1.5 text-xs font-normal text-zinc-400">
                          · {item.memberCount}
                        </span>
                      )}
                    </p>
                    {item.lastMessage && (
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {formatPreviewTime(item.lastMessage._creationTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        item.unreadCount > 0 && !isActive
                          ? "text-zinc-700 dark:text-zinc-300 font-medium"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {item.lastMessage
                        ? item.lastMessage.isDeleted
                          ? "Message deleted"
                          : item.lastMessage.text
                        : "No messages yet"}
                    </p>
                    {item.unreadCount > 0 && !isActive && (
                      <Badge className="ml-auto bg-blue-600 hover:bg-blue-600 h-5 min-w-5 flex items-center justify-center px-1.5 rounded-full text-[10px] shrink-0">
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
