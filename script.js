fetch("scraped.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("plans");
    container.innerHTML = "";

    const parser = new DOMParser();

    for (const [className, htmlString] of Object.entries(data)) {
      const doc = parser.parseFromString(htmlString, "text/html");
      console.log(doc);
      const table = doc.querySelector("");

      if (!table) continue; // pomijamy jeśli brak tabeli

      // Nagłówek klasy
      const title = document.createElement("h2");
      title.textContent = `Klasa ${className}`;
      container.appendChild(title);

      // Wstawiamy tabelę
      container.appendChild(table);
    }
  })
  .catch(err => {
    console.error("Błąd wczytywania danych:", err);
    document.getElementById("plans").textContent =
      "Nie udało się wczytać scraped.json";
  });