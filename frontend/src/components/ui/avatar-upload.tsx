import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadApi, ApiError } from '@/lib/api';
import { Camera, Loader2, Trash2, User } from 'lucide-react';

interface AvatarUploadProps {
    currentUrl?: string | null;
    userName?: string;
    onUploadComplete?: (url: string) => void;
    onDeleteComplete?: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    editable?: boolean;
}

const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
    xl: 'h-32 w-32',
};

const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10',
};

export function AvatarUpload({
    currentUrl,
    userName,
    onUploadComplete,
    onDeleteComplete,
    size = 'lg',
    editable = true,
}: AvatarUploadProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please upload an image file' });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Error', description: 'Image must be less than 2MB' });
            return;
        }

        setIsUploading(true);
        try {
            const result = await uploadApi.uploadAvatar(file);
            queryClient.invalidateQueries({ queryKey: ['user'] });
            onUploadComplete?.(result.url);
            toast({ title: 'Avatar updated successfully!' });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to upload avatar';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsUploading(false);
        }
    }, [toast, queryClient, onUploadComplete]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await uploadApi.deleteAvatar();
            queryClient.invalidateQueries({ queryKey: ['user'] });
            onDeleteComplete?.();
            toast({ title: 'Avatar removed successfully!' });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to remove avatar';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
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
        if (file) handleFile(file);
    };

    const isLoading = isUploading || isDeleting;

    return (
        <div className="flex flex-col items-center gap-3">
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleChange}
                disabled={!editable || isLoading}
                className="hidden"
            />

            <div
                onClick={() => editable && !isLoading && inputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                    'relative rounded-full overflow-hidden bg-muted transition-all',
                    sizeClasses[size],
                    editable && !isLoading && 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2',
                    dragActive && 'ring-2 ring-primary ring-offset-2',
                    isLoading && 'opacity-50 cursor-wait'
                )}
            >
                {currentUrl ? (
                    <img
                        src={currentUrl}
                        alt={userName || 'Avatar'}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                        <User className={cn('text-muted-foreground', iconSizes[size])} />
                    </div>
                )}

                {editable && !isLoading && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-5 w-5 text-white" />
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                )}
            </div>

            {editable && currentUrl && !isLoading && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                </Button>
            )}

            {editable && !currentUrl && (
                <p className="text-xs text-muted-foreground">
                    Click or drag to upload
                </p>
            )}
        </div>
    );
}
