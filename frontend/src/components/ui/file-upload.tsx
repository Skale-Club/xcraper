import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, X, Loader2, Image as ImageIcon, FileIcon } from 'lucide-react';

interface FileUploadProps {
    onUpload: (file: File) => Promise<void>;
    onDelete?: () => Promise<void>;
    currentUrl?: string | null;
    accept?: string;
    maxSize?: number;
    className?: string;
    disabled?: boolean;
    previewType?: 'image' | 'file';
    deleteText?: string;
}

export function FileUpload({
    onUpload,
    onDelete,
    currentUrl,
    accept = 'image/*',
    maxSize = 5 * 1024 * 1024,
    className,
    disabled = false,
    previewType = 'image',
    deleteText = 'Remove',
}: FileUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        setError(null);

        if (file.size > maxSize) {
            setError(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
            return;
        }

        setIsUploading(true);
        try {
            await onUpload(file);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [maxSize, onUpload]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setIsDeleting(false);
        }
    };

    const openFileDialog = () => {
        inputRef.current?.click();
    };

    const isLoading = isUploading || isDeleting;

    return (
        <div className={cn('space-y-2', className)}>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleChange}
                disabled={disabled || isLoading}
                className="hidden"
            />

            {currentUrl ? (
                <div className="relative group">
                    {previewType === 'image' ? (
                        <div className="relative w-full h-32 rounded-lg border border-border overflow-hidden bg-muted">
                            <img
                                src={currentUrl}
                                alt="Preview"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted">
                            <FileIcon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm truncate flex-1">{currentUrl.split('/').pop()}</span>
                        </div>
                    )}

                    {!disabled && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={openFileDialog}
                                disabled={isLoading}
                            >
                                {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                <span className="ml-1">Change</span>
                            </Button>
                            {onDelete && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={isLoading}
                                >
                                    {isDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <X className="h-4 w-4" />
                                    )}
                                    <span className="ml-1">{deleteText}</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div
                    onClick={disabled || isLoading ? undefined : openFileDialog}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={cn(
                        'relative w-full h-32 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
                        dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                        disabled && 'opacity-50 cursor-not-allowed',
                        isLoading && 'cursor-wait'
                    )}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        {isUploading ? (
                            <>
                                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                                <span className="text-sm text-muted-foreground">Uploading...</span>
                            </>
                        ) : (
                            <>
                                {previewType === 'image' ? (
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                ) : (
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                )}
                                <span className="text-sm text-muted-foreground">
                                    Drag & drop or click to upload
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Max {Math.round(maxSize / 1024 / 1024)}MB
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
