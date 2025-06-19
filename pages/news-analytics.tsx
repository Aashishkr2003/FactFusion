import { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  TimeScale,
} from "chart.js";
import { fetchNewsAndBlogs, saveToIndexedDB, getFromIndexedDB } from "../lib/fetchNews";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  TimeScale
);

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

interface AnalyticsProps {
  news: Article[];
  blogs: Article[];
}

export default function NewsAnalytics({ news: ssrNews, blogs: ssrBlogs }: AnalyticsProps) {
  // Local state for news/blogs, prefer IndexedDB, fallback to SSR
  const [news, setNews] = useState<Article[]>(ssrNews);
  const [blogs, setBlogs] = useState<Article[]>(ssrBlogs);

  // Try to load from IndexedDB on mount and when navigating
  useEffect(() => {
    if (typeof window !== "undefined") {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (cached && cached.news && cached.blogs) {
          setNews(cached.news);
          setBlogs(cached.blogs);
        } else {
          setNews(ssrNews);
          setBlogs(ssrBlogs);
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

  // On demand: If online, fetch fresh data and update IndexedDB
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.onLine) {
      (async () => {
        const cached = await getFromIndexedDB("newsapi_news_blogs");
        if (!cached || !cached.news || !cached.blogs) {
          fetchNewsAndBlogs()
            .then(async ({ news, blogs }) => {
              setNews(news);
              setBlogs(blogs);
              await saveToIndexedDB("newsapi_news_blogs", {
                news,
                blogs,
                timestamp: Date.now(),
              });
            })
            .catch(() => {});
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
          setNews(cached.news);
          setBlogs(cached.blogs);
        }
      })();
    }
  }, []);

  // All articles
  const allArticles = useMemo(() => [...news, ...blogs], [news, blogs]);
  const allTypes = useMemo(
    () => Array.from(new Set(allArticles.map((a) => a.type))),
    [allArticles]
  );
  const allAuthors = useMemo(
    () => Array.from(new Set(allArticles.map((a) => a.author || "Unknown"))),
    [allArticles]
  );

  // --- Bar Chart State ---
  const [barGroupBy, setBarGroupBy] = useState<"author" | "type">("author");

  // --- Pie Chart State ---
  const [pieGroupBy, setPieGroupBy] = useState<"type" | "author">("type");

  // --- Line Chart State ---
  const [lineGroupBy, setLineGroupBy] = useState<"date" | "author">("date");

  // --- Bar Chart Data ---
  const barCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (barGroupBy === "author") {
      allArticles.forEach((a) => {
        const author = a.author || "Unknown";
        counts[author] = (counts[author] || 0) + 1;
      });
    } else {
      allArticles.forEach((a) => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
    }
    return counts;
  }, [allArticles, barGroupBy]);

  const barLabels = useMemo(() => Object.keys(barCounts), [barCounts]);
  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: barGroupBy === "author" ? "Articles per Author" : "Articles per Type",
        data: Object.values(barCounts),
        backgroundColor: "rgba(59,130,246,0.7)",
      },
    ],
  };

  // --- Pie Chart Data ---
  const pieCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (pieGroupBy === "type") {
      allArticles.forEach((a) => {
        counts[a.type] = (counts[a.type] || 0) + 1;
      });
    } else {
      allArticles.forEach((a) => {
        const author = a.author || "Unknown";
        counts[author] = (counts[author] || 0) + 1;
      });
    }
    return counts;
  }, [allArticles, pieGroupBy]);

  const pieLabels = useMemo(() => Object.keys(pieCounts), [pieCounts]);
  const pieData = {
    labels: pieLabels,
    datasets: [
      {
        label: pieGroupBy === "type" ? "Type" : "Author",
        data: Object.values(pieCounts),
        backgroundColor: [
          "#6366f1",
          "#f59e42",
          "#10b981",
          "#ef4444",
          "#f472b6",
          "#fbbf24",
          "#3b82f6",
        ],
      },
    ],
  };

  // --- Line Chart Data ---
  const lineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (lineGroupBy === "date") {
      allArticles.forEach((a) => {
        const date = a.publishedAt?.split("T")[0] || "Unknown";
        counts[date] = (counts[date] || 0) + 1;
      });
    } else {
      allArticles.forEach((a) => {
        const author = a.author || "Unknown";
        counts[author] = (counts[author] || 0) + 1;
      });
    }
    return counts;
  }, [allArticles, lineGroupBy]);

  const lineLabels = useMemo(() => Object.keys(lineCounts), [lineCounts]);
  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: lineGroupBy === "date" ? "Articles per Day" : "Articles per Author",
        data: Object.values(lineCounts),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#6366f1",
      },
    ],
  };

  // Detect dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"));
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    }
  }, []);

  // Chart options for better visibility
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: isDark ? "#fff" : "#222",
            font: { size: 14 },
          },
        },
        title: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { color: isDark ? "#fff" : "#222", font: { size: 13 } },
          grid: { color: isDark ? "#444" : "#e5e7eb" },
        },
        y: {
          ticks: { color: isDark ? "#fff" : "#222", font: { size: 13 } },
          grid: { color: isDark ? "#444" : "#e5e7eb" },
        },
      },
      backgroundColor: isDark ? "#181e2a" : "#fff",
    }),
    [isDark]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-black dark:to-gray-900 p-2 sm:p-6">
      <div className="max-w-3xl mx-auto py-8 px-2 sm:px-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-700 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow">
          News Analytics
        </h1>
        {/* Bar Chart */}
        <div
          className={`mb-8 rounded-2xl shadow-xl p-4 border border-blue-100 dark:border-gray-800 w-full ${
            isDark ? "bg-[#181e2a]" : "bg-white"
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-2 mb-2 items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300 text-center w-full sm:w-auto">
              Bar Chart
            </h2>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <select
                value={barGroupBy}
                onChange={(e) => setBarGroupBy(e.target.value as "author" | "type")}
                className="px-2 py-1 rounded border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
              >
                <option value="author">Group by Author</option>
                <option value="type">Group by Type</option>
              </select>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>
        {/* Pie Chart */}
        <div
          className={`mb-8 rounded-2xl shadow-xl p-4 border border-blue-100 dark:border-gray-800 w-full ${
            isDark ? "bg-[#181e2a]" : "bg-white"
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-2 mb-2 items-center justify-between">
            <h2 className="text-lg font-semibold text-purple-700 dark:text-purple-300 text-center w-full sm:w-auto">
              Pie Chart
            </h2>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <select
                value={pieGroupBy}
                onChange={(e) => setPieGroupBy(e.target.value as "type" | "author")}
                className="px-2 py-1 rounded border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
              >
                <option value="type">Group by Type</option>
                <option value="author">Group by Author</option>
              </select>
            </div>
          </div>
          <div className="w-full flex justify-center">
            <Pie data={pieData} options={chartOptions} />
          </div>
        </div>
        {/* Line Chart */}
        <div
          className={`mb-8 rounded-2xl shadow-xl p-4 border border-blue-100 dark:border-gray-800 w-full ${
            isDark ? "bg-[#181e2a]" : "bg-white"
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-2 mb-2 items-center justify-between">
            <h2 className="text-lg font-semibold text-pink-700 dark:text-pink-300 text-center w-full sm:w-auto">
              Line Chart
            </h2>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <select
                value={lineGroupBy}
                onChange={(e) => setLineGroupBy(e.target.value as "date" | "author")}
                className="px-2 py-1 rounded border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
              >
                <option value="date">Group by Date</option>
                <option value="author">Group by Author</option>
              </select>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
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
