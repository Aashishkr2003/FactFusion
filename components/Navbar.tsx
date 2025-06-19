import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// Add a type for user with role
type UserWithRole = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

export default function Navbar() {
  const { data: session } = useSession();
  // Use type assertion to access role
  const user = session?.user as UserWithRole | undefined;
  const isAdmin = user?.role === "admin";
  const isSignedIn = !!session;

  return (
    <nav className="bg-gradient-to-r from-blue-700 via-blue-800 to-purple-800 shadow-lg px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-white drop-shadow">📰</span>
        <span className="text-lg sm:text-2xl font-extrabold bg-gradient-to-r from-blue-300 via-purple-200 to-pink-200 bg-clip-text text-transparent drop-shadow">
          FactFusion
        </span>
      </div>
      {/* Make routes always in one line */}
      <div className="flex-1 flex flex-row items-center gap-2 sm:gap-4 mt-2 sm:mt-0 text-sm sm:text-base">
        <Link
          href="/"
          className="font-medium text-white hover:text-blue-200 transition bg-blue-900/60 px-3 py-1 rounded-lg shadow"
        >
          Dashboard
        </Link>
        {session && (
          <>
            <Link
              href="/news-analytics"
              className="font-medium text-white hover:text-blue-200 transition bg-blue-900/60 px-3 py-1 rounded-lg shadow"
            >
              News Analytics
            </Link>
            {user?.role === "admin" && (
              <Link
                href="/admin-payout"
                className="font-medium text-white hover:text-blue-200 transition bg-blue-900/60 px-3 py-1 rounded-lg shadow"
              >
                Payout Calculator
              </Link>
            )}
          </>
        )}
      </div>
      <div className="ml-0 sm:ml-auto mt-2 sm:mt-0 flex items-center gap-2">
        {session ? (
          <>
            <span className="text-xs sm:text-sm text-white bg-blue-900/60 px-3 py-1 rounded-lg font-medium truncate max-w-[120px] sm:max-w-[160px] shadow">
              {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold shadow transition text-xs sm:text-base"
            >
              Logout
            </button>
          </>
        ) : (
          <span className="text-xs sm:text-sm text-white font-medium bg-blue-900/60 px-3 py-1 rounded-lg shadow">
            Not signed in
          </span>
        )}
      </div>
    </nav>
  );
}
