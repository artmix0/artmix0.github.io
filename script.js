console.log("Ładowanie danych ze scraped.json...");
fetch("scraped.json")
  .then(res => res.json())
  .then(data => {
    // Pomijamy wszystko po "\tBukowska" (stopka)
    const dataString = data["1A"]; 
    const cleanedString = dataString.split('\tBukowska')[0];

    // Dzielimy po wierszach
    const rows = cleanedString.split('\n');

    // Tworzymy HTML tabeli
    let html = '<table border="1">\n';

    rows.forEach(row => {
        html += '  <tr>';
        // dzielimy po tabulatorach i zamieniamy każdą komórkę na <td>
        row.split('\t').forEach(cell => {
            html += `<td>${cell.trim()}</td>`;
        });
        html += '</tr>\n';
    });

    html += '</table>';
    document.body.innerHTML = html;
  })
  .catch(err => console.error("Błąd wczytywania danych:", err));