export type Person = "Luca" | "Jan";

export type FixedCost = {
  area: string;
  kind: string;
  description: string;
  status: string;
  date: string;
  amount: number;
  paidBy: string;
  lucaShare: number;
  janShare: number;
  lucaPaid: number;
  janPaid: number;
  lucaBalance: number;
};

export type RoutePlan = {
  id: string;
  day: string;
  title: string;
  stops: string[];
  cost: string;
  status: string;
  note: string;
  maps: string;
};

export type Place = {
  id: string;
  title: string;
  category: string;
  region: string;
  location?: string;
  priority: string;
  effort: string;
  cost: string;
  note: string;
  maps: string;
  lat?: number | null;
  lng?: number | null;
  qualityStatus?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  region: string;
  place: string;
  cuisine: string;
  price: string;
  veggie: string;
  portions: string;
  priority: string;
  drive: string;
  why: string;
  maps: string;
  lat?: number | null;
  lng?: number | null;
  qualityStatus?: string;
  ratingHint?: string;
};

export type TrainLeg = {
  id: string;
  direction: string;
  date: string;
  section: string;
  train: string;
  from: string;
  dep: string;
  depPlatform: string;
  to: string;
  arr: string;
  arrPlatform: string;
  price: string;
  note: string;
  fromStationId?: string;
  toStationId?: string;
  timeZone?: string;
};

export type Flight = {
  id: string;
  direction: string;
  date: string;
  from: string;
  dep: string;
  to: string;
  arr: string;
  airline: string;
  number: string;
  booking: string;
  aircraft: string;
  manageUrl: string;
};

export const sheetSnapshot = {
  source: "Kreta_Kostenuebersicht_Luca_Jan_final",
  spreadsheetId: "1YnCyOTNSsMbtebp-JeqWUSC6PMSI2mQZsexddv30TqY",
  readAt: "10.06.2026, 19:35",
};

export const trip = {
  title: "Kreta 2026",
  people: "Luca & Jan",
  dates: "01.-09. Juli 2026",
  hotel: "Anthos Hotel, Frangokastello",
  hotelMaps:
    "https://www.google.com/maps/search/?api=1&query=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece",
  startDate: "2026-07-01T00:00:00",
};

export const dashboard = {
  totalBudget: 1159.66,
  openAmount: 0,
  consideredAmount: 1159.66,
  lucaPaid: 153.78,
  janPaid: 1005.88,
  lucaShare: 571.28,
  janShare: 588.38,
  lucaBalance: -417.5,
  direction: "luca_an_jan",
  settlementText: "Luca zahlt an Jan",
  settlementAmount: 417.5,
  fix: {
    amount: 1159.66,
    lucaPaid: 153.78,
    janPaid: 1005.88,
    lucaBalance: -417.5,
  },
  onTrip: {
    amount: 0,
    lucaPaid: 0,
    janPaid: 0,
    lucaBalance: 0,
  },
};

export const categorySummary = [
  { name: "Flug", total: 237.1, lucaPaid: 0, janPaid: 237.1, lucaShare: 118.55, janShare: 118.55, lucaBalance: -118.55 },
  { name: "Hotel", total: 588.7, lucaPaid: 54.82, janPaid: 533.88, lucaShare: 294.35, janShare: 294.35, lucaBalance: -239.53 },
  { name: "Mietwagen", total: 215, lucaPaid: 0, janPaid: 215, lucaShare: 107.5, janShare: 107.5, lucaBalance: -107.5 },
  { name: "Bahn/Nürnberg", total: 98.96, lucaPaid: 98.96, janPaid: 0, lucaShare: 49.48, janShare: 49.48, lucaBalance: 49.48 },
  { name: "Sonstiges", total: 19.9, lucaPaid: 0, janPaid: 19.9, lucaShare: 1.4, janShare: 18.5, lucaBalance: -1.4 },
];

export const fixedCosts: FixedCost[] = [
  {
    area: "Flug",
    kind: "Flug",
    description: "Hin- und Rückflug Nürnberg ↔ Kreta für 2 Personen",
    status: "Bezahlt",
    date: "02.06.2026",
    amount: 237.1,
    paidBy: "Jan",
    lucaShare: 118.55,
    janShare: 118.55,
    lucaPaid: 0,
    janPaid: 237.1,
    lucaBalance: -118.55,
  },
  {
    area: "Hotel",
    kind: "Hotel Kreta",
    description: "Unterkunft auf Kreta, Gesamtpreis für beide",
    status: "Bezahlt",
    date: "02.06.2026",
    amount: 533.88,
    paidBy: "Jan",
    lucaShare: 266.94,
    janShare: 266.94,
    lucaPaid: 0,
    janPaid: 533.88,
    lucaBalance: -266.94,
  },
  {
    area: "Hotel",
    kind: "Hotel Nürnberg",
    description: "Hotel in Nürnberg vom 08.-09. Juli",
    status: "Bezahlt",
    date: "08.07.2026",
    amount: 54.82,
    paidBy: "Luca",
    lucaShare: 27.41,
    janShare: 27.41,
    lucaPaid: 54.82,
    janPaid: 0,
    lucaBalance: 27.41,
  },
  {
    area: "Mietwagen",
    kind: "Mietwagen Kreta",
    description: "Mietwagen für die Reisezeit auf Kreta",
    status: "Bezahlt",
    date: "05.06.2026",
    amount: 215,
    paidBy: "Jan",
    lucaShare: 107.5,
    janShare: 107.5,
    lucaPaid: 0,
    janPaid: 215,
    lucaBalance: -107.5,
  },
  {
    area: "Bahn/Nürnberg",
    kind: "Bahn Hinreise",
    description: "Landstuhl → Nürnberg / Nürnberg Flughafen",
    status: "Bezahlt",
    date: "01.07.2026",
    amount: 56.98,
    paidBy: "Luca",
    lucaShare: 28.49,
    janShare: 28.49,
    lucaPaid: 56.98,
    janPaid: 0,
    lucaBalance: 28.49,
  },
  {
    area: "Bahn/Nürnberg",
    kind: "Bahn Rückreise",
    description: "Nürnberg → Landstuhl",
    status: "Geplant",
    date: "09.07.2026",
    amount: 41.98,
    paidBy: "Luca",
    lucaShare: 20.99,
    janShare: 20.99,
    lucaPaid: 41.98,
    janPaid: 0,
    lucaBalance: 20.99,
  },
  {
    area: "Sonstiges",
    kind: "Sonstige Fixkosten",
    description: "Weitere gemeinsame Kosten vor Abreise",
    status: "Bezahlt",
    date: "08.06.2026",
    amount: 19.9,
    paidBy: "Jan",
    lucaShare: 1.4,
    janShare: 18.5,
    lucaPaid: 0,
    janPaid: 19.9,
    lucaBalance: -1.4,
  },
];

export const lists = {
  travelDays: [
    "Mi, 01.07.",
    "Do, 02.07.",
    "Fr, 03.07.",
    "Sa, 04.07.",
    "So, 05.07.",
    "Mo, 06.07.",
    "Di, 07.07.",
    "Mi, 08.07.",
    "Do, 09.07.",
  ],
  categories: [
    "Tanken",
    "Parken/Maut",
    "Supermarkt",
    "Restaurants & Cafés",
    "Strandliegen/Schirme",
    "Ausflüge/Eintritte",
    "Gemeinsame Einkäufe",
    "Apotheke/Notfall",
    "ÖPNV/Taxi",
    "Sonstiges",
  ],
};

export const flights: Flight[] = [
  {
    id: "F001",
    direction: "Hinflug",
    date: "01.07.2026",
    from: "NUE Nürnberg",
    dep: "16:45",
    to: "CHQ Chania",
    arr: "20:35",
    airline: "Ryanair",
    number: "FR 7910",
    booking: "GZJMNP",
    aircraft: "Boeing 737-800",
    manageUrl: "https://www.ryanair.com/de/de/trip/manage",
  },
  {
    id: "F002",
    direction: "Rückflug",
    date: "08.07.2026",
    from: "CHQ Chania",
    dep: "21:00",
    to: "NUE Nürnberg",
    arr: "23:00",
    airline: "Ryanair",
    number: "FR 7911",
    booking: "GZJMNP",
    aircraft: "Boeing 737-800",
    manageUrl: "https://www.ryanair.com/de/de/trip/manage",
  },
];

export const trains: TrainLeg[] = [
  {
    id: "B001",
    direction: "Hinfahrt",
    date: "01.07.2026",
    section: "Landstuhl → Stuttgart",
    train: "ICE 1091",
    from: "Landstuhl",
    dep: "06:10",
    depPlatform: "1",
    to: "Stuttgart Hbf",
    arr: "07:51",
    arrPlatform: "16",
    price: "56,98 €",
    note: "Zugbindung für ICE 1091; ab 20 Minuten erwarteter Zielverspätung prüfen.",
  },
  {
    id: "B002",
    direction: "Hinfahrt",
    date: "01.07.2026",
    section: "Stuttgart → Nürnberg",
    train: "IC 2065",
    from: "Stuttgart Hbf",
    dep: "08:08",
    depPlatform: "16",
    to: "Nürnberg Hbf",
    arr: "10:18",
    arrPlatform: "15",
    price: "56,98 €",
    note: "Umstieg Stuttgart: Ankunft Gleis 16, Abfahrt Gleis 16.",
  },
  {
    id: "B003",
    direction: "Rückfahrt",
    date: "09.07.2026",
    section: "Nürnberg → Stuttgart",
    train: "IC 2066",
    from: "Nürnberg Hbf",
    dep: "17:40",
    depPlatform: "15",
    to: "Stuttgart Hbf",
    arr: "19:53",
    arrPlatform: "11",
    price: "41,98 €",
    note: "Zugbindung für IC 2066.",
  },
  {
    id: "B004",
    direction: "Rückfahrt",
    date: "09.07.2026",
    section: "Stuttgart → Kaiserslautern",
    train: "ICE 1090",
    from: "Stuttgart Hbf",
    dep: "20:04",
    depPlatform: "8",
    to: "Kaiserslautern Hbf",
    arr: "21:32",
    arrPlatform: "3",
    price: "41,98 €",
    note: "Umstieg Stuttgart: 11 Minuten von Gleis 11 zu Gleis 8. Live prüfen.",
  },
  {
    id: "B005",
    direction: "Rückfahrt",
    date: "09.07.2026",
    section: "Kaiserslautern → Landstuhl",
    train: "RB70",
    from: "Kaiserslautern Hbf",
    dep: "22:05",
    depPlatform: "3",
    to: "Landstuhl",
    arr: "22:17",
    arrPlatform: "2",
    price: "separates Ticket nötig",
    note: "DB-Ticket gilt für diesen Abschnitt nicht; weitere Fahrkarte nötig.",
  },
];

export const routes: RoutePlan[] = [
  {
    id: "RO01",
    day: "01.07.2026",
    title: "Ankunft & Frangokastello easy",
    stops: ["Frangokastello Castle", "Orthi Ammos Beach"],
    cost: "€",
    status: "Idee",
    note: "Anthos Hotel Frangokastello",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Orthi%20Ammos%20Beach&travelmode=driving&dir_action=navigate&waypoints=Frangokastello%20Castle",
  },
  {
    id: "RO02",
    day: "02.07.2026",
    title: "Sfakia-Hafen + Glyka Nera/Loutro",
    stops: ["Chora Sfakion", "Glyka Nera Beach", "Loutro"],
    cost: "€€",
    status: "Idee",
    note: "Fähren/Boote am Vortag prüfen.",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Loutro&travelmode=driving&dir_action=navigate&waypoints=Chora%20Sfakion%7CGlyka%20Nera%20Beach",
  },
  {
    id: "RO03",
    day: "03.07.2026",
    title: "Imbros-Schlucht + Komitades",
    stops: ["Imbros Gorge entrance", "Komitades", "Chora Sfakion"],
    cost: "€€",
    status: "Idee",
    note: "Früh starten, Wasser/Schuhe; Taxi zurück organisieren.",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Chora%20Sfakion&travelmode=driving&dir_action=navigate&waypoints=Imbros%20Gorge%20entrance%7CKomitades",
  },
  {
    id: "RO04",
    day: "04.07.2026",
    title: "Plakias-Strände + Myrthios Abendessen",
    stops: ["Rodakino Beach", "Plakias", "Damnoni Beach", "Myrthios"],
    cost: "€€",
    status: "Idee",
    note: "Gute Route für Strände + gutes Essen.",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Myrthios&travelmode=driving&dir_action=navigate&waypoints=Rodakino%20Beach%7CPlakias%7CDamnoni%20Beach",
  },
  {
    id: "R05",
    day: "05.07.2026",
    title: "Westküste Traumstrand",
    stops: ["Elafonisi Beach", "Falasarna/Abendessen"],
    cost: "Falasarna/Abendessen",
    status: "Geplant",
    note: "Sehr früh los, viel Fahrzeit einplanen.",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Falasarna%2FAbendessen&travelmode=driving&dir_action=navigate&waypoints=Elafonisi%20Beach",
  },
  {
    id: "RO15",
    day: "Offen",
    title: "Balos/Falassarna West-Tag",
    stops: ["Falassarna Beach", "Balos Lagoon"],
    cost: "€€€",
    status: "Idee",
    note: "Sehr großer Ausflug, Logistik vorher prüfen.",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Balos%20Lagoon&travelmode=driving&dir_action=navigate&waypoints=Falassarna%20Beach",
  },
  {
    id: "RO124852",
    day: "Offen",
    title: "Neue Route",
    stops: [
      "Imbros-Schlucht",
      "Chora Sfakion Hafen & Promenade",
      "Glyka Nera / Sweet Water Beach",
      "Frangokastello Burg & Strand",
      "Orthi Ammos Beach",
      "Taverna Akti",
    ],
    cost: "€€",
    status: "Geplant",
    note: "Chora Sfakion Hafen & Promenade",
    maps:
      "https://www.google.com/maps/dir/?api=1&origin=Anthos%20Hotel%2C%20Frangokastello%20730%2011%2C%20Greece&destination=Taverna%20Akti&travelmode=driving&dir_action=navigate&waypoints=Imbros-Schlucht%7CChora%20Sfakion%20Hafen%20%26%20Promenade%7CGlyka%20Nera%20%2F%20Sweet%20Water%20Beach",
  },
];

export const places: Place[] = [
  {
    id: "G001",
    title: "Frangokastello Burg & Strand",
    category: "Kultur/Strand",
    region: "Sfakia / Frangokastello",
    priority: "Hoch",
    effort: "1-3 h",
    cost: "€",
    note: "Direkt bei eurer Unterkunft; perfekt für Ankunft, Sonnenuntergang, kurzer Strandtag.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.18211429999999%2C24.2341866",
  },
  {
    id: "G006",
    title: "Glyka Nera / Sweet Water Beach",
    category: "Strand/Natur",
    region: "Sfakia",
    priority: "Hoch",
    effort: "Halber Tag",
    cost: "€€",
    note: "Nur per Boot oder Wanderung; ikonischer Südküstenstrand bei Chora Sfakion/Loutro.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.2018117%2C24.1074038",
  },
  {
    id: "G007",
    title: "Loutro",
    category: "Ort/Boot",
    region: "Sfakia",
    priority: "Hoch",
    effort: "Halber Tag",
    cost: "€€",
    note: "Autofreier Küstenort; Boot ab Chora Sfakion; ideal als entspannter Ausflug.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.2000045%2C24.0786653",
  },
  {
    id: "G014",
    title: "Preveli Palm Beach",
    category: "Strand/Natur",
    region: "Rethymno Süd",
    priority: "Hoch",
    effort: "Halber Tag",
    cost: "€€",
    note: "Palmenfluss und Strand; früh starten wegen Hitze/Parken.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.1526125%2C24.4738555",
  },
  {
    id: "G025",
    title: "Chania Altstadt & Venezianischer Hafen",
    category: "Stadt/Abend",
    region: "Chania",
    priority: "Hoch",
    effort: "Halber Tag",
    cost: "€€",
    note: "Einer der schönsten Stadtabende auf Kreta; früh parken.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.5171655%2C24.0175654",
  },
  {
    id: "G030",
    title: "Balos Lagoon",
    category: "Strand",
    region: "Gramvousa / Chania",
    priority: "Hoch",
    effort: "Ganzer Tag",
    cost: "€€€",
    note: "Extrem schön, aber logistisch aufwendig; Boot oder schwierige Zufahrt.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.5792671%2C23.5887205",
  },
  {
    id: "G032",
    title: "Elafonisi Beach",
    category: "Strand",
    region: "Westkreta",
    priority: "Hoch",
    effort: "Ganzer Tag",
    cost: "€€",
    note: "Weltbekannter Strand, sehr früh starten.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.2711801%2C23.5412959",
  },
  {
    id: "G036",
    title: "Knossos Palast",
    category: "Archäologie",
    region: "Heraklion",
    priority: "Hoch",
    effort: "2-3 h",
    cost: "€€",
    note: "Klassisches Kreta-Must-see; mit Museum kombinieren.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.2979569%2C25.1627815",
  },
];

export const restaurants: Restaurant[] = [
  {
    id: "R001",
    name: "Taverna Babis & Popi",
    region: "Sfakia/Frangokastello",
    place: "Frangokastello",
    cuisine: "Taverna",
    price: "€€",
    veggie: "Mittel",
    portions: "Groß",
    priority: "Hoch",
    drive: "0-5 Min",
    why: "Direkt bei Unterkunft; gute Kandidatin für unkompliziertes sattes Abendessen.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.185337%2C24.2289109",
  },
  {
    id: "R006",
    name: "Livikon by the Sea",
    region: "Sfakia",
    place: "Chora Sfakion",
    cuisine: "Taverna/Sea View",
    price: "€€",
    veggie: "Mittel",
    portions: "Mittel",
    priority: "Hoch",
    drive: "20-25 Min",
    why: "Schöner Hafenort, gut für Abendessen nach Ausflug.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.20117949999999%2C24.1360608",
  },
  {
    id: "R014",
    name: "Medousa Restaurant",
    region: "Plakias",
    place: "Plakias",
    cuisine: "Taverna",
    price: "€€",
    veggie: "Mittel",
    portions: "Groß",
    priority: "Hoch",
    drive: "45-55 Min",
    why: "Sehr guter Plakias-Kandidat für klassische satt machende Taverne.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.1904526%2C24.3973088",
  },
  {
    id: "R019",
    name: "Taverna Mariou",
    region: "Plakias",
    place: "Mariou",
    cuisine: "Bergdorf-Taverna",
    price: "€€",
    veggie: "Mittel",
    portions: "Groß",
    priority: "Hoch",
    drive: "55-65 Min",
    why: "Sehr attraktiv wegen Aussicht/Abendessen oberhalb Plakias.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.1990145%2C24.4217344",
  },
  {
    id: "R027",
    name: "To Stachi",
    region: "Chania",
    place: "Chania",
    cuisine: "Vegetarisch/Vegan",
    price: "€€",
    veggie: "Sehr hoch",
    portions: "Mittel",
    priority: "Hoch",
    drive: "90-110 Min",
    why: "Sehr wichtig für vegetarisches Essen in Chania.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.5183043%2C24.0236688",
  },
  {
    id: "R046",
    name: "Raki Ba Raki",
    region: "Rethymno",
    place: "Rethymno",
    cuisine: "Mezze/Kretisch",
    price: "€€",
    veggie: "Hoch",
    portions: "Mittel",
    priority: "Hoch",
    drive: "75-90 Min",
    why: "Mezze ist perfekt für vegetarisches Teilen.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.3700589%2C24.4738986",
  },
  {
    id: "R059",
    name: "Peskesi",
    region: "Heraklion",
    place: "Heraklion",
    cuisine: "Kretisch",
    price: "€€",
    veggie: "Hoch",
    portions: "Groß",
    priority: "Hoch",
    drive: "2 h",
    why: "Sehr bekannter Kandidat; viele traditionelle vegetarische Optionen möglich.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.3402248%2C25.1327106",
  },
  {
    id: "R070",
    name: "Phyllosophies",
    region: "Heraklion",
    place: "Heraklion",
    cuisine: "Vegetarisch/Cafe",
    price: "€€",
    veggie: "Sehr hoch",
    portions: "Mittel",
    priority: "Hoch",
    drive: "2 h",
    why: "Vegetarisch/healthy Kandidat, prüfen.",
    maps: "https://www.google.com/maps/search/?api=1&query=35.3389727%2C25.1330673",
  },
];

export const packItems = [
  { id: "P01", item: "Personalausweis/Reisepass", category: "Dokumente", who: "beide", importance: "Muss", bag: "Handgepäck", note: "Gültigkeit prüfen" },
  { id: "P02", item: "Führerschein", category: "Dokumente", who: "beide", importance: "Muss", bag: "Handgepäck", note: "Für Mietwagen wichtig" },
  { id: "P03", item: "Kreditkarte für Mietwagen", category: "Dokumente/Zahlung", who: "beide", importance: "Muss", bag: "Handgepäck", note: "Auf Namen des Hauptfahrers prüfen" },
  { id: "P04", item: "Buchungsbestätigungen Flug/Hotel/Mietwagen", category: "Dokumente", who: "beide", importance: "Muss", bag: "Handgepäck", note: "In Drive/App speichern" },
  { id: "P05", item: "Krankenversicherungskarte / Auslandsschutz", category: "Gesundheit", who: "beide", importance: "Muss", bag: "Handgepäck", note: "EHIC/Versicherung prüfen" },
  { id: "P06", item: "Sonnencreme SPF 50", category: "Strand/Gesundheit", who: "beide", importance: "Muss", bag: "Handgepäck", note: "Juli auf Kreta sehr wichtig" },
  { id: "P07", item: "Badesachen", category: "Kleidung", who: "beide", importance: "Muss", bag: "Koffer", note: "Strand/Pool" },
  { id: "P08", item: "Feste Schuhe/Sneaker", category: "Kleidung", who: "beide", importance: "Muss", bag: "Koffer", note: "Für Schluchten/Altstadt" },
  { id: "P09", item: "Wasserschuhe", category: "Strand", who: "beide", importance: "Sinnvoll", bag: "Tagesrucksack", note: "Steinige Buchten" },
  { id: "P10", item: "Powerbank", category: "Technik", who: "beide", importance: "Sinnvoll", bag: "Handgepäck", note: "Navigation/Maps" },
  { id: "P11", item: "Ladekabel + Netzteil", category: "Technik", who: "beide", importance: "Muss", bag: "Handgepäck", note: "iPhone/USB-C prüfen" },
  { id: "P12", item: "Sonnenbrille", category: "Strand", who: "beide", importance: "Muss", bag: "Tagesrucksack", note: "" },
  { id: "P13", item: "Kappe/Hut", category: "Strand/Gesundheit", who: "beide", importance: "Sinnvoll", bag: "Handgepäck", note: "Für Touren in der Sonne" },
  { id: "P14", item: "Reiseapotheke", category: "Gesundheit", who: "beide", importance: "Sinnvoll", bag: "Handgepäck", note: "Schmerzmittel, Magen, Pflaster" },
  { id: "P15", item: "Tagesrucksack", category: "Ausflüge", who: "beide", importance: "Sinnvoll", bag: "Koffer", note: "Wasser, Sonnencreme, Handtuch" },
  { id: "P16", item: "Offline-Karten herunterladen", category: "Orga", who: "beide", importance: "Sinnvoll", bag: "Auto/Tagesrucksack", note: "Google Maps Offline-Region Kreta" },
];
