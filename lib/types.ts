export type Bookmark = {
  id: string;
  url: string;
  title: string;
  tags: string[];
  notes: string | null;
  isRead: boolean;
  savedAt: string;
};

export type NewBookmark = {
  url: string;
  title: string;
  tags: string[];
  notes: string | null;
};

export type ReadState = "all" | "unread" | "read";

export type BookmarkFilters = {
  tag: string | null;
  readState: ReadState;
};

export type RegistrationInput = {
  email: string;
  password: string;
  fullName: string;
};

export type Credentials = {
  email: string;
  password: string;
};
