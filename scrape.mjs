import fs from "node:fs/promises";

const PLAN_ROOT = "https://zsk.poznan.pl/plany_lekcji/";
const CONCURRENCY = 8;
const RETRIES = 3;

/** Prefer newest Optivum folders; school often renames e.g. 2026 → 2026_09. */
const CANDIDATE_FOLDERS = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const folders = [];
    for (let y = year; y >= year - 1; y -= 1) {
        for (let m = 12; m >= 1; m -= 1) {
            if (y === year && m > month) continue;
            folders.push(`${y}_${String(m).padStart(2, "0")}`);
        }
        folders.push(String(y));
    }
    return folders;
})();

const decodeEntities = (text) =>
    text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
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
    const tableMatch = html.match(/<table\b[^>]*\btabela\b[^>]*>[\s\S]*?<\/table>/i);
    if (!tableMatch) return null;
    return tableMatch[0].replace(/>\s+</g, "><").trim();
};

const extractTitle = (html, fallback) => {
    const titleMatch = html.match(/<span[^>]*class="tytulnapis"[^>]*>([^<]+)<\/span>/i);
    return titleMatch ? decodeEntities(titleMatch[1]) : fallback;
};

const extractValidFrom = (html) => {
    const match = html.match(/Obowi[aą]zuje od:\s*([\d.]+)/i);
    return match ? match[1] : null;
};

const toAbsoluteUrl = (href, baseUrl) => {
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return `${baseUrl}${href.replace(/^\//, "")}`;
    }
};

const looksLikePlanList = (html) => /<h4>\s*Oddzia/i.test(html) && /plany\/o\d+\.html/i.test(html);

const resolveBaseUrl = async () => {
    for (const folder of CANDIDATE_FOLDERS) {
        const baseUrl = `${PLAN_ROOT}${folder}/`;
        const listUrl = `${baseUrl}lista.html`;
        try {
            const html = await fetchText(listUrl);
            if (looksLikePlanList(html)) {
                console.log(`Używam katalogu planu: ${baseUrl}`);
                return { baseUrl, listHtml: html };
            }
            console.log(`Pomijam ${listUrl} — nie wygląda na listę Optivum`);
        } catch (error) {
            console.log(`Pomijam ${listUrl} — ${error.message}`);
        }
    }
    throw new Error(
        `Nie znaleziono działającego planu w ${PLAN_ROOT} (próbowano: ${CANDIDATE_FOLDERS.slice(0, 8).join(", ")}…)`,
    );
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

const scrapeGroup = async (items, label, baseUrl) => {
    const entries = {};
    const scraped = await mapWithConcurrency(items, async (item, i) => {
        const url = toAbsoluteUrl(item.href, baseUrl);
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
        `Znaleziono: ${classes.length} klas, ${teachers.length} nauczycieli, ${rooms.length} sal`,
    );

    if (!classes.length) {
        throw new Error("Nie znaleziono klas na lista.html — selektor listy jest nieaktualny.");
    }

    const data = {
        generatedAt: new Date().toISOString(),
        source: baseUrl,
        classes: await scrapeGroup(classes, "klasa", baseUrl),
        teachers: await scrapeGroup(teachers, "nauczyciel", baseUrl),
        rooms: await scrapeGroup(rooms, "sala", baseUrl),
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
