export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  created_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  photo_url: string | null;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  actions_json: { type: "app" | "url"; target: string }[];
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  created_at: string;
}

export type ChatSource = "voice" | "chat";
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  source: ChatSource;
  status: string;
  session_id: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  created_at: string;
}
