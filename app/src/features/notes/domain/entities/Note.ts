export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  linkedAccountId?: string;
  linkedTransactionId?: string;
  pinned: boolean;
};

export type NoteFolder = {
  id: string;
  name: string;
  parentFolderId?: string;
  createdAt: string;
  updatedAt: string;
};
