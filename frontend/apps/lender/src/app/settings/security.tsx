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
  Shield,
  Loader,
  CircleAlert,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useLenderHttpClient,
  ApiKey,
  CreateApiKeyResponse,
  useAuth,
} from "@frontend/http-client-lender";

const createApiKeySchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(100, "Description too long"),
});

type CreateApiKeyForm = z.infer<typeof createApiKeySchema>;

export default function SecuritySettings() {
  const httpClient = useLenderHttpClient();
  const { user, refreshUser } = useAuth();
  const { setupTotp, verifyTotp, disableTotp } = httpClient;

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // TOTP state
  const [totpSetupData, setTotpSetupData] = useState<{
    qr_code_uri: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isTotpLoading, setIsTotpLoading] = useState(false);
  const [showTotpDialog, setShowTotpDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableTotpCode, setDisableTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");

  const form = useForm<CreateApiKeyForm>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      description: "",
    },
  });

  // TOTP handlers
  const handleSetupTotp = async () => {
    setIsTotpLoading(true);
    setTotpError("");
    try {
      const response = await setupTotp();
      setTotpSetupData(response);
      setShowTotpDialog(true);
    } catch (err) {
      console.error("Failed setting up TOTP:", err);
      toast.error(`Failed to setup TOTP: ${err}`);
    }
    setIsTotpLoading(false);
  };

  const handleVerifyTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setTotpError("Please enter a valid 6-digit code");
      return;
    }

    setIsTotpLoading(true);
    setTotpError("");
    try {
      await verifyTotp({ totp_code: totpCode });
      toast.success(
        "TOTP successfully enabled! Your account is now more secure.",
      );
      setShowTotpDialog(false);
      setTotpSetupData(null);
      setTotpCode("");
      setTotpError("");
      await refreshUser();
    } catch (err) {
      console.error("Failed verifying TOTP:", err);
      setTotpError(`Failed to verify TOTP code: ${err}`);
    }
    setIsTotpLoading(false);
  };

  const handleDisableTotp = async () => {
    if (!disableTotpCode || disableTotpCode.length !== 6) {
      setTotpError("Please enter a valid 6-digit code");
      return;
    }

    setIsTotpLoading(true);
    setTotpError("");
    try {
      await disableTotp({ totp_code: disableTotpCode });
      toast.success("TOTP has been disabled successfully");
      setShowDisableDialog(false);
      setDisableTotpCode("");
      await refreshUser();
    } catch (err) {
      console.error("Failed disabling TOTP:", err);
      setTotpError("Invalid TOTP code. Please try again.");
    }
    setIsTotpLoading(false);
  };

  // API Key handlers
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

      setNewApiKey(response.api_key);
      setShowNewApiKey(true);
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

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Manage your security settings and API access.
        </p>
      </div>

      {/* TOTP Section */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using TOTP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Shield
                className={`h-5 w-5 ${user.totp_enabled ? "text-green-600" : "text-blue-600"}`}
              />
              <div>
                <h5 className="text-sm font-medium">
                  Time-based One-Time Password (TOTP)
                </h5>
                <p className="mt-1 text-xs text-gray-500">
                  {user.totp_enabled
                    ? "Your account is protected with TOTP authentication"
                    : "Secure your account with authenticator app codes"}
                </p>
              </div>
            </div>
            {user.totp_enabled ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-green-300 text-green-700"
                >
                  <Shield className="mr-1 h-3 w-3" />
                  Enabled
                </Badge>
                <Button
                  onClick={() => setShowDisableDialog(true)}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Disable
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleSetupTotp}
                disabled={isTotpLoading}
                size="sm"
                variant="outline"
              >
                {isTotpLoading ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                Setup TOTP
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOTP Setup Dialog */}
      <Dialog
        open={showTotpDialog}
        onOpenChange={(open) => {
          setShowTotpDialog(open);
          if (!open) {
            setTotpError("");
            setTotpCode("");
            setTotpSetupData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (like Google
              Authenticator, Authy, or 1Password).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {totpError && (
              <Alert variant="destructive" className="text-sm">
                <CircleAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {totpError}
                </AlertDescription>
              </Alert>
            )}
            {totpSetupData && (
              <div className="space-y-4">
                {/* QR Code */}
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupData.qr_code_uri)}`}
                    alt="TOTP QR Code"
                    className="h-48 w-48"
                  />
                </div>

                {/* Manual Entry */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Can't scan the QR code?</p>
                  <p className="text-xs text-gray-500">
                    Manually enter this secret in your authenticator app:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                      {totpSetupData.secret}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSetupData.secret);
                        toast.success("Secret copied to clipboard!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Verification */}
                <div className="space-y-2">
                  <label htmlFor="totp-code" className="text-sm font-medium">
                    Enter the 6-digit code from your authenticator app:
                  </label>
                  <Input
                    id="totp-code"
                    type="text"
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleVerifyTotp}
                    disabled={isTotpLoading || totpCode.length !== 6}
                    className="flex-1"
                  >
                    {isTotpLoading ? (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify & Enable
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTotpDialog(false);
                      setTotpSetupData(null);
                      setTotpCode("");
                      setTotpError("");
                    }}
                    disabled={isTotpLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {!totpSetupData && !totpError && (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">
                  Setting up TOTP...
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* TOTP Disable Dialog */}
      <Dialog
        open={showDisableDialog}
        onOpenChange={(open) => {
          setShowDisableDialog(open);
          if (!open) {
            setTotpError("");
            setDisableTotpCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your current TOTP code to confirm disabling two-factor
              authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {totpError && (
              <Alert variant="destructive" className="text-sm">
                <CircleAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {totpError}
                </AlertDescription>
              </Alert>
            )}

            <Alert
              variant="default"
              className="border-yellow-200 bg-yellow-50 text-yellow-900"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Disabling TOTP will reduce your account security. Make sure you
                understand the risks.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label
                htmlFor="disable-totp-code"
                className="text-sm font-medium"
              >
                Enter 6-digit code from your authenticator app:
              </label>
              <Input
                id="disable-totp-code"
                type="text"
                placeholder="123456"
                value={disableTotpCode}
                onChange={(e) =>
                  setDisableTotpCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleDisableTotp}
                disabled={isTotpLoading || disableTotpCode.length !== 6}
                className="flex-1"
                variant="destructive"
              >
                {isTotpLoading ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Disable TOTP
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisableTotpCode("");
                  setTotpError("");
                }}
                disabled={isTotpLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <div className="min-w-0 flex-1">
                <div className="relative rounded border bg-white p-2 font-mono text-sm dark:bg-gray-900">
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

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for programmatic access. You can have up to
                5 keys.
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
            <div className="text-muted-foreground py-8 text-center">
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
