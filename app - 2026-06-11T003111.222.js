/* ============================================
   PARC AUTO DRT SFAX - LOGIQUE JAVASCRIPT
   AVEC SYNCHRONISATION CLOUD VIA CLOUDFLARE WORKER
   ============================================ */

// ============================================
// 🔧 TTS MANAGER GLOBAL — Arrêt robuste multi-plateforme
// ============================================
const TTSManager = {
  _utterance: null,
  _isSpeaking: false,

  stopAll() {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
    } catch(e) { console.warn('TTS stop error:', e); }
    this._isSpeaking = false;
    this._utterance = null;
  },

  speak(text, options = {}) {
    this.stopAll();
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = options.lang || 'fr-FR';
    utter.rate = options.rate || 1.0;
    utter.pitch = options.pitch || 1.0;
    utter.volume = options.volume || 1.0;
    this._utterance = utter;
    this._isSpeaking = true;
    utter.onend = () => { this._isSpeaking = false; this._utterance = null; };
    utter.onerror = () => { this._isSpeaking = false; this._utterance = null; };
    window.speechSynthesis.speak(utter);
  }
};

function stopAllTTS() {
  TTSManager.stopAll();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    setTimeout(() => window.speechSynthesis.cancel(), 100);
    setTimeout(() => window.speechSynthesis.cancel(), 300);
  }
}

// ============================================
// CONFIGURATION WORKER (aucun secret ici)
// ============================================
const WORKER_URL = 'https://wandering-sound-cd2f.drtsfaxparauto.workers.dev';

// ============================================
// DONNÉES PAR DÉFAUT
// ============================================
const DEFAULT_DATA = {
  "vehicles": [
    {
      "id": "v_1_17-351511",
      "matricule": "17-351511",
      "matriculeAgent": "75970",
      "modele": "Ford Ranger",
      "chauffeur": "Mr .Mahmoud Khalfallah",
      "whatsappChauffeur": "21698716355",
      "km": 277803,
      "prochaineVidange": 283503,
      "prochaineChaine": 309042,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-05-16",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_2_17-351512",
      "matricule": "17-351512",
      "matriculeAgent": "76004",
      "modele": "Ford Ranger",
      "chauffeur": "Mr .Hammadi Znaidi",
      "whatsappChauffeur": "21698230415",
      "km": 180739,
      "prochaineVidange": 272138,
      "prochaineChaine": 321687,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-25",
      "indiceBatterie": "256857",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_3_17-356835",
      "matricule": "17-356835",
      "matriculeAgent": "72858",
      "modele": "Ford Figo",
      "chauffeur": "Mr . Aref Jarraya",
      "whatsappChauffeur": "2167974000",
      "km": 229604,
      "prochaineVidange": 220047,
      "prochaineChaine": 250137,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-12-02",
      "indiceBatterie": "215557",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_4_17-356842",
      "matricule": "17-356842",
      "matriculeAgent": "71620",
      "modele": "Ford Figo",
      "chauffeur": "Mr . Nabil Ben Jemaa",
      "whatsappChauffeur": "21698830250",
      "km": 0,
      "prochaineVidange": 179386,
      "prochaineChaine": 190140,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-02-08",
      "indiceBatterie": "154094",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_5_17-357074",
      "matricule": "17-357074",
      "matriculeAgent": "72726",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Walid Masmoudi",
      "whatsappChauffeur": "21698916314",
      "km": 262963,
      "prochaineVidange": 267630,
      "prochaineChaine": 317630,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-08-10",
      "indiceBatterie": "198228",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_6_17-357075",
      "matricule": "17-357075",
      "matriculeAgent": "71393",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Bassem Chaari",
      "whatsappChauffeur": "21698436555",
      "km": 114820,
      "prochaineVidange": 123220,
      "prochaineChaine": 115441,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-05-15",
      "indiceBatterie": "113220",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_7_17-357076",
      "matricule": "17-357076",
      "matriculeAgent": "59095",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Zaher Jemni",
      "whatsappChauffeur": "21698458017",
      "km": 168363,
      "prochaineVidange": 163075,
      "prochaineChaine": 192473,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-03-16",
      "indiceBatterie": "14894",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_8_17-357077",
      "matricule": "17-357077",
      "matriculeAgent": "72184",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Mourad Ammar",
      "whatsappChauffeur": "21698656356",
      "km": 162400,
      "prochaineVidange": 160430,
      "prochaineChaine": 197749,
      "prochaineVisite": "",
      "dateChangementBatterie": "2022-06-17",
      "indiceBatterie": "111921",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_9_17-357078",
      "matricule": "17-357078",
      "matriculeAgent": "72386",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Niza Haj Kacem",
      "whatsappChauffeur": "21698413000",
      "km": 164215,
      "prochaineVidange": 170962,
      "prochaineChaine": 173473,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-11-08",
      "indiceBatterie": "151955",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_10_17-357079",
      "matricule": "17-357079",
      "matriculeAgent": "60057",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Hichem Abdelmoula",
      "whatsappChauffeur": "21699412890",
      "km": 115885,
      "prochaineVidange": 117105,
      "prochaineChaine": 139585,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_11_17-357143",
      "matricule": "17-357143",
      "matriculeAgent": "70983",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Med Amin BenHassan",
      "whatsappChauffeur": null,
      "km": 91410,
      "prochaineVidange": 98286,
      "prochaineChaine": 70000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-11-24",
      "indiceBatterie": "66776",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_12_17357144",
      "matricule": "17357144",
      "matriculeAgent": null,
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Kais Ezzeddine",
      "whatsappChauffeur": null,
      "km": 0,
      "prochaineVidange": null,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_13_17-357145",
      "matricule": "17-357145",
      "matriculeAgent": "70756",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Med Banneni",
      "whatsappChauffeur": "21695272971",
      "km": 249232,
      "prochaineVidange": 250827,
      "prochaineChaine": 261155,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-10-11",
      "indiceBatterie": "211500",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_14_17-357146",
      "matricule": "17-357146",
      "matriculeAgent": "70876",
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Hamdi Ben Aouicha",
      "whatsappChauffeur": "21698230530",
      "km": 262243,
      "prochaineVidange": 268780,
      "prochaineChaine": 271557,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-02-24",
      "indiceBatterie": "237280",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_15_17-357148",
      "matricule": "17-357148",
      "matriculeAgent": null,
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Sami Chaari",
      "whatsappChauffeur": "21698266314",
      "km": 140825,
      "prochaineVidange": 150739,
      "prochaineChaine": 192334,
      "prochaineVisite": "",
      "dateChangementBatterie": "2022-07-28",
      "indiceBatterie": "79789",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_16_17-357149",
      "matricule": "17-357149",
      "matriculeAgent": null,
      "modele": "Peugeot  Bipper",
      "chauffeur": "Mr .Tahar Tyar",
      "whatsappChauffeur": null,
      "km": 244024,
      "prochaineVidange": 244231,
      "prochaineChaine": 290785,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-01-06",
      "indiceBatterie": "176570",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_17_17-354452",
      "matricule": "17-354452",
      "matriculeAgent": null,
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Moez Boudawara",
      "whatsappChauffeur": "21698312799",
      "km": 182752,
      "prochaineVidange": 188082,
      "prochaineChaine": 202198,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-10-08",
      "indiceBatterie": "175900",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_18_17-354453",
      "matricule": "17-354453",
      "matriculeAgent": "70378",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr . Anis Ben Jemaa",
      "whatsappChauffeur": "21698221000",
      "km": 172281,
      "prochaineVidange": 171402,
      "prochaineChaine": 221402,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-03-15",
      "indiceBatterie": "153560",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_19_17-354454",
      "matricule": "17-354454",
      "matriculeAgent": "71339",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Kais Majdoub",
      "whatsappChauffeur": "21699419519",
      "km": 191872,
      "prochaineVidange": null,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_20_17-354455",
      "matricule": "17-354455",
      "matriculeAgent": "72858",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Aref Jarraya",
      "whatsappChauffeur": "2167974000",
      "km": 238416,
      "prochaineVidange": 244460,
      "prochaineChaine": 243012,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-09-25",
      "indiceBatterie": "217190",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_21_17-354456",
      "matricule": "17-354456",
      "matriculeAgent": "75487",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr . Kamel Ksibi",
      "whatsappChauffeur": "21698382888",
      "km": 220570,
      "prochaineVidange": 229250,
      "prochaineChaine": 263923,
      "prochaineVisite": "",
      "dateChangementBatterie": "2026-02-22",
      "indiceBatterie": "169864",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_22_17-351899",
      "matricule": "17-351899",
      "matriculeAgent": "70540",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Hichem Mzid",
      "whatsappChauffeur": "21698230106",
      "km": 0,
      "prochaineVidange": 264029,
      "prochaineChaine": 276100,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-04-19",
      "indiceBatterie": "246031",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_23_17-355455",
      "matricule": "17-355455",
      "matriculeAgent": null,
      "modele": "Citroen Nemo",
      "chauffeur": "Mm .Nawel Ben Ameur",
      "whatsappChauffeur": "21699266306",
      "km": 163700,
      "prochaineVidange": 173943,
      "prochaineChaine": 154074,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-06-02",
      "indiceBatterie": "160052",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_24_17-355456",
      "matricule": "17-355456",
      "matriculeAgent": null,
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Walid Mhiri",
      "whatsappChauffeur": "21698352339",
      "km": 220570,
      "prochaineVidange": 226146,
      "prochaineChaine": 186000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-05-09",
      "indiceBatterie": "193906",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_25_17-355555",
      "matricule": "17-355555",
      "matriculeAgent": "73388",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Walid Chakroun",
      "whatsappChauffeur": "21698951715",
      "km": 228055,
      "prochaineVidange": 235380,
      "prochaineChaine": 290515,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-06-03",
      "indiceBatterie": "185746",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_26_17-355556",
      "matricule": "17-355556",
      "matriculeAgent": "72309",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Khaled Hamza",
      "whatsappChauffeur": "21698916250",
      "km": 159857,
      "prochaineVidange": 160237,
      "prochaineChaine": 187840,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-11-01",
      "indiceBatterie": "120229",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_27_17-355557",
      "matricule": "17-355557",
      "matriculeAgent": "74712",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Walid Ben Aoun",
      "whatsappChauffeur": "21698716355",
      "km": 160484,
      "prochaineVidange": 158810,
      "prochaineChaine": 181542,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-25",
      "indiceBatterie": "152000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_28_17-355558",
      "matricule": "17-355558",
      "matriculeAgent": "72721",
      "modele": "Citroen Nemo",
      "chauffeur": "Mr .Naceur Issaoui",
      "whatsappChauffeur": "21698385186",
      "km": 205193,
      "prochaineVidange": 210820,
      "prochaineChaine": 246820,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-09-07",
      "indiceBatterie": "176830",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_29_17-355695",
      "matricule": "17-355695",
      "matriculeAgent": "70871",
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Slim Boussarsar",
      "whatsappChauffeur": "21696808008",
      "km": 262581,
      "prochaineVidange": 197607,
      "prochaineChaine": 232400,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-25",
      "indiceBatterie": "180028",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_30_17-355696",
      "matricule": "17-355696",
      "matriculeAgent": "71685",
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Med Jedaied",
      "whatsappChauffeur": "21698628820",
      "km": 262581,
      "prochaineVidange": 272360,
      "prochaineChaine": 291238,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-10-25",
      "indiceBatterie": "236278",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_31_17-355697",
      "matricule": "17-355697",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Atef Driss",
      "whatsappChauffeur": "21698571450",
      "km": 150412,
      "prochaineVidange": 150137,
      "prochaineChaine": 171412,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-01-07",
      "indiceBatterie": "137730",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_32_17-355698",
      "matricule": "17-355698",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Fethi Ben Salem",
      "whatsappChauffeur": "21693261407",
      "km": 133291,
      "prochaineVidange": null,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_33_17-355699",
      "matricule": "17-355699",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Adnen El Amri",
      "whatsappChauffeur": "21698242401",
      "km": 254366,
      "prochaineVidange": 250000,
      "prochaineChaine": 272624,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-03",
      "indiceBatterie": "251694",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_34_17-355700",
      "matricule": "17-355700",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "",
      "whatsappChauffeur": null,
      "km": 134438,
      "prochaineVidange": 143560,
      "prochaineChaine": 156045,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-07-14",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_35_17-355701",
      "matricule": "17-355701",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Faouzi Charfeddine",
      "whatsappChauffeur": "21699888808",
      "km": 102470,
      "prochaineVidange": 109888,
      "prochaineChaine": 155051,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-07-10",
      "indiceBatterie": "92000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_36_17-355702",
      "matricule": "17-355702",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Imed Haj Kacem",
      "whatsappChauffeur": "21697646333",
      "km": 198303,
      "prochaineVidange": 195914,
      "prochaineChaine": 207658,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-02-12",
      "indiceBatterie": "154480",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_37_17-355703",
      "matricule": "17-355703",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Fethi Ben Salem",
      "whatsappChauffeur": "21698231045",
      "km": 169005,
      "prochaineVidange": 176150,
      "prochaineChaine": 208144,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-09",
      "indiceBatterie": "161000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_38_17-355704",
      "matricule": "17-355704",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Hatem Kolsi",
      "whatsappChauffeur": "21695934016",
      "km": 119364,
      "prochaineVidange": 129671,
      "prochaineChaine": 151574,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-02",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_39_17-355705",
      "matricule": "17-355705",
      "matriculeAgent": null,
      "modele": "Citroen Jumpy",
      "chauffeur": "Mr .Nabil Allouche",
      "whatsappChauffeur": "21698700613",
      "km": 212398,
      "prochaineVidange": 222000,
      "prochaineChaine": 226648,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-10-02",
      "indiceBatterie": "180053",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_40_17-346875",
      "matricule": "17-346875",
      "matriculeAgent": null,
      "modele": "Mitsubishi L200",
      "chauffeur": "Mr .Lotfi Daoued",
      "whatsappChauffeur": "21697053553",
      "km": 149222,
      "prochaineVidange": 144224,
      "prochaineChaine": 131751,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-06-03",
      "indiceBatterie": "127874",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_41_17-346876",
      "matricule": "17-346876",
      "matriculeAgent": null,
      "modele": "Mitsubishi L200",
      "chauffeur": "Mr .Kais Ezzeddine",
      "whatsappChauffeur": null,
      "km": 19222,
      "prochaineVidange": 144224,
      "prochaineChaine": 131751,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-06-03",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_42_17-349762",
      "matricule": "17-349762",
      "matriculeAgent": null,
      "modele": "Mitsubishi L200",
      "chauffeur": "Mr .Ammar Khammar",
      "whatsappChauffeur": "21698801096",
      "km": 266062,
      "prochaineVidange": 271944,
      "prochaineChaine": 255462,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-02-05",
      "indiceBatterie": "195462",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_43_17-349763",
      "matricule": "17-349763",
      "matriculeAgent": null,
      "modele": "Mitsubishi L200",
      "chauffeur": "Mr .Badr Hamza",
      "whatsappChauffeur": "21696644829",
      "km": 170200,
      "prochaineVidange": 169868,
      "prochaineChaine": 196313,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_44_17-368829",
      "matricule": "17-368829",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Jasser Gharbi",
      "whatsappChauffeur": "21693122800",
      "km": 33392,
      "prochaineVidange": 31952,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_45_17-368830",
      "matricule": "17-368830",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Majed Assili",
      "whatsappChauffeur": "21698644901",
      "km": 46107,
      "prochaineVidange": 43000,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_46_17-368831",
      "matricule": "17-368831",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Hamza Bettoumia",
      "whatsappChauffeur": "21694640117",
      "km": 34620,
      "prochaineVidange": 41215,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_47_17-368832",
      "matricule": "17-368832",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Karim Mestiri",
      "whatsappChauffeur": "21699807070",
      "km": 50575,
      "prochaineVidange": 36230,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_48_17-368833",
      "matricule": "17-368833",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Sabeur Louhichi",
      "whatsappChauffeur": "21698657258",
      "km": 41380,
      "prochaineVidange": 50964,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_49_17-368834",
      "matricule": "17-368834",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Med Ali Montassar",
      "whatsappChauffeur": "21697273114",
      "km": 38801,
      "prochaineVidange": 39423,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_50_17-369453",
      "matricule": "17-369453",
      "matriculeAgent": null,
      "modele": "Fiar Fiorino",
      "chauffeur": "Mr .Abdelwaheb Saadaoui",
      "whatsappChauffeur": "21698508950",
      "km": 59580,
      "prochaineVidange": 64000,
      "prochaineChaine": 150000,
      "prochaineVisite": "2025-11-07",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_51_17-355881",
      "matricule": "17-355881",
      "matriculeAgent": null,
      "modele": "Volkswagen Golf 7",
      "chauffeur": "Mr Kais Hassayoun",
      "whatsappChauffeur": "21698258960",
      "km": 372363,
      "prochaineVidange": 375363,
      "prochaineChaine": 360000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-01-30",
      "indiceBatterie": "320000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_52_17-351435",
      "matricule": "17-351435",
      "matriculeAgent": null,
      "modele": "Volkswagen Polo 7",
      "chauffeur": "Mme .Salma Trigui",
      "whatsappChauffeur": "21694102000",
      "km": 294082,
      "prochaineVidange": 294092,
      "prochaineChaine": 485719,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-03-27",
      "indiceBatterie": "170355",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_53_17-351401",
      "matricule": "17-351401",
      "matriculeAgent": null,
      "modele": "Volkswagen Polo 7",
      "chauffeur": "Mr .Fakher Krichen",
      "whatsappChauffeur": "21698222994",
      "km": 364118,
      "prochaineVidange": null,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-12-01",
      "indiceBatterie": "318037",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_54_17-348917",
      "matricule": "17-348917",
      "matriculeAgent": null,
      "modele": "Volkswagen Polo 6",
      "chauffeur": "Mme .Sameh Hentati",
      "whatsappChauffeur": "21695984984",
      "km": 156675,
      "prochaineVidange": 162741,
      "prochaineChaine": 200000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-09-07",
      "indiceBatterie": "13625",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_55_17-349212",
      "matricule": "17-349212",
      "matriculeAgent": null,
      "modele": "Volkswagen Caddy",
      "chauffeur": "Mr .Riadh Makni",
      "whatsappChauffeur": "21698224994",
      "km": 386330,
      "prochaineVidange": 388140,
      "prochaineChaine": 440215,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-01-02",
      "indiceBatterie": "355955",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_56_17-349213",
      "matricule": "17-349213",
      "matriculeAgent": null,
      "modele": "Volkswagen Caddy",
      "chauffeur": "Mr . Ramzi Taktak",
      "whatsappChauffeur": "21696500003",
      "km": 0,
      "prochaineVidange": 167651,
      "prochaineChaine": 216317,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-07-18",
      "indiceBatterie": "146317",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_57_17-349935",
      "matricule": "17-349935",
      "matriculeAgent": null,
      "modele": "Partner",
      "chauffeur": "Mr .Wissem Bouguecha",
      "whatsappChauffeur": "21698605625",
      "km": 0,
      "prochaineVidange": 322936,
      "prochaineChaine": 376185,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-01-30",
      "indiceBatterie": "287000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_58_17-349945",
      "matricule": "17-349945",
      "matriculeAgent": null,
      "modele": "Partner",
      "chauffeur": "Mr .Soulaimen Ghalleb",
      "whatsappChauffeur": "21697967000",
      "km": 96240,
      "prochaineVidange": 102533,
      "prochaineChaine": 165033,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-03-10",
      "indiceBatterie": "91001",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_59_17-351255",
      "matricule": "17-351255",
      "matriculeAgent": null,
      "modele": "Partner",
      "chauffeur": "Mr .Khaled Amara",
      "whatsappChauffeur": "21695960800",
      "km": 166818,
      "prochaineVidange": 176062,
      "prochaineChaine": 227500,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-03-12",
      "indiceBatterie": "160479",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_60_17-367818",
      "matricule": "17-367818",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Moez Rmila",
      "whatsappChauffeur": "21698773531",
      "km": 45852,
      "prochaineVidange": 49742,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-05-02",
      "indiceBatterie": "33445",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_61_17-367819",
      "matricule": "17-367819",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Med Chaabouni",
      "whatsappChauffeur": "21698242145",
      "km": 42318,
      "prochaineVidange": 49666,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_62_17-367820",
      "matricule": "17-367820",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Tarak Ben Mbarek",
      "whatsappChauffeur": "21696979115",
      "km": 27610,
      "prochaineVidange": 34116,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_63_17-368821",
      "matricule": "17-368821",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Sayef Ayouni",
      "whatsappChauffeur": "21698247065",
      "km": 88290,
      "prochaineVidange": 89919,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-11-13",
      "indiceBatterie": "80000",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_64_17-367822",
      "matricule": "17-367822",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mme .Hela Souissi",
      "whatsappChauffeur": "21698439936",
      "km": 41414,
      "prochaineVidange": 42705,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-18",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_65_17-370279",
      "matricule": "17-370279",
      "matriculeAgent": "6674",
      "modele": "Renaut Express",
      "chauffeur": "Mr .Anoir Daoued",
      "whatsappChauffeur": "21698500344",
      "km": 41414,
      "prochaineVidange": 20000,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_66_17-379280",
      "matricule": "17-379280",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .WARD Dali",
      "whatsappChauffeur": "21698231210",
      "km": 12600,
      "prochaineVidange": null,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_67_17-370281",
      "matricule": "17-370281",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Ameur Ben Mansour",
      "whatsappChauffeur": "21697756323",
      "km": 17821,
      "prochaineVidange": 20023,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_68_17-370307",
      "matricule": "17-370307",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Makram Makhlouf",
      "whatsappChauffeur": "21699630999",
      "km": 24602,
      "prochaineVidange": 34827,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_69_17-370308",
      "matricule": "17-370308",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Med Amin Feki",
      "whatsappChauffeur": "21698251366",
      "km": 17340,
      "prochaineVidange": 20035,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_70_17-370309",
      "matricule": "17-370309",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Taha Hamil",
      "whatsappChauffeur": "21693122800",
      "km": 21079,
      "prochaineVidange": 19761,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_71_17-371048",
      "matricule": "17-371048",
      "matriculeAgent": null,
      "modele": "Renaut Express",
      "chauffeur": "Mr .Thameur Nawar",
      "whatsappChauffeur": "21698900002",
      "km": 19768,
      "prochaineVidange": 30519,
      "prochaineChaine": 150000,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_72_17-353430",
      "matricule": "17-353430",
      "matriculeAgent": null,
      "modele": "Citroen Berlingo",
      "chauffeur": "Mr .Zied Ouledabdallah",
      "whatsappChauffeur": "21698212898",
      "km": 218527,
      "prochaineVidange": 227155,
      "prochaineChaine": 194042,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-06-18",
      "indiceBatterie": "28145",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_73_17-351301",
      "matricule": "17-351301",
      "matriculeAgent": null,
      "modele": "Renault Kango",
      "chauffeur": "Mr .Aref Abdelmoula",
      "whatsappChauffeur": "21695886877",
      "km": 257637,
      "prochaineVidange": 258913,
      "prochaineChaine": 277121,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-09-18",
      "indiceBatterie": "26797",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_74_17-351890",
      "matricule": "17-351890",
      "matriculeAgent": null,
      "modele": "Mazda BT50",
      "chauffeur": "Mr .Moez Hammami",
      "whatsappChauffeur": "21698517121",
      "km": 306730,
      "prochaineVidange": 306180,
      "prochaineChaine": 213217,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-08-21",
      "indiceBatterie": "271774",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_75_17-363395",
      "matricule": "17-363395",
      "matriculeAgent": null,
      "modele": "Ford Rangrer",
      "chauffeur": "Mr .Safwen Ben Ncir",
      "whatsappChauffeur": null,
      "km": 204479,
      "prochaineVidange": 209964,
      "prochaineChaine": null,
      "prochaineVisite": "",
      "dateChangementBatterie": "",
      "indiceBatterie": "",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_76_17-344532",
      "matricule": "17-344532",
      "matriculeAgent": null,
      "modele": "Ford Ranger",
      "chauffeur": "Mr .Karim Ben Hamza",
      "whatsappChauffeur": null,
      "km": 269352,
      "prochaineVidange": 272138,
      "prochaineChaine": 251687,
      "prochaineVisite": "",
      "dateChangementBatterie": "2025-09-05",
      "indiceBatterie": "256857",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_77_17-344534",
      "matricule": "17-344534",
      "matriculeAgent": null,
      "modele": "Ford Ranger",
      "chauffeur": "Mr .Ridha Ayouni",
      "whatsappChauffeur": "21696361578",
      "km": 200045,
      "prochaineVidange": 202831,
      "prochaineChaine": 213919,
      "prochaineVisite": "",
      "dateChangementBatterie": "2024-06-18",
      "indiceBatterie": "188483",
      "dateChangementPneus": "",
      "statut": "actif"
    },
    {
      "id": "v_78_17-346799",
      "matricule": "17-346799",
      "matriculeAgent": null,
      "modele": "Ford Ranger",
      "chauffeur": "Mr .Med Abdelhedi",
      "whatsappChauffeur": "21695746838",
      "km": 219946,
      "prochaineVidange": 229368,
      "prochaineChaine": 229936,
      "prochaineVisite": "",
      "dateChangementBatterie": "2023-08-29",
      "indiceBatterie": "188850",
      "dateChangementPneus": "",
      "statut": "actif"
    }
  ],
  "repairs": [
    {
      "id": "rep_1",
      "matricule": "17-356835",
      "type": "Vidange",
      "designation": "Vidange complète + filtre à huile",
      "date": "2026-01-15",
      "km": 45000,
      "montant": 185.5,
      "chauffeur": "Mr . Aref Jarraya"
    },
    {
      "id": "rep_2",
      "matricule": "17-356835",
      "type": "Réparation",
      "designation": "Remplacement plaquettes de frein avant",
      "date": "2026-03-10",
      "km": 46500,
      "montant": 320.0,
      "chauffeur": "Mr . Aref Jarraya"
    },
    {
      "id": "rep_3",
      "matricule": "17-423100",
      "type": "Visite Technique",
      "designation": "Contrôle technique annuel",
      "date": "2026-02-20",
      "km": 84000,
      "montant": 95.0,
      "chauffeur": ""
    },
    {
      "id": "rep_4",
      "matricule": "17-512204",
      "type": "Pneus",
      "designation": "Remplacement 4 pneus Bridgestone 185/65R15",
      "date": "2026-04-05",
      "km": 144000,
      "montant": 680.0,
      "chauffeur": ""
    },
    {
      "id": "rep_5",
      "matricule": "17-512204",
      "type": "Batterie",
      "designation": "Remplacement batterie 55Ah Varta",
      "date": "2025-12-01",
      "km": 141000,
      "montant": 145.0,
      "chauffeur": ""
    }
  ],
  "settings": {
    "alerteVidange": 1000,
    "alerteChaine": 1000,
    "alerteVisite": 7
  }
};

// ============================================
// UTILISATEURS ADMIN
// ============================================
// ============================================
const ADMIN_USERS = [
  { email: 'admin@drt.tn', password: 'DRT@Sfax2026', role: 'admin', name: 'Administrateur' }
];

// ============================================
// CLASSE PRINCIPALE
// ============================================
class ParcAutoApp {
  constructor() {
    this.data = null;
    this.currentTab = 'dashboard';
    this.alertFilter = 'all';
    this.isCloudSync = false;
    this.init();
  }

  // ============================================
  // SYNCHRONISATION CLOUD GITHUB GIST
  // ============================================

  isCloudConfigured() {
    return WORKER_URL && !WORKER_URL.includes('PLACEHOLDER');
  }

  // Lire les données via Cloudflare Worker (token caché côté serveur)
  async readFromCloud() {
    if (!this.isCloudConfigured()) {
      console.log('Cloud non configuré');
      return null;
    }

    try {
      console.log('Lecture cloud via Worker...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(WORKER_URL, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn('Erreur lecture Worker:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('✅ Données reçues via Worker');
      return data;
    } catch (e) {
      console.warn('Erreur connexion Worker:', e);
      return null;
    }
  }

  // Écrire les données via Cloudflare Worker (token caché côté serveur)
  async writeToCloud() {
    if (!this.isCloudConfigured()) {
      console.log('Cloud non configuré');
      return false;
    }

    try {
      console.log('Écriture cloud via Worker...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(WORKER_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.data),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn('Erreur écriture Worker:', response.status);
        return false;
      }

      console.log('✅ Données sauvegardées via Worker');
      return true;
    } catch (e) {
      console.warn('Erreur écriture Worker:', e.name === 'AbortError' ? 'Timeout 8s' : e);
      return false;
    }
  }

  // ============================================
  // CHARGEMENT / SAUVEGARDE
  // ============================================
  async loadData() {
    // Lire localStorage d'abord (référence locale)
    let localData = null;
    try {
      const saved = localStorage.getItem('parcAutoData_v3');
      if (saved) localData = JSON.parse(saved);
    } catch (e) {
      console.warn('Erreur chargement localStorage:', e);
    }

    // Essayer le cloud
    if (this.isCloudConfigured()) {
      const cloudData = await this.readFromCloud();

      if (cloudData && cloudData.vehicles) {
        // Préférer la version la plus récente (timestamp _lastSaved)
        const cloudTs = cloudData._lastSaved || 0;
        const localTs = localData ? (localData._lastSaved || 0) : 0;

        if (localTs > cloudTs) {
          console.log('Local plus récent que cloud — utilisation du local');
          this.isCloudSync = true;
          // Re-pousser le local vers le cloud en arrière-plan
          this.data = localData;
          this.writeToCloud().catch(() => {});
          return localData;
        }

        this.isCloudSync = true;
        cloudData.settings = Object.assign(
          { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7, entreprise: 'Tunisie Telecom' },
          cloudData.settings || {}
        );
        return cloudData;
      }
    }

    // Fallback localStorage
    if (localData) {
      const merged = { ...DEFAULT_DATA, ...localData };
      merged.settings = Object.assign(
        { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7, entreprise: 'Tunisie Telecom' },
        merged.settings || {}
      );
      return merged;
    }

    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  async saveData() {
    // Horodatage pour résoudre les conflits cloud/local
    this.data._lastSaved = Date.now();

    // 1. Sauvegarder IMMÉDIATEMENT en local (jamais bloqué)
    try {
      localStorage.setItem('parcAutoData_v3', JSON.stringify(this.data));
    } catch (e) {
      console.warn('Erreur sauvegarde localStorage:', e);
    }

    // 2. Sync cloud en ARRIÈRE-PLAN (sans bloquer l'interface)
    if (this.isCloudConfigured()) {
      this.showSyncStatus('syncing');
      this.writeToCloud()
        .then(success => {
          this.showSyncStatus(success ? 'synced' : 'error');
          if (!success) console.warn('Sync cloud échouée — données conservées en local');
        })
        .catch(() => { this.showSyncStatus('error'); });
    } else {
      this.showSyncStatus('synced');
    }
  }

  // ============================================
  // INITIALISATION
  // ============================================
  async init() {
    this.data = await this.loadData();
    this.initHomePage();
    this.initAdminLogin();
    this.initUserLogin();
    this.initNavigation();
    this.initForms();
    this.initSearch();
    this.renderAll();
    // Activer les notifications push
    registerPushNotifications();

    if (this.data.currentUser && this.data.currentUser.role === 'user') {
      this.startAutoSync();
    }
  }

  startAutoSync() {
    if (!this.isCloudConfigured()) return;

    setInterval(async () => {
      const cloudData = await this.readFromCloud();
      if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(this.data)) {
        // 🔧 FIX: Préserver les valeurs de session locale
        const localUserVehicle = this.data.userVehicle;
        const localCurrentUser = this.data.currentUser;
        this.data = cloudData;
        this.data.userVehicle = localUserVehicle;
        this.data.currentUser = localCurrentUser;
        this.renderUserVehicleDetail();
        // Sync toast hidden: this.showToast('🔄 Données mises à jour depuis le cloud', 'success');
      }
    }, 30000);
  }

  // ============================================
  // PAGE D'ACCUEIL
  // ============================================
  initHomePage() {}

  // ============================================
  // LOGIN ADMIN
  // ============================================
  initAdminLogin() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;

      const user = ADMIN_USERS.find(u => u.email === email && u.password === password);

      if (user) {
        // Stocker temporairement les infos admin en attente OTP
        OTP_CONFIG.pendingAdmin = { email: user.email, role: user.role, name: user.name };
        const sendResult = await requestOTPEmail({ matricule: 'ADMIN', chauffeur: user.name });
        if (!sendResult.ok) {
          this.showToast(sendResult.msg || 'Erreur envoi OTP', 'error');
          return;
        }
        this.showToast('📧 Code OTP envoyé par email', 'success');
        showOTPScreen(null, 'admin');
      } else {
        this.showToast('Email ou mot de passe incorrect', 'error');
      }
    });
  }

  // ============================================
  // LOGIN UTILISATEUR (2 étapes : Agent + Véhicule)
  // ============================================
  // ============================================
  // LOGIN UTILISATEUR — matricule véhicule uniquement
  // ============================================
  initUserLogin() {
    const form = document.getElementById('user-login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const vehicleInput = (document.getElementById('user-matricule')?.value || '').trim().toUpperCase();

      if (!vehicleInput) {
        this.showToast('Veuillez saisir le matricule du véhicule', 'error');
        return;
      }

      // Recharger depuis le cloud si configuré
      if (this.isCloudConfigured()) {
        const cloudData = await this.readFromCloud();
        if (cloudData && cloudData.vehicles) {
          this.data.vehicles = cloudData.vehicles;
          this.data.repairs  = cloudData.repairs  || this.data.repairs  || [];
          this.data.settings = cloudData.settings || this.data.settings || {};
        }
      }

      if (!this.data.vehicles || this.data.vehicles.length === 0) {
        this.showToast("Aucun véhicule enregistré dans le système.", 'error');
        return;
      }

      // Rechercher le véhicule par matricule
      const vehicle = this.data.vehicles.find(v => {
        const dbMat    = v.matricule.toUpperCase().replace(/[\s-]/g, '');
        const inputMat = vehicleInput.replace(/[\s-]/g, '');
        return dbMat === inputMat;
      });

      if (!vehicle) {
        this.showToast('❌ Matricule véhicule non trouvé. Vérifiez votre saisie.', 'error');
        const f = document.getElementById('user-matricule');
        if (f) { f.style.borderColor = '#ef4444'; f.focus(); }
        return;
      }

      // Connexion directe — pas d'OTP pour les chauffeurs
      this.data.currentUser = { role: 'user', name: vehicle.chauffeur || 'Utilisateur' };
      this.data.userVehicle = vehicle.matricule;
      window._selectedMatricule = vehicle.matricule;
      await this.saveData();
      document.getElementById('login-user').style.display  = 'none';
      document.getElementById('user-choice-page').style.display = 'flex';
      setTimeout(() => {
        if (typeof checkAndNotifyAlerts === 'function') checkAndNotifyAlerts();
        this.startAutoSync();
      }, 500);
    });
  }


  // ============================================
  // NAVIGATION (Admin)
  // ============================================
  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-nav]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.nav;
        this.showTab(tab);
      });
    });
  }

  showTab(tabName) {
    document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.toggle('active', tab.id === `tab-${tabName}`);
    });

    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) {
      const titles = {
        dashboard: 'Tableau de bord',
        vehicles: 'Parc Véhicules',
        alerts: 'Alertes',
        repairs: 'Historique Réparations',
        'add-repair': 'Nouvelle Intervention',
        settings: 'Paramètres'
      };
      breadcrumb.textContent = titles[tabName] || tabName;
    }

    this.currentTab = tabName;
    this.renderAll();
  }

  // ============================================
  // FORMULAIRES
  // ============================================
  initForms() {
    const vehicleForm = document.getElementById('vehicle-form');
    if (vehicleForm) {
      vehicleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveVehicle();
      });
    }

    const repairForm = document.getElementById('repair-form');
    if (repairForm) {
      repairForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveRepair();
      });
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
  }

  // ============================================
  // RECHERCHE
  // ============================================
  initSearch() {
    const searchVehicles = document.getElementById('search-vehicles');
    if (searchVehicles) {
      searchVehicles.addEventListener('input', () => this.renderVehiclesTable());
    }

    const searchRepairs = document.getElementById('search-repairs');
    if (searchRepairs) {
      searchRepairs.addEventListener('input', () => this.renderRepairsTable());
    }
  }

  // ============================================
  // RENDU GLOBAL
  // ============================================
  renderAll() {
    this.updateAlertCounts();
    this.renderStats();
    this.renderVehiclesTable();
    this.renderAlertsTable();
    this.renderRepairsTable();
    this.renderDashboardAlerts();
    this.renderDashboardRepairs();
    this.populateVehicleSelect();
    this.loadSettings();
  }

  // ============================================
  // STATISTIQUES
  // ============================================
  renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const totalVehicles = this.data.vehicles.length;
    const activeVehicles = this.data.vehicles.filter(v => v.statut === 'actif').length;
    const alertVehicles = this.getAlerts().length;
    const totalRepairs = this.data.repairs.length;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">🚗</div>
        <div class="stat-info">
          <h3>${totalVehicles}</h3>
          <p>Véhicules total</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-info">
          <h3>${activeVehicles}</h3>
          <p>Véhicules actifs</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">🔧</div>
        <div class="stat-info">
          <h3>${totalRepairs}</h3>
          <p>Interventions</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">🚨</div>
        <div class="stat-info">
          <h3>${alertVehicles}</h3>
          <p>Alertes actives</p>
        </div>
      </div>
    `;
  }

  // ============================================
  // ALERTES
  // ============================================
  getAlerts() {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const settings = this.data.settings || { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7 };

    this.data.vehicles.forEach(v => {
      if (v.prochaineVidange && v.km >= v.prochaineVidange - settings.alerteVidange) {
        const kmRestant = v.prochaineVidange - v.km;
        alerts.push({
          vehicle: v,
          type: 'Vidange',
          detail: kmRestant <= 0 ? `DÉPASSÉE de ${Math.abs(kmRestant).toLocaleString()} km` : `${kmRestant.toLocaleString()} km restants`,
          priority: kmRestant <= 0 ? 'urgent' : 'warning',
          rawValue: kmRestant
        });
      }

      if (v.prochaineChaine && v.km >= v.prochaineChaine - settings.alerteChaine) {
        const kmRestant = v.prochaineChaine - v.km;
        alerts.push({
          vehicle: v,
          type: 'Kit Chaîne',
          detail: kmRestant <= 0 ? `DÉPASSÉE de ${Math.abs(kmRestant).toLocaleString()} km` : `${kmRestant.toLocaleString()} km restants`,
          priority: kmRestant <= 0 ? 'urgent' : 'warning',
          rawValue: kmRestant
        });
      }

      if (v.prochaineVisite) {
        const visiteDate = new Date(v.prochaineVisite);
        visiteDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((visiteDate - today) / (1000 * 60 * 60 * 24));
        if (daysDiff <= settings.alerteVisite) {
          alerts.push({
            vehicle: v,
            type: 'Visite Technique',
            detail: daysDiff < 0 ? `DÉPASSÉE de ${Math.abs(daysDiff)} jours` : `${daysDiff} jours restants`,
            priority: daysDiff < 0 ? 'urgent' : 'warning',
            rawValue: daysDiff
          });
        }
      }
    });

    return alerts;
  }

  updateAlertCounts() {
    const alerts = this.getAlerts();
    const navBadge = document.getElementById('nav-alert-count');
    if (navBadge) {
      navBadge.textContent = alerts.length;
      navBadge.style.display = alerts.length > 0 ? 'inline-flex' : 'none';
    }

    const notifDot = document.getElementById('notif-dot');
    if (notifDot) {
      notifDot.style.display = alerts.length > 0 ? 'block' : 'none';
    }

    const navVehicleCount = document.getElementById('nav-vehicle-count');
    if (navVehicleCount) {
      navVehicleCount.textContent = this.data.vehicles.length;
    }
  }

  renderAlertsTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;

    let alerts = this.getAlerts();

    if (this.alertFilter !== 'all') {
      alerts = alerts.filter(a => a.priority === this.alertFilter);
    }

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">✅</div><strong>Aucune alerte</strong><br><span style="font-size:13px;">Tous les véhicules sont à jour</span></td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td><strong>${a.vehicle.matricule}</strong></td>
        <td>${a.vehicle.chauffeur || '-'}</td>
        <td><span class="badge badge-${a.priority === 'urgent' ? 'danger' : 'warning'}">${a.priority === 'urgent' ? 'URGENT' : 'AVERTISSEMENT'}</span></td>
        <td>${a.type}</td>
        <td>${a.detail}</td>
        <td>${a.vehicle.km.toLocaleString()} km</td>
      </tr>
    `).join('');
  }

  renderDashboardAlerts() {
    const tbody = document.getElementById('dashboard-alerts-body');
    if (!tbody) return;

    const alerts = this.getAlerts().slice(0, 5);

    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--secondary);"><div style="font-size:32px;margin-bottom:8px;">✅</div>Aucune alerte active</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td><strong>${a.vehicle.matricule}</strong></td>
        <td>${a.vehicle.chauffeur || '-'}</td>
        <td><span class="badge badge-${a.priority === 'urgent' ? 'danger' : 'warning'}">${a.type}</span></td>
        <td>${a.detail}</td>
        <td>${a.vehicle.km.toLocaleString()} km</td>
      </tr>
    `).join('');
  }

  // ============================================
  // VÉHICULES
  // ============================================
  renderVehiclesTable() {
    const tbody = document.getElementById('vehicles-table-body');
    if (!tbody) return;

    const search = document.getElementById('search-vehicles')?.value.toLowerCase() || '';
    let vehicles = this.data.vehicles;

    if (search) {
      vehicles = vehicles.filter(v =>
        v.matricule.toLowerCase().includes(search) ||
        v.modele.toLowerCase().includes(search) ||
        (v.chauffeur && v.chauffeur.toLowerCase().includes(search))
      );
    }

    if (vehicles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">🚗</div><strong>Aucun véhicule</strong><br><span style="font-size:13px;">Ajoutez un véhicule pour commencer</span></td></tr>`;
      return;
    }

    tbody.innerHTML = vehicles.map(v => {
      const alerts = this.getAlerts().filter(a => a.vehicle.id === v.id);
      const hasAlert = alerts.length > 0;
      const alertTypes = alerts.map(a => a.type).join(', ');

      return `
        <tr>
          <td><strong>${v.matricule}</strong></td>
          <td>${v.modele}</td>
          <td>${v.chauffeur || '-'}</td>
          <td>${v.km.toLocaleString()}</td>
          <td>${v.prochaineVidange ? v.prochaineVidange.toLocaleString() : '-'}</td>
          <td>${v.prochaineChaine ? v.prochaineChaine.toLocaleString() : '-'}</td>
          <td>${v.prochaineVisite || '-'}</td>
          <td><span class="badge badge-${hasAlert ? 'danger' : 'success'}">${hasAlert ? '⚠️ ' + alertTypes : '✅ OK'}</span></td>
          <td>
            <button class="action-btn edit" onclick="parcAuto.editVehicle('${v.id}')">✏️</button>
            <button class="action-btn delete" onclick="parcAuto.deleteVehicle('${v.id}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicle-modal');
    const title = document.getElementById('vehicle-modal-title');
    const form = document.getElementById('vehicle-form');

    form.reset();
    document.getElementById('vehicle-id').value = '';

    if (vehicleId) {
      const v = this.data.vehicles.find(v => v.id === vehicleId);
      if (v) {
        title.textContent = 'Modifier Véhicule';
        document.getElementById('vehicle-id').value = v.id;
        document.getElementById('vehicle-matricule').value = v.matricule;
        document.getElementById('vehicle-modele').value = v.modele;
        document.getElementById('vehicle-chauffeur').value = v.chauffeur || '';
        document.getElementById('vehicle-whatsapp').value = v.whatsappChauffeur || '';
        document.getElementById('vehicle-km').value = v.km;
        document.getElementById('vehicle-vidange').value = v.prochaineVidange || '';
        document.getElementById('vehicle-chaine').value = v.prochaineChaine || '';
        document.getElementById('vehicle-visite').value = v.prochaineVisite || '';
        document.getElementById('vehicle-batterie-date').value = v.dateChangementBatterie || '';
        document.getElementById('vehicle-batterie-index').value = v.indexBatterie || '';
        document.getElementById('vehicle-pneus-date').value = v.dateChangementPneus || '';
      }
    } else {
      title.textContent = 'Nouveau Véhicule';
    }

    modal.classList.add('active');
  }

  async saveVehicle() {
    const id = document.getElementById('vehicle-id')?.value || '';
    const matricule = document.getElementById('vehicle-matricule')?.value?.trim() || '';
    const modele = document.getElementById('vehicle-modele')?.value?.trim() || '';
    if (!matricule) {
      this.showToast('⚠️ Matricule obligatoire', 'error');
      document.getElementById('vehicle-matricule')?.focus();
      return;
    }
    if (!modele) {
      this.showToast('⚠️ Modèle obligatoire', 'error');
      document.getElementById('vehicle-modele')?.focus();
      return;
    }
    const kmVal = parseInt(document.getElementById('vehicle-km')?.value) || 0;
    if (kmVal > 999999) {
      this.showToast('Kilométrage incohérent (max 999 999 km)', 'error');
      return;
    }
    const vehicle = {
      id: id || 'v' + Date.now(),
      matricule: matricule.toUpperCase(),
      modele: modele,
      chauffeur: document.getElementById('vehicle-chauffeur').value.trim(),
      whatsappChauffeur: document.getElementById('vehicle-whatsapp').value.replace(/\D/g,'').trim() || null,
      km: kmVal,
      prochaineVidange: parseInt(document.getElementById('vehicle-vidange').value) || null,
      prochaineChaine: parseInt(document.getElementById('vehicle-chaine').value) || null,
      prochaineVisite: document.getElementById('vehicle-visite').value || null,
      dateChangementBatterie: document.getElementById('vehicle-batterie-date').value || null,
      indexBatterie: document.getElementById('vehicle-batterie-index').value.trim() || null,
      dateChangementPneus: document.getElementById('vehicle-pneus-date').value || null,
      statut: 'actif'
    };

    if (id) {
      const index = this.data.vehicles.findIndex(v => v.id === id);
      if (index !== -1) this.data.vehicles[index] = vehicle;
    } else {
      this.data.vehicles.push(vehicle);
    }

    await this.saveData();
    this.renderAll();
    closeModal('vehicle-modal');
    this.showToast(id ? 'Véhicule modifié avec succès' : 'Véhicule ajouté avec succès', 'success');
  }

  editVehicle(id) {
    this.openVehicleModal(id);
  }

  async deleteVehicle(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible.')) return;
    this.data.vehicles = this.data.vehicles.filter(v => v.id !== id);
    await this.saveData();
    this.renderAll();
    this.showToast('Véhicule supprimé', 'success');
  }

  // ============================================
  // RÉPARATIONS
  // ============================================
  renderRepairsTable() {
    const tbody = document.getElementById('repairs-table-body');
    if (!tbody) return;

    const search = document.getElementById('search-repairs')?.value.toLowerCase() || '';
    let repairs = [...this.data.repairs].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (search) {
      repairs = repairs.filter(r =>
        r.matricule.toLowerCase().includes(search) ||
        r.type.toLowerCase().includes(search) ||
        r.designation.toLowerCase().includes(search)
      );
    }

    if (repairs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--secondary);"><div style="font-size:40px;margin-bottom:8px;">🔧</div><strong>Aucune intervention</strong><br><span style="font-size:13px;">Ajoutez une intervention pour commencer</span></td></tr>`;
      return;
    }

    tbody.innerHTML = repairs.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.matricule}</strong></td>
        <td>${r.chauffeur || '-'}</td>
        <td><span class="badge badge-info">${r.type}</span></td>
        <td>${r.designation}</td>
        <td>${r.km.toLocaleString()}</td>
        <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</td>
        <td>
          <button class="action-btn delete" onclick="parcAuto.deleteRepair('${r.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  renderDashboardRepairs() {
    const tbody = document.getElementById('dashboard-repairs-body');
    if (!tbody) return;

    const recent = [...this.data.repairs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--secondary);"><p>Aucune intervention récente</p></td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.matricule}</strong></td>
        <td><span class="badge badge-info">${r.type}</span></td>
        <td>${r.designation}</td>
        <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</td>
      </tr>
    `).join('');
  }

  populateVehicleSelect() {
    const select = document.getElementById('repair-matricule');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Sélectionner un véhicule</option>' +
      this.data.vehicles.map(v => `<option value="${v.matricule}">${v.matricule} - ${v.modele}</option>`).join('');
    select.value = currentValue;
  }

  async saveRepair() {
    const matricule = document.getElementById('repair-matricule').value;
    if (!matricule) {
      this.showToast('Veuillez sélectionner un véhicule', 'error');
      return;
    }

    const vehicle = this.data.vehicles.find(v => v.matricule === matricule);
    const kmVal = parseInt(document.getElementById('repair-km')?.value) || 0;

    const repair = {
      id: 'r' + Date.now(),
      matricule: matricule,
      chauffeur: document.getElementById('repair-chauffeur').value.trim() || (vehicle ? vehicle.chauffeur : ''),
      type: document.getElementById('repair-type').value,
      date: document.getElementById('repair-date').value,
      km: kmVal,
      montant: parseFloat(document.getElementById('repair-montant').value) || 0,
      designation: document.getElementById('repair-designation').value.trim(),
      nextVidange: parseInt(document.getElementById('repair-next-vidange').value) || null,
      nextChaine: parseInt(document.getElementById('repair-next-chaine').value) || null,
      nextVisite: document.getElementById('repair-next-visite').value || null
    };

    if (vehicle) {
      vehicle.km = repair.km;
      if (repair.nextVidange) vehicle.prochaineVidange = repair.nextVidange;
      if (repair.nextChaine) vehicle.prochaineChaine = repair.nextChaine;
      if (repair.nextVisite) vehicle.prochaineVisite = repair.nextVisite;
    }

    this.data.repairs.push(repair);
    await this.saveData();
    this.renderAll();

    document.getElementById('repair-form').reset();
    this.showToast('Intervention enregistrée et véhicule mis à jour', 'success');
    this.showTab('repairs');
  }

  async deleteRepair(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) return;
    this.data.repairs = this.data.repairs.filter(r => r.id !== id);
    await this.saveData();
    this.renderAll();
    this.showToast('Intervention supprimée', 'success');
  }

  // ============================================
  // PARAMÈTRES
  // ============================================
  loadSettings() {
    const s = this.data.settings || { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7, entreprise: 'Tunisie Telecom' };
    const elVidange = document.getElementById('setting-alerte-vidange');
    const elChaine = document.getElementById('setting-alerte-chaine');
    const elVisite = document.getElementById('setting-alerte-visite');
    const elEntreprise = document.getElementById('setting-entreprise');

    if (elVidange) elVidange.value = s.alerteVidange;
    if (elChaine) elChaine.value = s.alerteChaine;
    if (elVisite) elVisite.value = s.alerteVisite;
    if (elEntreprise) elEntreprise.value = s.entreprise;
  }

  async saveSettings() {
    this.data.settings = {
      alerteVidange: parseInt(document.getElementById('setting-alerte-vidange').value) || 1000,
      alerteChaine: parseInt(document.getElementById('setting-alerte-chaine').value) || 1000,
      alerteVisite: parseInt(document.getElementById('setting-alerte-visite').value) || 7,
      entreprise: document.getElementById('setting-entreprise').value.trim() || 'Tunisie Telecom'
    };
    await this.saveData();
    this.renderAll();
    this.showToast('Paramètres sauvegardés', 'success');
  }

  // ============================================
  // INTERFACE UTILISATEUR (Vue Véhicule)
  // ============================================
  renderUserVehicleDetail() {
    const container = document.getElementById('user-vehicle-detail');
    if (!container) return;

    const matricule = this.data.userVehicle;
    if (!matricule) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚗</div><h3>Aucun véhicule sélectionné</h3></div>`;
      return;
    }

    const vehicle = this.data.vehicles.find(v => v.matricule === matricule);
    if (!vehicle) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Véhicule non trouvé</h3></div>`;
      return;
    }

    const alerts = this.getAlerts().filter(a => a.vehicle.id === vehicle.id);
    const repairs = this.data.repairs.filter(r => r.matricule === matricule)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const vidangeProgress = vehicle.prochaineVidange ? Math.min(100, (vehicle.km / vehicle.prochaineVidange) * 100) : 0;
    const chaineProgress = vehicle.prochaineChaine ? Math.min(100, (vehicle.km / vehicle.prochaineChaine) * 100) : 0;

    const today = new Date();
    today.setHours(0,0,0,0);
    let visiteDaysLeft = null;
    if (vehicle.prochaineVisite) {
      const visiteDate = new Date(vehicle.prochaineVisite);
      visiteDate.setHours(0,0,0,0);
      visiteDaysLeft = Math.ceil((visiteDate - today) / (1000 * 60 * 60 * 24));
    }

    container.innerHTML = `
      <div class="vehicle-detail-card">
        <div class="vehicle-detail-header">
          <div class="vehicle-icon-big">🚗</div>
          <h2>${vehicle.matricule}</h2>
          <p>${vehicle.modele} — ${vehicle.chauffeur || 'Chauffeur non assigné'}</p>
        </div>

        <div class="vehicle-detail-body">
          ${alerts.length > 0 ? `
          <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
            <div style="font-weight:700;color:#991b1b;margin-bottom:8px;">🚨 Alertes actives</div>
            ${alerts.map(a => `
              <div style="font-size:13px;color:#7f1d1d;padding:4px 0;">
                • <strong>${a.type}</strong>: ${a.detail}
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="detail-section">
            <div class="detail-section-title">📊 Informations générales</div>
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-item-label">Kilométrage actuel</div>
                <div class="detail-item-value" style="display:flex;align-items:center;gap:10px;">
                  <span id="user-km-display">${vehicle.km.toLocaleString()} km</span>
                  <button onclick="openUserKmModal('${vehicle.matricule}', ${vehicle.km})"
                    style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;
                    border-radius:7px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;
                    box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                    ✏️ Modifier
                  </button>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochaine vidange</div>
                <div class="detail-item-value ${vidangeProgress >= 90 ? 'alert' : vidangeProgress >= 70 ? 'warning' : 'ok'}">${vehicle.prochaineVidange ? vehicle.prochaineVidange.toLocaleString() + ' km' : 'Non défini'}</div>
                ${vehicle.prochaineVidange ? `
                <div class="km-progress">
                  <div class="km-progress-bar">
                    <div class="km-progress-fill ${vidangeProgress >= 90 ? 'danger' : vidangeProgress >= 70 ? 'warning' : 'ok'}" style="width:${vidangeProgress}%"></div>
                  </div>
                  <div class="km-progress-text">${(vehicle.prochaineVidange - vehicle.km).toLocaleString()} km restants</div>
                </div>
                ` : ''}
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochain kit chaîne</div>
                <div class="detail-item-value ${chaineProgress >= 90 ? 'alert' : chaineProgress >= 70 ? 'warning' : 'ok'}">${vehicle.prochaineChaine ? vehicle.prochaineChaine.toLocaleString() + ' km' : 'Non défini'}</div>
                ${vehicle.prochaineChaine ? `
                <div class="km-progress">
                  <div class="km-progress-bar">
                    <div class="km-progress-fill ${chaineProgress >= 90 ? 'danger' : chaineProgress >= 70 ? 'warning' : 'ok'}" style="width:${chaineProgress}%"></div>
                  </div>
                  <div class="km-progress-text">${(vehicle.prochaineChaine - vehicle.km).toLocaleString()} km restants</div>
                </div>
                ` : ''}
              </div>
              <div class="detail-item">
                <div class="detail-item-label">Prochaine visite technique</div>
                <div class="detail-item-value ${visiteDaysLeft !== null && visiteDaysLeft <= 7 ? 'alert' : visiteDaysLeft !== null && visiteDaysLeft <= 30 ? 'warning' : 'ok'}">${vehicle.prochaineVisite || 'Non définie'}</div>
                ${visiteDaysLeft !== null ? `
                <div class="km-progress-text" style="text-align:left;margin-top:4px;">
                  ${visiteDaysLeft < 0 ? `<span style="color:var(--danger);">Dépassée de ${Math.abs(visiteDaysLeft)} jours</span>` : `${visiteDaysLeft} jours restants`}
                </div>
                ` : ''}
              </div>
              <div class="detail-item">
                <div class="detail-item-label">🔋 Date changement batterie</div>
                <div class="detail-item-value ${vehicle.dateChangementBatterie ? 'ok' : ''}">${vehicle.dateChangementBatterie || 'Non renseigné'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">🔋 Indice batterie</div>
                <div class="detail-item-value">${vehicle.indexBatterie || 'Non renseigné'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">🛞 Date changement pneus</div>
                <div class="detail-item-value ${vehicle.dateChangementPneus ? 'ok' : ''}">${vehicle.dateChangementPneus || 'Non renseigné'}</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">🔧 Historique des interventions</div>
            ${repairs.length === 0 ? '<p style="color:var(--secondary);font-size:14px;">Aucune intervention enregistrée</p>' : ''}
            ${repairs.map(r => `
              <div class="repair-list-item">
                <div class="repair-icon">🔧</div>
                <div class="repair-info">
                  <h4>${r.type}</h4>
                  <p>${r.designation}</p>
                </div>
                <div class="repair-meta">
                  <div class="date">${r.date}</div>
                  <div class="amount">${r.montant ? r.montant.toFixed(2) + ' TND' : '-'}</div>
                  <div style="font-size:11px;color:var(--secondary);margin-top:2px;">${r.km.toLocaleString()} km</div>
                </div>
              </div>
            `).join('')}
          </div>

          

<div style="text-align:center;padding-top:16px;border-top:1px solid var(--border);margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button onclick="exportVehiclePDF('${matricule}')"
              style="background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
              📄 Télécharger rapport PDF
            </button>
${(()=>{ const d=JSON.parse(localStorage.getItem('parcAutoData_v3')||'{}'); return d.currentUser&&d.currentUser.role==='admin' ? `<button onclick="sendWhatsAppAlert('${matricule}')" style="background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">📲 Envoyer alerte WhatsApp</button>` : ''; })()}
            <p style="font-size:12px;color:var(--secondary);width:100%;margin-top:4px;">☁️ Données synchronisées avec le cloud • Mise à jour automatique</p>
          </div>
        </div>
      </div>
    `;

  }

  // ============================================
  // AFFICHAGE CARTE GRISE RECTO/VERSO
  // ============================================
  async loadCarteGriseImages(matricule) {
    const safeMat = matricule.replace(/[^a-zA-Z0-9-]/g, '_');
    const rectoEl = document.getElementById(`cg-recto-${matricule}`);
    const versoEl = document.getElementById(`cg-verso-${matricule}`);
    if (!rectoEl || !versoEl) return;

    // Helper to set image
    const setImage = (el, fileId, label) => {
      if (!fileId) return false;
      // Use Google Drive direct thumbnail URL - works without auth if file is public
      const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
      el.innerHTML = `<img src="${thumbUrl}" 
        alt="Carte grise ${label} ${matricule}" 
        style="width:100%;height:180px;object-fit:cover;border-radius:8px;cursor:pointer;"
        onerror="this.parentElement.innerHTML='<div class=\'carte-grise-placeholder\'><span style=\'font-size:32px\'>📷</span><span style=\'font-size:12px;color:#94a3b8;margin-top:6px;\'>${label} non disponible</span></div>'"
        onclick="window.open('${viewUrl}', '_blank')">`;
      return true;
    };

    // Try 1: Load from Drive cache (localStorage)
    try {
      const cacheRaw = localStorage.getItem('driveFileCache');
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        const cgFiles = (cache.cache && cache.cache.CARTES_GRISES) || [];
        const rectoFile = cgFiles.find(f => f.name && f.name.includes(safeMat) && f.name.includes('_RECTO_'));
        const versoFile = cgFiles.find(f => f.name && f.name.includes(safeMat) && f.name.includes('_VERSO_'));
        if (rectoFile && rectoFile.id) setImage(rectoEl, rectoFile.id, 'Recto');
        if (versoFile && versoFile.id) setImage(versoEl, versoFile.id, 'Verso');
        if (rectoFile && versoFile) return; // Both found in cache, done
      }
    } catch(e) { console.warn('Cache carte grise error:', e); }

    // Try 2: If Drive is connected, fetch fresh
    if (window.driveManager && window.driveManager.isSignedIn) {
      try {
        const files = await window.driveManager.listFiles('CARTES_GRISES', matricule);
        const rectoFile = files.find(f => f.name && f.name.includes('_RECTO_'));
        const versoFile = files.find(f => f.name && f.name.includes('_VERSO_'));
        if (rectoFile && rectoFile.id) setImage(rectoEl, rectoFile.id, 'Recto');
        if (versoFile && versoFile.id) setImage(versoEl, versoFile.id, 'Verso');
      } catch(e) { console.warn('Drive carte grise error:', e); }
    }
  }

  // ============================================
  // LECTURE VOCALE DES ALERTES
  // ============================================
  speakAlerts(alerts) {
    if (!window.speechSynthesis || !alerts || alerts.length === 0) return;

    // DIAGNOSTIC
    console.log('=== SPEAKALERTS APPELÉ ===');
    console.log('Nombre d\'alertes reçues:', alerts.length);
    alerts.forEach((a, i) => console.log('  Alerte ' + (i+1) + ':', a.type, '-', a.detail));

    const alertTexts = alerts.map((a, i) => {
      let detailText = a.detail || '';
      return `Alerte ${i + 1}: ${a.type}. ${detailText}.`;
    });

    // FIX: Message singulier/pluriel correct - EXPLICITE
    let introText;
    if (alerts.length === 1) {
      introText = "Attention! Vous avez une seule alerte active.";
    } else if (alerts.length === 0) {
      introText = "Aucune alerte active.";
    } else {
      introText = `Attention! Vous avez ${alerts.length} alertes actives.`;
    }
    const fullText = introText + ' ' + alertTexts.join(' ');
    console.log('Texte TTS final:', fullText);

    const doSpeak = () => {
      TTSManager.stopAll();
      const utter = new SpeechSynthesisUtterance(fullText);
      utter.lang   = 'fr-FR';
      utter.rate   = 1.1;
      utter.pitch  = 1.0;
      utter.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang === 'fr-FR')
                   || voices.find(v => v.lang.startsWith('fr'));
      if (frVoice) utter.voice = frVoice;
      TTSManager._utterance = utter;
      TTSManager._isSpeaking = true;
      utter.onend = () => { TTSManager._isSpeaking = false; TTSManager._utterance = null; };
      utter.onerror = () => { TTSManager._isSpeaking = false; TTSManager._utterance = null; };
      window.speechSynthesis.speak(utter);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      setTimeout(doSpeak, 400);
    }
  }


  // ============================================
  // SYNCHRONISATION
  // ============================================
  async syncNow() {
    this.showSyncStatus('syncing');

    if (this.isCloudConfigured()) {
      const cloudData = await this.readFromCloud();
      if (cloudData && cloudData.vehicles) {
        // 🔧 FIX: Préserver les valeurs de session locale
        const localUserVehicle = this.data.userVehicle;
        const localCurrentUser = this.data.currentUser;
        this.data = cloudData;
        this.data.userVehicle = localUserVehicle;
        this.data.currentUser = localCurrentUser;
        this.renderAll();

        const userInterface = document.getElementById('user-interface');
        if (userInterface && userInterface.style.display !== 'none') {
          this.renderUserVehicleDetail();
        }

        // Sync toast hidden: this.showToast('☁️ Données synchronisées depuis le cloud', 'success');
        return;
      }
    }

    this.saveData();
    this.renderAll();
    // Sync toast hidden: this.showToast('Données synchronisées localement', 'success');
  }

  showSyncStatus(status) {
    const els = document.querySelectorAll('#sync-status .sync-status, .sync-mini');
    els.forEach(el => {
      if (el.classList.contains('sync-status')) {
        el.className = 'sync-status ' + status;
        if (status === 'synced') el.innerHTML = '🔄 Synchronisé';
        if (status === 'syncing') el.innerHTML = '⏳ Synchronisation...';
        if (status === 'error') el.innerHTML = '❌ Erreur';
      }
    });
  }

  // ============================================
  // IMPORT / EXPORT
  // ============================================
  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parc-auto-drt-sfax-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Données exportées avec succès', 'success');
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.name.endsWith('.xlsx')) {
        await this.importFromExcel(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (imported.vehicles && imported.repairs) {
              this.data = imported;
              await this.saveData();
              this.renderAll();
              this.showToast('Données JSON importées avec succès', 'success');
            } else {
              throw new Error('Format invalide');
            }
          } catch (err) {
            this.showToast('Erreur lors de l\'importation JSON', 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  async importFromExcel(file) {
    try {
      if (!window.XLSX) {
        this.showToast('❌ Librairie Excel non chargée. Rafraîchissez la page.', 'error');
        return;
      }

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

      // === FEUILLE VÉHICULES ===
      const wsVeh = wb.Sheets['Véhicules'];
      if (!wsVeh) throw new Error("Feuille 'Véhicules' introuvable");
      const rowsVeh = XLSX.utils.sheet_to_json(wsVeh, { header: 1, defval: '' });

      // Find header row (row index with 'Matricule')
      let headerIdx = -1;
      for (let i = 0; i < rowsVeh.length; i++) {
        if (String(rowsVeh[i][0]).includes('Matricule')) { headerIdx = i; break; }
      }
      if (headerIdx < 0) throw new Error("En-tête 'Matricule' introuvable");

      // Data starts 2 rows after header (skip hint row)
      const vehicles = [];
      // Détecter la présence de la colonne "Matricule Agent" dans les headers
      const _headerRow = rowsVeh[headerIdx] || [];
      const _hasAgentCol = _headerRow.some((h, idx) => idx > 0 && String(h || '').toLowerCase().includes('agent'));

      for (let i = headerIdx + 2; i < rowsVeh.length; i++) {
        const r = rowsVeh[i];
        const mat = String(r[0] || '').trim();
        if (!mat || mat.toLowerCase().includes('obligatoire')) continue;
        const fmtDate = (v) => {
          if (!v) return '';
          if (v instanceof Date) return v.toISOString().split('T')[0];
          return String(v).trim();
        };
        // Détecter si la colonne "Matricule Agent" est présente (col B)
        // En vérifiant le header: si r[1] header contient "Agent" → décalage de 1
        const hasAgentCol = _hasAgentCol;
        const o = hasAgentCol ? 1 : 0; // offset

        vehicles.push({
          id: 'v_' + Date.now() + '_' + i,
          matricule: mat,
          matriculeAgent: hasAgentCol ? String(r[1] || '').trim().toUpperCase() || null : null,
          modele: String(r[1 + o] || '').trim(),
          chauffeur: String(r[2 + o] || '').trim(),
          whatsappChauffeur: String(r[3 + o] || '').replace(/\D/g, '') || null,
          km: parseInt(r[4 + o]) || 0,
          prochaineVidange: parseInt(r[5 + o]) || 0,
          prochaineChaine: parseInt(r[6 + o]) || 0,
          prochaineVisite: fmtDate(r[7 + o]),
          dateChangementBatterie: fmtDate(r[8 + o]),
          indiceBatterie: String(r[9 + o] || '').trim(),
          dateChangementPneus: fmtDate(r[10 + o]),
          statut: String(r[11 + o] || 'actif').trim().toLowerCase() || 'actif'
        });
      }

      if (vehicles.length === 0) throw new Error('Aucun véhicule trouvé dans le fichier');

      // === FEUILLE RÉPARATIONS (optionnelle) ===
      const repairs = [...(this.data.repairs || [])];
      const wsRep = wb.Sheets['Réparations'];
      if (wsRep) {
        const rowsRep = XLSX.utils.sheet_to_json(wsRep, { header: 1, defval: '' });
        // Find header (row with 'Matricule')
        let repHeaderIdx = -1;
        for (let i = 0; i < rowsRep.length; i++) {
          if (String(rowsRep[i][0]).includes('Matricule')) { repHeaderIdx = i; break; }
        }
        if (repHeaderIdx >= 0) {
          const fmtDate = (v) => {
            if (!v) return '';
            if (v instanceof Date) return v.toISOString().split('T')[0];
            return String(v).trim();
          };
          for (let i = repHeaderIdx + 2; i < rowsRep.length; i++) {
            const r = rowsRep[i];
            const mat = String(r[0] || '').trim();
            if (!mat || mat.toLowerCase().includes('ex:')) continue;
            const repDate = fmtDate(r[3]);
            // Avoid duplicates: same matricule + type + date
            const isDup = repairs.some(ex => ex.matricule === mat && ex.date === repDate && ex.type === String(r[1]||'').trim());
            if (isDup) continue;
            repairs.push({
              id: 'rep_' + Date.now() + '_' + i,
              matricule: mat,
              type: String(r[1] || 'Réparation').trim(),
              designation: String(r[2] || '').trim(),
              date: repDate,
              km: parseInt(r[4]) || 0,
              montant: parseFloat(String(r[5]).replace(',', '.')) || 0,
              chauffeur: (vehicles.find(v => v.matricule === mat) || {}).chauffeur || ''
            });
          }
        }
      }

      // Merge with existing vehicles (keep existing, add new)
      const existingMats = new Set((this.data.vehicles || []).map(v => v.matricule));
      const newVehicles = [...(this.data.vehicles || [])];
      let added = 0, updated = 0;
      vehicles.forEach(v => {
        if (existingMats.has(v.matricule)) {
          const idx = newVehicles.findIndex(ex => ex.matricule === v.matricule);
          if (idx >= 0) { newVehicles[idx] = { ...newVehicles[idx], ...v, id: newVehicles[idx].id }; updated++; }
        } else {
          newVehicles.push(v); added++;
        }
      });

      this.data.vehicles = newVehicles;
      this.data.repairs = repairs;
      await this.saveData();
      this.renderAll();
      const repCount = wsRep ? repairs.filter(r => !this.data.repairs.includes(r)).length : 0;
      this.showToast(`✅ ${added} véhicule(s) ajouté(s), ${updated} mis à jour, ${repairs.length} réparation(s) importée(s)`, 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      this.showToast('❌ Erreur import Excel : ' + err.message, 'error');
    }
  }

  // ============================================
  // UTILITAIRES
  // ============================================
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// ============================================
// FONCTIONS GLOBALES
// ============================================
let parcAuto;

document.addEventListener('DOMContentLoaded', () => {
  parcAuto = new ParcAutoApp();
});

function showLogin(type) {
  // Définie aussi inline dans index.html — version de secours
  const homePage = document.getElementById('home-page');
  const loginAdmin = document.getElementById('login-admin');
  const loginUser = document.getElementById('login-user');
  if (homePage) homePage.style.display = 'none';
  if (type === 'admin' && loginAdmin) loginAdmin.style.display = 'flex';
  else if (loginUser) loginUser.style.display = 'flex';
}

function goHome() {
  document.getElementById('login-admin').style.display = 'none';
  document.getElementById('login-user').style.display = 'none';
  document.getElementById('user-interface').style.display = 'none';
  document.getElementById('home-page').style.display = 'flex';
}

function checkAdmin() {
  const data = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
  if (!data.currentUser || data.currentUser.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }
  const adminName = document.getElementById('admin-name');
  if (adminName && data.currentUser.name) {
    adminName.textContent = data.currentUser.name;
  }
  return true;
}

function logout() {
  stopAllTTS();
  const data = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
  data.currentUser = null;
  data.userVehicle = null;
  localStorage.setItem('parcAutoData_v3', JSON.stringify(data));
  window.location.href = 'index.html';
}

function goBackToChoice() {
  stopAllTTS();
  document.getElementById('user-interface').style.display = 'none';
  document.getElementById('user-choice-page').style.display = 'flex';
}

function showTab(tabName) {
  if (parcAuto) parcAuto.showTab(tabName);
}

function openVehicleModal() {
  if (parcAuto) parcAuto.openVehicleModal();
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function syncNow() {
  if (parcAuto) parcAuto.syncNow();
}

function exportData() {
  if (parcAuto) parcAuto.exportData();
}

function importData() {
  if (parcAuto) parcAuto.importData();
}

function filterAlerts(type) {
  if (parcAuto) {
    parcAuto.alertFilter = type;
    parcAuto.renderAlertsTable();
  }
}

// ============================================
// 1. NOTIFICATIONS PUSH (Service Worker)
// ============================================
async function registerPushNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    showNotifPermissionBanner();
  } else if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch(e) {}
    }
    scheduleDailyAlertCheck();
  }
}

function showNotifPermissionBanner() {
  const banner = document.createElement('div');
  banner.id = 'notif-permission-banner';
  banner.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
  banner.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);">
      <div style="font-size:52px;margin-bottom:16px;">🔔</div>
      <h2 style="font-size:19px;font-weight:700;color:#1e293b;margin-bottom:10px;">Notifications obligatoires</h2>
      <p style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:24px;">
        L'application <strong>Parc Auto DRT Sfax</strong> doit vous envoyer des alertes automatiques pour les maintenances de votre véhicule.<br><br>
        <strong style="color:#ef4444;">Ces notifications sont obligatoires</strong> pour recevoir les alertes du chef de parc.
      </p>
      <button id="btn-accept-notif" style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(239,68,68,0.3);">
        ✅ Accepter les notifications
      </button>
      <p style="font-size:11px;color:#94a3b8;margin-top:14px;">Sans notifications, vous ne recevrez pas les alertes de maintenance.</p>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('btn-accept-notif').addEventListener('click', async () => {
    const perm = await Notification.requestPermission();
    banner.remove();
    if (perm === 'granted') {
      if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch(e) {} }
      scheduleDailyAlertCheck();
      new Notification('✅ Parc Auto DRT Sfax', { body: 'Notifications activées. Vous recevrez les alertes de maintenance.', icon: 'icon-192.png' });
    } else {
      setTimeout(showNotifPermissionBanner, 5000);
    }
  });
}

function scheduleDailyAlertCheck() {
  checkAndNotifyAlerts();
  setInterval(checkAndNotifyAlerts, 3600000);
}

function checkAndNotifyAlerts() {
  try {
    const raw = localStorage.getItem('parcAutoData_v3');
    if (!raw) return;
    const data = JSON.parse(raw);
    const today = new Date(); today.setHours(0,0,0,0);
    const settings = data.settings || { alerteVidange: 1000, alerteChaine: 1000, alerteVisite: 7 };

    let totalAlerts = 0;
    const allMessages = [];

    (data.vehicles || []).forEach(v => {
      const vAlerts = [];

      // 1. Vidange
      if (v.prochaineVidange && v.km) {
        const rest = v.prochaineVidange - v.km;
        if (rest <= settings.alerteVidange) {
          totalAlerts++;
          const msg = `Vidange ${rest <= 0 ? 'DÉPASSÉE de ' + Math.abs(rest) + ' km' : 'dans ' + rest + ' km'}`;
          allMessages.push(`${v.matricule}: ${msg}`);
          vAlerts.push(msg);
        }
      }

      // 2. Kit Chaîne
      if (v.prochaineChaine && v.km) {
        const rest = v.prochaineChaine - v.km;
        if (rest <= settings.alerteChaine) {
          totalAlerts++;
          const msg = `Kit chaîne ${rest <= 0 ? 'DÉPASSÉE de ' + Math.abs(rest) + ' km' : 'dans ' + rest + ' km'}`;
          allMessages.push(`${v.matricule}: ${msg}`);
          vAlerts.push(msg);
        }
      }

      // 3. Visite Technique
      if (v.prochaineVisite) {
        const d = new Date(v.prochaineVisite); d.setHours(0,0,0,0);
        const days = Math.ceil((d - today) / 86400000);
        if (days <= settings.alerteVisite) {
          totalAlerts++;
          const msg = `Visite technique ${days < 0 ? 'DÉPASSÉE de ' + Math.abs(days) + ' j' : 'dans ' + days + ' j'}`;
          allMessages.push(`${v.matricule}: ${msg}`);
          vAlerts.push(msg);
        }
      }

      // 4. Batterie (> 24 mois)
      if (v.dateChangementBatterie) {
        const months = (today - new Date(v.dateChangementBatterie)) / (1000*60*60*24*30);
        if (months >= 24) { vAlerts.push(`Batterie: ${Math.floor(months)} mois sans remplacement`); totalAlerts++; }
      }

      // 5. Pneus (> 12 mois)
      if (v.dateChangementPneus) {
        const months = (today - new Date(v.dateChangementPneus)) / (1000*60*60*24*30);
        if (months >= 12) { vAlerts.push(`Pneus: ${Math.floor(months)} mois sans remplacement`); totalAlerts++; }
      }

      // ENVOI AUTOMATIQUE WHATSAPP
      if (vAlerts.length > 0) {
        if (v.whatsappChauffeur) {
          queueWhatsAppMessage(v, vAlerts, today, 'chauffeur');
        }
        queueWhatsAppMessage(v, vAlerts, today, 'chef');
      }
    });

    if (totalAlerts > 0 && Notification.permission === 'granted') {
      new Notification('🚨 Parc Auto DRT Sfax', {
        body: `${totalAlerts} alerte(s) active(s)\n${allMessages.slice(0,3).join('\n')}`,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: 'parc-alert'
      });
    }
  } catch(e) { 
    console.warn('Notification error:', e); 
  }
}

// ============================================
// WHATSAPP — FILE D'ATTENTE ET ENVOI INTELLIGENT
// ============================================

/**
 * queueWhatsAppMessage: stocke les messages en attente dans localStorage
 * puis les envoie via notification cliquable. Le chauffeur/chef reçoit
 * l'alerte même s'il n'a pas ouvert l'application.
 */
function queueWhatsAppMessage(vehicle, alerts, today, recipient) {
  const todayStr = today.toISOString().split('T')[0];
  const dedupeKey = `wa_${recipient}_${vehicle.matricule}_${todayStr}`;
  if (localStorage.getItem(dedupeKey)) return;

  const dateStr = today.toLocaleDateString('fr-FR');
  const alertLines = alerts.map(a => `⚠️ ${a}`).join('\n');

  let phone, msg;

  if (recipient === 'chef') {
    phone = '21698230530';
    msg = `🚨 *ALERTE CHEF DE PARC — DRT SFAX*

📌 Véhicule : *${vehicle.matricule}*
🚙 Modèle : ${vehicle.modele}
👤 Chauffeur : ${vehicle.chauffeur || 'N/A'}
📱 WhatsApp chauffeur : ${vehicle.whatsappChauffeur || 'Non enregistré'}
📍 KM actuel : ${(vehicle.km || 0).toLocaleString()} km
📅 Date : ${dateStr}

⚠️ *ALERTES DÉTECTÉES :*
${alertLines}

🔴 *Action requise : contacter le chauffeur et planifier l'intervention.*

_Parc Auto DRT Sfax — Tunisie Telecom_`;
  } else {
    phone = String(vehicle.whatsappChauffeur || '').replace(/\D/g, '');
    if (!phone) return;
    msg = `🚗 *ALERTE MAINTENANCE — Parc Auto DRT Sfax*

📌 Véhicule : *${vehicle.matricule}*
🚙 Modèle : ${vehicle.modele}
👤 Chauffeur : ${vehicle.chauffeur || 'N/A'}
📍 KM actuel : ${(vehicle.km || 0).toLocaleString()} km
📅 Date : ${dateStr}

⚠️ *ACTIONS REQUISES :*
${alertLines}

🔴 *Merci de contacter le chef du parc.*
Contact : 98 230 530

_Parc Auto DRT Sfax — Tunisie Telecom_
_Ce message est généré automatiquement._`;
  }

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  // MÉTHODE 1 : Notification cliquable (fonctionne en arrière-plan)
  // Le clic sur la notification ouvre directement WhatsApp
  if (Notification.permission === 'granted') {
    const icon = recipient === 'chef' ? '🚨' : '📱';
    const label = recipient === 'chef' ? 'Chef de parc' : `Chauffeur ${vehicle.chauffeur}`;
    
    try {
      // Stocker l'URL WhatsApp pour que le service worker puisse l'ouvrir
      const pendingKey = `wa_pending_${vehicle.matricule}_${recipient}_${todayStr}`;
      localStorage.setItem(pendingKey, waUrl);

      const notif = new Notification(`${icon} Alerte WhatsApp — ${vehicle.matricule}`, {
        body: `Cliquez pour envoyer l'alerte WhatsApp à ${label}\n${alerts[0] || ''}`,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: `wa-${recipient}-${vehicle.matricule}`,
        requireInteraction: true,
        data: { waUrl, pendingKey }
      });

      notif.onclick = function() {
        window.open(waUrl, '_blank');
        localStorage.setItem(dedupeKey, '1');
        localStorage.removeItem(pendingKey);
        notif.close();
      };

      localStorage.setItem(dedupeKey, '1');
      console.log(`✅ Notification WhatsApp créée pour ${vehicle.matricule} → ${recipient}`);
      return;
    } catch(e) {
      console.warn('Notification failed, fallback to direct open:', e);
    }
  }

  // MÉTHODE 2 : Fallback — ouvrir directement WhatsApp
  window.open(waUrl, '_blank');
  localStorage.setItem(dedupeKey, '1');
}

// Compatibilité avec l'ancien code
function sendWhatsAppAlertToChef(vehicle, alerts, today) {
  queueWhatsAppMessage(vehicle, alerts, today, 'chef');
}
function autoSendWhatsAppToChauffeur(vehicle, alerts, today) {
  queueWhatsAppMessage(vehicle, alerts, today, 'chauffeur');
}

// ============================================
// 2. EXPORT PDF RAPPORT VÉHICULE
// ============================================
function exportVehiclePDF(matricule) {
  const raw = localStorage.getItem('parcAutoData_v3');
  if (!raw) return;
  const data = JSON.parse(raw);
  const vehicle = data.vehicles.find(v => v.matricule === matricule);
  if (!vehicle) return;

  const repairs = (data.repairs || [])
    .filter(r => r.matricule === matricule)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  const totalCost = repairs.reduce((s,r) => s + (r.montant || 0), 0);
  const today = new Date().toLocaleDateString('fr-FR');

  const html = `<!DOCTYPE html><html lang="fr"><head>
  <meta charset="UTF-8">
  <title>Rapport — ${vehicle.matricule}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; background:#fff; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #ef4444; }
    .logo-block h1 { font-size:22px; font-weight:700; color:#1e293b; }
    .logo-block p { font-size:11px; color:#64748b; letter-spacing:1px; text-transform:uppercase; margin-top:2px; }
    .date-block { text-align:right; font-size:12px; color:#64748b; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .section { margin-bottom:28px; }
    .section-title { font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
    .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
    .info-box label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .info-box span { display:block; font-size:16px; font-weight:700; color:#1e293b; margin-top:4px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { background:#f1f5f9; color:#475569; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:10px 12px; text-align:left; border-bottom:2px solid #e2e8f0; }
    td { padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#1e293b; }
    tr:nth-child(even) td { background:#fafafa; }
    .total-row td { font-weight:700; background:#fef2f2; color:#991b1b; border-top:2px solid #fecaca; }
    .footer { margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; }
    .gradient-bar { height:4px; background:linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7); border-radius:2px; margin-bottom:32px; }
  </style></head><body>
  <div class="gradient-bar"></div>
  <div class="header">
    <div class="logo-block">
      <h1>🚗 Parc Auto DRT Sfax</h1>
      <p>Direction Régionale de Sfax — Tunisie Telecom</p>
    </div>
    <div class="date-block">
      <strong>RAPPORT D'ENTRETIEN</strong><br>
      Généré le ${today}<br>
      <span class="badge badge-red" style="margin-top:6px;">${vehicle.matricule}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Informations du véhicule</div>
    <div class="info-grid">
      <div class="info-box"><label>Matricule</label><span>${vehicle.matricule}</span></div>
      <div class="info-box"><label>Modèle</label><span>${vehicle.modele}</span></div>
      <div class="info-box"><label>Chauffeur</label><span>${vehicle.chauffeur || '—'}</span></div>
      <div class="info-box"><label>Kilométrage</label><span>${vehicle.km.toLocaleString()} km</span></div>
      <div class="info-box"><label>Prochaine vidange</label><span>${vehicle.prochaineVidange ? vehicle.prochaineVidange.toLocaleString() + ' km' : '—'}</span></div>
      <div class="info-box"><label>Visite technique</label><span>${vehicle.prochaineVisite || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Historique des interventions (${repairs.length})</div>
    ${repairs.length === 0 ? '<p style="color:#94a3b8;font-size:13px;">Aucune intervention enregistrée.</p>' : `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Désignation</th><th>Km</th><th>Montant</th></tr></thead>
      <tbody>
        ${repairs.map(r => `<tr>
          <td>${r.date}</td>
          <td><strong>${r.type}</strong></td>
          <td>${r.designation}</td>
          <td>${r.km.toLocaleString()} km</td>
          <td>${r.montant ? r.montant.toFixed(2) + ' TND' : '—'}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="4" style="text-align:right;">TOTAL COÛTS</td>
          <td>${totalCost.toFixed(2)} TND</td>
        </tr>
      </tbody>
    </table>`}
  </div>

  <div class="footer">
    <span>Parc Auto DRT Sfax — Tunisie Telecom</span>
    <span>Créé par Hamdi Ben Aouicha — Chef de Parc DRT Sfax</span>
    <span>Document généré le ${today}</span>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ============================================
// 3. DOUBLE AUTHENTIFICATION OTP — Email (Resend via Worker)
// ============================================
const OTP_CONFIG = {
  code: null,
  expiry: null,
  attempts: 0,
  maxAttempts: 3,
  vehicleData: null,   // données véhicule en attente de validation
  pendingAdmin: null   // données admin en attente de validation
};

function generateOTP() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (100000 + (arr[0] % 900000)).toString();
}

async function requestOTPEmail(vehicleData) {
  const otp = generateOTP();
  OTP_CONFIG.code = otp;
  OTP_CONFIG.expiry = Date.now() + 10 * 60 * 1000; // 10 min
  OTP_CONFIG.attempts = 0;
  OTP_CONFIG.vehicleData = vehicleData;

  try {
    const resp = await fetch(`${WORKER_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        otp,
        matricule: vehicleData.matricule,
        chauffeur: vehicleData.chauffeur || 'N/A'
      })
    });
    if (!resp.ok) throw new Error('Worker error ' + resp.status);
    return { ok: true };
  } catch (e) {
    console.error('OTP email error:', e);
    return { ok: false, msg: 'Erreur envoi email. Réessayez.' };
  }
}

function verifyOTP(inputCode) {
  if (!OTP_CONFIG.code || !OTP_CONFIG.expiry) return { ok: false, msg: 'Aucun code généré' };
  if (Date.now() > OTP_CONFIG.expiry) return { ok: false, msg: 'Code expiré. Recommencez.' };
  OTP_CONFIG.attempts++;
  if (OTP_CONFIG.attempts > OTP_CONFIG.maxAttempts) return { ok: false, msg: 'Trop de tentatives. Reconnectez-vous.' };
  if (inputCode.trim() === OTP_CONFIG.code) {
    OTP_CONFIG.code = null;
    return { ok: true };
  }
  const left = OTP_CONFIG.maxAttempts - OTP_CONFIG.attempts;
  return { ok: false, msg: `Code incorrect. ${left} essai(s) restant(s).` };
}

// ============================================
// ÉCRAN OTP — Affichage et gestion
// ============================================
function showOTPScreen(vehicleData, type = 'user') {
  // Supprimer ancien écran si présent
  document.getElementById('otp-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'otp-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.85);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:36px 28px;max-width:400px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.3);animation:otpFadeIn .3s ease;">
      <style>
        @keyframes otpFadeIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
        @keyframes otpShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        .otp-boxes { display:flex;gap:10px;justify-content:center;margin:20px 0; }
        .otp-box { width:48px;height:56px;border:2px solid #e2e8f0;border-radius:12px;font-size:22px;font-weight:700;text-align:center;color:#1e293b;outline:none;transition:all .2s;background:#f8fafc; }
        .otp-box:focus { border-color:#3b82f6;background:#eff6ff;box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .otp-box.filled { border-color:#3b82f6;background:#eff6ff; }
        .otp-box.error { border-color:#ef4444!important;background:#fef2f2!important;animation:otpShake .4s ease; }
        .otp-dot { width:12px;height:12px;border-radius:50%;background:#22c55e;display:inline-block;transition:all .3s; }
        .otp-dot.used { background:#ef4444; }
      </style>
      <div style="font-size:52px;margin-bottom:12px;">🔐</div>
      <h2 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px;">Vérification en 2 étapes</h2>
      <p style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:4px;">
        Un code OTP à 6 chiffres a été envoyé par email à<br><strong>drtsfaxparauto@gmail.com</strong>
      </p>
      <p style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:20px;">Consultez votre Gmail pour récupérer le code.</p>

      <div id="otp-loading" style="color:#64748b;font-size:13px;margin-bottom:8px;">⏳ Chargement...</div>

      <div class="otp-boxes" id="otp-boxes">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="0" autocomplete="off">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="1" autocomplete="off">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="2" autocomplete="off">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="3" autocomplete="off">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="4" autocomplete="off">
        <input class="otp-box" type="text" inputmode="numeric" maxlength="1" data-idx="5" autocomplete="off">
      </div>

      <div id="otp-error" style="color:#ef4444;font-size:13px;min-height:20px;margin-bottom:8px;"></div>

      <button id="otp-validate-btn" onclick="validateOTPAndLogin()" style="width:100%;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(249,115,22,.3);margin-bottom:16px;transition:all .2s;">
        Valider le code
      </button>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <button onclick="resendOTPWhatsApp()" style="background:none;border:none;color:#3b82f6;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          📲 Renvoyer le code
        </button>
        <button onclick="cancelOTP()" style="background:none;border:none;color:#94a3b8;font-size:13px;cursor:pointer;">
          Annuler
        </button>
      </div>

      <div style="font-size:13px;color:#64748b;">
        Tentatives :
        <span class="otp-dot" id="otp-dot-0"></span>
        <span class="otp-dot" id="otp-dot-1" style="margin:0 4px;"></span>
        <span class="otp-dot" id="otp-dot-2"></span>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Init boxes behaviour
  const boxes = overlay.querySelectorAll('.otp-box');
  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '');
      if (box.value && i < 5) boxes[i + 1].focus();
      box.classList.toggle('filled', !!box.value);
      // Auto-valider si tout rempli
      if ([...boxes].every(b => b.value)) validateOTPAndLogin();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
      paste.split('').forEach((c, idx) => { if (boxes[idx]) { boxes[idx].value = c; boxes[idx].classList.add('filled'); } });
      if (paste.length === 6) validateOTPAndLogin();
    });
  });

  // Focus first box after short delay
  setTimeout(() => {
    document.getElementById('otp-loading').style.display = 'none';
    boxes[0].focus();
  }, 1500);
}

function getOTPCode() {
  const boxes = document.querySelectorAll('#otp-boxes .otp-box');
  return [...boxes].map(b => b.value).join('');
}

async function validateOTPAndLogin() {
  if (validateOTPAndLogin._running) return;
  validateOTPAndLogin._running = true;
  const code = getOTPCode();
  if (code.length < 6) { validateOTPAndLogin._running = false; return; }

  const result = verifyOTP(code);

  if (result.ok) {
    document.getElementById('otp-overlay')?.remove();

    // Cas Admin
    if (OTP_CONFIG.pendingAdmin) {
      const admin = OTP_CONFIG.pendingAdmin;
      // Vider tout OTP_CONFIG immédiatement
      OTP_CONFIG.pendingAdmin = null;
      OTP_CONFIG.code = null;
      OTP_CONFIG.expiry = null;
      OTP_CONFIG.attempts = 0;
      if (window.parcAuto) {
        parcAuto.data.currentUser = { email: admin.email, role: admin.role, name: admin.name };
        parcAuto.data.userVehicle = null;
        // Sauvegarder immédiatement en localStorage (sans attendre le cloud)
        const localData = JSON.parse(localStorage.getItem('parcAutoData_v3') || '{}');
        localData.currentUser = parcAuto.data.currentUser;
        localData.userVehicle = null;
        localStorage.setItem('parcAutoData_v3', JSON.stringify(localData));
        // Marquer OTP comme validé pour éviter boucle
        sessionStorage.setItem('otp_validated', '1');
        // Rediriger immédiatement
        window.location.href = 'admin.html';
      }
      return;
    }

    // Cas Utilisateur (non utilisé actuellement mais conservé)
    const vd = OTP_CONFIG.vehicleData;
    OTP_CONFIG.vehicleData = null;
    if (window.parcAuto && vd) {
      parcAuto.data.currentUser = { role: 'user', name: vd.chauffeur || 'Utilisateur' };
      parcAuto.data.userVehicle = vd.matricule;
      window._selectedMatricule = vd.matricule;
      parcAuto.saveData();
      document.getElementById('login-user').style.display  = 'none';
      document.getElementById('user-choice-page').style.display = 'flex';
      setTimeout(() => {
        if (typeof checkAndNotifyAlerts === 'function') checkAndNotifyAlerts();
        parcAuto.startAutoSync();
      }, 500);
    }
  } else {
    // Erreur — marquer dot utilisé
    const usedIdx = OTP_CONFIG.attempts - 1;
    const dot = document.getElementById(`otp-dot-${usedIdx}`);
    if (dot) dot.classList.add('used');

    const errorEl = document.getElementById('otp-error');
    if (errorEl) errorEl.textContent = result.msg;

    // Shake les boxes
    document.querySelectorAll('#otp-boxes .otp-box').forEach(b => {
      b.classList.add('error');
      b.value = '';
      setTimeout(() => b.classList.remove('error'), 500);
    });
    document.querySelector('#otp-boxes .otp-box')?.focus();
    validateOTPAndLogin._running = false;

    // Si max tentatives atteint
    if (OTP_CONFIG.attempts >= OTP_CONFIG.maxAttempts) {
      setTimeout(() => cancelOTP(), 2000);
    }
  }
}

async function resendOTPWhatsApp() {
  const vd = OTP_CONFIG.vehicleData;
  if (!vd) return;
  // Reset dots
  for (let i = 0; i < 3; i++) {
    const d = document.getElementById(`otp-dot-${i}`);
    if (d) d.classList.remove('used');
  }
  document.getElementById('otp-error').textContent = '';
  // Reset boxes
  document.querySelectorAll('#otp-boxes .otp-box').forEach(b => { b.value = ''; b.classList.remove('filled','error'); });
  // Nouveau code
  const result = await requestOTPEmail(vd);
  if (result.ok) {
    if (window.parcAuto) parcAuto.showToast('📧 Nouveau code envoyé par email', 'success');
  } else {
    document.getElementById('otp-error').textContent = result.msg || 'Erreur envoi';
  }
}

function cancelOTP() {
  document.getElementById('otp-overlay')?.remove();
  OTP_CONFIG.code = null;
  OTP_CONFIG.vehicleData = null;
  OTP_CONFIG.attempts = 0;
}


// ============================================
// ALERTES WHATSAPP
// ============================================

function sendWhatsAppAlert(matricule) {
  if (!window.parcAuto) return;
  const v = parcAuto.data.vehicles.find(v => v.matricule === matricule);
  if (!v) return;

  const today = new Date();
  const alerts = [];

  // Check vidange
  if (v.prochaineVidange && v.km) {
    const remaining = v.prochaineVidange - v.km;
    if (remaining <= 2000) alerts.push(`🔧 Vidange : ${remaining > 0 ? remaining + ' km restants' : 'DÉPASSÉE de ' + Math.abs(remaining) + ' km'}`);
  }
  // Check chaîne
  if (v.prochaineChaine && v.km) {
    const remaining = v.prochaineChaine - v.km;
    if (remaining <= 2000) alerts.push(`⛓️ Kit chaîne : ${remaining > 0 ? remaining + ' km restants' : 'DÉPASSÉE de ' + Math.abs(remaining) + ' km'}`);
  }
  // Check visite technique
  if (v.prochaineVisite) {
    const visiteDate = new Date(v.prochaineVisite);
    const daysLeft = Math.ceil((visiteDate - today) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) alerts.push(`📋 Visite technique : ${daysLeft < 0 ? 'DÉPASSÉE de ' + Math.abs(daysLeft) + ' jours' : daysLeft + ' jours restants'}`);
  }
  // Check batterie (si > 2 ans)
  if (v.dateChangementBatterie) {
    const battDate = new Date(v.dateChangementBatterie);
    const monthsOld = (today - battDate) / (1000 * 60 * 60 * 24 * 30);
    if (monthsOld >= 24) alerts.push(`🔋 Batterie : ${Math.floor(monthsOld)} mois depuis le dernier remplacement`);
  }
  // Check pneus (si > 12 mois)
  if (v.dateChangementPneus) {
    const pneusDate = new Date(v.dateChangementPneus);
    const monthsOld = (today - pneusDate) / (1000 * 60 * 60 * 24 * 30);
    if (monthsOld >= 12) alerts.push(`🛞 Pneus : ${Math.floor(monthsOld)} mois depuis le dernier changement`);
  }

  const header = `🚗 *ALERTE PARC AUTO — DRT SFAX*\n\n📌 Véhicule : *${v.matricule}*\n🚙 Modèle : ${v.modele}\n👤 Chauffeur : ${v.chauffeur || 'N/A'}\n📍 KM actuel : ${(v.km || 0).toLocaleString()} km\n📅 Date : ${today.toLocaleDateString('fr-FR')}\n`;

  let body;
  if (alerts.length === 0) {
    body = header + `\n✅ *Aucune alerte en cours*\nTous les entretiens sont à jour.\n\n_Parc Auto DRT Sfax — Tunisie Telecom_`;
  } else {
    body = header + `\n⚠️ *ALERTES DÉTECTÉES (${alerts.length}) :*\n\n` + alerts.join('\n') + `\n\n_Merci de prendre les dispositions nécessaires._\n_Parc Auto DRT Sfax — Tunisie Telecom_`;
  }

  // Ouvrir boîte de dialogue pour choisir le numéro
  const phoneNum = prompt('📲 Numéro WhatsApp du destinataire :\n(format international, ex: 21698230530)', '216');
  if (!phoneNum || phoneNum.trim() === '216' || phoneNum.trim().length < 8) {
    alert('Numéro invalide. Opération annulée.');
    return;
  }

  const phone = phoneNum.replace(/\D/g, '');
  const encoded = encodeURIComponent(body);
  const waUrl = `https://wa.me/${phone}?text=${encoded}`;
  window.open(waUrl, '_blank');
}

// ============================================
// VÉRIFICATION GLOBALE DES ALERTES
// ============================================
function checkAllAlerts() {
  if (!window.parcAuto) return [];
  const today = new Date();
  const allAlerts = [];

  parcAuto.data.vehicles.forEach(v => {
    const vAlerts = [];

    if (v.prochaineVidange && v.km && (v.prochaineVidange - v.km) <= 2000)
      vAlerts.push({ type: 'Vidange', level: v.prochaineVidange - v.km <= 0 ? 'danger' : 'warning' });

    if (v.prochaineChaine && v.km && (v.prochaineChaine - v.km) <= 2000)
      vAlerts.push({ type: 'Chaîne', level: v.prochaineChaine - v.km <= 0 ? 'danger' : 'warning' });

    if (v.prochaineVisite) {
      const daysLeft = Math.ceil((new Date(v.prochaineVisite) - today) / 86400000);
      if (daysLeft <= 30) vAlerts.push({ type: 'Visite technique', level: daysLeft < 0 ? 'danger' : 'warning' });
    }

    if (v.dateChangementBatterie) {
      const months = (today - new Date(v.dateChangementBatterie)) / (1000 * 60 * 60 * 24 * 30);
      if (months >= 24) vAlerts.push({ type: 'Batterie', level: 'warning' });
    }

    if (v.dateChangementPneus) {
      const months = (today - new Date(v.dateChangementPneus)) / (1000 * 60 * 60 * 24 * 30);
      if (months >= 12) vAlerts.push({ type: 'Pneus', level: 'warning' });
    }

    if (vAlerts.length > 0) allAlerts.push({ vehicle: v, alerts: vAlerts });
  });

  return allAlerts;
}

// ============================================
// EXPORT/IMPORT EXCEL CSV
// ============================================
function exportCSV() {
  if (!window.parcAuto) return;
  const vehicles = parcAuto.data.vehicles;
  const headers = ['Matricule','Modèle','Chauffeur','KM Actuel','Prochaine Vidange','Prochaine Chaîne','Prochaine Visite','Date Batterie','Indice Batterie','Date Pneus','Statut'];
  const rows = vehicles.map(v => [
    v.matricule, v.modele, v.chauffeur || '',
    v.km || 0, v.prochaineVidange || '', v.prochaineChaine || '',
    v.prochaineVisite || '', v.dateChangementBatterie || '',
    v.indexBatterie || '', v.dateChangementPneus || '', v.statut || 'actif'
  ]);
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `parc-auto-drt-sfax-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  parcAuto.showToast('Export CSV réussi — Ouvrira dans Excel', 'success');
}
