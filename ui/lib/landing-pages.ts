export type LandingPage = {
  slug: string
  title: string
  description: string
  h1: string
  eyebrow: string
  answer: string
  updatedAt: string
  pillar: string
  intentStage: "BOFU" | "MOFU"
  sections: Array<{
    title: string
    body: string
    bullets: string[]
  }>
  stats: Array<{
    label: string
    value: string
    detail: string
  }>
  comparison: Array<{
    area: string
    manual: string
    surp: string
  }>
  faq: Array<{
    question: string
    answer: string
  }>
}

export const landingPages: LandingPage[] = [
  {
    slug: "softver-za-autobuske-agencije",
    title: "Softver za autobuske agencije",
    description: "Softver za autobuske agencije za linije, polaske, rezervacije, putnike i online rezervacije na jednom mestu.",
    h1: "Softver za autobuske agencije koji olaksava svakodnevni rad",
    eyebrow: "Softver za agencije",
    answer:
      "Softver za autobuske agencije pomaze da se linije, polasci, putnici i rezervacije vode na jednom mestu. SURP je napravljen za agencije koje zele manje tabela, manje poruka i jasniji pregled svakog polaska.",
    updatedAt: "2026-05-24",
    pillar: "digitalizacija-agencije",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta je softver za autobuske agencije?",
        body: "To je program koji pomaze agenciji da vodi linije, stanice, polaske, rezervacije i putnike bez stalnog prepisivanja iz jedne tabele u drugu.",
        bullets: ["Linije i stanice", "Polasci i dani voznje", "Rezervacije i putnici", "Javni sajt agencije"],
      },
      {
        title: "Kako izgleda rad u SURP-u?",
        body: "Agencija unese linije i polaske, a zatim tim kroz jedan pregled prati rezervacije i putnike. Putnici mogu da pronadju osnovne informacije na javnoj strani agencije.",
        bullets: ["Jedan pregled za tim", "Javna strana agencije", "Online rezervacije koje ne ostaju samo u porukama"],
      },
      {
        title: "Zasto agencije prelaze sa tabela?",
        body: "Tabele brzo postanu nepregledne kada ima vise linija, vise zaposlenih i vise kanala za rezervacije. Sistem pomaze da svi gledaju iste podatke.",
        bullets: ["Manje duplog unosa", "Brza provera rezervacija", "Jasniji dogovor u timu"],
      },
    ],
    stats: [
      { label: "Pocetak rada", value: "do 14 dana", detail: "Prva verzija sa linijama, korisnicima i osnovnim tokovima." },
      { label: "Koriscenje", value: "preko weba", detail: "Panel i javna strana rade kroz browser." },
      { label: "Namena", value: "agencije", detail: "Sistem je pravljen za autobuske agencije, ne za genericku prodaju." },
    ],
    comparison: [
      { area: "Rezervacije", manual: "Pozivi, poruke i tabele", surp: "Jedan pregled rezervacija i putnika" },
      { area: "Linije", manual: "Odvojeni fajlovi i rucne izmene", surp: "Centralna evidencija linija i stanica" },
      { area: "Online prisustvo", manual: "Staticki sajt ili drustvene mreze", surp: "Javni izlog povezan sa sistemom" },
    ],
    faq: [
      { question: "Da li je SURP samo za velike agencije?", answer: "Ne. Moze se krenuti od osnovnih linija i rezervacija, pa kasnije dodati javni sajt i online rezervacije." },
      { question: "Da li zamenjuje Excel?", answer: "Da. Cilj je da se vazni podaci vode u jednom sistemu, umesto u vise tabela koje se rucno uskladjuju." },
      { question: "Da li putnici vide sve podatke iz sistema?", answer: "Ne. Javni sajt prikazuje samo informacije koje agencija objavi, dok podaci za tim ostaju u panelu." },
      { question: "Da li mozemo prvo testirati jednu liniju?", answer: "Da. Preporuka je da se krene sa jednom linijom i jasnim pravilom kako tim prati rezervacije." },
    ],
  },
  {
    slug: "sistem-za-rezervacije-autobusa",
    title: "Sistem za rezervacije autobusa",
    description: "Sistem za rezervacije autobusa za agencije koje zele bolji pregled putnika, polazaka i slobodnih mesta.",
    h1: "Sistem za rezervacije autobusa bez pretrage kroz poruke i tabele",
    eyebrow: "Rezervacije",
    answer:
      "Sistem za rezervacije autobusa pomaze agenciji da vidi ko putuje, kada polazi i na kojoj liniji je rezervacija. SURP spaja rezervacije koje unosi tim i upite koji dolaze preko sajta.",
    updatedAt: "2026-05-24",
    pillar: "online-rezervacije",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta je sistem za rezervacije autobusa?",
        body: "To je jednostavan nacin da se rezervacije, putnici i polasci vode na jednom mestu, umesto kroz sveske, Excel i poruke.",
        bullets: ["Unos rezervacije po polasku", "Podaci o putniku", "Stanice polaska i dolaska", "Status rezervacije"],
      },
      {
        title: "Kako smanjuje greske?",
        body: "Kada svi rade iz istog pregleda, manja je sansa da se mesto duplira, da se putnik preskoci ili da se termin pogresno upise.",
        bullets: ["Jedan pregled", "Manje prepisivanja", "Istorija rezervacija"],
      },
      {
        title: "Kada online rezervacije imaju smisla?",
        body: "Online rezervacije najvise pomazu kada ne ostaju samo u emailu, vec odmah ulaze u pregled koji tim koristi svaki dan.",
        bullets: ["Putnik salje upit online", "Tim vidi rezervaciju u panelu", "Agencija i dalje kontrolise potvrdu"],
      },
    ],
    stats: [
      { label: "Rezervacija", value: "po polasku", detail: "Svaka rezervacija je vezana za konkretan polazak." },
      { label: "Pregled", value: "1 panel", detail: "Tim ne mora da sabira poruke i tabele." },
      { label: "Start", value: "jedna linija", detail: "Moze se uvoditi postepeno bez prekida rada." },
    ],
    comparison: [
      { area: "Upit putnika", manual: "Telefon ili poruka bez jasnih podataka", surp: "Rezervacija sa osnovnim podacima" },
      { area: "Provera mesta", manual: "Rucno brojanje", surp: "Pregled po polasku" },
      { area: "Istorija", manual: "Tesko pretraziva", surp: "Putnik i rezervacije na jednom mestu" },
    ],
    faq: [
      { question: "Da li mogu da unosim rezervacije rucno?", answer: "Da. Rucni unos je vazan jer mnoge agencije i dalje primaju rezervacije telefonom i kroz poruke." },
      { question: "Da li online rezervacija odmah znaci placanje?", answer: "Ne. Online rezervacije i online placanje mogu biti odvojeni koraci." },
      { question: "Da li se vidi istorija putnika?", answer: "Da, cilj je da tim brze pronadje prethodne rezervacije i kontakt podatke." },
      { question: "Da li radi za vise polazaka dnevno?", answer: "Da, sistem je namenjen agencijama koje vode vise linija i polazaka." },
    ],
  },
  {
    slug: "online-rezervacije-autobuskih-karata",
    title: "Online rezervacije autobuskih karata",
    description: "Online rezervacije autobuskih karata za agencije koje zele da putnici lakse pronadju polazak i posalju rezervaciju.",
    h1: "Online rezervacije autobuskih karata za putnike koji traze brz odgovor",
    eyebrow: "Online rezervacije",
    answer:
      "Online rezervacije autobuskih karata omogucavaju putniku da pronadje liniju i posalje rezervaciju preko sajta agencije. Agenciji to znaci manje ponavljajucih pitanja i uredniji pregled upita.",
    updatedAt: "2026-05-24",
    pillar: "online-rezervacije",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta su online rezervacije autobuskih karata?",
        body: "To je nacin da putnik preko sajta vidi osnovne informacije o liniji i ostavi podatke za rezervaciju.",
        bullets: ["Javni sajt agencije", "Pregled linija i polazaka", "Forma za rezervaciju", "Pregled za tim"],
      },
      {
        title: "Kako pomaze putnicima?",
        body: "Putnik ne mora odmah da zove ili salje poruku samo da bi proverio osnovne informacije. Sve sto je vazno vidi na jednoj strani.",
        bullets: ["Manje cekanja na odgovor", "Jasniji termin polaska", "Jednostavniji kontakt sa agencijom"],
      },
      {
        title: "Kako pomaze agenciji?",
        body: "Agencija dobija uredniji upit, a tim manje vremena trosi na ista pitanja o liniji, terminu i slobodnim mestima.",
        bullets: ["Manje telefonskih provera", "Bolja evidencija upita", "Bolja vidljivost na Google-u"],
      },
    ],
    stats: [
      { label: "Kanal", value: "24/7", detail: "Putnik moze poslati upit i van radnog vremena." },
      { label: "Urednost", value: "jasan upit", detail: "Podaci ne ostaju rasuti po porukama." },
      { label: "Google", value: "linije i relacije", detail: "Javna strana pomaze da se agencija pronadje za vazne pretrage." },
    ],
    comparison: [
      { area: "Dostupnost", manual: "Samo kad tim odgovara", surp: "Upit je moguc preko sajta" },
      { area: "Podaci", manual: "Nepotpune poruke", surp: "Jasniji podaci za rezervaciju" },
      { area: "Vidljivost", manual: "Facebook/telefon", surp: "Javna strana koju Google lakse cita" },
    ],
    faq: [
      { question: "Da li putnik moze rezervisati preko telefona i dalje?", answer: "Da. Online rezervacije dopunjuju postojece kanale, ne moraju odmah da ih zamene." },
      { question: "Da li je potreban poseban sajt?", answer: "SURP ukljucuje javnu stranu agencije koja se moze koristiti kao osnova za online rezervacije." },
      { question: "Da li online rezervacija automatski prodaje kartu?", answer: "Ne mora. Agencija moze prvo koristiti online upite, a placanje uvoditi kasnije." },
      { question: "Da li je vazno za Google?", answer: "Da. Jasan javni sajt sa linijama i informacijama pomaze pretragama koje putnici vec rade." },
    ],
  },
  {
    slug: "digitalizacija-autobuske-agencije",
    title: "Digitalizacija autobuske agencije",
    description: "Digitalizacija autobuske agencije kroz linije, rezervacije, putnike, vozne redove i javni sajt u jednom sistemu.",
    h1: "Digitalizacija autobuske agencije bez prekida svakodnevnog rada",
    eyebrow: "Digitalizacija",
    answer:
      "Digitalizacija autobuske agencije ne mora da bude velika promena preko noci. Najbolje je krenuti od linija, polazaka i rezervacija, pa postepeno prebacivati tim na jedan pregled.",
    updatedAt: "2026-05-24",
    pillar: "digitalizacija-agencije",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta obuhvata digitalizacija agencije?",
        body: "Digitalizacija ne znaci samo novi sajt. Ona znaci da agencija zna gde su joj linije, polasci, rezervacije i putnici.",
        bullets: ["Lista linija", "Pregled polazaka", "Rezervacije i putnici", "Javni sajt"],
      },
      {
        title: "Kako krenuti bez rizika?",
        body: "Najsigurnije je poceti sa jednim delom posla, proveriti ga sa timom, pa tek onda siriti sistem na ostatak agencije.",
        bullets: ["Pregled trenutnog nacina rada", "Jedna probna linija", "Paralelni rad nekoliko dana"],
      },
      {
        title: "Koji su prvi rezultati?",
        body: "Prvi rezultat je bolji pregled. Tim zna gde se nalaze podaci i ne mora da trazi informacije po porukama, sveskama i tabelama.",
        bullets: ["Manje haosa u komunikaciji", "Brze uvodjenje novih ljudi", "Bolja osnova za online rezervacije"],
      },
    ],
    stats: [
      { label: "Prvi korak", value: "pilot", detail: "Jedna linija ili jedan tok rezervacije." },
      { label: "Rizik", value: "nizak", detail: "Postepeno uvodjenje smanjuje prekide." },
      { label: "Dobitak", value: "bolji pregled", detail: "Tim vidi iste podatke o polascima i rezervacijama." },
    ],
    comparison: [
      { area: "Uvodjenje", manual: "Sve odjednom ili nikako", surp: "Postepeno po toku rada" },
      { area: "Znanje tima", manual: "Kod pojedinaca ili u porukama", surp: "U sistemu koji tim deli" },
      { area: "Rast", manual: "Svaka nova linija donosi vise prepisivanja", surp: "Isti nacin rada za vise linija" },
    ],
    faq: [
      { question: "Da li digitalizacija mora da bude velika promena?", answer: "Ne. Najbolje radi kada se uvodi kroz male korake koje tim moze odmah da proveri." },
      { question: "Sta prvo digitalizovati?", answer: "Najcesce linije, polaske i rezervacije, jer se tu najbrze vidi korist." },
      { question: "Da li treba odmah prestati sa starim nacinom rada?", answer: "Ne odmah. Kratak paralelni rad smanjuje rizik i daje timu sigurnost." },
      { question: "Da li SURP pomaze i za online prisustvo?", answer: "Da. Javni izlog agencije je deo sistema i moze biti osnova za SEO i online rezervacije." },
    ],
  },
  {
    slug: "vozni-red-online-sistem",
    title: "Vozni red online sistem",
    description: "Vozni red online sistem za autobuske agencije koje zele uredjen prikaz linija, polazaka i dana voznje.",
    h1: "Vozni red online sistem za linije, polaske i rezervacije",
    eyebrow: "Vozni redovi",
    answer:
      "Vozni red online sistem pomaze agenciji da lakse vodi linije, dane voznje i termine polazaka. Kada je povezan sa rezervacijama, tim brze vidi koji polasci su aktivni i sta putnici najcesce traze.",
    updatedAt: "2026-05-24",
    pillar: "vozni-redovi",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta je vozni red online sistem?",
        body: "To je digitalni pregled linija, polazaka i dana voznje koji koristi tim, a putnici mogu da vide na javnoj strani agencije.",
        bullets: ["Linija i smer", "Stanice polaska i dolaska", "Dani voznje", "Termini polazaka"],
      },
      {
        title: "Zasto nije dovoljna staticka tabela?",
        body: "Tabela ili slika reda voznje brzo zastari, tesko se cita na telefonu i nije povezana sa rezervacijama.",
        bullets: ["Teze izmene", "Nema vezu sa rezervacijama", "Slabije iskustvo na telefonu"],
      },
      {
        title: "Kako SURP povezuje vozni red i rezervacije?",
        body: "Polasci koje agencija vodi u sistemu mogu da budu osnova za rezervacije i za informacije koje putnici vide na sajtu.",
        bullets: ["Jedan unos podataka", "Manje razlicitih informacija", "Bolja sansa da se linije pronadju na Google-u"],
      },
    ],
    stats: [
      { label: "Podaci", value: "linija + termin", detail: "Osnovni blok svake rezervacije." },
      { label: "Izmena", value: "jedno mesto", detail: "Promena se vodi u jednom sistemu." },
      { label: "Putnik", value: "telefon", detail: "Javna strana je laka za brzo citanje na mobilnom." },
    ],
    comparison: [
      { area: "Objava reda voznje", manual: "PDF, slika ili tabela", surp: "Javna strana agencije" },
      { area: "Izmene", manual: "Rucno na vise mesta", surp: "Centralna izmena u sistemu" },
      { area: "Rezervacije", manual: "Odvojene od reda voznje", surp: "Vezane za polazak" },
    ],
    faq: [
      { question: "Da li sistem prikazuje dane voznje?", answer: "Da. Vozni red moze obuhvatiti dane voznje, termine i osnovne informacije o liniji." },
      { question: "Da li putnici mogu videti vozni red online?", answer: "Da, kroz javnu stranu agencije kada agencija objavi relevantne informacije." },
      { question: "Da li podrzava vise linija?", answer: "Da. SURP je namenjen agencijama sa vise linija, stanica i polazaka." },
      { question: "Da li je vozni red povezan sa rezervacijama?", answer: "Da. To je glavna razlika u odnosu na PDF, sliku ili obicnu tabelu reda voznje." },
    ],
  },
  {
    slug: "upravljanje-autobuskim-linijama",
    title: "Upravljanje autobuskim linijama",
    description: "Upravljanje autobuskim linijama za agencije koje zele jasan pregled stanica, smerova, polazaka i rezervacija.",
    h1: "Upravljanje autobuskim linijama bez rasutih tabela",
    eyebrow: "Linije",
    answer:
      "Upravljanje autobuskim linijama znaci da agencija na jednom mestu vodi polaznu stanicu, dolaznu stanicu, smer, dane voznje i polaske. SURP pomaze da linije budu jasne timu, a putnicima lakse dostupne za pretragu i rezervaciju.",
    updatedAt: "2026-05-24",
    pillar: "vozni-redovi",
    intentStage: "BOFU",
    sections: [
      {
        title: "Sta obuhvata upravljanje linijama?",
        body: "Svaka linija treba da ima naziv, stanice, smer i polaske. Kada su ti podaci uredni, lakse je voditi rezervacije i objaviti informacije putnicima.",
        bullets: ["Polazna i dolazna stanica", "Smer linije", "Dani voznje", "Termini polazaka"],
      },
      {
        title: "Zasto tabele brzo postanu problem?",
        body: "Kada se linije menjaju, tabele se lako razidju. Jedna verzija je kod dispecera, druga u telefonu, a treca na staroj objavi.",
        bullets: ["Vise verzija istih podataka", "Sporije izmene", "Veca sansa za gresku"],
      },
      {
        title: "Kako SURP pomaze timu?",
        body: "Tim vidi iste linije i polaske u sistemu, pa je lakse proveriti sta je aktivno i za koji polazak se prima rezervacija.",
        bullets: ["Jedan pregled linija", "Laksa provera polazaka", "Bolja osnova za javni sajt"],
      },
    ],
    stats: [
      { label: "Linije", value: "na jednom mestu", detail: "Nazivi, stanice i smerovi su u istom sistemu." },
      { label: "Izmene", value: "brze", detail: "Tim ne mora da trazi poslednju verziju tabele." },
      { label: "Putnici", value: "laksa pretraga", detail: "Jasne linije pomazu da se polazak brze pronadje." },
    ],
    comparison: [
      { area: "Podaci o liniji", manual: "Rasuti kroz tabele i poruke", surp: "Linija je u jednom sistemu" },
      { area: "Izmene", manual: "Rucno na vise mesta", surp: "Jedna izmena za tim" },
      { area: "Rezervacije", manual: "Nisu jasno vezane za liniju", surp: "Rezervacija se vodi po polasku" },
    ],
    faq: [
      { question: "Da li SURP podrzava vise linija?", answer: "Da. Agencija moze voditi vise linija, stanica, smerova i polazaka." },
      { question: "Da li mogu da menjam liniju kasnije?", answer: "Da. Linije i polasci se mogu menjati kako se menja red voznje agencije." },
      { question: "Da li linije mogu biti deo javnog sajta?", answer: "Da. Kada agencija objavi javnu stranu, linije mogu pomoci putnicima da pronadju pravi polazak." },
      { question: "Da li ovo pomaze za rezervacije?", answer: "Da. Uredne linije su osnova za jasne polaske i tacnije rezervacije." },
    ],
  },
]

export function getLandingPage(slug: string) {
  return landingPages.find((page) => page.slug === slug)
}
