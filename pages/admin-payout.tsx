import { GetServerSideProps } from "next";
import { useMemo, useState, useEffect } from "react";
import {
  fetchNewsAndBlogs,
  saveToIndexedDB,
  getFromIndexedDB,
} from "../lib/fetchNews";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

interface PayoutProps {
  articles: Article[];
}

type AuthorTypeKey = string; // `${author}|||${type}`

export default function AdminPayout({ articles: ssrArticles }: PayoutProps) {
  // Local state for articles (prefer localStorage, fallback to SSR)
  const [articles, setArticles] = useState<Article[]>(ssrArticles);

  // Try to load from IndexedDB on mount and when navigating
  useEffect(() => {
    if (typeof window !== "undefined") {
      (async () => {
        const cached = await getFromIndexedDB("admin-payout-articles");
        if (
          cached &&
          Array.isArray(cached.articles) &&
          cached.articles.length > 0
        ) {
          setArticles(cached.articles);
        } else {
          setArticles(ssrArticles);
          await saveToIndexedDB("admin-payout-articles", {
            articles: ssrArticles,
            timestamp: Date.now(),
          });
        }
      })();
    }
    // eslint-disable-next-line
  }, [ssrArticles]);

  // On demand: If online, fetch fresh data and update IndexedDB
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.onLine) {
      fetchNewsAndBlogs()
        .then(async ({ news, blogs }) => {
          const fresh = [...news, ...blogs];
          setArticles(fresh);
          await saveToIndexedDB("admin-payout-articles", {
            articles: fresh,
            timestamp: Date.now(),
          });
        })
        .catch(() => {});
    }
  }, []);

  // If offline, always try to use IndexedDB cache
  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      (async () => {
        const cached = await getFromIndexedDB("admin-payout-articles");
        if (
          cached &&
          Array.isArray(cached.articles) &&
          cached.articles.length > 0
        ) {
          setArticles(cached.articles);
        }
      })();
    }
  }, []);

  // Filters
  const [selectedAuthor, setSelectedAuthor] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Unique authors/types
  const authors = useMemo(
    () => [
      "All",
      ...Array.from(new Set(articles.map((a) => a.author || "Unknown"))),
    ],
    [articles]
  );
  const types = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => a.type)))],
    [articles]
  );

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter(
      (a) =>
        (selectedAuthor === "All" ||
          (a.author || "Unknown") === selectedAuthor) &&
        (selectedType === "All" || a.type === selectedType)
    );
  }, [articles, selectedAuthor, selectedType]);

  // Group by author+type
  const grouped = useMemo(() => {
    const map: Record<
      AuthorTypeKey,
      { author: string; type: string; count: number }
    > = {};
    filteredArticles.forEach((a) => {
      const author = a.author || "Unknown";
      const key = `${author}|||${a.type}`;
      if (!map[key]) map[key] = { author, type: a.type, count: 0 };
      map[key].count += 1;
    });
    return map;
  }, [filteredArticles]);

  // Editable payout rates per author+type (fix: use author+type as key)
  const [payoutRates, setPayoutRates] = useState<{
    [key: AuthorTypeKey]: number;
  }>({});

  const handleRateChange = (author: string, type: string, value: string) => {
    const key = `${author}|||${type}`;
    const num = Number(value);
    if (!isNaN(num) && num >= 0) {
      setPayoutRates((rates) => ({ ...rates, [key]: num }));
    }
  };

  // Export handlers
  const handleCSVExport = () => {
    const headers = [
      "Author",
      "Type",
      "Articles",
      "Payout Rate ($)",
      "Total Payout ($)",
    ];
    const rows = Object.values(grouped).map(({ author, type, count }) => {
      const key = `${author}|||${type}`;
      const rate = payoutRates[key] ?? 2;
      return [author, type, count, rate, (count * rate).toFixed(2)];
    });
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" ? `"${cell.replace(/"/g, '""')}"` : cell
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "payout_export.csv");
    link.click();
  };

  const handlePDFExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Payout Export", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [
        ["Author", "Type", "Articles", "Payout Rate ($)", "Total Payout ($)"],
      ],
      body: Object.values(grouped).map(({ author, type, count }) => [
        author,
        type,
        count,
        payoutRates[`${author}|||${type}`] ?? 2,
        (count * (payoutRates[`${author}|||${type}`] ?? 2)).toFixed(2),
      ]),
      styles: { fontSize: 10 },
    });

    doc.save("payout_export.pdf");
  };

  const [exporting, setExporting] = useState(false);
  const handleGoogleSheetExport = async () => {
    setExporting(true);
    const endpoint =
      "https://api.sheety.co/7eeed78b1fa6df5a08db2457a7688f30/untitledSpreadsheet/sheet1";

    try {
      // (Optional) Clear the sheet before export
      // await fetch(endpoint, { method: "DELETE" });

      // Prepare all rows
      const rows = Object.values(grouped).map(({ author, type, count }) => {
        const key = `${author}|||${type}`;
        const rate = payoutRates[key] ?? 2;
        return {
          author,
          type,
          articles: count,
          ratePerArticle: rate,
          totalPayout: (count * rate).toFixed(2),
        };
      });

      // Sheety API: POST each row (free plan does not support batch insert)
      for (const row of rows) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sheet1: row }),
        });
        if (!response.ok) {
          throw new Error(`Failed to export: ${row.author} - ${row.type}`);
        }
      }

      alert("All payout data exported to Google Sheet!");
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-black dark:to-gray-900 p-2 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-700 via-purple-600 to-pink-500 bg-clip-text text-transparent drop-shadow mb-6 sm:mb-8">
          Payout Calculator
        </h1>
        {/* Filters + Export */}
        <div className="mb-6 sm:mb-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-4 sm:p-6 border border-blue-100 dark:border-gray-800 flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center">
          <div className="flex flex-col sm:flex-row flex-1 min-w-0 gap-2 sm:gap-4 gap-y-2">
            <div className="flex flex-col min-w-0 w-full max-w-xs">
              <label className="text-xs text-gray-400 mb-1 ml-1">Author</label>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="px-3 py-2 bg-[#1a2233] dark:bg-gray-800 text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full truncate text-sm"
              >
                {authors.map((author, idx) => (
                  <option
                    key={idx}
                    value={author}
                    className="truncate"
                    title={author}
                  >
                    {author.length > 20 ? author.slice(0, 17) + "..." : author}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col min-w-0 w-full max-w-xs">
              <label className="text-xs text-gray-400 mb-1 ml-1">Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-[#1a2233] dark:bg-gray-800 text-white rounded-lg border border-blue-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full truncate text-sm"
              >
                {types.map((type, idx) => (
                  <option
                    key={idx}
                    value={type}
                    className="truncate"
                    title={type}
                  >
                    {type.length > 20 ? type.slice(0, 17) + "..." : type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Export Buttons */}
          <div className="flex gap-2 flex-col sm:flex-row flex-wrap mt-4 sm:mt-0 w-full sm:w-auto">
            <button
              onClick={handleCSVExport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={handlePDFExport}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded shadow text-sm"
            >
              Export PDF
            </button>
            <button
              onClick={handleGoogleSheetExport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow text-sm"
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export to Google Sheets"}
            </button>
          </div>
        </div>
        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-2 sm:p-6 border border-blue-100 dark:border-gray-800 overflow-x-auto">
          <table className="min-w-[600px] w-full text-xs sm:text-sm text-gray-900 dark:text-gray-100">
            <thead>
              <tr>
                <th className="px-2 py-2 border-b text-left font-semibold whitespace-nowrap">
                  Author
                </th>
                <th className="px-2 py-2 border-b text-left font-semibold whitespace-nowrap">
                  Type
                </th>
                <th className="px-2 py-2 border-b text-center font-semibold whitespace-nowrap">
                  Articles
                </th>
                <th className="px-2 py-2 border-b text-center font-semibold whitespace-nowrap">
                  Payout Rate ($)
                </th>
                <th className="px-2 py-2 border-b text-center font-semibold whitespace-nowrap">
                  Total Payout ($)
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.values(grouped).map(({ author, type, count }) => {
                const key = `${author}|||${type}`;
                const rate = payoutRates[key] ?? 2;
                return (
                  <tr
                    key={key}
                    className="hover:bg-blue-50 dark:hover:bg-gray-800 transition"
                  >
                    <td className="px-2 py-2 border-b">{author}</td>
                    <td className="px-2 py-2 border-b">{type}</td>
                    <td className="px-2 py-2 border-b text-center">{count}</td>
                    <td className="px-2 py-2 border-b text-center">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={rate}
                        onChange={(e) =>
                          handleRateChange(author, type, e.target.value)
                        }
                        className="w-16 sm:w-20 px-2 py-1 rounded border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white text-xs sm:text-sm"
                        style={{
                          backgroundColor: "inherit",
                          color: "inherit",
                          borderColor: "inherit",
                        }}
                      />
                    </td>
                    <td className="px-2 py-2 border-b text-center font-semibold">
                      {(count * rate).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {Object.keys(grouped).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    No data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const { news, blogs } = await fetchNewsAndBlogs();
  return {
    props: {
      articles: [...news, ...blogs],
    },
  };
};
