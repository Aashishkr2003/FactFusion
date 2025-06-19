// lib/fetchNews.ts
// IndexedDB helpers
function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("newsDashboardDB", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("articles")) {
        db.createObjectStore("articles");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIndexedDB(key: string, value: any) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("articles", "readwrite");
    tx.objectStore("articles").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFromIndexedDB(key: string) {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction("articles", "readonly");
    const req = tx.objectStore("articles").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function fetchNews() {
  const apiKey = process.env.NEWSAPI_KEY;
  const cacheKey = "newsapi_news";
  let cache: any = null;
  if (typeof window !== "undefined") {
    cache = await getFromIndexedDB(cacheKey);
    if (cache) {
      // 1 hour cache
      if (Date.now() - cache.timestamp < 60 * 60 * 1000) {
        return cache.articles;
      }
    }
  }

  const res = await fetch(
    `https://newsapi.org/v2/top-headlines?country=us&pageSize=20&apiKey=${apiKey}`
  );
  if (!res.ok) throw new Error("Failed to fetch news");
  const data = await res.json();

  const mapArticle = (item: any) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    urlToImage: item.urlToImage,
    author: item.author,
    publishedAt: item.publishedAt,
    source: item.source,
    type: "news",
  });

  const articles = (data.articles || []).map(mapArticle);

  if (typeof window !== "undefined") {
    await saveToIndexedDB(
      cacheKey,
      { articles, timestamp: Date.now() }
    );
  }
  return articles;
}

export async function fetchNewsAndBlogs() {
  const apiKey = process.env.NEWSAPI_KEY;
  const cacheKey = "newsapi_news_blogs";
  let cache: any = null;
  if (typeof window !== "undefined") {
    cache = await getFromIndexedDB(cacheKey);
    if (cache) {
      // 1 hour cache
      if (Date.now() - cache.timestamp < 60 * 60 * 1000) {
        return { news: cache.news, blogs: cache.blogs };
      }
    }
  }
  // Fetch news
  const newsRes = await fetch(
    `https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=20&apiKey=${apiKey}`
  );
  const newsData = await newsRes.json();

  // Fetch blogs
  const blogsRes = await fetch(
    `https://newsapi.org/v2/top-headlines?country=us&category=general&pageSize=20&apiKey=${apiKey}`
  );
  const blogsData = await blogsRes.json();

  const mapArticle = (item: any, type: string) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    urlToImage: item.urlToImage,
    author: item.author,
    publishedAt: item.publishedAt,
    source: item.source,
    type,
  });

  const news = (newsData.articles || []).map((item: any) => mapArticle(item, "news"));
  const blogs = (blogsData.articles || []).map((item: any) => mapArticle(item, "blogs"));

  if (typeof window !== "undefined") {
    await saveToIndexedDB(
      cacheKey,
      { news, blogs, timestamp: Date.now() }
    );
  }

  return { news, blogs };
}