// QM-07: Hijri (Islamic) holiday suggestions for the academic calendar.
// Dates come from the Umm al-Qura calendar built into Node's Intl (ICU); Bangladesh follows local moon
// sighting, so every suggestion is an estimate that may move by a day – the admin reviews before adding.

const HIJRI = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

const MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
  "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qadah", "Dhu al-Hijjah"];

// [hijri month, day, length in days, key, English title, Bangla title, type]
const OCCASIONS = [
  [1, 10, 1, "ashura", "Ashura", "আশুরা", "Holiday"],
  [3, 12, 1, "miladunnabi", "Eid-e-Miladunnabi", "ঈদে মিলাদুন্নবী", "Holiday"],
  [7, 27, 1, "shab-e-miraj", "Shab-e-Miraj", "শবে মেরাজ", "Holiday"],
  [8, 15, 1, "shab-e-barat", "Shab-e-Barat", "শবে বরাত", "Holiday"],
  [9, 1, 30, "ramadan", "Ramadan (fasting month)", "রমজান", "Other"],
  [9, 27, 1, "shab-e-qadr", "Shab-e-Qadr", "শবে কদর", "Holiday"],
  [10, 1, 3, "eid-ul-fitr", "Eid-ul-Fitr", "ঈদুল ফিতর", "Holiday"],
  [12, 9, 1, "arafah", "Day of Arafah", "আরাফার দিন", "Other"],
  [12, 10, 3, "eid-ul-adha", "Eid-ul-Adha", "ঈদুল আজহা", "Holiday"],
];

function hijriOf(date) {
  const parts = Object.fromEntries(HIJRI.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

const iso = (d) => d.toISOString().slice(0, 10);

/** Suggested Islamic occasions that start in the given Gregorian year. */
function hijriSuggestions(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return [];
  const out = [];
  for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += 86_400_000) {
    const d = new Date(t);
    const h = hijriOf(d);
    for (const [month, day, length, key, title, titleBn, type] of OCCASIONS) {
      if (h.month !== month || h.day !== day) continue;
      // Ramadan length follows the calendar (29 or 30 days): end the day before 1 Shawwal.
      let end = new Date(t + (length - 1) * 86_400_000);
      if (key === "ramadan") {
        let probe = t;
        while (hijriOf(new Date(probe + 86_400_000)).month === 9) probe += 86_400_000;
        end = new Date(probe);
      }
      out.push({
        key: `${key}-${h.year}`, title, titleBn, type,
        startDate: iso(d), endDate: iso(end),
        hijriLabel: `${day} ${MONTHS[month - 1]} ${h.year} AH`,
        estimated: true,
      });
    }
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

module.exports = { hijriOf, hijriSuggestions };
