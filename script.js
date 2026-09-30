document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "zsk-plan-selection";
  const DAY_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
  const plany = {};
  const teacherByCode = {};
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

  const teacherCodeFromName = (name) => {
    const match = String(name).match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : "";
  };

  const teacherDisplayName = (name) => String(name).replace(/\s*\([^)]+\)\s*$/, "").trim() || name;

  const resolveTeacherName = (codeOrName) => {
    if (!codeOrName) return "";
    if (plany[codeOrName]?.type === "teacher") return teacherDisplayName(codeOrName);
    const byCode = teacherByCode[codeOrName];
    if (byCode) return teacherDisplayName(byCode);
    return codeOrName;
  };

  const resolveTeacherKey = (codeOrName) => {
    if (!codeOrName) return null;
    if (plany[codeOrName]?.type === "teacher") return codeOrName;
    return teacherByCode[codeOrName] || null;
  };

  const registerGroup = (group, type) => {
    for (const [name, entry] of Object.entries(group || {})) {
      const html = typeof entry === "string" ? entry : entry.html;
      const title = typeof entry === "string" ? name : entry.title || name;
      const validFrom = typeof entry === "string" ? null : entry.validFrom;
      plany[name] = { type, html, title, validFrom };
      if (type === "teacher") {
        const code = teacherCodeFromName(name);
        if (code) teacherByCode[code] = name;
      }
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
            const klass = [...wrap.querySelectorAll(".o")]
              .map((el) => el.textContent.trim())
              .filter(Boolean)
              .join(", ");
            const text = wrap.textContent.replace(/\s+/g, " ").trim();
            if (!text) return null;
            return {
              subject: subjects.join(" ") || text,
              teacher,
              teacherFull: resolveTeacherName(teacher),
              room,
              klass,
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

  const chip = (kind, label, target) => {
    if (!label) return "";
    const safeLabel = label.replace(/</g, "&lt;");
    if (!target || !plany[target]) {
      return `<span class="chip chip-${kind}">${safeLabel}</span>`;
    }
    return `<button type="button" class="chip chip-${kind} chip-link" data-target="${target}">${safeLabel}</button>`;
  };

  const lessonMetaHtml = (item, planType) => {
    const parts = [];
    if (planType === "teacher" || planType === "room") {
      item.klass
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((klass) => {
          parts.push(chip("o", klass, plany[klass] ? klass : null));
        });
    }
    if (planType === "class" || planType === "room") {
      const teacherKey = resolveTeacherKey(item.teacher);
      const teacherLabel = item.teacherFull || item.teacher;
      if (teacherLabel) parts.push(chip("n", teacherLabel, teacherKey));
    }
    if (planType === "class" || planType === "teacher") {
      if (item.room) parts.push(chip("s", item.room, plany[item.room] ? item.room : null));
    }
    return parts.length ? `<p class="lesson-meta">${parts.join(" ")}</p>` : "";
  };

  const renderMobileDays = (parsed, planType) => {
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
                return `<div class="lesson-item">
                  <p class="lesson-subject">${item.subject}</p>
                  ${lessonMetaHtml(item, planType)}
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

  const enhanceTableLinks = (root) => {
    root.querySelectorAll("a.n, a.o, a.s").forEach((anchor) => {
      const text = anchor.textContent.trim();
      let target = null;
      if (anchor.classList.contains("n")) {
        target = resolveTeacherKey(text);
        const full = resolveTeacherName(text);
        if (full && full !== text) {
          anchor.setAttribute("title", full);
          anchor.setAttribute("aria-label", full);
          anchor.dataset.fullName = full;
        }
      } else if (anchor.classList.contains("o")) {
        target = plany[text] ? text : null;
      } else if (anchor.classList.contains("s")) {
        target = plany[text] ? text : null;
      }

      if (!target) return;
      anchor.classList.add("plan-link");
      anchor.dataset.target = target;
      anchor.setAttribute("role", "button");
      anchor.setAttribute("tabindex", "0");
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        selectAndRender(target);
      });
      anchor.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectAndRender(target);
        }
      });
    });
  };

  const selectAndRender = (name) => {
    if (!name || !plany[name]) return;
    const type = plany[name].type;
    Object.values(selects).forEach((select) => {
      select.selectedIndex = 0;
    });
    const select = selects[type];
    if (select) select.value = name;
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
    renderPlan(name);
  };

  const renderPlan = (name) => {
    const plan = plany[name];
    if (!plan || !plan.html) {
      plansContainer.innerHTML = `<p class="placeholder">Brak planu dla wybranego elementu.</p>`;
      return;
    }

    const parsed = parseLessons(plan.html);
    const heading =
      plan.type === "teacher" ? teacherDisplayName(plan.title || name) : plan.title || name;
    const teacherCode = plan.type === "teacher" ? teacherCodeFromName(name) : "";
    const subtitle =
      plan.type === "teacher" && teacherCode
        ? `<p class="plan-subtitle">Kod: ${teacherCode}</p>`
        : "";
    const validFrom = plan.validFrom
      ? `<p class="plan-meta">Obowiązuje od: ${plan.validFrom}</p>`
      : "";

    if (!parsed) {
      plansContainer.innerHTML = `<h2>${heading}</h2>${subtitle}${validFrom}${plan.html}`;
      enhanceTableLinks(plansContainer);
      return;
    }

    plansContainer.innerHTML = `
      <article class="plan">
        <h2>${heading}</h2>
        ${subtitle}
        ${validFrom}
        ${renderMobileDays(parsed, plan.type)}
        <div class="table-scroll">${parsed.tableHTML}</div>
      </article>
    `;

    const initialDay = defaultDayIndex(parsed.dayHeaders.length);
    activateDay(plansContainer, initialDay);
    plansContainer.querySelectorAll(".day-tab").forEach((tab) => {
      tab.addEventListener("click", () => activateDay(plansContainer, Number(tab.dataset.day)));
    });
    plansContainer.querySelectorAll(".chip-link").forEach((btn) => {
      btn.addEventListener("click", () => selectAndRender(btn.dataset.target));
    });
    enhanceTableLinks(plansContainer);
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
