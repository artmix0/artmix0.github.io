document.addEventListener("DOMContentLoaded", () => {
  const plany = {};

  fetch("scraped.json")
    .then(res => res.json())
    .then(data => {

      let container = "";

      const parser = new DOMParser();

      for (const [name, htmlString] of Object.entries(data)) {
        const doc = parser.parseFromString(htmlString, "text/html");
        const table = doc.querySelector("div > table");

        const rows = table.querySelectorAll(":scope > tbody > tr");

        if (rows[1]) rows[1].remove();
        if (rows[2]) rows[2].remove();

        const title = document.createElement("h2");
        title.textContent = name;
        container =+ title;
        container =+ table;

        plany[name] = container;
      }

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
  
  
});