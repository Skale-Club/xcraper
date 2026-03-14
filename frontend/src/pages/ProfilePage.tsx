import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { authApi, usersApi, ApiError } from '@/lib/api';
import {
    Loader2,
    Lock,
    Save,
} from 'lucide-react';

export default function ProfilePage() {
    const { toast } = useToast();
    const { user, refreshUser } = useAuth();
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
        mutationFn: (data: { currentPassword: string; newPassword: string }) =>
            authApi.changePassword(data.currentPassword, data.newPassword),
        onSuccess: () => {
            toast({ title: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsChangingPassword(false);
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to change password';
            toast({ variant: 'destructive', title: 'Error', description: message });
            setIsChangingPassword(false);
        },
    });

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
        changePasswordMutation.mutate({ currentPassword, newPassword });
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
        </div>
    );
}
