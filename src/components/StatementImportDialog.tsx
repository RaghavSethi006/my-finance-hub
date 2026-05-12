import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { extractPdfText } from '@/lib/pdf-text';
import { parseStatementText, suggestCategoryId } from '@/lib/statement-import';
import type { Account, Category, Currency, Transaction } from '@/lib/types';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type StatementImportDialogProps = {
  accounts: Account[];
  categories: Category[];
  defaultCurrency: Currency;
  onImport: (transactions: Transaction[]) => void;
};

export function StatementImportDialog({
  accounts,
  categories,
  defaultCurrency,
  onImport,
}: StatementImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [statementText, setStatementText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '');
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');

  const parsed = useMemo(() => parseStatementText(statementText), [statementText]);
  const previewRows = parsed.entries.slice(0, 12);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        setIsExtractingPdf(true);
        setPdfStatus('Reading PDF...');
        const buffer = await file.arrayBuffer();
        const extracted = await extractPdfText(buffer, setPdfStatus);
        setStatementText(extracted.text);
        toast.success(
          extracted.mode === 'ocr'
            ? 'Scanned PDF processed with OCR'
            : 'PDF statement text extracted'
        );
      } else {
        const text = await file.text();
        setStatementText(text);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Unable to read the selected statement file');
    } finally {
      setIsExtractingPdf(false);
      setPdfStatus('');
      event.target.value = '';
    }
  };

  const handleImport = () => {
    if (!selectedAccountId) {
      toast.error('Choose the account that this statement belongs to');
      return;
    }

    if (parsed.entries.length === 0) {
      toast.error('Paste statement text or upload a CSV/TXT statement before importing');
      return;
    }

    const transactions: Transaction[] = parsed.entries.map((entry) => ({
      id: generateId('stmt-tx'),
      amount: entry.amount,
      type: entry.type === 'income' ? 'income' : 'expense',
      categoryId: suggestCategoryId(entry.description, entry.type, categories) ?? '',
      accountId: selectedAccountId,
      date: entry.date,
      note: entry.description,
      paymentMethod: entry.paymentMethod,
      currency: defaultCurrency,
      taxTag: 'untagged',
      isDeductible: false,
      isRecurring: false,
    }));

    onImport(transactions);
    toast.success(`Imported ${transactions.length} transaction${transactions.length === 1 ? '' : 's'} from the statement`);
    setOpen(false);
    setStatementText('');
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import Statement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
            <DialogDescription>
              Upload a PDF, CSV, or TXT statement, or paste monthly statement text. Aurum will extract recognizable rows and convert them into transaction logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-2">
                <Label>Statement text</Label>
                <Textarea
                  className="min-h-[220px]"
                  placeholder="Paste statement rows here, or upload a PDF/CSV/TXT statement..."
                  value={statementText}
                  onChange={(event) => setStatementText(event.target.value)}
                />
                <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" className="hidden" onChange={(event) => void handleFileChange(event)} />
                <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> {isExtractingPdf ? 'Extracting PDF...' : 'Upload Statement File'}
                </Button>
                {pdfStatus && <p className="text-xs text-muted-foreground">{pdfStatus}</p>}
              </div>

              <div className="space-y-3 rounded-xl border bg-secondary/10 p-4">
                <div>
                  <Label>Account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-lg font-semibold">{parsed.entries.length}</p>
                    <p className="text-xs text-muted-foreground">Rows recognized</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-lg font-semibold">{parsed.warnings.length}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Supported formats</p>
                  <p className="text-xs text-muted-foreground">
                    PDF bank statements with selectable text, CSV columns like date, description, debit, credit, amount, narration, remarks, and pasted lines like
                    {' '}
                    <span className="font-mono">04/21/2026 AMAZON 42.18 DR</span>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scanned PDFs now fall back to OCR automatically. The OCR bundle is English-first, so very low-quality scans may still need cleanup.
                  </p>
                </div>
              </div>
            </div>

            {parsed.warnings.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Import warnings</p>
                  <Badge variant="outline">{parsed.warnings.length}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {parsed.warnings.slice(0, 6).map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{entry.description}</TableCell>
                      <TableCell className="capitalize">{entry.type}</TableCell>
                      <TableCell className="capitalize">{entry.paymentMethod}</TableCell>
                      <TableCell className="text-right font-mono">{entry.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {previewRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Paste or upload a statement to preview imported rows.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {parsed.entries.length > previewRows.length && (
              <p className="text-xs text-muted-foreground">
                Previewing the first {previewRows.length} rows. {parsed.entries.length - previewRows.length} more rows will import too.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport}>Import Transactions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
