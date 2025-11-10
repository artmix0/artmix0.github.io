fetch("scraped.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("plans");
    container.innerHTML = "";

    const parser = new DOMParser();

    for (const [className, htmlString] of Object.entries(data)) {
      const doc = parser.parseFromString(htmlString, "text/html");
      console.log(doc);
      const table = doc.querySelector("div>table");
      table.querySelector("tr:nth-of-type(2)").remove();
      table.querySelector("tr:nth-of-type(3)").remove();

      const title = document.createElement("h2");
      title.textContent = `${className}`;
      container.appendChild(title);

      container.appendChild(table);
    }
  })
  .catch(err => {
    console.error("Błąd wczytywania danych:", err);
    document.getElementById("plans").textContent =
      "Nie udało się wczytać scraped.json";
  });