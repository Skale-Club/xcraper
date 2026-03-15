import { db } from '../db/index.js';
import { creditPackages } from '../db/schema.js';

const defaultPackages = [
    {
        id: 'pkg-starter',
        name: 'Starter Pack',
        credits: 250,
        price: '5.90',
        description: 'Perfect for trying out the platform',
        isPopular: false,
        isActive: true,
        sortOrder: 1,
    },
    {
        id: 'pkg-standard',
        name: 'Standard Pack',
        credits: 500,
        price: '10.90',
        description: 'Great for regular users',
        isPopular: true,
        isActive: true,
        sortOrder: 2,
    },
    {
        id: 'pkg-professional',
        name: 'Professional Pack',
        credits: 1000,
        price: '19.90',
        description: 'Best value for power users',
        isPopular: false,
        isActive: true,
        sortOrder: 3,
    },
    {
        id: 'pkg-enterprise',
        name: 'Enterprise Pack',
        credits: 2500,
        price: '44.90',
        description: 'For teams and agencies',
        isPopular: false,
        isActive: true,
        sortOrder: 4,
    },
    {
        id: 'pkg-unlimited',
        name: 'Unlimited Pack',
        credits: 5000,
        price: '79.90',
        description: 'Maximum savings for heavy users',
        isPopular: false,
        isActive: true,
        sortOrder: 5,
    },
];

async function seedPackages() {
    console.log('Seeding credit packages...');

    try {
        for (const pkg of defaultPackages) {
            await db.insert(creditPackages)
                .values(pkg)
                .onConflictDoUpdate({
                    target: creditPackages.id,
                    set: {
                        name: pkg.name,
                        credits: pkg.credits,
                        price: pkg.price,
                        description: pkg.description,
                        isPopular: pkg.isPopular,
                        isActive: pkg.isActive,
                        sortOrder: pkg.sortOrder,
                        updatedAt: new Date(),
                    },
                });
            console.log(`Upserted package: ${pkg.name}`);
        }

        console.log('Credit packages seeded successfully!');
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seedPackages();
