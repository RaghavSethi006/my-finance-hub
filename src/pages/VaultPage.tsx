import Fuse from "fuse.js";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { useFinOS } from "@/lib/store";
import { VaultDocument } from "@/lib/types";
import { deleteVaultDocument, importVaultDocument, isTauriDesktop, readVaultDocument } from "@/lib/desktop";
import { FileText, Grid3X3, List, Lock, Search, Shield, Trash2, Unlock, Upload, Edit2, Download } from "lucide-react";
import { toast } from "sonner";

const FILE_ICONS: Record<string, string> = {
  pdf: "PDF",
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  docx: "DOCX",
  csv: "CSV",
  xlsx: "XLSX",
};

type LinkedEntityType = NonNullable<VaultDocument["linkedEntityType"]>;

type DocumentFormState = {
  name: string;
  category: VaultDocument["category"];
  tags: string;
  linkedEntityType: "none" | LinkedEntityType;
  linkedEntityId: string;
};

type LinkOption = {
  id: string;
  label: string;
  detail: string;
};

type LinkedSummary = {
  typeLabel: string;
  label: string;
  detail: string;
};

const EMPTY_DOCUMENT_FORM: DocumentFormState = {
  name: "",
  category: "other",
  tags: "",
  linkedEntityType: "none",
  linkedEntityId: "",
};

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferFileType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension || file.type || "file";
}

function formatSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getMimeType(fileType: string): string {
  const normalized = fileType.toLowerCase();
  if (normalized === "pdf") return "application/pdf";
  if (normalized === "jpg" || normalized === "jpeg") return "image/jpeg";
  if (normalized === "png") return "image/png";
  if (normalized === "csv") return "text/csv";
  if (normalized === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (normalized === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

function isPreviewable(fileType: string): boolean {
  return ["pdf", "jpg", "jpeg", "png"].includes(fileType.toLowerCase());
}

function buildDownloadName(document: VaultDocument): string {
  const normalizedType = document.fileType.toLowerCase();
  const hasExtension = document.name.toLowerCase().endsWith(`.${normalizedType}`);
  return hasExtension ? document.name : `${document.name}.${normalizedType}`;
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getLinkedTypeLabel(type: LinkedEntityType): string {
  if (type === "transaction") return "Transaction";
  if (type === "account") return "Account";
  return "Asset";
}

function buildDocumentForm(document?: VaultDocument): DocumentFormState {
  if (!document) {
    return { ...EMPTY_DOCUMENT_FORM };
  }

  return {
    name: document.name,
    category: document.category,
    tags: document.tags.join(", "),
    linkedEntityType: document.linkedEntityType ?? "none",
    linkedEntityId: document.linkedEntityId ?? "",
  };
}

function summarizeLinkedRecord(
  document: VaultDocument,
  linkOptions: Record<LinkedEntityType, LinkOption[]>
): LinkedSummary | null {
  if (!document.linkedEntityType || !document.linkedEntityId) return null;

  const linkedOption = linkOptions[document.linkedEntityType].find((option) => option.id === document.linkedEntityId);
  if (linkedOption) {
    return {
      typeLabel: getLinkedTypeLabel(document.linkedEntityType),
      label: linkedOption.label,
      detail: linkedOption.detail,
    };
  }

  return {
    typeLabel: getLinkedTypeLabel(document.linkedEntityType),
    label: `Unavailable ${document.linkedEntityType}`,
    detail: "This saved link no longer matches an existing record.",
  };
}

export default function VaultPage() {
  const {
    documents,
    transactions,
    accounts,
    assets,
    securityStatus,
    unlockVault,
    lockVault,
    setVaultPassword,
    addDocument,
    updateDocument,
    deleteDocument,
  } = useFinOS();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | VaultDocument["category"]>("all");
  const [selectedDocument, setSelectedDocument] = useState<VaultDocument | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isUnlockingVault, setIsUnlockingVault] = useState(false);
  const [isUpdatingVaultPassword, setIsUpdatingVaultPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [newVaultPassword, setNewVaultPassword] = useState("");
  const [confirmVaultPassword, setConfirmVaultPassword] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentForm, setDocumentForm] = useState<DocumentFormState>({ ...EMPTY_DOCUMENT_FORM });

  const linkOptions = useMemo<Record<LinkedEntityType, LinkOption[]>>(
    () => ({
      transaction: [...transactions]
        .sort((left, right) => right.date.localeCompare(left.date))
        .map((transaction) => {
          const account = accounts.find((candidate) => candidate.id === transaction.accountId);
          return {
            id: transaction.id,
            label: transaction.note || "Untitled transaction",
            detail: `${transaction.date} / ${formatCurrency(transaction.amount, transaction.currency)} / ${account?.name ?? "Unknown account"}`,
          };
        }),
      account: [...accounts]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((account) => ({
          id: account.id,
          label: account.name,
          detail: `${account.bankName || getLinkedTypeLabel("account")} / ${formatCurrency(account.balance, account.currency)}`,
        })),
      asset: [...assets]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((asset) => ({
          id: asset.id,
          label: asset.name,
          detail: `${asset.ticker || getLinkedTypeLabel("asset")} / ${formatCurrency(asset.currentPrice * asset.quantity, asset.currency)}`,
        })),
    }),
    [accounts, assets, transactions]
  );

  const decoratedDocuments = useMemo(
    () =>
      documents.map((document) => ({
        document,
        linkedSummary: summarizeLinkedRecord(document, linkOptions),
      })),
    [documents, linkOptions]
  );

  const filteredDocuments = useMemo(() => {
    const byCategory = decoratedDocuments.filter(
      ({ document }) => activeCategory === "all" || document.category === activeCategory
    );

    if (!search.trim()) {
      return byCategory;
    }

    const fuse = new Fuse(byCategory, {
      keys: [
        { name: "document.name", weight: 0.45 },
        { name: "document.tags", weight: 0.2 },
        { name: "document.category", weight: 0.1 },
        { name: "linkedSummary.label", weight: 0.2 },
        { name: "linkedSummary.detail", weight: 0.05 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    return fuse.search(search.trim()).map((result) => result.item);
  }, [activeCategory, decoratedDocuments, search]);

  const categoryCounts = documents.reduce((accumulator, document) => {
    accumulator[document.category] = (accumulator[document.category] || 0) + 1;
    return accumulator;
  }, {} as Record<string, number>);

  const activeLinkOptions =
    documentForm.linkedEntityType === "none" ? [] : linkOptions[documentForm.linkedEntityType];
  const linkedOptionFallback =
    documentForm.linkedEntityType !== "none" &&
    documentForm.linkedEntityId &&
    !activeLinkOptions.some((option) => option.id === documentForm.linkedEntityId)
      ? {
          id: documentForm.linkedEntityId,
          label: `Unavailable ${documentForm.linkedEntityType}`,
          detail: "This saved link no longer matches an existing record.",
        }
      : null;
  const visibleLinkOptions = linkedOptionFallback ? [linkedOptionFallback, ...activeLinkOptions] : activeLinkOptions;

  const selectedDocumentLinkSummary = useMemo(
    () => (selectedDocument ? summarizeLinkedRecord(selectedDocument, linkOptions) : null),
    [linkOptions, selectedDocument]
  );

  const isVaultLocked = securityStatus.isVaultLocked;
  const hasVaultPassword = securityStatus.hasVaultPassword;

  const openUploadDialog = () => fileInputRef.current?.click();

  const resetUploadState = () => {
    setPendingFile(null);
    setDocumentForm({ ...EMPTY_DOCUMENT_FORM });
    setUploadOpen(false);
  };

  const validateLinkSelection = (): boolean => {
    if (documentForm.linkedEntityType !== "none" && !documentForm.linkedEntityId) {
      toast.error(`Choose the ${documentForm.linkedEntityType} to link`);
      return false;
    }

    return true;
  };

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    setDocumentForm({
      ...EMPTY_DOCUMENT_FORM,
      name: file.name.replace(/\.[^.]+$/, ""),
    });
    setUploadOpen(true);
    event.target.value = "";
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    if (!documentForm.name.trim()) {
      toast.error("Document name is required");
      return;
    }
    if (!validateLinkSelection()) {
      return;
    }

    setIsSaving(true);
    try {
      const id = generateId("doc");
      const now = new Date().toISOString();
      const tags = parseTags(documentForm.tags);
      const linkedEntityType = documentForm.linkedEntityType === "none" ? undefined : documentForm.linkedEntityType;
      const linkedEntityId = linkedEntityType ? documentForm.linkedEntityId : undefined;

      let document: VaultDocument;

      if (isTauriDesktop()) {
        const bytes = Array.from(new Uint8Array(await pendingFile.arrayBuffer()));
        document = await importVaultDocument({
          id,
          name: documentForm.name.trim(),
          category: documentForm.category,
          fileType: inferFileType(pendingFile),
          size: pendingFile.size,
          tags,
          linkedEntityId,
          linkedEntityType,
          createdAt: now,
          updatedAt: now,
          bytes,
        });
      } else {
        document = {
          id,
          name: documentForm.name.trim(),
          category: documentForm.category,
          fileType: inferFileType(pendingFile),
          size: pendingFile.size,
          tags,
          linkedEntityId,
          linkedEntityType,
          createdAt: now,
          updatedAt: now,
        };
      }

      addDocument(document);
      toast.success("Document saved to the vault");
      resetUploadState();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  const openDetails = (document: VaultDocument) => {
    setSelectedDocument(document);
    setDocumentForm(buildDocumentForm(document));
    setDetailOpen(true);
  };

  const handleUpdateDocument = () => {
    if (!selectedDocument) return;
    if (!documentForm.name.trim()) {
      toast.error("Document name is required");
      return;
    }
    if (!validateLinkSelection()) {
      return;
    }

    const tags = parseTags(documentForm.tags);
    const updatedAt = new Date().toISOString();
    const linkedEntityType = documentForm.linkedEntityType === "none" ? undefined : documentForm.linkedEntityType;
    const linkedEntityId = linkedEntityType ? documentForm.linkedEntityId : undefined;

    updateDocument(selectedDocument.id, {
      name: documentForm.name.trim(),
      category: documentForm.category,
      tags,
      linkedEntityId,
      linkedEntityType,
      updatedAt,
    });
    setSelectedDocument((current) =>
      current
        ? {
            ...current,
            name: documentForm.name.trim(),
            category: documentForm.category,
            tags,
            linkedEntityId,
            linkedEntityType,
            updatedAt,
          }
        : current
    );
    toast.success("Document updated");
    setDetailOpen(false);
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;

    try {
      if (isTauriDesktop()) {
        await deleteVaultDocument(selectedDocument.id);
      }
      deleteDocument(selectedDocument.id);
      setDetailOpen(false);
      setSelectedDocument(null);
      toast.success("Document deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete document");
    }
  };

  useEffect(() => {
    if (!selectedDocument || !detailOpen || !isTauriDesktop() || !isPreviewable(selectedDocument.fileType)) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setIsLoadingPreview(false);
      return;
    }

    let isActive = true;
    setIsLoadingPreview(true);

    void readVaultDocument(selectedDocument.id)
      .then((bytes) => {
        if (!isActive) return;
        const blob = new Blob([new Uint8Array(bytes)], { type: getMimeType(selectedDocument.fileType) });
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return objectUrl;
        });
      })
      .catch((error) => {
        console.error(error);
        if (isActive) {
          toast.error("Failed to load document preview");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [detailOpen, selectedDocument]);

  const handleDownloadDocument = async () => {
    if (!selectedDocument || !isTauriDesktop()) return;

    try {
      const bytes = await readVaultDocument(selectedDocument.id);
      const blob = new Blob([new Uint8Array(bytes)], { type: getMimeType(selectedDocument.fileType) });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildDownloadName(selectedDocument);
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download document");
    }
  };

  const handleUnlockVault = async () => {
    if (!passwordInput.trim()) {
      toast.error("Enter your vault password");
      return;
    }

    setIsUnlockingVault(true);
    try {
      await unlockVault(passwordInput);
      setPasswordInput("");
      toast.success("Vault unlocked");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to unlock vault");
    } finally {
      setIsUnlockingVault(false);
    }
  };

  const handleSetVaultPassword = async () => {
    if (!newVaultPassword.trim()) {
      toast.error("Enter a vault password");
      return;
    }
    if (newVaultPassword !== confirmVaultPassword) {
      toast.error("Vault passwords do not match");
      return;
    }

    setIsUpdatingVaultPassword(true);
    try {
      await setVaultPassword(undefined, newVaultPassword);
      setNewVaultPassword("");
      setConfirmVaultPassword("");
      toast.success("Vault password set and documents encrypted");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to set vault password");
    } finally {
      setIsUpdatingVaultPassword(false);
    }
  };

  const handleLockVault = async () => {
    try {
      await lockVault();
      toast.success("Vault locked");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to lock vault");
    }
  };

  if (isTauriDesktop() && !hasVaultPassword) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-5 pb-8 pt-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold">Set Up Your Vault Password</h2>
              <p className="text-sm text-muted-foreground">
                Your vault now uses AES-256 encryption. Set a master password to encrypt stored documents and secure all
                future uploads.
              </p>
            </div>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="New vault password"
                value={newVaultPassword}
                onChange={(event) => setNewVaultPassword(event.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirm vault password"
                value={confirmVaultPassword}
                onChange={(event) => setConfirmVaultPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Existing vault files on disk will be re-encrypted during setup. Use a password you can remember.
              </p>
            </div>
            <Button onClick={handleSetVaultPassword} disabled={isUpdatingVaultPassword} className="w-full">
              {isUpdatingVaultPassword ? "Encrypting Vault..." : "Set Vault Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVaultLocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pb-8 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Vault is Locked</h2>
            <p className="text-sm text-muted-foreground">Unlock the vault to manage your locally stored documents.</p>
            <Input type="password" placeholder="Master password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} className="mx-auto max-w-xs" />
            {securityStatus.vaultCooldownRemainingSeconds > 0 && (
              <p className="text-xs text-amber-600">
                Too many attempts. Try again in {securityStatus.vaultCooldownRemainingSeconds}s.
              </p>
            )}
            <Button onClick={handleUnlockVault} disabled={isUnlockingVault} className="w-full max-w-xs">
              <Unlock className="mr-2 h-4 w-4" /> {isUnlockingVault ? "Unlocking..." : "Unlock Vault"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleSelectFile} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Vault</h1>
          <p className="text-sm text-muted-foreground">
            Private financial document storage with fuzzy search and linked-record context
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void handleLockVault()} className="gap-2">
            <Lock className="h-4 w-4" /> Lock
          </Button>
          <Button className="gap-2" onClick={openUploadDialog}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={activeCategory === "all" ? "secondary" : "outline"} className="cursor-pointer" onClick={() => setActiveCategory("all")}>
          All ({documents.length})
        </Badge>
        {(["banking", "tax", "legal", "personal", "other"] as VaultDocument["category"][]).map((category) => (
          <Badge
            key={category}
            variant={activeCategory === category ? "secondary" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => setActiveCategory(category)}
          >
            {category} ({categoryCounts[category] || 0})
          </Badge>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents, tags, accounts, assets, and transactions..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
          {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
        </Button>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map(({ document, linkedSummary }) => (
            <Card key={document.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDetails(document)}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
                    {FILE_ICONS[document.fileType] || "FILE"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {document.fileType.toUpperCase()} / {formatSize(document.size)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px] capitalize">{document.category}</Badge>
                      {document.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                    {linkedSummary && (
                      <div className="mt-3 rounded-lg border bg-secondary/20 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          Linked {linkedSummary.typeLabel}
                        </div>
                        <p className="mt-1 truncate text-xs font-medium">{linkedSummary.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{linkedSummary.detail}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredDocuments.length === 0 && (
            <Card className="border-dashed lg:col-span-3">
              <CardContent className="flex min-h-[220px] items-center justify-center text-center text-muted-foreground">
                <div>
                  <Shield className="mx-auto mb-3 h-8 w-8" />
                  <p className="text-sm">No documents match this view yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openUploadDialog}>Upload a document</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredDocuments.map(({ document, linkedSummary }) => (
                <div key={document.id} className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-secondary/30" onClick={() => openDetails(document)}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground">
                      {FILE_ICONS[document.fileType] || "FILE"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{document.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.updatedAt.slice(0, 10)}
                        {linkedSummary ? ` / Linked ${linkedSummary.typeLabel}: ${linkedSummary.label}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">{document.category}</Badge>
                    <span className="text-xs text-muted-foreground">{formatSize(document.size)}</span>
                  </div>
                </div>
              ))}
              {filteredDocuments.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No documents found</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetUploadState();
            return;
          }
          setUploadOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>{pendingFile ? `Saving ${pendingFile.name} into your local vault.` : "Choose a document to store locally."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Document Name</Label>
              <Input value={documentForm.name} onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={documentForm.category} onValueChange={(value) => setDocumentForm((current) => ({ ...current, category: value as VaultDocument["category"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banking">Banking</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Link Type</Label>
                <Select
                  value={documentForm.linkedEntityType}
                  onValueChange={(value) =>
                    setDocumentForm((current) => ({
                      ...current,
                      linkedEntityType: value as DocumentFormState["linkedEntityType"],
                      linkedEntityId: "",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked record</SelectItem>
                    <SelectItem value="transaction">Transaction</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Linked Item</Label>
                <Select
                  value={documentForm.linkedEntityId || "none"}
                  disabled={documentForm.linkedEntityType === "none" || visibleLinkOptions.length === 0}
                  onValueChange={(value) =>
                    setDocumentForm((current) => ({
                      ...current,
                      linkedEntityId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder={documentForm.linkedEntityType === "none" ? "Choose link type first" : "Select a record"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked item</SelectItem>
                    {visibleLinkOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {documentForm.linkedEntityType !== "none" && visibleLinkOptions.length > 0 && documentForm.linkedEntityId && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {visibleLinkOptions.find((option) => option.id === documentForm.linkedEntityId)?.detail}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Tags</Label>
              <Textarea value={documentForm.tags} onChange={(event) => setDocumentForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma separated tags" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetUploadState}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isSaving || !pendingFile}>
              <Upload className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedDocument(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
            <DialogDescription>Update metadata or remove this document from your local vault.</DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/40 p-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium">{selectedDocument.fileType.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Size</span>
                  <p className="font-medium">{formatSize(selectedDocument.size)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created</span>
                  <p className="font-medium">{selectedDocument.createdAt.slice(0, 10)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Updated</span>
                  <p className="font-medium">{selectedDocument.updatedAt.slice(0, 10)}</p>
                </div>
              </div>

              {selectedDocumentLinkSummary && (
                <div className="rounded-lg border bg-secondary/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Linked {selectedDocumentLinkSummary.typeLabel}
                  </div>
                  <p className="mt-1 text-sm font-medium">{selectedDocumentLinkSummary.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedDocumentLinkSummary.detail}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Preview</Label>
                <div className="overflow-hidden rounded-lg border bg-secondary/20">
                  {isLoadingPreview && (
                    <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                      Loading preview...
                    </div>
                  )}
                  {!isLoadingPreview && previewUrl && selectedDocument.fileType.toLowerCase() === "pdf" && (
                    <iframe title={selectedDocument.name} src={previewUrl} className="h-[320px] w-full bg-white" />
                  )}
                  {!isLoadingPreview && previewUrl && ["jpg", "jpeg", "png"].includes(selectedDocument.fileType.toLowerCase()) && (
                    <img src={previewUrl} alt={selectedDocument.name} className="max-h-[320px] w-full object-contain" />
                  )}
                  {!isLoadingPreview && !previewUrl && (
                    <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                      Preview is available for PDF and image documents in the desktop app.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs">Document Name</Label>
                <Input value={documentForm.name} onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={documentForm.category} onValueChange={(value) => setDocumentForm((current) => ({ ...current, category: value as VaultDocument["category"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banking">Banking</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Link Type</Label>
                  <Select
                    value={documentForm.linkedEntityType}
                    onValueChange={(value) =>
                      setDocumentForm((current) => ({
                        ...current,
                        linkedEntityType: value as DocumentFormState["linkedEntityType"],
                        linkedEntityId: "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked record</SelectItem>
                      <SelectItem value="transaction">Transaction</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="asset">Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Linked Item</Label>
                  <Select
                    value={documentForm.linkedEntityId || "none"}
                    disabled={documentForm.linkedEntityType === "none" || visibleLinkOptions.length === 0}
                    onValueChange={(value) =>
                      setDocumentForm((current) => ({
                        ...current,
                        linkedEntityId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder={documentForm.linkedEntityType === "none" ? "Choose link type first" : "Select a record"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked item</SelectItem>
                      {visibleLinkOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {documentForm.linkedEntityType !== "none" && visibleLinkOptions.length > 0 && documentForm.linkedEntityId && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {visibleLinkOptions.find((option) => option.id === documentForm.linkedEntityId)?.detail}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Tags</Label>
                <Textarea value={documentForm.tags} onChange={(event) => setDocumentForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma separated tags" />
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownloadDocument} disabled={!isTauriDesktop()} className="gap-2">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteDocument} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
                <Button onClick={handleUpdateDocument} className="gap-2">
                  <Edit2 className="h-4 w-4" /> Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
