import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Only Google accounts on this domain may sign in.
const ALLOWED_DOMAIN = "seekhoapp.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    // Reject anyone whose verified Google email is not @seekhoapp.com
    async signIn({ profile }) {
      const email = (profile?.email ?? "").toLowerCase();
      return Boolean(profile?.email_verified) && email.endsWith("@" + ALLOWED_DOMAIN);
    },
  },
  pages: { signIn: "/" },
});
