import { useSession, signIn, signOut } from "next-auth/react";
import { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setType,
  setSearchTerm,
  setSelectedAuthor,
  setStartDate,
  setEndDate,
  resetFilters,
} from "../store/filtersSlice";
import type { RootState } from "../store";
import { fetchNewsAndBlogs, saveToIndexedDB, getFromIndexedDB } from "../lib/fetchNews";

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  author: string | null;
  publishedAt: string;
  source?: { name: string };
  type: string;
}

interface HomeProps {
  news: Article[];
  blogs: Article[];
}

export default function Home({ news: ssrNews, blogs: ssrBlogs }: HomeProps) {
  const { data: session, status } = useSession();
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filters);

  // Local state for news/blogs, prefer localStorage, fallback to SSR
  const [news, setNews] = useState<Article[]>(ssrNews);
  const [blogs, setBlogs] = useState<Article[]>(ssrBlogs);
  const [apiError, setApiError] = useState(false);

  // Add offlineArticles state
  const [offlineArticles, setOfflineArticles] = useState<{ news: Article[]; blogs: Article[] } | null>(null);

  // Try to load from IndexedDB on mount and when navigating
  useEffect(() => {
    if (typeof window !== "undefined") {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (cached && cached.news && cached.blogs) {
          setNews(cached.news);
          setBlogs(cached.blogs);
          setOfflineArticles({ news: cached.news, blogs: cached.blogs });
        } else {
          setNews(ssrNews);
          setBlogs(ssrBlogs);
          setOfflineArticles(null);
          await saveToIndexedDB("newsapi_news_blogs", {
            news: ssrNews,
            blogs: ssrBlogs,
            timestamp: Date.now(),
          });
        }
      })();
    }
    // eslint-disable-next-line
  }, [ssrNews, ssrBlogs]);

  // On demand: If online, fetch fresh data and update localStorage (API called only once)
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.onLine) {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (!cached || !cached.news || !cached.blogs) {
          fetchNewsAndBlogs()
            .then(async ({ news, blogs }) => {
              setNews(news);
              setBlogs(blogs);
              setOfflineArticles({ news, blogs });
              await saveToIndexedDB("newsapi_news_blogs", {
                news,
                blogs,
                timestamp: Date.now(),
              });
            })
            .catch(() => setApiError(true));
        }
      })();
    }
  }, []);

  // If offline, always try to use IndexedDB cache
  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (cached && cached.news && cached.blogs) {
          setOfflineArticles({ news: cached.news, blogs: cached.blogs });
        }
      })();
    }
  }, []);

  // Compute articles based on type
  const articles = useMemo(
    () =>
      filters.type === "all"
        ? [...news, ...blogs]
        : filters.type === "news"
        ? news
        : blogs,
    [filters.type, news, blogs]
  );

  // Unique authors from current articles
  const authors = useMemo(
    () => [
      "All",
      ...Array.from(new Set(articles.map((a) => a.author || "Unknown"))),
    ],
    [articles]
  );

  // Reset filters when type changes
  useEffect(() => {
    dispatch(resetFilters());
    dispatch(setType(filters.type));
    // eslint-disable-next-line
  }, [filters.type, dispatch, articles]);

  // articlesToUse must be defined before using it in filtered
  const articlesToUse =
    offlineArticles !== null
      ? filters.type === "all"
        ? [...offlineArticles.news, ...offlineArticles.blogs]
        : filters.type === "news"
        ? offlineArticles.news
        : offlineArticles.blogs
      : articles;

  // Filtered articles (fix: use articlesToUse after its declaration)
  const filtered = useMemo(() => {
    return articlesToUse.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        article.description?.toLowerCase().includes(filters.searchTerm.toLowerCase());

      const matchesAuthor =
        filters.selectedAuthor === "All" ||
        (article.author || "Unknown") === filters.selectedAuthor;

      const articleDate = new Date(article.publishedAt);
      const matchesStart = filters.startDate
        ? articleDate >= new Date(filters.startDate)
        : true;
      const matchesEnd = filters.endDate ? articleDate <= new Date(filters.endDate) : true;

      return matchesSearch && matchesAuthor && matchesStart && matchesEnd;
    });
  }, [articlesToUse, filters]);

  // Client-side fallback to IndexedDB if fetch failed (offline)
  useEffect(() => {
    if ((news.length === 0 && blogs.length === 0) && typeof window !== "undefined") {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (cached && cached.news && cached.blogs) {
          setOfflineArticles({
            news: cached.news,
            blogs: cached.blogs,
          });
        } else {
          setApiError(true);
        }
      })();
    }
  }, [news, blogs]);

  if (status === "loading") {
    return <p className="text-white p-8">Loading...</p>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-blue-100 dark:border-gray-800 px-8 py-10 max-w-md w-full flex flex-col items-center animate-fade-in">
          <div className="mb-6 flex flex-col items-center">
            <span className="text-5xl mb-2 bg-gradient-to-r from-blue-700 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow">📰</span>
            <h1 className="text-2xl font-extrabold mb-1 bg-gradient-to-r from-blue-700 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow">
              Welcome to FactFusion
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-center mt-2">
              Access the latest newness around World.
            </p>
          </div>
          <button
            onClick={() => signIn("google")}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:from-blue-700 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg transition text-lg mt-4 w-full justify-center"
          >
            <svg className="w-6 h-6" viewBox="0 0 48 48">
              <g>
                <path fill="#4285F4" d="M44.5,20H24v8.5h11.7C34.1,33.1,29.6,36,24,36c-6.6,0-12-5.4-12-12s5.4-12,12-12c2.7,0,5.2,0.9,7.2,2.5l6.4-6.4C34.6,5.1,29.6,3,24,3C12.4,3,3,12.4,3,24s9.4,21,21,21c10.5,0,19.5-7.7,21-18H44.5z"/>
                <path fill="#34A853" d="M6.3,14.7l7,5.1C15.5,16.1,19.4,13,24,13c2.7,0,5.2,0.9,7.2,2.5l6.4-6.4C34.6,5.1,29.6,3,24,3C16.1,3,9.1,7.8,6.3,14.7z"/>
                <path fill="#FBBC05" d="M24,45c5.4,0,10.3-1.8,14.1-4.9l-6.5-5.3C29.6,36,24,36,24,36c-5.6,0-10.1-2.9-11.7-7.5l-7,5.4C9.1,40.2,16.1,45,24,45z"/>
                <path fill="#EA4335" d="M44.5,20H24v8.5h11.7c-1.2,3.2-4.1,5.5-7.7,5.5c-2.7,0-5.2-0.9-7.2-2.5l-6.4,6.4C13.4,42.9,18.4,45,24,45c10.5,0,19.5-7.7,21-18H44.5z"/>
              </g>
            </svg>
            Login with Google
          </button>
          <div className="mt-8 text-xs text-gray-400 text-center">
            &copy; {new Date().getFullYear()} FactFusion. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  // Show error if API and localStorage both failed
  if (apiError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-blue-100 dark:border-gray-800 text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">
            Unable to load news data
          </h1>
          <p className="mb-2 text-gray-700 dark:text-gray-300">
            The news API is currently unreachable and no offline data is available.
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            Please check your internet connection or try again later.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard content after login
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-black dark:to-gray-900 p-2 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Type Dropdown */}
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
            <label className="mr-2 font-semibold text-lg text-gray-700 dark:text-gray-200">
              Type:
            </label>
            <select
              value={filters.type}
              onChange={(e) =>
                dispatch(setType(e.target.value as "news" | "blogs" | "all"))
              }
              className="px-4 py-2 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
            >
              <option value="news">News</option>
              <option value="blogs">Blogs</option>
              <option value="all">All</option>
            </select>
          </div>
          {/* Dashboard Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-blue-100 dark:border-gray-800 flex flex-col items-center">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Total Articles
              </h2>
              <p className="text-4xl font-extrabold text-blue-700 dark:text-blue-300">
                {articles.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-blue-100 dark:border-gray-800 flex flex-col items-center">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Unique Authors
              </h2>
              <p className="text-4xl font-extrabold text-purple-700 dark:text-purple-300">
                {authors.length - 1}
              </p>
            </div>
          </div>
          {/* Filters */}
          <div className="mb-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-blue-100 dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Search..."
                value={filters.searchTerm}
                onChange={(e) => dispatch(setSearchTerm(e.target.value))}
                className="px-4 py-2 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              {/* Author dropdown with reduced width and truncated names */}
              <div className="relative w-full max-w-xs">
                <select
                  value={filters.selectedAuthor}
                  onChange={(e) => dispatch(setSelectedAuthor(e.target.value))}
                  className="px-4 py-2 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full truncate"
                >
                  {authors.map((author, idx) => (
                    <option
                      key={idx}
                      value={author}
                      className="truncate"
                      title={author}
                    >
                      {author.length > 25 ? author.slice(0, 22) + "..." : author}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => dispatch(setStartDate(e.target.value))}
                  className="w-1/2 px-2 py-2 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => dispatch(setEndDate(e.target.value))}
                  className="w-1/2 px-2 py-2 bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>
          {/* Filtered Results */}
          {filtered.length === 0 ? (
            <div className="text-center text-lg text-gray-500 py-12">
              No results found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((article, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-900 text-black dark:text-white rounded-2xl shadow-lg p-5 border border-blue-100 dark:border-gray-800 flex flex-col"
                >
                  <img
                    src={article.urlToImage || "/no-image.png"}
                    alt="cover"
                    className="w-full h-40 object-cover rounded-lg mb-3 border border-gray-200 dark:border-gray-800"
                  />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    By {article.author || "Unknown"} on {new Date(article.publishedAt).toISOString().split("T")[0]}
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 text-sm underline mt-auto font-semibold"
                  >
                    Read More
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const { news, blogs } = await fetchNewsAndBlogs();
  return {
    props: {
      news,
      blogs,
    },
  };
};
