import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import {PrismaClient} from "@prisma/client";
import DataLoader from 'DataLoader';
import express from "express";
import cookieParser from "cookie-parser"
import {expressMiddleware} from "@apollo/server/express4";

const prisma = new PrismaClient();

const typeDefs = `#graphql

type Query{
    user: [User!]!
    message: [Message!]!
    post: [Post!]!
    like: [Like!]!
    getConversation(input: queryConversation): [Message!]
}
input queryConversation{
    id:Int!
    id2:Int!
}
type User{
    id : Int! 
    firstName : String!
    lastName : String! 
    email : String!
    connexion : [User!]
    posts : [Post!]
}
type Message{
    id : Int! 
    content: String!
    createdAt: String!
    fromUser : User! 
    toUser : User! 
}
type Post{
    id : Int! 
    content : String!
    createdAt : String!
    author : User! 
}
type Like{
    id: Int!
    linkingUser: User! 
    postLinked : Post!
}
type Comment{
    id : Int!
    content : String! 
    createdAt : String! 
    postedBy : User! 
    postCommented : Post!
}
type Connection{
    id: Int!
    user1: User!
    user2: User!
}
input CreateUser {
    firstName: String!
    lastName: String!
    email: String!
}
input CreateMessage {
    senderId: Int!
    receiverId: Int!
    content: String!
}
input CreateConnexion {
    user1Id: Int!
    user2Id: Int!
}
input CreateComment {
    postId: Int!
    authorId: Int!
    content: String!
}
input CreatePost {
    authorId: Int!
    content: String!
}
input CreateLike {
    userId: Int!
    postId: Int!
}
input UpdateUser {
    id: Int!
    firstName: String
    lastName: String
    email: String
}
input UpdateMessage {
    id: Int!
    content: String
}
input UpdateComment {
    id: Int!
    content: String
}
input UpdatePost {
    id: Int!
    content: String
}
input DeleteUser {
    id: Int!
}
input DeleteMessage {
    id: Int!
}
input DeleteConnection {
    id: Int!
}
input DeleteComment {
    id: Int!
}
input DeletePost {
    id: Int!
}
input DeleteLike {
    id: Int!
}
type Mutation {
    createUser(input: CreateUser): User!
    sendMessage(input: CreateMessage): Message!
    connect(input: CreateConnexion ): Connection!
    createComment(input: CreateComment ): Comment!
    createPost(input: CreatePost ): Post!
    likePost(input: CreateLike ): Like!


    updateUser(input: UpdateUser):User!
    updateMessage(input: UpdateMessage):Message!
    updateComment(input: UpdateComment):Comment!
    updatePost(input: UpdatePost):Post!

    deleteMessage(input: DeleteMessage):Message!
    deleteUser(input: DeleteUser): User!
    deleteConnection(input: DeleteConnection): Connection!
    deleteComment(input: DeleteComment): Comment!
    deletePost(input: DeletePost): Post!
    deleteLike(input: DeleteLike): Like!
}
`;

const UserByID = new DataLoader(async (ids) => {
    const users = await prisma.user.findMany({
        where : {id: { in: ids }}
    })
    return ids.map((id)=> users.find((user) => user.id ===id));
});
const PostByID = new DataLoader(async (ids) => {
    const posts = await prisma.post.findMany({
        where : {id: { in: ids }}
    })
    return ids.map((id)=> posts.find((post) => post.id ===id));
});
const UserByFriendsOfFriends = new DataLoader(async (userIds) => {
    // Récupérer toutes les connexions (amis) pour les utilisateurs donnés
    const connections = await prisma.connection.findMany({
        where: {
            OR: [
                { user1Id: { in: userIds } },
                { user2Id: { in: userIds } },
            ],
        },
        include: {
            user1: true, // Inclut l'utilisateur 1 dans la connexion
            user2: true, // Inclut l'utilisateur 2 dans la connexion
        },
    });

    // Organiser les connexions par utilisateur
    const userConnectionsMap = userIds.reduce((acc, userId) => {
        acc[userId] = [];
        return acc;
    }, {});

    connections.forEach((connection) => {
        if (userConnectionsMap[connection.user1Id]) {
            userConnectionsMap[connection.user1Id].push(connection.user2Id);
        }
        if (userConnectionsMap[connection.user2Id]) {
            userConnectionsMap[connection.user2Id].push(connection.user1Id);
        }
    });

    // Récupérer les amis de chaque ami (le deuxième cercle)
    const friendsOfFriends = await prisma.connection.findMany({
        where: {
            OR: userIds.flatMap(userId => {
                const friends = userConnectionsMap[userId] || [];
                return friends.map(friendId => ({
                    OR: [
                        { user1Id: friendId, user2Id: { not: userId } },
                        { user2Id: friendId, user1Id: { not: userId } },
                    ],
                }));
            }),
        },
        include: {
            user1: true,
            user2: true,
        },
    });

    // Filtrer les amis de l'utilisateur pour ne garder que les amis des amis
    const allFriendsIds = new Set(userIds.flatMap(userId => userConnectionsMap[userId]));
    const friendsOfFriendsMap = userIds.reduce((acc, userId) => {
        acc[userId] = [];
        return acc;
    }, {});

    friendsOfFriends.forEach((connection) => {
        const friendOfFriendId = connection.user1Id === connection.user2Id ? connection.user2Id : connection.user1Id;
        // Exclure ceux qui sont déjà amis avec l'utilisateur
        if (!allFriendsIds.has(friendOfFriendId)) {
            if (userConnectionsMap[connection.user1Id]) {
                friendsOfFriendsMap[connection.user1Id].push(friendOfFriendId);
            }
            if (userConnectionsMap[connection.user2Id]) {
                friendsOfFriendsMap[connection.user2Id].push(friendOfFriendId);
            }
        }
    });

    // Retourner les résultats pour chaque utilisateur
    return userIds.map((userId) => friendsOfFriendsMap[userId]);
});
const UserByConnexion = new DataLoader(async (userIds) => {
    // Récupérer toutes les connexions où l'utilisateur est soit user1, soit user2
    const connections = await prisma.connection.findMany({
        where: {
            OR: [
                { user1Id: { in: userIds } },
                { user2Id: { in: userIds } },
            ],
        },
        include: {
            user1: true, // Inclut l'utilisateur 1 dans la connexion
            user2: true, // Inclut l'utilisateur 2 dans la connexion
        },
    });
    // Organiser les connexions par utilisateur
    const userConnectionsMap = userIds.reduce((acc, userId) => {
        acc[userId] = [];
        return acc;
    }, {});
    connections.forEach((connection) => {
        if (userConnectionsMap[connection.user1Id]) {
            userConnectionsMap[connection.user1Id].push(connection.user2);
        }
        if (userConnectionsMap[connection.user2Id]) {
            userConnectionsMap[connection.user2Id].push(connection.user1);
        }
    });
    return userIds.map((userId) => userConnectionsMap[userId]);
});
const PostByUser = new DataLoader(async (ids) => {
    const posts = await prisma.post.findMany({
        where : {id: { in: ids }}
    })
    return ids.map((id)=> posts.filter((post) => post.authorId === id));
});
const MessageByUser = new DataLoader(async (ids) => {
    // Supposons que `ids` contienne des paires d'IDs sous forme de tableau de tableaux (ex : [[id1, id2], [id3, id4]])
    const messages = await prisma.message.findMany({
        where: {
            OR: ids.map(([id1, id2]) => ([
                { senderId: id1, receiverId: id2 },
                { senderId: id2, receiverId: id1 }
            ])).flat()  // Aplatir le tableau pour créer une seule condition OR
        },
    });

    const messagesMap = new Map();

    messages.forEach((message) => {
        const key = `${message.senderId}_${message.receiverId}`;
        if (!messagesMap.has(key)) {
            messagesMap.set(key, []);
        }
        messagesMap.get(key).push(message);
    });

    // Renvoyez les messages pour chaque paire d'IDs en triant par createdAt
    return ids.map(([id1, id2]) => {
        const key = `${id1}_${id2}`;
        const messagesForPair = messagesMap.get(key) || [];

        // Tri des messages par createdAt
        return messagesForPair.sort((a, b) =>  a.createdAt - b.createdAt);
    });
});

const resolvers = {
    Query: {
        user: () => prisma.user.findMany(),
        message:() => prisma.message.findMany(),
        post: () => prisma.post.findMany(),
        like:() => prisma.like.findMany(),
        getConversation:(_,{input}) => MessageByUser.load([input.id, input.id2]),
    },

    User: {
        connexion:( parent )   => UserByConnexion.load(parent.id),
        posts :(parent) => PostByID.load(parent.id),
    },
    Message: {
        fromUser:(parent) => UserByID.load(parent.senderId),
        toUser:(parent) => UserByID.load(parent.receiverId),
    },
    Post: {
      author:(parent) => UserByID.load(parent.authorId),
    },
    Like:{
        linkingUser:( parent ) => UserByID.load(parent.userId),
        postLinked:( parent ) => PostByID.load(parent.postId)
    },
    Comment:{
        postedBy: (parent) => UserByID.load(parent.authorId),
        postCommented :(parent) => PostByID.load(parent.postId)
    },
    Connection:{
        user1:(parent)=> UserByID.load(parent.user1Id),
        user2:(parent)=> UserByID.load(parent.user2Id)
    },

    Mutation: {
            createUser: async (_, { input }) => {
                return  prisma.user.create({
                    data: {
                        firstName: input.firstName,
                        lastName: input.lastName,
                        email: input.email,
                    },
                });
            },
            sendMessage: async (_, { input }) => {
                return prisma.message.create({
                    data: {
                        content: input.content,
                        sender: {connect: {id: input.senderId}},
                        receiver: {connect: {id: input.receiverId}},
                    },
                });
            },
            connect: async (_, { input }) => {
                // Vérifier si la connexion existe déjà
                const existingConnection = await prisma.connection.findFirst({
                    where: {
                        OR: [
                            {
                                user1Id: input.user1Id,
                                user2Id: input.user2Id,
                            },
                            {
                                user1Id: input.user2Id,
                                user2Id: input.user1Id,
                            },
                        ],
                    },
                });

                // Si la connexion existe déjà, retourner une erreur ou une réponse appropriée
                if (existingConnection) {
                    throw new Error('La connexion existe déjà.');
                }

                // Si la connexion n'existe pas, la créer
                return prisma.connection.create({
                    data: {
                        user1: { connect: { id: input.user1Id } },
                        user2: { connect: { id: input.user2Id } },
                    },
                });
            },
            createComment: async (_, { input }) => {
                return  prisma.comment.create({
                    data: {
                        content: input.content,
                        post: { connect: { id: input.postId } },
                        author: { connect: { id: input.authorId } },
                    },
                });
            },
            createPost: async (_, { input }) => {
                return prisma.post.create({
                    data: {
                        content: input.content,
                        author: { connect: { id: input.authorId } },
                    },
                });
            },
            likePost: async (_, { input }) => {
                return prisma.like.create({
                    data: {
                        post: {connect: {id: input.postId}},
                        user: {connect: {id: input.userId}},
                    },
                });
            },
            updateUser: async (_, { input }) => {
                return prisma.user.update({
                    where: {
                        id: input.id,
                    },
                    data: {
                        firstName: input.firstName,
                        lastName: input.lastName,
                        email: input.email,
                    },
                });
            },
            updateMessage: async (_, { input }) => {
                return prisma.message.update({
                    where: {
                        id: input.id,
                    },
                    data: {
                        content: input.content,
                    },
                });
            },
            updateComment: async (_, { input }) => {
                return prisma.comment.update({
                    where: {
                        id: input.id,
                    },
                    data: {
                        content: input.content,
                    },
                });
            },
            updatePost: async (_, { input }) => {
                return prisma.post.update({
                    where: {
                        id: input.id,
                    },
                    data: {
                        content: input.content,
                    },
                });
            },
            deleteUser: async (_, { input }) => {
                return prisma.user.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
            deleteMessage: async (_, { input }) => {
                return prisma.message.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
            deleteConnection: async (_, { input }) => {
                return prisma.connection.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
            deleteComment: async (_, { input }) => {
                return prisma.comment.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
            deletePost: async (_, { input }) => {
                return prisma.post.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
            deleteLike: async (_, { input }) => {
                return prisma.like.delete({
                    where: {
                        id: input.id,
                    },
                });
            },
        },

};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

await server.start();

const app = express();
app.use(cookieParser('mysecret',{
    sameSite: 'strict',
    httpOnly: true,
    signed : true
}));

app.get("/login",(req,res)=>{
    res.cookie("mycookie",'myvalue',{
        sameSite: 'strict',
        httpOnly: true,
        signed : true
    })
    res.send('Logged in');

})

app.use((req,res,next)=> {
    if(req.signedCookies.mycookie){
        console.log("Connected")
        next();
    }
    console.log("Not connected");
    return;
})


app.use('/graphql',
    express.json(),
    expressMiddleware(server),
    )
app.listen(4000,()=> {
    console.log(`🚀 Linkedin API at: http://localhost:4000/graphql`);
} )


