export interface DocumentEditEntry {
  editedAt: string;
  editedById?: string | null;
  editedByName: string;
  editedByUsername?: string | null;
  editedByEmail?: string | null;
  editedByRole?: string | null;
  summary?: string;
}

export interface DocumentEditAuditFields {
  lastEditedAt?: string | null;
  lastEditedById?: string | null;
  lastEditedByName?: string | null;
  lastEditedByUsername?: string | null;
  lastEditedByRole?: string | null;
  editHistory?: DocumentEditEntry[];
}
