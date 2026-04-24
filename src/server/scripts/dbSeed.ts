import { faker } from '@faker-js/faker';
import { type PrismaClient } from '@prisma/client';
import {
    sanitizeAndSerializeProviderData,
    createProviderId,
} from 'wasp/auth/utils';

/**
 * Seeds the admin user (ceo@lemonode.pl), a business, aspect schema,
 * reviews with varied ratings/sentiments, and aspect mentions —
 * everything needed to test AI hardening workflows end-to-end.
 */
export async function seedAdminWithReviews(prismaClient: PrismaClient) {
    // 1. Create admin user
    const adminUser = await prismaClient.user.create({
        data: {
            email: 'ceo@lemonode.pl',
            username: 'ceo@lemonode.pl',
            isAdmin: true,
            name: 'CEO Admin',
            subscriptionStatus: 'active',
            subscriptionPlan: 'premium',
            datePaid: new Date(),
            subscriptionEndDate: faker.date.future(),
        },
    });

    // 2. Create auth identity so we can log in with ceo123!@#
    const providerId = createProviderId('email', 'ceo@lemonode.pl');
    const providerData = await sanitizeAndSerializeProviderData<'email'>({
        hashedPassword: 'ceo123!@#',
        isEmailVerified: true,
        emailVerificationSentAt: null,
        passwordResetSentAt: null,
    });

    await prismaClient.auth.create({
        data: {
            userId: adminUser.id,
            identities: {
                create: {
                    providerName: providerId.providerName,
                    providerUserId: providerId.providerUserId,
                    providerData: providerData,
                },
            },
        },
    });

    console.log(`Seeded admin user (ceo@lemonode.pl)`);
}