import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        try {
          const user = await prisma.admin_user.findFirst({
            where: { email: { equals: credentials.email, mode: 'insensitive' } },
          })
          if (!user) {
            console.error('Auth: No user found for email:', credentials.email)
            return null
          }
          const isValid = await bcrypt.compare(credentials.password, user.password_hash)
          if (!isValid) {
            console.error('Auth: Invalid password for email:', credentials.email)
            return null
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user?.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.role = token?.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
