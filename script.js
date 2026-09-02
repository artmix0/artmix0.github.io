document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "zsk-plan-selection";
  const DAY_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
  const plany = {};
  const selects = {
    class: document.querySelector("#classSelect"),
    teacher: document.querySelector("#teacherSelect"),
    room: document.querySelector("#roomSelect"),
  };
  const plansContainer = document.getElementById("plans");

  const placeholderOption = (label) =>
    `<option value="" disabled selected>-- ${label} --</option>`;

  const sortClassNames = (a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (na !== nb) return na - nb;
    return a.localeCompare(b, "pl");
  };

  const fillSelect = (select, names, label, compare) => {
    select.innerHTML = placeholderOption(label);
    names.sort(compare).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  };

  const normalizeData = (data) => {
    if (data && data.classes) {
      return data;
    }

    const normalized = { classes: {}, teachers: {}, rooms: {}, source: null };
    for (const [name, html] of Object.entries(data || {})) {
      const entry = typeof html === "string" ? { title: name, html } : html;
      if (/^[0-9][A-Z]$/i.test(name)) {
        normalized.classes[name] = entry;
      } else if (/\(.+\)$/.test(name)) {
        normalized.teachers[name] = entry;
      } else {
        normalized.rooms[name] = entry;
      }
    }
    return normalized;
  };

  const registerGroup = (group, type) => {
    for (const [name, entry] of Object.entries(group || {})) {
      const html = typeof entry === "string" ? entry : entry.html;
      const title = typeof entry === "string" ? name : entry.title || name;
      const validFrom = typeof entry === "string" ? null : entry.validFrom;
      plany[name] = { type, html, title, validFrom };
    }
  };

  const parseLessons = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.tabela") || doc.querySelector("table");
    if (!table) return null;

    const headerCells = [...table.querySelectorAll("tr:first-child th, tr:first-child td")];
    const headers = headerCells.map((cell) => cell.textContent.trim());
    const dayHeaders = headers.slice(2);

    const rows = [...table.querySelectorAll("tr")].slice(1).map((tr) => {
      const cells = [...tr.children];
      const number = (cells[0]?.textContent || "").trim();
      const time = (cells[1]?.textContent || "").replace(/\s+/g, " ").trim();
      const days = cells.slice(2).map((td) => {
        const raw = td.innerHTML.trim();
        if (!raw || raw === "&nbsp;") return [];
        return raw
          .split(/<br\s*\/?>/i)
          .map((chunk) => {
            const wrap = document.createElement("div");
            wrap.innerHTML = chunk;
            const subjects = [...wrap.querySelectorAll(".p")]
              .map((el) => el.textContent.trim())
              .filter(Boolean);
            const teacher = wrap.querySelector(".n")?.textContent.trim() || "";
            const room = wrap.querySelector(".s")?.textContent.trim() || "";
            const text = wrap.textContent.replace(/\s+/g, " ").trim();
            if (!text) return null;
            return {
              subject: subjects.join(" ") || text,
              teacher,
              room,
              text,
            };
          })
          .filter(Boolean);
      });
      return { number, time, days };
    });

    return { tableHTML: table.outerHTML, dayHeaders, rows };
  };

  const defaultDayIndex = (dayCount) => {
    const jsDay = new Date().getDay();
    const mondayBased = jsDay === 0 ? 6 : jsDay - 1;
    return mondayBased < dayCount ? mondayBased : 0;
  };

  const renderMobileDays = (parsed) => {
    const tabs = parsed.dayHeaders
      .map((day, index) => {
        const short = DAY_SHORT[index] || day.slice(0, 2);
        return `<button type="button" class="day-tab" data-day="${index}" aria-label="${day}" aria-pressed="false">${short}</button>`;
      })
      .join("");

    const panels = parsed.dayHeaders
      .map((day, index) => {
        const lessons = parsed.rows
          .map((row) => {
            const items = row.days[index] || [];
            if (!items.length) return "";
            const cards = items
              .map((item) => {
                const meta = [item.teacher, item.room].filter(Boolean).join(" · ");
                return `<div class="lesson-item">
                  <p class="lesson-subject">${item.subject}</p>
                  ${meta ? `<p class="lesson-meta">${meta}</p>` : ""}
                </div>`;
              })
              .join("");
            return `<article class="lesson-card">
              <div class="lesson-time">
                <strong>${row.number}</strong>
                <span>${row.time}</span>
              </div>
              <div class="lesson-body">${cards}</div>
            </article>`;
          })
          .filter(Boolean)
          .join("");

        return `<div class="day-panel" data-day="${index}" hidden>
          ${lessons || `<p class="empty-day">Brak lekcji w ${day.toLowerCase()}.</p>`}
        </div>`;
      })
      .join("");

    return `<div class="day-tabs" role="tablist">${tabs}</div>
      <div class="day-panels">${panels}</div>`;
  };

  const activateDay = (root, index) => {
    root.querySelectorAll(".day-tab").forEach((tab) => {
      const active = Number(tab.dataset.day) === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    root.querySelectorAll(".day-panel").forEach((panel) => {
      panel.hidden = Number(panel.dataset.day) !== index;
    });
  };

  const renderPlan = (name) => {
    const plan = plany[name];
    if (!plan || !plan.html) {
      plansContainer.innerHTML = `<p class="placeholder">Brak planu dla wybranego elementu.</p>`;
      return;
    }

    const parsed = parseLessons(plan.html);
    const validFrom = plan.validFrom
      ? `<p class="plan-meta">Obowiązuje od: ${plan.validFrom}</p>`
      : "";

    if (!parsed) {
      plansContainer.innerHTML = `<h2>${plan.title}</h2>${validFrom}${plan.html}`;
      return;
    }

    plansContainer.innerHTML = `
      <article class="plan">
        <h2>${plan.title}</h2>
        ${validFrom}
        ${renderMobileDays(parsed)}
        <div class="table-scroll">${parsed.tableHTML}</div>
      </article>
    `;

    const initialDay = defaultDayIndex(parsed.dayHeaders.length);
    activateDay(plansContainer, initialDay);
    plansContainer.querySelectorAll(".day-tab").forEach((tab) => {
      tab.addEventListener("click", () => activateDay(plansContainer, Number(tab.dataset.day)));
    });
  };

  fetch("scraped.json")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((raw) => {
      const data = normalizeData(raw);
      registerGroup(data.classes, "class");
      registerGroup(data.teachers, "teacher");
      registerGroup(data.rooms, "room");

      fillSelect(selects.class, Object.keys(data.classes || {}), "Wybierz klasę", sortClassNames);
      fillSelect(
        selects.teacher,
        Object.keys(data.teachers || {}),
        "Wybierz nauczyciela",
        (a, b) => a.localeCompare(b, "pl")
      );
      fillSelect(
        selects.room,
        Object.keys(data.rooms || {}),
        "Wybierz salę",
        (a, b) => a.localeCompare(b, "pl", { numeric: true })
      );

      if (!Object.keys(plany).length) {
        plansContainer.innerHTML =
          `<p class="placeholder">Brak danych planu. Uruchom scraper albo poczekaj na aktualizację z GitHub Actions.</p>`;
        return;
      }

      let saved = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch {
        saved = null;
      }
      if (saved && plany[saved]) {
        const type = plany[saved].type;
        const select = selects[type];
        if (select) select.value = saved;
        renderPlan(saved);
      }
    })
    .catch((err) => {
      console.error("Błąd wczytywania danych:", err);
      plansContainer.innerHTML =
        `<p class="placeholder">Nie udało się wczytać scraped.json</p>`;
    });

  Object.values(selects).forEach((select) => {
    select.addEventListener("change", (event) => {
      const selectedValue = event.target.value;
      if (!selectedValue) return;

      Object.values(selects).forEach((other) => {
        if (other !== event.target) other.selectedIndex = 0;
      });

      try {
        localStorage.setItem(STORAGE_KEY, selectedValue);
      } catch {
        /* ignore quota / private mode */
      }
      renderPlan(selectedValue);
    });
  });
});
