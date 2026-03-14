import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminUser } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageIntro from '@/components/app/PageIntro';
import { useToast } from '@/hooks/use-toast';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Edit,
    Coins,
    Shield,
    ShieldCheck,
    UserX
} from 'lucide-react';

function UserRow({
    user,
    onEdit,
    onAddCredits,
    onToggleAdmin,
    onDeactivate
}: {
    user: AdminUser;
    onEdit: (user: AdminUser) => void;
    onAddCredits: (user: AdminUser) => void;
    onToggleAdmin: (user: AdminUser) => void;
    onDeactivate: (user: AdminUser) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <tr className="border-b">
            <td className="py-3 px-4">
                <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
            </td>
            <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                    {user.role === 'admin' ? (
                        <>
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                        </>
                    ) : (
                        <>
                            <Shield className="h-3 w-3" />
                            User
                        </>
                    )}
                </span>
            </td>
            <td className="py-3 px-4">
                <span className="font-medium">{user.credits}</span>
            </td>
            <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${user.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td className="py-3 px-4">
                <span className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                </span>
            </td>
            <td className="py-3 px-4">
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-20 py-1">
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                    onClick={() => { onEdit(user); setShowMenu(false); }}
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit User
                                </button>
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                    onClick={() => { onAddCredits(user); setShowMenu(false); }}
                                >
                                    <Coins className="h-4 w-4" />
                                    Add Credits
                                </button>
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                    onClick={() => { onToggleAdmin(user); setShowMenu(false); }}
                                >
                                    <Shield className="h-4 w-4" />
                                    {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                </button>
                                <hr className="my-1" />
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-600"
                                    onClick={() => { onDeactivate(user); setShowMenu(false); }}
                                >
                                    <UserX className="h-4 w-4" />
                                    Deactivate
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function AdminUsersPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [creditsUser, setCreditsUser] = useState<AdminUser | null>(null);
    const [creditsAmount, setCreditsAmount] = useState(10);
    const [creditsDescription, setCreditsDescription] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'users', page],
        queryFn: () => adminApi.getUsers(page, 20),
    });

    const updateMutation = useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: Parameters<typeof adminApi.updateUser>[1] }) =>
            adminApi.updateUser(userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            toast({ title: 'User updated successfully' });
            setEditingUser(null);
        },
        onError: (error: Error) => {
            toast({
                title: 'Error updating user',
                description: error.message,
                variant: 'destructive'
            });
        },
    });

    const addCreditsMutation = useMutation({
        mutationFn: ({ userId, amount, description }: { userId: string; amount: number; description?: string }) =>
            adminApi.addCredits(userId, amount, description),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            toast({ title: 'Credits added successfully' });
            setCreditsUser(null);
            setCreditsAmount(10);
            setCreditsDescription('');
        },
        onError: (error: Error) => {
            toast({
                title: 'Error adding credits',
                description: error.message,
                variant: 'destructive'
            });
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: (userId: string) => adminApi.deleteUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            toast({ title: 'User deactivated successfully' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error deactivating user',
                description: error.message,
                variant: 'destructive'
            });
        },
    });

    const handleToggleAdmin = (user: AdminUser) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        updateMutation.mutate({
            userId: user.id,
            data: { role: newRole }
        });
    };

    const handleDeactivate = (user: AdminUser) => {
        if (confirm(`Are you sure you want to deactivate ${user.name}?`)) {
            deactivateMutation.mutate(user.id);
        }
    };

    const handleAddCredits = () => {
        if (creditsUser) {
            addCreditsMutation.mutate({
                userId: creditsUser.id,
                amount: creditsAmount,
                description: creditsDescription || undefined,
            });
        }
    };

    // Filter users by search query
    const filteredUsers = data?.users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Admin"
                title="User Management"
                description="View and manage all registered users"
            />

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Users</CardTitle>
                            <CardDescription>
                                {data?.pagination.total ?? 0} total users
                            </CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-64"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Credits</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers?.map(user => (
                                            <UserRow
                                                key={user.id}
                                                user={user}
                                                onEdit={setEditingUser}
                                                onAddCredits={setCreditsUser}
                                                onToggleAdmin={handleToggleAdmin}
                                                onDeactivate={handleDeactivate}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {data && data.pagination.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {data.pagination.page} of {data.pagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                            disabled={page === data.pagination.totalPages}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Edit User</CardTitle>
                            <CardDescription>Update user information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    defaultValue={editingUser.name}
                                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="credits">Credits</Label>
                                <Input
                                    id="credits"
                                    type="number"
                                    defaultValue={editingUser.credits}
                                    onChange={(e) => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setEditingUser(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => updateMutation.mutate({
                                        userId: editingUser.id,
                                        data: {
                                            name: editingUser.name,
                                            credits: editingUser.credits,
                                        }
                                    })}
                                    disabled={updateMutation.isPending}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Add Credits Modal */}
            {creditsUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Add Credits</CardTitle>
                            <CardDescription>
                                Add credits to {creditsUser.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={creditsAmount}
                                    onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
                                    min={1}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (optional)</Label>
                                <Input
                                    id="description"
                                    placeholder="e.g., Compensation for bug"
                                    value={creditsDescription}
                                    onChange={(e) => setCreditsDescription(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setCreditsUser(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddCredits}
                                    disabled={addCreditsMutation.isPending}
                                >
                                    Add {creditsAmount} Credits
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
