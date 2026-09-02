import fs from "node:fs/promises";

const BASE_URL = "https://zsk.poznan.pl/plany_lekcji/2026/";
const CONCURRENCY = 8;
const RETRIES = 3;

const decodeEntities = (text) =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .trim();

const fetchText = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "artmix0-zsk-plan-scraper (https://artmix0.github.io/)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
};

const extractList = (html) => {
  const items = { classes: [], teachers: [], rooms: [] };
  const sections = html.split(/<h4>([^<]+)<\/h4>/i);

  for (let i = 1; i < sections.length; i += 2) {
    const heading = sections[i].trim().toLowerCase();
    const chunk = sections[i + 1] || "";
    const type = heading.includes("oddzia")
      ? "classes"
      : heading.includes("nauczyciel")
        ? "teachers"
        : heading.includes("sal")
          ? "rooms"
          : null;

    if (!type) continue;

    const linkRe = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = linkRe.exec(chunk))) {
      items[type].push({
        href: match[1],
        name: decodeEntities(match[2]),
      });
    }
  }

  return items;
};

const extractTable = (html) => {
  const tableMatch = html.match(
    /<table\b[^>]*\btabela\b[^>]*>[\s\S]*?<\/table>/i
  );
  if (!tableMatch) return null;
  return tableMatch[0].replace(/>\s+</g, "><").trim();
};

const extractTitle = (html, fallback) => {
  const titleMatch = html.match(
    /<span[^>]*class="tytulnapis"[^>]*>([^<]+)<\/span>/i
  );
  return titleMatch ? decodeEntities(titleMatch[1]) : fallback;
};

const extractValidFrom = (html) => {
  const match = html.match(/Obowi[aą]zuje od:\s*([\d.]+)/i);
  return match ? match[1] : null;
};

const toAbsoluteUrl = (href) => {
  try {
    return new URL(href, BASE_URL).href;
  } catch {
    return `${BASE_URL}${href.replace(/^\//, "")}`;
  }
};

const mapWithConcurrency = async (items, mapper) => {
  const results = [];
  let index = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
};

const scrapeGroup = async (items, label) => {
  const entries = {};
  const scraped = await mapWithConcurrency(items, async (item, i) => {
    const url = toAbsoluteUrl(item.href);
    const html = await fetchText(url);
    const table = extractTable(html);
    if (!table) {
      throw new Error(`Brak tabeli planu dla ${item.name} (${url})`);
    }
    console.log(`[${label} ${i + 1}/${items.length}] ${item.name}`);
    return {
      name: item.name,
      title: extractTitle(html, item.name),
      html: table,
      validFrom: extractValidFrom(html),
    };
  });

  for (const plan of scraped) {
    entries[plan.name] = {
      title: plan.title,
      html: plan.html,
    };
    if (plan.validFrom) {
      entries[plan.name].validFrom = plan.validFrom;
    }
  }
  return entries;
};

const run = async () => {
  console.log(`Pobieram listę: ${BASE_URL}lista.html`);
  const listHtml = await fetchText(`${BASE_URL}lista.html`);
  const { classes, teachers, rooms } = extractList(listHtml);

  console.log(
    `Znaleziono: ${classes.length} klas, ${teachers.length} nauczycieli, ${rooms.length} sal`
  );

  if (!classes.length) {
    throw new Error(
      "Nie znaleziono klas na lista.html — selektor listy jest nieaktualny."
    );
  }

  const data = {
    generatedAt: new Date().toISOString(),
    source: BASE_URL,
    classes: await scrapeGroup(classes, "klasa"),
    teachers: await scrapeGroup(teachers, "nauczyciel"),
    rooms: await scrapeGroup(rooms, "sala"),
  };

  const total =
    Object.keys(data.classes).length +
    Object.keys(data.teachers).length +
    Object.keys(data.rooms).length;

  if (total < 10) {
    throw new Error(`Za mało planów (${total}) — przerywam zapis.`);
  }

  const firstClass = Object.values(data.classes)[0];
  data.validFrom = firstClass?.validFrom || null;

  await fs.writeFile("scraped.json", JSON.stringify(data), "utf8");

  console.log(`Zapisano ${total} planów do scraped.json`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
