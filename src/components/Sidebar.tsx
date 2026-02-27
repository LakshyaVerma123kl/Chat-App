"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

  const handleStartDirectChat = async (otherUserId: string) => {
    const conversationId = await getOrCreateConversation({ otherUserId });
    router.push(`/?c=${conversationId}`);
  };

  const handleOpenGroupChat = (conversationId: string) => {
    router.push(`/?c=${conversationId}`);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const conversationId = await createGroup({
      groupName,
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
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-900 shrink-0 z-10">
      <div className="p-4 border-b flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Chats
          </h2>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Group Name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <div className="text-sm font-medium mb-2">Select Members</div>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  {allUsers?.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => toggleUserSelection(user.clerkId)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedUsers.includes(user.clerkId)
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.imageUrl} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{user.name}</span>
                      {selectedUsers.includes(user.clerkId) && (
                        <div className="h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-[10px]">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </ScrollArea>
                <Button
                  className="w-full"
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || selectedUsers.length === 0}
                >
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search..."
            className="pl-8 bg-zinc-100 dark:bg-zinc-800 border-none h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sidebarData === undefined ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              Loading...
            </div>
          ) : filteredData?.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No chats found.
            </div>
          ) : (
            filteredData?.map((item) => {
              const isActive = currentChatId === item.conversationId;

              return (
                <div
                  key={item.id}
                  onClick={() =>
                    item.isGroup && item.conversationId
                      ? handleOpenGroupChat(item.conversationId)
                      : handleStartDirectChat(item.otherUserId!)
                  }
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.isGroup ? (
                    <div className="relative h-10 w-10 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="relative shrink-0">
                      <Avatar>
                        <AvatarImage src={item.imageUrl} />
                        <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {item.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {item.name}
                        {item.isGroup && (
                          <span className="text-xs font-normal text-zinc-400">
                            ({item.memberCount})
                          </span>
                        )}
                      </p>
                      {item.unreadCount > 0 && !isActive && (
                        <Badge
                          variant="default"
                          className="ml-auto bg-blue-600 hover:bg-blue-700 h-5 min-w-5 flex items-center justify-center px-1 rounded-full text-[10px]"
                        >
                          {item.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {item.lastMessage && (
                      <p
                        className={`text-xs truncate mt-0.5 ${item.unreadCount > 0 && !isActive ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-500"}`}
                      >
                        {item.lastMessage.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
