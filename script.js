document.addEventListener("DOMContentLoaded", () => {
  const plany = {};

  fetch("scraped.json")
    .then(res => res.json())
    .then(data => {

      const parser = new DOMParser();

      for (const [name, htmlString] of Object.entries(data)) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const table = doc.querySelector("div > table");

      const containerHTML = `<h2>${name}</h2>` + table.outerHTML;

      plany[name] = containerHTML;
      }
      
      console.log(plany);

      document.querySelector("#classSelect").innerHTML = `<option value="" disabled selected>-- Wybierz --</option>`;
      document.querySelector("#teacherSelect").innerHTML = `<option value="" disabled selected>-- Wybierz --</option>`;
      document.querySelector("#roomSelect").innerHTML = `<option value="" disabled selected>-- Wybierz --</option>`;

      for (const name in plany) {
        if(/^[0-9][A-Z]$/.test(name)){
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          document.querySelector("#classSelect").appendChild(option);
        }
        else if(/\(.+\)$/.test(name)){
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          document.querySelector("#teacherSelect").appendChild(option);
        }
        else{
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          document.querySelector("#roomSelect").appendChild(option);
        }
      }
    })
    .catch(err => {
      console.error("Błąd wczytywania danych:", err);
      document.getElementById("plans").textContent =
        "Nie udało się wczytać scraped.json";
    });
  
  document.querySelectorAll("select").forEach(select => {
    select.addEventListener("change", (event) => {
        const selectedValue = event.target.value;
        const plansContainer = document.getElementById("plans");

        plansContainer.innerHTML = plany[selectedValue] || "Brak planu dla wybranego elementu.";

        event.target.selectedIndex = 0;
    });
});
});