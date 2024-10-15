import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import {PrismaClient} from "@prisma/client";
import DataLoader from 'DataLoader';


const prisma = new PrismaClient();

const typeDefs = `#graphql

type Query{
    user: [User!]!
    message: [Message!]!
    post: [Post!]!
    like: [Like!]!
    
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

input CreateMessage{
    senderId: Int!, receiverId: Int!, content: String!
}

input CreateConnexion{
    user1Id: Int!, user2Id: Int!
}

input CreateComment{
    postId: Int!, authorId: Int!, content: String!
}

input CreatePost{
    authorId: Int!, content: String!
}

input CreateLike{
    userId: Int!, postId: Int!
}

type Mutation {
    createUser(input: CreateUser): User!
    sendMessage(input: CreateMessage): Message!
    connect(input: CreateConnexion ): Connection!
    createComment(input: CreateComment ): Comment!
    createPost(input: CreatePost ): Post!
    likePost(input: CreateLike ): Like!
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

const resolvers = {
    Query: {
        user: () => prisma.user.findMany(),
        message:() => prisma.message.findMany(),
        post: () => prisma.post.findMany(),
        like:() => prisma.like.findMany()
    },

    User: {
        connexion:( parent )   => UserByConnexion.load(parent.id), // TODO
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
        },

}
;

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});

console.log(`🚀 Linkedin API at: ${url}`);
