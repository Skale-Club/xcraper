import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usersApi, integrationsApi, ApiError } from '@/lib/api';
import {
    Loader2,
    Lock,
    Save,
    Plug,
    Trash2,
    CheckCircle2,
} from 'lucide-react';

export default function ProfilePage() {
    const { toast } = useToast();
    const { user, refreshUser, updatePassword } = useAuth();
    const queryClient = useQueryClient();

    const [name, setName] = useState(user?.name || '');
    const [company, setCompany] = useState(user?.company || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const updateProfileMutation = useMutation({
        mutationFn: (data: { name: string; company?: string; phone?: string }) =>
            usersApi.updateProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] });
            refreshUser?.();
            toast({ title: 'Profile updated successfully!' });
            setIsUpdating(false);
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update profile';
            toast({ variant: 'destructive', title: 'Error', description: message });
            setIsUpdating(false);
        },
    });

    const changePasswordMutation = useMutation({
        // Password changes go through Supabase Auth (the active session proves
        // identity); there is no backend /auth/change-password route. updatePassword
        // shows its own success toast on completion.
        mutationFn: async (data: { newPassword: string }) => {
            const { error } = await updatePassword(data.newPassword);
            if (error) {
                throw new Error(error);
            }
        },
        onSuccess: () => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsChangingPassword(false);
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : (error.message || 'Failed to change password');
            toast({ variant: 'destructive', title: 'Error', description: message });
            setIsChangingPassword(false);
        },
    });

    // ── Xphere integration (per-user API key) ──────────────────────────────────
    const [xphereKey, setXphereKey] = useState('');
    // When a key is already saved, the field shows a masked (dots) value instead of
    // an empty placeholder. Focusing it switches to edit mode to enter a new key.
    const [editingXphere, setEditingXphere] = useState(false);
    const xphereQuery = useQuery({
        queryKey: ['xphere-key'],
        queryFn: () => integrationsApi.getXphereKey(),
    });
    const saveXphereMutation = useMutation({
        mutationFn: (apiKey: string) => integrationsApi.saveXphereKey({ apiKey }),
        onSuccess: (data) => {
            toast({ title: data.message });
            setXphereKey('');
            setEditingXphere(false);
            queryClient.invalidateQueries({ queryKey: ['xphere-key'] });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to save Xphere key';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });
    const removeXphereMutation = useMutation({
        mutationFn: () => integrationsApi.deleteXphereKey(),
        onSuccess: (data) => {
            toast({ title: data.message });
            setXphereKey('');
            setEditingXphere(false);
            queryClient.invalidateQueries({ queryKey: ['xphere-key'] });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to remove key';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const handleSaveXphere = () => {
        if (!xphereKey.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Paste your Xphere API key' });
            return;
        }
        saveXphereMutation.mutate(xphereKey.trim());
    };

    const handleUpdateProfile = () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
            return;
        }
        setIsUpdating(true);
        updateProfileMutation.mutate({ name, company, phone });
    };

    const handleChangePassword = () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast({ variant: 'destructive', title: 'Error', description: 'All password fields are required' });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: 'Error', description: 'New passwords do not match' });
            return;
        }
        if (newPassword.length < 6) {
            toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters' });
            return;
        }
        setIsChangingPassword(true);
        changePasswordMutation.mutate({ newPassword });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-start gap-6">
                        <AvatarUpload
                            currentUrl={user?.avatarUrl}
                            userName={user?.name}
                            size="xl"
                            editable={true}
                            onUploadComplete={() => {
                                queryClient.invalidateQueries({ queryKey: ['user'] });
                                refreshUser?.();
                            }}
                            onDeleteComplete={() => {
                                queryClient.invalidateQueries({ queryKey: ['user'] });
                                refreshUser?.();
                            }}
                        />
                        <div className="flex-1 space-y-1">
                            <p className="font-medium text-lg">{user?.name}</p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Click on the avatar to upload a new photo. Supports PNG, JPG, WEBP, and GIF (max 2MB).
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company">Company</Label>
                            <Input
                                id="company"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                placeholder="Your company"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Your phone"
                            />
                        </div>
                    </div>

                    <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                        {isUpdating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                        />
                    </div>
                    <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                        {isChangingPassword ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Lock className="mr-2 h-4 w-4" />
                        )}
                        Change Password
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plug className="h-5 w-5" /> Xphere Integration
                    </CardTitle>
                    <CardDescription>
                        Connect your Xphere CRM so scraped leads can be pushed straight in as prospects.
                        Create a key in Xphere → Settings → API Keys with the{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">prospects:write</code> scope, then paste it here.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {xphereQuery.data?.configured ? (
                        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>
                                    Connected — <span className="font-mono">{xphereQuery.data.keyPreview}</span>
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeXphereMutation.mutate()}
                                disabled={removeXphereMutation.isPending}
                                title="Remove Xphere key"
                            >
                                {removeXphereMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not connected yet.</p>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="xphereKey">
                            {xphereQuery.data?.configured ? 'Replace API key' : 'Xphere API key'}
                        </Label>
                        <Input
                            id="xphereKey"
                            type="password"
                            // When a key is saved and the user hasn't started editing, show a
                            // masked (dots) value so the field reads as "filled", not empty.
                            value={xphereQuery.data?.configured && !editingXphere ? 'xphapikeyplaceholder' : xphereKey}
                            readOnly={Boolean(xphereQuery.data?.configured) && !editingXphere}
                            onFocus={() => {
                                if (xphereQuery.data?.configured && !editingXphere) {
                                    setEditingXphere(true);
                                    setXphereKey('');
                                }
                            }}
                            onBlur={() => {
                                if (editingXphere && !xphereKey.trim()) {
                                    setEditingXphere(false);
                                }
                            }}
                            onChange={(e) => setXphereKey(e.target.value)}
                            placeholder={xphereQuery.data?.configured ? undefined : 'xph_...'}
                            autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">
                            {xphereQuery.data?.configured
                                ? 'A key is saved. Click the field to enter a new one. It is verified before saving and never shown again.'
                                : 'The key is verified with Xphere before saving and is never shown again.'}
                        </p>
                    </div>

                    <Button onClick={handleSaveXphere} disabled={saveXphereMutation.isPending || !xphereKey.trim()}>
                        {saveXphereMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {xphereQuery.data?.configured ? 'Update key' : 'Connect Xphere'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
