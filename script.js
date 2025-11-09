console.log("Ładowanie danych ze scraped.json...");
fetch("scraped.json")
  .then(res => res.json())
  .then(data => {
    const lista = document.getElementById("lista");
    data.forEach(el => {
      const li = document.createElement("li");
      li.textContent = el;
      lista.appendChild(li);
    });
  })
  .catch(err => console.error("Błąd wczytywania danych:", err));