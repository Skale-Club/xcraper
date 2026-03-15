import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface ErrorDetails {
  type?: string;
  message?: string;
  stack?: string;
  apifyError?: any;
  statusCode?: number;
  timestamp?: string;
}

interface ErrorDetailsResponse {
  errorDetails?: ErrorDetails | null;
  errorMessage?: string | null;
  apifyStatusMessage?: string | null;
  completedAt?: string | null;
}

interface ErrorDetailsDialogProps {
  searchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ErrorDetailsDialog({ searchId, open, onOpenChange }: ErrorDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = JSON.stringify(errorDetails, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setFetchError(null);
      setCopied(false);
      return;
    }

    let isCancelled = false;

    const fetchErrorDetails = async () => {
      setLoading(true);
      setFetchError(null);
      setErrorDetails(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(getApiUrl(`/search/${searchId}/error-details`), {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to fetch error details");
        }

        const data: ErrorDetailsResponse = await response.json();

        if (!isCancelled) {
          setErrorDetails(
            data.errorDetails ?? (
              data.errorMessage || data.apifyStatusMessage
                ? {
                    type: "SearchError",
                    message: data.errorMessage || data.apifyStatusMessage || "Unknown error",
                    timestamp: data.completedAt || undefined,
                  }
                : null
            )
          );
        }
      } catch (error) {
        console.error("Error fetching error details:", error);

        if (!isCancelled) {
          setFetchError(error instanceof Error ? error.message : "Failed to fetch error details");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void fetchErrorDetails();

    return () => {
      isCancelled = true;
    };
  }, [open, searchId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Error Details
          </DialogTitle>
          <DialogDescription>
            Technical error information for search: {searchId}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : fetchError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </div>
        ) : errorDetails ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy JSON
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-3">
              {errorDetails.type && (
                <div>
                  <label className="text-sm font-medium">Error Type:</label>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded mt-1">
                    {errorDetails.type}
                  </p>
                </div>
              )}

              {errorDetails.message && (
                <div>
                  <label className="text-sm font-medium">Message:</label>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded mt-1 break-words">
                    {errorDetails.message}
                  </p>
                </div>
              )}

              {errorDetails.statusCode && (
                <div>
                  <label className="text-sm font-medium">Status Code:</label>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded mt-1">
                    {errorDetails.statusCode}
                  </p>
                </div>
              )}

              {errorDetails.timestamp && (
                <div>
                  <label className="text-sm font-medium">Timestamp:</label>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded mt-1">
                    {new Date(errorDetails.timestamp).toLocaleString()}
                  </p>
                </div>
              )}

              {errorDetails.apifyError && (
                <div>
                  <label className="text-sm font-medium">Apify Error:</label>
                  <pre className="text-xs text-muted-foreground bg-muted p-3 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-words max-w-full">
                    {JSON.stringify(errorDetails.apifyError, null, 2)}
                  </pre>
                </div>
              )}

              {errorDetails.stack && (
                <div>
                  <label className="text-sm font-medium">Stack Trace:</label>
                  <pre className="text-xs text-muted-foreground bg-muted p-3 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-words max-w-full">
                    {errorDetails.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No error details available for this search.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
