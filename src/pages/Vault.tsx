import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { decryptData } from "@/lib/encryption";
import { VaultSetupDialog } from "@/components/VaultSetupDialog";
import { VaultUnlockDialog } from "@/components/VaultUnlockDialog";
import { VaultItemForm } from "@/components/VaultItemForm";
import { 
  Lock, Plus, ArrowLeft, Eye, EyeOff, Trash2, Edit, 
  Globe, CreditCard, Key, FileText, Upload, Download, Copy, Shield 
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface VaultItem {
  id: string;
  title: string;
  item_type: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

const TYPE_ICONS: Record<string, any> = {
  credential: Globe,
  card: CreditCard,
  key: Key,
  note: FileText,
  file: Upload
};

const TYPE_LABELS: Record<string, string> = {
  credential: 'Login',
  card: 'Card',
  key: 'Secret Key',
  note: 'Note',
  file: 'File'
};

export default function Vault() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vaultSettings, setVaultSettings] = useState<any>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [decryptedItems, setDecryptedItems] = useState<Record<string, any>>({});
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await checkVaultSettings(session.user.id);
    setLoading(false);
  };

  const checkVaultSettings = async (userId: string) => {
    const { data, error } = await supabase
      .from('vault_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      setVaultSettings(data);
    }
  };

  const fetchVaultItems = async () => {
    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to fetch vault items");
      return;
    }

    setItems(data || []);
  };

  const handleUnlock = async (pin: string) => {
    setCurrentPin(pin);
    setIsUnlocked(true);
    await fetchVaultItems();
    toast.success("Vault unlocked!");
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setCurrentPin("");
    setDecryptedItems({});
    setVisibleItems(new Set());
    toast.info("Vault locked");
  };

  const toggleItemVisibility = async (item: VaultItem) => {
    const newVisibleItems = new Set(visibleItems);
    
    if (visibleItems.has(item.id)) {
      newVisibleItems.delete(item.id);
      setVisibleItems(newVisibleItems);
    } else {
      // Decrypt if not already decrypted
      if (!decryptedItems[item.id]) {
        try {
          const decrypted = await decryptData(item.encrypted_data, currentPin);
          setDecryptedItems(prev => ({ ...prev, [item.id]: JSON.parse(decrypted) }));
        } catch (error) {
          toast.error("Failed to decrypt item");
          return;
        }
      }
      newVisibleItems.add(item.id);
      setVisibleItems(newVisibleItems);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleEdit = async (item: VaultItem) => {
    try {
      const decrypted = await decryptData(item.encrypted_data, currentPin);
      setEditItem({
        id: item.id,
        title: item.title,
        item_type: item.item_type,
        decryptedData: JSON.parse(decrypted)
      });
      setShowItemForm(true);
    } catch (error) {
      toast.error("Failed to decrypt item for editing");
    }
  };

  const handleDelete = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    
    // If it's a file, delete from storage too
    if (item?.item_type === 'file' && decryptedItems[itemId]?.filePath) {
      await supabase.storage
        .from('vault-files')
        .remove([decryptedItems[itemId].filePath]);
    }

    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error("Failed to delete item");
      return;
    }

    toast.success("Item deleted");
    fetchVaultItems();
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('vault-files')
      .download(filePath);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDecryptedContent = (item: VaultItem) => {
    const data = decryptedItems[item.id];
    if (!data) return null;

    switch (item.item_type) {
      case 'credential':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Website:</span>
              <span className="font-mono">{data.website}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Username:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">{data.username}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(data.username, 'Username')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Password:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">••••••••</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(data.password, 'Password')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      case 'card':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Card:</span>
              <span className="font-mono">•••• {data.cardNumber?.slice(-4)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Holder:</span>
              <span>{data.cardHolder}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiry:</span>
              <span>{data.expiry}</span>
            </div>
          </div>
        );
      case 'key':
      case 'note':
        return (
          <div className="text-sm">
            <pre className="whitespace-pre-wrap font-mono text-xs bg-muted p-2 rounded max-h-40 overflow-y-auto">
              {data.content}
            </pre>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => copyToClipboard(data.content, 'Content')}>
              <Copy className="h-3 w-3 mr-2" /> Copy
            </Button>
          </div>
        );
      case 'file':
        return (
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">File:</span>
              <span>{data.fileName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span>{(data.fileSize / 1024).toFixed(2)} KB</span>
            </div>
            <Button size="sm" onClick={() => downloadFile(data.filePath, data.fileName)}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Secure Vault
              </h1>
              <p className="text-sm text-muted-foreground">
                Store your sensitive data with PIN protection
              </p>
            </div>
          </div>
          
          {isUnlocked && (
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditItem(null); setShowItemForm(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
              <Button variant="outline" onClick={handleLock}>
                <Lock className="h-4 w-4 mr-2" /> Lock
              </Button>
            </div>
          )}
        </div>

        {/* Main Content */}
        {!vaultSettings ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Set Up Your Vault</CardTitle>
              <CardDescription>
                Create a 4-digit PIN to start using your secure vault
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setShowSetupDialog(true)}>
                <Lock className="h-4 w-4 mr-2" /> Set Up PIN
              </Button>
            </CardContent>
          </Card>
        ) : !isUnlocked ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Lock className="h-5 w-5" />
                Vault Locked
              </CardTitle>
              <CardDescription>
                Enter your PIN to access your secure vault
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setShowUnlockDialog(true)}>
                Unlock Vault
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Vault Items</CardTitle>
              <CardDescription>
                {items.length} item{items.length !== 1 ? 's' : ''} stored securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No items in your vault yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowItemForm(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Your First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const Icon = TYPE_ICONS[item.item_type] || FileText;
                    const isVisible = visibleItems.has(item.id);
                    
                    return (
                      <Card key={item.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium">{item.title}</h3>
                                <Badge variant="secondary" className="mt-1">
                                  {TYPE_LABELS[item.item_type]}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleItemVisibility(item)}
                              >
                                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. The item will be permanently deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          
                          {isVisible && (
                            <div className="mt-4 pt-4 border-t">
                              {renderDecryptedContent(item)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <VaultSetupDialog
        open={showSetupDialog}
        onOpenChange={setShowSetupDialog}
        userId={user?.id}
        onSetupComplete={() => checkVaultSettings(user?.id)}
      />

      <VaultUnlockDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        storedPinHash={vaultSettings?.pin_hash || ""}
        onUnlock={handleUnlock}
      />

      {showItemForm && (
        <VaultItemForm
          open={showItemForm}
          onOpenChange={setShowItemForm}
          userId={user?.id}
          pin={currentPin}
          onItemAdded={fetchVaultItems}
          editItem={editItem}
        />
      )}
    </div>
  );
}
