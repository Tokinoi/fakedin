// seed.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Créer des utilisateurs
    const users = await prisma.user.createMany({
        data: [
            { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com' },
            { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com' },
            { firstName: 'Clara', lastName: 'Brown', email: 'clara@example.com' },
            { firstName: 'David', lastName: 'Wilson', email: 'david@example.com' },
            { firstName: 'Eva', lastName: 'Taylor', email: 'eva@example.com' },
        ],
    });

    // Créer des connexions entre utilisateurs
    const connections = await prisma.connection.createMany({
        data: [
            { user1Id: 1, user2Id: 2 }, // Alice et Bob
            { user1Id: 1, user2Id: 3 }, // Alice et Clara
            { user1Id: 2, user2Id: 4 }, // Bob et David
            { user1Id: 3, user2Id: 5 }, // Clara et Eva
            { user1Id: 4, user2Id: 1 }, // David et Alice
        ],
    });

    // Créer des posts
    const posts = await prisma.post.createMany({
        data: [
            { content: 'First post by Alice!', authorId: 1 },
            { content: 'Bob is sharing his first post.', authorId: 2 },
            { content: 'Clara is loving Prisma!', authorId: 3 },
            { content: 'David is working on a new project.', authorId: 4 },
            { content: 'Eva just finished her first marathon.', authorId: 5 },
        ],
    });

    // Créer des commentaires sur les posts
    const comments = await prisma.comment.createMany({
        data: [
            { content: 'Great post, Alice!', postId: 1, authorId: 2 }, // Bob commente le post d'Alice
            { content: 'Thanks, Bob!', postId: 1, authorId: 1 }, // Alice répond à Bob
            { content: 'Prisma is awesome indeed!', postId: 3, authorId: 4 }, // David commente le post de Clara
            { content: 'Congrats on the marathon, Eva!', postId: 5, authorId: 3 }, // Clara félicite Eva
        ],
    });

    // Créer des likes sur les posts
    const likes = await prisma.like.createMany({
        data: [
            { postId: 1, userId: 2 }, // Bob aime le post d'Alice
            { postId: 2, userId: 1 }, // Alice aime le post de Bob
            { postId: 3, userId: 5 }, // Eva aime le post de Clara
            { postId: 4, userId: 3 }, // Clara aime le post de David
            { postId: 5, userId: 4 }, // David aime le post d'Eva
        ],
    });

    // Créer des messages entre utilisateurs
    const messages = await prisma.message.createMany({
        data: [
            { content: 'Hey Bob, how are you?', senderId: 1, receiverId: 2 }, // Alice envoie un message à Bob
            { content: 'I\'m good, thanks Alice!', senderId: 2, receiverId: 1 }, // Bob répond à Alice
            { content: 'Clara, do you want to grab coffee?', senderId: 4, receiverId: 3 }, // David envoie un message à Clara
            { content: 'Sure, let\'s meet tomorrow!', senderId: 3, receiverId: 4 }, // Clara répond à David
        ],
    });

    console.log({ users, connections, posts, comments, likes, messages });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
