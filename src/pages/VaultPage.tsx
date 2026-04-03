import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinOS } from "@/lib/store";
import { Shield, Lock, Unlock, FileText, Upload, Search, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const FILE_ICONS: Record<string, string> = { pdf: '📄', jpg: '🖼️', png: '🖼️', docx: '📝' };

export default function VaultPage() {
  const { documents, isVaultLocked, toggleVaultLock } = useFinOS();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');

  const filtered = documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const categoryCounts = documents.reduce((acc, d) => { acc[d.category] = (acc[d.category] || 0) + 1; return acc; }, {} as Record<string, number>);

  if (isVaultLocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Vault is Locked</h2>
            <p className="text-sm text-muted-foreground">Enter your master password to access encrypted documents</p>
            <Input type="password" placeholder="Master password" className="max-w-xs mx-auto" />
            <Button onClick={toggleVaultLock} className="w-full max-w-xs">
              <Unlock className="h-4 w-4 mr-2" /> Unlock Vault
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Vault</h1>
          <p className="text-sm text-muted-foreground">AES-256 encrypted document storage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleVaultLock} className="gap-2">
            <Lock className="h-4 w-4" /> Lock
          </Button>
          <Button className="gap-2"><Upload className="h-4 w-4" /> Upload</Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="cursor-pointer">All ({documents.length})</Badge>
        {Object.entries(categoryCounts).map(([cat, count]) => (
          <Badge key={cat} variant="outline" className="cursor-pointer capitalize">{cat} ({count})</Badge>
        ))}
      </div>

      {/* Search + View Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
          {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Documents */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center text-lg">
                    {FILE_ICONS[doc.fileType] || '📄'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.fileType.toUpperCase()} · {(doc.size / 1000).toFixed(0)} KB</p>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="secondary" className="text-[10px] capitalize">{doc.category}</Badge>
                      {doc.linkedEntityType && <Badge variant="outline" className="text-[10px]">Linked</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map(doc => (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{FILE_ICONS[doc.fileType] || '📄'}</span>
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">{doc.category}</Badge>
                    <span className="text-xs text-muted-foreground">{(doc.size / 1000).toFixed(0)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
