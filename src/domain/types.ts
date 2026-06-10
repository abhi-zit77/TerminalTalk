export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
}

export interface ChatSession {
  token: string;
  user: AuthenticatedUser;
  convexUrl?: string | undefined;
}

export interface ChatGroup {
  id: string;
  name: string;
  role: "admin" | "member";
  joinCode?: string | undefined;
}

export interface ChatFriend {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  status: "pending" | "accepted" | "blocked";
  direction?: "incoming" | "outgoing" | undefined;
}

export interface ChatMessage {
  id: string;
  scope: "group" | "direct" | "system";
  groupId?: string | undefined;
  friendUserId?: string | undefined;
  sender: {
    username: string;
    displayName?: string | undefined;
    nickname?: string | undefined;
  };
  body?: string | undefined;
  redactedAt?: number | undefined;
  redactionReason?: "terminal_closed" | "session_expired" | undefined;
  createdAt: number;
}

export interface SystemStats {
  memoryUsedMb: number;
  memoryTotalMb: number;
  cpuLabel: string;
  osLabel: string;
  deviceSpecLines: string[];
  diskAvailableGb?: number | undefined;
  networkStatus: "online" | "offline" | "unknown";
}

export interface AppNotice {
  tone: "info" | "success" | "warning" | "error";
  message: string;
}
