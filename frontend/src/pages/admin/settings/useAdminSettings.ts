import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, ApiError, AdminSettings, AdminCreditPackage, AdminSystemSettings } from '@/lib/api';

export function useAdminSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: () => settingsApi.getAdmin(),
    });

    const settings: Partial<AdminSettings> = data?.settings ?? {};
    const systemSettings: Partial<AdminSystemSettings> = data?.systemSettings ?? {};
    const packages: AdminCreditPackage[] = data?.packages ?? [];

    const updateMutation = useMutation({
        mutationFn: (data: Partial<AdminSettings>) => settingsApi.update(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Settings saved successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to save settings';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const updateSystemMutation = useMutation({
        mutationFn: (data: Partial<AdminSystemSettings>) => settingsApi.updateSystem(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'System settings saved successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to save system settings';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const createPackageMutation = useMutation({
        mutationFn: (data: Parameters<typeof settingsApi.createPackage>[0]) =>
            settingsApi.createPackage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package created successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to create package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const deletePackageMutation = useMutation({
        mutationFn: (id: string) => settingsApi.deletePackage(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package deleted successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const updatePackageMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof settingsApi.updatePackage>[1] }) =>
            settingsApi.updatePackage(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package updated successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const handleSave = (data: Partial<AdminSettings>) => {
        updateMutation.mutate(data);
    };

    const optionalValue = (value: string) => value || undefined;

    return {
        settings,
        systemSettings,
        packages,
        isLoading,
        handleSave,
        saveSetting: handleSave,
        saveSystemSetting: updateSystemMutation.mutate,
        optionalValue,
        isSaving: updateMutation.isPending,
        isSavingSystem: updateSystemMutation.isPending,
        createPackage: createPackageMutation.mutate,
        deletePackage: deletePackageMutation.mutate,
        updatePackage: updatePackageMutation.mutate,
        isCreating: createPackageMutation.isPending,
        isDeleting: deletePackageMutation.isPending,
        isUpdating: updatePackageMutation.isPending,
    };
}

export function useCreditPackages() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: (data: Parameters<typeof settingsApi.createPackage>[0]) =>
            settingsApi.createPackage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package created successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to create package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => settingsApi.deletePackage(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package deleted successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof settingsApi.updatePackage>[1] }) =>
            settingsApi.updatePackage(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package updated successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    return {
        createPackage: createMutation.mutate,
        deletePackage: deleteMutation.mutate,
        updatePackage: updateMutation.mutate,
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdating: updateMutation.isPending,
    };
}
