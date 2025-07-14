import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
} from "@frontend/shadcn";
import {
  Copy,
  Plus,
  Trash2,
  Key,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useHttpClientBorrower,
  ApiKey,
  CreateApiKeyResponse,
} from "@frontend/http-client-borrower";

const createApiKeySchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(100, "Description too long"),
});

type CreateApiKeyForm = z.infer<typeof createApiKeySchema>;

export default function ApiKeysSettings() {
  const httpClient = useHttpClientBorrower();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<CreateApiKeyForm>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      description: "",
    },
  });

  const loadApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const keys = await httpClient.getApiKeys();
      setApiKeys(keys);
    } catch (error) {
      toast.error("Failed to load API keys");
      console.error("Error loading API keys:", error);
    } finally {
      setIsLoading(false);
    }
  }, [httpClient]);

  const createApiKey = async (data: CreateApiKeyForm) => {
    try {
      setIsCreating(true);
      const response: CreateApiKeyResponse =
        await httpClient.createApiKey(data);

      // Set the new API key to display
      setNewApiKey(response.api_key);
      setShowNewApiKey(true);

      // Close create dialog and reload keys
      setCreateDialogOpen(false);
      form.reset();
      await loadApiKeys();

      toast.success("API key created successfully");
    } catch (error) {
      toast.error("Failed to create API key");
      console.error("Error creating API key:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteApiKey = async (id: number) => {
    try {
      setIsDeleting(true);
      await httpClient.deleteApiKey(id);
      await loadApiKeys();
      toast.success("API key deleted successfully");
    } catch (error) {
      toast.error("Failed to delete API key");
      console.error("Error deleting API key:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingKey(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (_error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const openDeleteDialog = (apiKey: ApiKey) => {
    setDeletingKey(apiKey);
    setDeleteDialogOpen(true);
  };

  const closeNewApiKeyDisplay = () => {
    setNewApiKey(null);
    setShowNewApiKey(false);
  };

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const canCreateMore = apiKeys.length < 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground">
          Manage your API keys for programmatic access to your account.
        </p>
      </div>

      {/* New API Key Display */}
      {newApiKey && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <Key className="h-4 w-4" />
          <AlertTitle>New API Key Created</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              Your new API key has been created. Copy it now as it won't be
              shown again.
            </p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm bg-white dark:bg-gray-900 p-2 rounded border relative">
                  {showNewApiKey ? newApiKey : "•".repeat(50)}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1 h-6 w-6 p-0"
                    onClick={() => setShowNewApiKey(!showNewApiKey)}
                  >
                    {showNewApiKey ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <Button size="sm" onClick={() => copyToClipboard(newApiKey)}>
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={closeNewApiKeyDisplay}>
              I've saved my API key
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                You can have up to 5 API keys. Each key has full access to your
                account.
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canCreateMore}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    API keys provide programmatic access to your account. Keep
                    them secure.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(createApiKey)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Trading Bot, Mobile App"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? "Creating..." : "Create API Key"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No API keys created yet</p>
              <p className="text-sm">
                Create your first API key to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Key ID</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">
                      {apiKey.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(apiKey.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        lndst_sk_••••••••
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteDialog(apiKey)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!canCreateMore && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Limit Reached</AlertTitle>
              <AlertDescription>
                You have reached the maximum of 5 API keys. Delete an existing
                key to create a new one.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingKey && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Deleting the API key "<strong>{deletingKey.description}</strong>
                " will immediately revoke access for any applications using it.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingKey && deleteApiKey(deletingKey.id)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
