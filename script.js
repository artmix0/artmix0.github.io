fetch("scraped.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("plans");
    container.innerHTML = "";

    const parser = new DOMParser();

    for (const [className, htmlString] of Object.entries(data)) {
      const doc = parser.parseFromString(htmlString, "text/html");
      const table = doc.querySelector("div > table, table");

      const rows = table.querySelectorAll(":scope > tbody > tr");

      if (rows[1]) rows[1].remove();
      if (rows[2]) rows[2].remove();

      const title = document.createElement("h2");
      title.textContent = className;
      container.appendChild(title);
      container.appendChild(table);
    }
  })
  .catch(err => {
    console.error("Błąd wczytywania danych:", err);
    document.getElementById("plans").textContent =
      "Nie udało się wczytać scraped.json";
  });