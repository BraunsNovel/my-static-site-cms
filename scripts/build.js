import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CONTENT_DIR = path.join(ROOT, 'content');
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- Yardımcılar ----------
function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const { data, content } = matter(raw);
      return {
        slug: path.basename(f, '.md'),
        ...data,
        body: content,
        bodyHtml: marked.parse(content || '')
      };
    });
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// ---------- Serileri İşle ----------
const seriesRaw = readMarkdownFiles(path.join(CONTENT_DIR, 'series'));
const seriesList = seriesRaw.map(s => ({
  slug: s.slug || slugify(s.title),
  title: s.title,
  altTitle: s.altTitle || '',
  author: s.author || 'Bilinmiyor',
  artist: s.artist || '',
  status: s.status || 'ongoing',
  updateSchedule: s.updateSchedule || '—',
  cover: s.cover || '',
  genres: Array.isArray(s.genres) ? s.genres : [],
  featured: !!s.featured,
  synopsis: s.synopsis || '',
  synopsisHtml: marked.parse(s.synopsis || ''),
  publishDate: s.publishDate || new Date().toISOString().slice(0, 10)
}));

// ---------- Bölümleri İşle ----------
const chaptersRaw = readMarkdownFiles(path.join(CONTENT_DIR, 'chapters'));
const chaptersList = chaptersRaw
  .map(c => ({
    slug: c.slug,
    series: c.series,
    title: c.title,
    chapterNumber: Number(c.chapterNumber) || 0,
    publishedAt: c.publishedAt || new Date().toISOString().slice(0, 10),
    wordCount: countWords(c.body),
    contentHtml: c.bodyHtml
  }))
  .sort((a, b) => {
    if (a.series !== b.series) return a.series.localeCompare(b.series);
    return a.chapterNumber - b.chapterNumber;
  });

// ---------- Seri İstatistiklerini Hesapla ----------
const seriesStats = {};
chaptersList.forEach(ch => {
  if (!seriesStats[ch.series]) {
    seriesStats[ch.series] = {
      chapterCount: 0,
      totalWords: 0,
      firstPublish: ch.publishedAt,
      lastUpdate: ch.publishedAt
    };
  }
  const st = seriesStats[ch.series];
  st.chapterCount += 1;
  st.totalWords += ch.wordCount;
  if (ch.publishedAt < st.firstPublish) st.firstPublish = ch.publishedAt;
  if (ch.publishedAt > st.lastUpdate) st.lastUpdate = ch.publishedAt;
});

const seriesWithStats = seriesList.map(s => ({
  ...s,
  chapterCount: seriesStats[s.slug]?.chapterCount || 0,
  totalWords: seriesStats[s.slug]?.totalWords || 0,
  firstPublish: seriesStats[s.slug]?.firstPublish || null,
  lastUpdate: seriesStats[s.slug]?.lastUpdate || null
}));

// ---------- JSON Yaz ----------
fs.writeFileSync(
  path.join(DATA_DIR, 'series.json'),
  JSON.stringify(seriesWithStats, null, 2)
);

fs.writeFileSync(
  path.join(DATA_DIR, 'chapters.json'),
  JSON.stringify(chaptersList, null, 2)
);

console.log(`✅ Build tamamlandı:`);
console.log(`   • ${seriesWithStats.length} seri`);
console.log(`   • ${chaptersList.length} bölüm`);
