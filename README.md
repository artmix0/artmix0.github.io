# artmix0.github.io

To repozytorium zawiera **statyczną stronę internetową** hostowaną przez GitHub Pages pod adresem:

👉 https://artmix0.github.io/

Strona służy do **przeglądania planu lekcji**.  
Jest to **strona statyczna**, a dane z planem lekcji są **pobierane i aktualizowane automatycznie przez workflow GitHub Actions** – dzięki temu strona zawsze wyświetla aktualny plan, bez potrzeby ręcznej ingerencji.

---

## 🛠 Jak to działa

1. **Workflow GitHub Actions** regularnie uruchamia skrypt, który pobiera plan lekcji ze strony szkoły.  
2. Dane są zapisywane jako statyczne pliki w repozytorium (HTML/JSON).  
3. GitHub Pages automatycznie publikuje te pliki, dzięki czemu odwiedzający widzą zawsze aktualny plan lekcji.

> Dzięki temu strona nie wymaga backendu ani dynamicznego pobierania danych w przeglądarce – wszystko dzieje się po stronie GitHub.
