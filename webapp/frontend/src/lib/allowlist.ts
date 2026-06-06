// Kuratierte Allowlist für Wörter, die das Wörterbuch (igerman98) nicht kennt,
// die aber korrekt sind – v. a. Länder, Nationalitäten, Kontinente. Alles
// kleingeschrieben (Vergleich erfolgt case-insensitiv).

const COUNTRIES = [
  "afghanistan", "ägypten", "albanien", "algerien", "andorra", "angola",
  "argentinien", "armenien", "aserbaidschan", "äthiopien", "australien",
  "bahamas", "bahrain", "bangladesch", "barbados", "belgien", "belize",
  "benin", "bhutan", "bolivien", "bosnien", "herzegowina", "botswana",
  "brasilien", "brunei", "bulgarien", "burkina", "faso", "burundi", "chile",
  "china", "costa", "rica", "dänemark", "deutschland", "dominica",
  "dominikanische", "republik", "dschibuti", "ecuador", "elfenbeinküste",
  "el", "salvador", "eritrea", "estland", "eswatini", "fidschi", "finnland",
  "frankreich", "gabun", "gambia", "georgien", "ghana", "grenada",
  "griechenland", "großbritannien", "guatemala", "guinea", "bissau", "guyana",
  "haiti", "honduras", "indien", "indonesien", "irak", "iran", "irland",
  "island", "israel", "italien", "jamaika", "japan", "jemen", "jordanien",
  "kambodscha", "kamerun", "kanada", "kap", "verde", "kasachstan", "katar",
  "kenia", "kirgisistan", "kiribati", "kolumbien", "komoren", "kongo",
  "kosovo", "kroatien", "kuba", "kuwait", "laos", "lesotho", "lettland",
  "libanon", "liberia", "libyen", "liechtenstein", "litauen", "luxemburg",
  "madagaskar", "malawi", "malaysia", "malediven", "mali", "malta", "marokko",
  "mauretanien", "mauritius", "mazedonien", "nordmazedonien", "mexiko",
  "mikronesien", "moldau", "monaco", "mongolei", "montenegro", "mosambik",
  "myanmar", "namibia", "nauru", "nepal", "neuseeland", "nicaragua",
  "niederlande", "niger", "nigeria", "nordkorea", "norwegen", "oman",
  "österreich", "osttimor", "pakistan", "palau", "panama", "papua",
  "neuguinea", "paraguay", "peru", "philippinen", "polen", "portugal",
  "ruanda", "rumänien", "russland", "samoa", "san", "marino", "saudi",
  "arabien", "schweden", "schweiz", "senegal", "serbien", "seychellen",
  "sierra", "leone", "simbabwe", "singapur", "slowakei", "slowenien",
  "somalia", "spanien", "sri", "lanka", "südafrika", "sudan", "südkorea",
  "südsudan", "suriname", "syrien", "tadschikistan", "tansania", "thailand",
  "togo", "tonga", "trinidad", "tobago", "tschad", "tschechien", "tunesien",
  "türkei", "turkmenistan", "tuvalu", "uganda", "ukraine", "ungarn",
  "uruguay", "usbekistan", "vanuatu", "vatikanstadt", "venezuela", "vietnam",
  "vereinigte", "staaten", "arabische", "emirate", "weißrussland", "belarus",
  "zentralafrikanische", "zypern",
]

const NATIONALITIES = [
  "afghanisch", "ägyptisch", "albanisch", "algerisch", "amerikanisch",
  "argentinisch", "armenisch", "aserbaidschanisch", "äthiopisch",
  "australisch", "belgisch", "bolivianisch", "bosnisch", "brasilianisch",
  "britisch", "bulgarisch", "chilenisch", "chinesisch", "dänisch", "deutsch",
  "ecuadorianisch", "englisch", "estnisch", "finnisch", "französisch",
  "georgisch", "ghanaisch", "griechisch", "indisch", "indonesisch", "irakisch",
  "iranisch", "irisch", "isländisch", "israelisch", "italienisch", "japanisch",
  "jemenitisch", "jordanisch", "kanadisch", "kasachisch", "katarisch",
  "kenianisch", "kolumbianisch", "koreanisch", "kroatisch", "kubanisch",
  "lettisch", "libanesisch", "libysch", "litauisch", "luxemburgisch",
  "malaysisch", "marokkanisch", "mexikanisch", "mongolisch", "neuseeländisch",
  "niederländisch", "nigerianisch", "norwegisch", "österreichisch",
  "pakistanisch", "peruanisch", "philippinisch", "polnisch", "portugiesisch",
  "rumänisch", "russisch", "saudisch", "schwedisch", "schweizerisch",
  "senegalesisch", "serbisch", "singapurisch", "slowakisch", "slowenisch",
  "spanisch", "südafrikanisch", "südkoreanisch", "syrisch", "thailändisch",
  "tschechisch", "tunesisch", "türkisch", "ukrainisch", "ungarisch",
  "uruguayisch", "usbekisch", "venezolanisch", "vietnamesisch", "zyprisch",
]

const CONTINENTS_REGIONS = [
  "europa", "europäisch", "afrika", "afrikanisch", "asien", "asiatisch",
  "amerika", "nordamerika", "südamerika", "lateinamerika", "ozeanien",
  "antarktis", "arktis", "skandinavien", "balkan", "kaukasus", "nahost",
  "naher", "osten", "subsahara",
]

// häufige, korrekte Wörter, die dem Wörterbuch fehlen können
const MISC = [
  "funfacts", "funfact", "podcast", "podcasts", "newsletter", "feedback",
  "team", "teams", "online", "offline", "ehrenamt", "ehrenamtlich",
  "nachhaltigkeitsstrategie", "stipendiat", "stipendiatin", "stipendien",
  "naumann", "freiheit.org",
]

export const CURATED_ALLOW: ReadonlySet<string> = new Set(
  [...COUNTRIES, ...NATIONALITIES, ...CONTINENTS_REGIONS, ...MISC].map((w) =>
    w.toLowerCase()
  )
)
