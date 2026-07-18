import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, Package, UserCog, Wrench,
  ArrowLeftRight, Receipt, Calculator, Store, Plus, X, Check, Clock,
  CreditCard, Smartphone, Banknote, ChevronRight, TrendingUp, AlertCircle,
  ArrowLeft, Trash2, Wallet, CalendarDays, Leaf, Printer, Eye, LogOut, Lock, Settings
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS — palette "claie d'attiéké"
   fond grain (blanc-manioc), nuit-cacao pour la nav,
   vert-manioc pour l'action, ocre-soleil pour l'attention,
   rouge-piment pour les impayés.
--------------------------------------------------------- */
const C = {
  bg: "#F5F1E6",
  bgAlt: "#ECE5D3",
  card: "#FFFFFF",
  ink: "#241A15",
  inkSoft: "#6B5D4F",
  border: "#E1D8C3",
  green: "#3F6B4F",
  greenDeep: "#2B4A36",
  greenSoft: "#E4EEE6",
  gold: "#C98A2B",
  goldSoft: "#F6E9D3",
  chili: "#AE3A2C",
  chiliSoft: "#F3DFDA",
};

const fcfa = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const ENTREPRISE = {
  nom: "HÉLÈNE Multiservices",
  slogan: "Attiéké de qualité, tradition et fraîcheur",
  tel: "07 49 20 56 98",
  adresse: "Bouaflé, Côte d'Ivoire",
  email: "",
};

const DOC_TYPES = {
  devis: { label: "Devis", prefix: "DEV", couleur: "gold" },
  facture: { label: "Facture", prefix: "FAC", couleur: "green" },
  recu: { label: "Reçu", prefix: "REC", couleur: "green" },
};

function prochainNumero(docs, type) {
  const annee = new Date().getFullYear();
  const prefix = DOC_TYPES[type].prefix;
  const count = docs.filter((d) => d.type === type && d.numero.includes(String(annee))).length;
  return `${prefix}-${annee}-${String(count + 1).padStart(3, "0")}`;
}

/* ---------------------------------------------------------
   GAMME BOULES, SACS & BASSINES
   Boules de 100 F à 500 F ; sacs de 250 et de 200 boules
   pour chaque prix ; bassines de 5 000 à 7 000 F.
--------------------------------------------------------- */
const PRIX_BOULES = [100, 125, 200, 250, 300, 350, 400, 450, 500];
const LIMITE_SAC = 30000; // Un sac ne peut contenir plus de 30 000 F de boules

const PRODUITS_BOULES = [
  ...PRIX_BOULES.flatMap((prix) => {
    const liste = [{ id: `b${prix}`, nom: `Boule de ${prix} F`, unite: "boule", prix, stock: 0, emoji: "⚪" }];
    if (prix * 250 <= LIMITE_SAC) {
      liste.push({ id: `s${prix}`, nom: `Sac de 250 boules de ${prix} F`, unite: "sac (250 boules)", prix: prix * 250, stock: 0, emoji: "🧺" });
    }
    if (prix * 200 <= LIMITE_SAC) {
      liste.push({ id: `s200x${prix}`, nom: `Sac de 200 boules de ${prix} F`, unite: "sac (200 boules)", prix: prix * 200, stock: 0, emoji: "🧺" });
    }
    return liste;
  }),
  { id: "bas5000", nom: "Bassine de 5 000 F", unite: "bassine", prix: 5000, stock: 0, emoji: "🥣" },
  { id: "bas6000", nom: "Bassine de 6 000 F", unite: "bassine", prix: 6000, stock: 0, emoji: "🥣" },
  { id: "bas7000", nom: "Bassine de 7 000 F", unite: "bassine", prix: 7000, stock: 0, emoji: "🥣" },
  // Grosses commandes : le montant se calcule automatiquement selon la quantité (1 kg = 400 F)
  { id: "vrac_kg", nom: "Attiéké au kilo", unite: "kg", prix: 400, stock: 0, emoji: "⚖️" },
  { id: "vrac_tonne", nom: "Attiéké à la tonne", unite: "tonne (1 000 kg)", prix: 400000, stock: 0, emoji: "🚚" },
];

// Anciens produits et sacs dépassant la limite, à retirer s'ils ne sont utilisés dans aucune commande
const IDS_A_RETIRER = [
  "p1", "p2", "p3", "p4", // attiéké en gros (remplacé par kg / tonne)
  ...PRIX_BOULES.filter((p) => p * 250 > LIMITE_SAC).map((p) => `s${p}`),
  ...PRIX_BOULES.filter((p) => p * 200 > LIMITE_SAC).map((p) => `s200x${p}`),
];

// Ajoute les produits de la gamme qui manquent et retire les produits obsolètes non utilisés
function fusionnerGamme(produitsExistants, commandes = []) {
  const idsUtilises = new Set();
  commandes.forEach((c) => c.items.forEach((it) => idsUtilises.add(it.produitId)));
  const fusion = produitsExistants.filter((p) => !IDS_A_RETIRER.includes(p.id) || idsUtilises.has(p.id));
  PRODUITS_BOULES.forEach((p) => {
    if (!fusion.some((x) => x.id === p.id)) fusion.push(p);
  });
  return fusion;
}

/* ---------------------------------------------------------
   FRAIS DE LIVRAISON & EMBALLAGE (au choix, par sac)
--------------------------------------------------------- */
const ZONES_LIVRAISON = [
  { id: "bouafle", label: "Bouaflé — retrait / local (0 F)", tarif: 0 },
  { id: "zone1", label: "Yamoussoukro · Daloa · Bouaké · Abidjan (1 000 F/sac)", tarif: 1000 },
  { id: "korhogo", label: "Korhogo (3 000 F/sac)", tarif: 3000 },
];
const TARIF_EMBALLAGE = 1500; // F par sac

// Nombre de sacs dans une liste d'articles : sacs directement choisis
// + boules vendues à l'unité, converties en sacs équivalents (30 000 F max par sac)
function compterSacs(items, produits) {
  let sacsDirects = 0;
  let valeurBoulesVrac = 0;
  items.forEach((it) => {
    const p = produits.find((x) => x.id === it.produitId);
    if (!p) return;
    const u = (p.unite || "").toLowerCase();
    if (u.includes("sac")) {
      sacsDirects += Number(it.qte || 0);
    } else if (u === "boule") {
      valeurBoulesVrac += Number(it.qte || 0) * Number(p.prix || 0);
    }
  });
  const sacsEquivalents = valeurBoulesVrac > 0 ? Math.ceil(valeurBoulesVrac / LIMITE_SAC) : 0;
  return sacsDirects + sacsEquivalents;
}

/* ---------------------------------------------------------
   DONNÉES DE DÉMONSTRATION
--------------------------------------------------------- */
const SEED_PRODUITS = [];

const SEED_CLIENTS = [
  { id: "c1", nom: "Maquis Le Baobab", tel: "07 01 23 45 67", adresse: "Yopougon, Abidjan", type: "Revendeur" },
  { id: "c2", nom: "Restaurant Chez Tantie Aya", tel: "05 44 12 09 88", adresse: "Cocody, Abidjan", type: "Revendeur" },
  { id: "c3", nom: "Mme Koffi Adjoua", tel: "01 22 33 44 55", adresse: "Marcory, Abidjan", type: "Particulier" },
];

const SEED_COMMANDES = [
  { id: "o1", clientId: "c1", date: "2026-07-10", items: [{ produitId: "s100", qte: 2 }], statut: "payé", moyenPaiement: "Mobile Money", jourPaiement: "2026-07-10" },
  { id: "o2", clientId: "c2", date: "2026-07-12", items: [{ produitId: "s200x125", qte: 1 }, { produitId: "b200", qte: 50 }], statut: "impayé", moyenPaiement: "Espèces", jourPaiement: "2026-07-20" },
  { id: "o3", clientId: "c3", date: "2026-07-14", items: [{ produitId: "bas5000", qte: 2 }], statut: "partiel", moyenPaiement: "Virement", jourPaiement: "2026-07-18" },
];

/* ---------------------------------------------------------
   STORAGE HELPERS
--------------------------------------------------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function loadKey(key, seed) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return seed;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) return rows[0].value;
    return seed;
  } catch {
    return seed;
  }
}

function saveKey(key, value) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ key, value }]),
  }).catch(() => {
    /* silencieux : les données restent en mémoire pour cette session */
  });
}
/* ---------------------------------------------------------
   NOTIFICATIONS GÉRANT (email automatique + WhatsApp en un tap)
--------------------------------------------------------- */
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const GERANT_EMAIL = import.meta.env.VITE_GERANT_EMAIL;
const GERANT_WHATSAPP = import.meta.env.VITE_GERANT_WHATSAPP;

function envoyerEmailGerant(sujet, message) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !GERANT_EMAIL) return;
  fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: { to_email: GERANT_EMAIL, subject: sujet, message },
    }),
  }).catch(() => {});
}

function ouvrirWhatsAppGerant(message) {
  if (!GERANT_WHATSAPP) return;
  window.open(`https://wa.me/${GERANT_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
}

function notifierGerant(sujet, message) {
  envoyerEmailGerant(sujet, message);
  ouvrirWhatsAppGerant(message);
}

/* ---------------------------------------------------------
   PETITS COMPOSANTS
--------------------------------------------------------- */
function Badge({ statut }) {
  const map = {
    "payé": { bg: C.greenSoft, fg: C.greenDeep, label: "Payé" },
    "partiel": { bg: C.goldSoft, fg: "#8A5D14", label: "Partiel" },
    "impayé": { bg: C.chiliSoft, fg: C.chili, label: "Impayé" },
  };
  const s = map[statut] || map["impayé"];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {s.label}
    </span>
  );
}

function ClaieBadge({ children, size = 40 }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size, height: size,
        background: C.greenSoft,
        border: `1.5px dashed ${C.green}`,
        color: C.greenDeep,
      }}
    >
      {children}
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, tone = "green" }) {
  const tones = {
    green: { bg: C.greenSoft, fg: C.greenDeep },
    gold: { bg: C.goldSoft, fg: "#8A5D14" },
    chili: { bg: C.chiliSoft, fg: C.chili },
  };
  const t = tones[tone];
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: C.inkSoft }}>{label}</span>
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: t.bg, color: t.fg }}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: C.inkSoft }}>{sub}</div>}
    </div>
  );
}

function ComingSoon({ titre, points }) {
  return (
    <div className="rounded-2xl p-8" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
      <div className="flex items-start gap-4">
        <ClaieBadge size={44}><Clock size={20} /></ClaieBadge>
        <div>
          <h3 className="text-lg font-bold mb-1" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>{titre}</h3>
          <p className="text-sm mb-4" style={{ color: C.inkSoft }}>
            Ce module fait partie du plan global. On le construit à la prochaine étape, en détail :
          </p>
          <ul className="space-y-1.5">
            {points.map((p, i) => (
              <li key={i} className="text-sm flex items-center gap-2" style={{ color: C.ink }}>
                <ChevronRight size={14} style={{ color: C.green }} /> {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.45)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-4 py-8">
        <div className="w-full max-w-md rounded-2xl" style={{ background: C.card }}>
          {/* En-tête collant : titre + fermer toujours visibles */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-5 pb-3 rounded-t-2xl"
            style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
            <h3 className="text-lg font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>{title}</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bgAlt }}>
              <X size={17} />
            </button>
          </div>
          <div className="px-6 pb-6 pt-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = { border: `1px solid ${C.border}`, background: C.bg, color: C.ink };

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
const NAV = [
  { group: "Vue d'ensemble", items: [{ id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard }] },
  { group: "Ventes", items: [
    { id: "clients", label: "Clients", icon: Users },
    { id: "commandes", label: "Commandes", icon: ShoppingCart },
    { id: "factures", label: "Devis & Factures", icon: FileText },
  ]},
  { group: "Catalogue", items: [{ id: "produits", label: "Produits", icon: Package }] },
  { group: "Ressources", items: [
    { id: "personnel", label: "Personnel", icon: UserCog },
    { id: "materiel", label: "Matériel", icon: Wrench },
  ]},
  { group: "Finances", items: [
    { id: "achats", label: "Achats & Ventes", icon: ArrowLeftRight },
    { id: "depenses", label: "Dépenses & Entretiens", icon: Receipt },
    { id: "compta", label: "Comptabilité", icon: Calculator },
  ]},
  { group: "Réglages", items: [{ id: "parametres", label: "Paramètres", icon: Settings }] },
];

/* =========================================================
   APP
========================================================= */
export default function App() {
  const [mode, setMode] = useState("gerant"); // "gerant" | "client"
  const [section, setSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState(null); // null | {role:"gerant"} | {role:"client", clientId}

  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [materiel, setMateriel] = useState([]);
  const [achats, setAchats] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [paies, setPaies] = useState([]); // journal des salaires (journaliers et mensuels)

  const [showClientModal, setShowClientModal] = useState(false);
  const [showProduitModal, setShowProduitModal] = useState(false);
  const [showCommandeModal, setShowCommandeModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [personnelEdit, setPersonnelEdit] = useState(null); // employé en cours de modification
  const [ficheEmploi, setFicheEmploi] = useState(null); // employé dont on affiche la fiche d'emploi
  const [fichePaie, setFichePaie] = useState(null); // employé dont on affiche la fiche de paie
  const [showMaterielModal, setShowMaterielModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showDepenseModal, setShowDepenseModal] = useState(false);
  const [showRapport, setShowRapport] = useState(false);
  const [encaisserCmd, setEncaisserCmd] = useState(null); // commande en cours d'encaissement
  const [encaisserClient, setEncaisserClient] = useState(null); // client en cours d'encaissement global
  const [confirmation, setConfirmation] = useState(null); // {message, action} ou {message} pour simple info
  const [releveClient, setReleveClient] = useState(null); // client dont on affiche le relevé de compte
  const [clientEdit, setClientEdit] = useState(null); // client en cours de modification
  const [rechercheClients, setRechercheClients] = useState("");
  const [rechercheCommandes, setRechercheCommandes] = useState("");
  const [signature, setSignature] = useState(""); // signature du gérant (image)
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [notifs, setNotifs] = useState([]); // journal des notifications
  const [showNotifs, setShowNotifs] = useState(false);
  const [pin, setPin] = useState("1234"); // code gérant (modifiable dans Paramètres)
  const [recup, setRecup] = useState(null); // question/réponse de récupération du code
  const [entrepriseV, setEntrepriseV] = useState(0); // force le rafraîchissement après modification des infos entreprise

  const [activeClientId, setActiveClientId] = useState(null); // pour l'espace client (simulation de connexion)

  useEffect(() => {
    let done = false;
    const finish = (cl, pr, co, dc, pe, ma, ac, de) => {
      if (done) return;
      done = true;
      const prAvecGamme = fusionnerGamme(pr, co);
      if (JSON.stringify(prAvecGamme.map((p) => p.id)) !== JSON.stringify(pr.map((p) => p.id))) saveKey("attieke:produits", prAvecGamme);
      setClients(cl); setProduits(prAvecGamme); setCommandes(co); setDocuments(dc);
      setPersonnel(pe); setMateriel(ma); setAchats(ac); setDepenses(de);
      setActiveClientId(cl[0]?.id || null);
      setLoading(false);
    };

    // Filet de sécurité : démarrage sur les données de démo après 3s quoi qu'il arrive
    const safety = setTimeout(() => finish(SEED_CLIENTS, SEED_PRODUITS, SEED_COMMANDES, [], [], [], [], []), 3000);

    (async () => {
      try {
        const [cl, pr, co, dc, pe, ma, ac, de] = await Promise.all([
          loadKey("attieke:clients", SEED_CLIENTS),
          loadKey("attieke:produits", SEED_PRODUITS),
          loadKey("attieke:commandes", SEED_COMMANDES),
          loadKey("attieke:documents", []),
          loadKey("attieke:personnel", []),
          loadKey("attieke:materiel", []),
          loadKey("attieke:achats", []),
          loadKey("attieke:depenses", []),
        ]);
        finish(cl, pr, co, dc, pe, ma, ac, de);
      } catch {
        finish(SEED_CLIENTS, SEED_PRODUITS, SEED_COMMANDES, [], [], [], [], []);
      }
    })();

    return () => clearTimeout(safety);
  }, []);

  // Chargement séparé de la signature et des notifications (non bloquant)
  useEffect(() => {
    loadKey("attieke:signature", "").then((s) => setSignature(s || ""));
    loadKey("attieke:notifs", []).then((n) => setNotifs(Array.isArray(n) ? n : []));
    loadKey("attieke:paies", []).then((p) => setPaies(Array.isArray(p) ? p : []));
    loadKey("attieke:pin", "1234").then((p) => setPin(p || "1234"));
    loadKey("attieke:recup", null).then((r) => setRecup(r && r.question ? r : null));
    loadKey("attieke:entreprise", null).then((e) => {
      if (e && typeof e === "object") { Object.assign(ENTREPRISE, e); setEntrepriseV((v) => v + 1); }
    });
  }, []);

  const updatePin = (p) => { setPin(p); saveKey("attieke:pin", p); };
  const updateRecup = (r) => { setRecup(r); saveKey("attieke:recup", r); };

  // SAUVEGARDE : exporte toutes les données dans un fichier téléchargeable
  const exporterDonnees = () => {
    const data = {
      version: 1,
      exporteLe: new Date().toISOString(),
      clients, produits, commandes, documents, personnel, materiel,
      achats, depenses, paies, signature, notifs,
      entreprise: { ...ENTREPRISE }, pin, recup,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helene-sauvegarde-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // RESTAURATION : recharge toutes les données depuis un fichier de sauvegarde
  const importerDonnees = (data) => {
    if (!data || typeof data !== "object" || !Array.isArray(data.clients)) {
      return { ok: false, texte: "Fichier invalide : ce n'est pas une sauvegarde HÉLÈNE Multiservices." };
    }
    updateClients(data.clients || []);
    updateProduits(fusionnerGamme(data.produits || [], data.commandes || []));
    updateCommandes(data.commandes || []);
    updateDocuments(data.documents || []);
    updatePersonnel(data.personnel || []);
    updateMateriel(data.materiel || []);
    updateAchats(data.achats || []);
    updateDepenses(data.depenses || []);
    updatePaies(data.paies || []);
    updateSignature(data.signature || "");
    updateNotifs(data.notifs || []);
    if (data.entreprise) updateEntreprise(data.entreprise);
    if (data.pin) updatePin(data.pin);
    if (data.recup) updateRecup(data.recup);
    setActiveClientId((data.clients || [])[0]?.id || null);
    return { ok: true, texte: `Sauvegarde du ${data.exporteLe ? fmtDate(data.exporteLe.slice(0, 10)) : "?"} restaurée avec succès.` };
  };
  const updateEntreprise = (e) => {
    Object.assign(ENTREPRISE, e);
    saveKey("attieke:entreprise", { ...ENTREPRISE });
    setEntrepriseV((v) => v + 1);
  };

  const updatePaies = (next) => { setPaies(next); saveKey("attieke:paies", next); };

  // GÉNÉRATION AUTOMATIQUE DES PAIES
  // Pour chaque journée écoulée (salaire journalier) ou mois écoulé (salaire mensuel),
  // une ligne de paie est créée, marquée "payé" par défaut. Le gérant peut la basculer en "non payé".
  useEffect(() => {
    if (loading || personnel.length === 0) return;
    const aujourdHui = todayISO();
    const nouvelles = [];
    const existe = new Set(paies.map((p) => p.id));

    personnel.forEach((emp) => {
      const type = emp.typePaie || "mensuel";
      // Début de la génération : date d'embauche, sans remonter à plus de 90 jours
      const bornebasse = new Date(); bornebasse.setDate(bornebasse.getDate() - 90);
      let debut = emp.dateEmbauche ? new Date(emp.dateEmbauche) : bornebasse;
      if (debut < bornebasse) debut = bornebasse;

      if (type === "journalier") {
        const d = new Date(debut);
        // La journée en cours est incluse : les journalières sont payées en fin de journée
        while (d.toISOString().slice(0, 10) <= aujourdHui) {
          const periode = d.toISOString().slice(0, 10);
          const id = `${emp.id}:${periode}`;
          if (!existe.has(id)) {
            nouvelles.push({ id, employeId: emp.id, type: "journalier", periode, montant: Number(emp.salaire) || 0, statut: "payé" });
          }
          d.setDate(d.getDate() + 1);
        }
      } else {
        // Mensuel : chaque mois entièrement écoulé
        const d = new Date(debut.getFullYear(), debut.getMonth(), 1);
        const maintenant = new Date();
        while (new Date(d.getFullYear(), d.getMonth() + 1, 1) <= new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)) {
          const periode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const id = `${emp.id}:${periode}`;
          if (!existe.has(id)) {
            nouvelles.push({ id, employeId: emp.id, type: "mensuel", periode, montant: Number(emp.salaire) || 0, statut: "payé" });
          }
          d.setMonth(d.getMonth() + 1);
        }
      }
    });

    if (nouvelles.length > 0) updatePaies([...paies, ...nouvelles]);
  }, [loading, personnel, paies.length]);

  const updateSignature = (s) => { setSignature(s); saveKey("attieke:signature", s); };
  const updateNotifs = (next) => { setNotifs(next); saveKey("attieke:notifs", next); };
  const ajouterNotif = (message) => {
    const n = { id: "n" + Date.now(), message, date: new Date().toISOString(), lu: false };
    setNotifs((prev) => { const next = [n, ...prev].slice(0, 100); saveKey("attieke:notifs", next); return next; });
  };
  const nbNonLues = notifs.filter((n) => !n.lu).length;

  const updateClients = (next) => { setClients(next); saveKey("attieke:clients", next); };
  const updateProduits = (next) => { setProduits(next); saveKey("attieke:produits", next); };
  const updateCommandes = (next) => { setCommandes(next); saveKey("attieke:commandes", next); };
  const updateDocuments = (next) => { setDocuments(next); saveKey("attieke:documents", next); };
  const updatePersonnel = (next) => { setPersonnel(next); saveKey("attieke:personnel", next); };
  const updateMateriel = (next) => { setMateriel(next); saveKey("attieke:materiel", next); };
  const updateAchats = (next) => { setAchats(next); saveKey("attieke:achats", next); };
  const updateDepenses = (next) => { setDepenses(next); saveKey("attieke:depenses", next); };

  const montantCommande = (cmd) =>
    cmd.items.reduce((s, it) => {
      const p = produits.find((x) => x.id === it.produitId);
      return s + (p ? p.prix * it.qte : 0);
    }, 0) + Number(cmd.fraisTransport || 0) + Number(cmd.fraisEmballage || 0);

  // Somme des encaissements enregistrés sur une commande.
  // Compatibilité : une commande "payé" sans détail d'encaissement compte pour sa totalité.
  const montantPaye = (cmd) => {
    const total = montantCommande(cmd);
    if (cmd.paiements && cmd.paiements.length > 0) {
      return Math.min(total, cmd.paiements.reduce((s, p) => s + Number(p.montant || 0), 0));
    }
    return cmd.statut === "payé" ? total : 0;
  };
  const montantReste = (cmd) => Math.max(0, montantCommande(cmd) - montantPaye(cmd));

  // Lignes de document pour une commande (produits + frais éventuels)
  const lignesDeCommande = (cmd) => {
    const lignes = cmd.items.map((it) => {
      const p = produits.find((x) => x.id === it.produitId);
      return { designation: p?.nom || "—", unite: p?.unite || "", qte: it.qte, pu: p?.prix || 0, montant: (p?.prix || 0) * it.qte };
    });
    if (cmd.fraisTransport > 0) {
      lignes.push({ designation: `Transport${cmd.zone ? ` — ${cmd.zone.split("(")[0].trim()}` : ""}`, unite: cmd.nbSacs ? `${cmd.nbSacs} sac·s` : "", qte: 1, pu: cmd.fraisTransport, montant: cmd.fraisTransport });
    }
    if (cmd.fraisEmballage > 0) {
      lignes.push({ designation: "Emballage", unite: cmd.nbSacs ? `${cmd.nbSacs} sac·s` : "", qte: 1, pu: cmd.fraisEmballage, montant: cmd.fraisEmballage });
    }
    return lignes;
  };

  // Génère automatiquement un reçu de paiement (visible et imprimable côté gérant ET côté client)
  const genererRecuAuto = (clientId, commandeId, lignes, total, montantRecu, resteApres, moyen) => {
    const recu = {
      id: "d" + Date.now() + Math.random().toString(36).slice(2, 6),
      type: "recu",
      numero: prochainNumero(documents, "recu"),
      clientId, commandeId,
      date: todayISO(),
      lignes, total,
      montantRecu, resteApres,
      moyenPaiement: moyen,
      statut: resteApres > 0 ? "partiel" : "payé",
    };
    updateDocuments([...documents, recu]);
  };

  // Enregistre un encaissement, met à jour le statut et émet le reçu automatiquement.
  // Le signalement client est remis à zéro : s'il reste un solde, il pourra signaler son prochain versement.
  const encaisser = (cmdId, montant, moyen) => {
    const cmd = commandes.find((c) => c.id === cmdId);
    if (!cmd) return;
    const total = montantCommande(cmd);
    const paiements = [...(cmd.paiements || []), { montant: Number(montant), moyen, date: todayISO() }];
    const paye = Math.min(total, paiements.reduce((s, p) => s + Number(p.montant || 0), 0));
    const statut = paye >= total ? "payé" : paye > 0 ? "partiel" : "impayé";
    updateCommandes(commandes.map((c) => c.id === cmdId ? { ...c, paiements, statut, paiementSignale: false } : c));

    genererRecuAuto(cmd.clientId, cmd.id, lignesDeCommande(cmd), total, Number(montant), Math.max(0, total - paye), moyen);
    notifierGerant("Paiement reçu", `Paiement de ${fcfa(Number(montant))} reçu de ${nomClient(cmd.clientId)} (${moyen}). Reste à payer : ${fcfa(Math.max(0, total - paye))}.`);
  };

  // Encaissement global sur le solde d'un client : le montant est réparti
  // automatiquement sur ses commandes non soldées, de la plus ancienne à la plus récente.
  // Un reçu unique est émis, détaillant la répartition du versement.
  const encaisserSurSolde = (clientId, montant, moyen) => {
    let restant = Number(montant);
    const next = commandes.map((c) => ({ ...c }));
    const dettes = next
      .filter((c) => c.clientId === clientId && montantReste(c) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const soldeAvant = dettes.reduce((s, c) => s + montantReste(c), 0);
    const lignesRecu = [];
    for (const c of dettes) {
      if (restant <= 0) break;
      const reste = montantReste(c);
      const verse = Math.min(restant, reste);
      restant -= verse;
      c.paiements = [...(c.paiements || []), { montant: verse, moyen, date: todayISO() }];
      const total = montantCommande(c);
      const paye = Math.min(total, c.paiements.reduce((s, p) => s + Number(p.montant || 0), 0));
      c.statut = paye >= total ? "payé" : paye > 0 ? "partiel" : "impayé";
      c.paiementSignale = false;
      lignesRecu.push({
        designation: `Versement — commande du ${fmtDate(c.date)}${c.statut === "payé" ? " (soldée)" : ""}`,
        unite: "", qte: 1, pu: verse, montant: verse,
      });
    }
    updateCommandes(next);
    genererRecuAuto(clientId, null, lignesRecu, soldeAvant, Number(montant), Math.max(0, soldeAvant - Number(montant)), moyen);
    notifierGerant("Paiement reçu", `Versement de ${fcfa(Number(montant))} reçu de ${nomClient(clientId)} (${moyen}), réparti sur son solde. Reste à payer : ${fcfa(Math.max(0, soldeAvant - Number(montant)))}.`);
  };

  const nomClient = (id) => clients.find((c) => c.id === id)?.nom || "—";
  const nomProduit = (id) => produits.find((p) => p.id === id)?.nom || "—";

  /* ---------- KPI dashboard ---------- */
  const totalDu = commandes.reduce((s, c) => s + montantReste(c), 0);
  const nbImpayes = commandes.filter((c) => c.statut === "impayé").length;
  const nbEnAttente = commandes.filter((c) => c.statut !== "payé").length;
  const ventesTotal = commandes.reduce((s, c) => s + montantCommande(c), 0);
  const stockTotal = produits.reduce((s, p) => s + p.stock, 0);
  const nbSignales = commandes.filter((c) => c.paiementSignale && c.statut !== "payé").length;
  const nbEnRetard = commandes.filter((c) => montantReste(c) > 0 && c.jourPaiement < todayISO()).length;
  const montantEnRetard = commandes.filter((c) => montantReste(c) > 0 && c.jourPaiement < todayISO()).reduce((s, c) => s + montantReste(c), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="flex flex-col items-center gap-3">
          <ClaieBadge size={56}><Leaf size={24} /></ClaieBadge>
          <span className="text-sm" style={{ color: C.inkSoft }}>Chargement…</span>
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <LoginScreen
        clients={clients}
        pin={pin}
        recup={recup}
        onResetPin={updatePin}
        onLogin={(a) => {
          setAuth(a);
          if (a.role === "client") {
            setActiveClientId(a.clientId);
            setMode("client");
          } else {
            setMode("gerant");
            setSection("dashboard");
          }
        }}
      />
    );
  }

  const logout = () => { setAuth(null); setMode("gerant"); setMenuOpen(false); };

  return (
    <div className="min-h-screen flex" style={{
      background: C.bg,
      backgroundImage: `radial-gradient(circle, rgba(36,26,21,0.05) 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
        * { font-family: 'Public Sans', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {mode === "gerant" ? (
        <>
          {/* BARRE MOBILE */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
            style={{ background: C.ink, color: "#F5F1E6" }}>
            <div className="flex items-center gap-2.5">
              <ClaieBadge size={34}><Leaf size={15} /></ClaieBadge>
              <div>
                <div className="font-bold text-sm leading-none" style={{ fontFamily: "'Fraunces', serif" }}>HÉLÈNE</div>
                <div className="text-[10px] opacity-60">Multiservices · Attiéké</div>
              </div>
            </div>
            <button onClick={() => setMenuOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: C.green, color: "#fff" }}>
              Menu <ChevronRight size={14} />
            </button>
          </div>

          {/* MENU MOBILE PLEIN ÉCRAN */}
          {menuOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex flex-col p-5 overflow-y-auto"
              style={{ background: C.ink, color: "#F5F1E6" }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <ClaieBadge size={38}><Leaf size={16} /></ClaieBadge>
                  <div className="font-bold" style={{ fontFamily: "'Fraunces', serif" }}>HÉLÈNE Multiservices</div>
                </div>
                <button onClick={() => setMenuOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.12)" }}>
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-5">
                {NAV.map((g) => (
                  <div key={g.group}>
                    <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2 px-2">{g.group}</div>
                    <div className="space-y-1">
                      {g.items.map((it) => {
                        const Icon = it.icon;
                        const active = section === it.id;
                        return (
                          <button key={it.id}
                            onClick={() => { setSection(it.id); setMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition"
                            style={{ background: active ? C.green : "rgba(255,255,255,0.05)", color: active ? "#fff" : "#E7DFCF", fontWeight: active ? 600 : 500 }}>
                            <Icon size={17} /> {it.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <button onClick={() => { setMode("client"); setMenuOpen(false); }}
                className="mt-5 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold"
                style={{ background: C.gold, color: "#2A1D08" }}>
                <Store size={16} /> Aperçu espace client
              </button>
              <button onClick={logout}
                className="mt-2 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.1)", color: "#E7DFCF" }}>
                <LogOut size={16} /> Se déconnecter
              </button>
            </div>
          )}

          {/* SIDEBAR */}
          <aside className="w-64 shrink-0 hidden md:flex flex-col p-5" style={{ background: C.ink, color: "#F5F1E6" }}>
            <div className="flex items-center gap-3 mb-8">
              <ClaieBadge size={42}><Leaf size={18} /></ClaieBadge>
              <div>
                <div className="font-bold text-lg leading-none" style={{ fontFamily: "'Fraunces', serif" }}>HÉLÈNE</div>
                <div className="text-xs opacity-60">Multiservices · Attiéké</div>
              </div>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto">
              {NAV.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2 px-2">{g.group}</div>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      const active = section === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => setSection(it.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition"
                          style={{ background: active ? C.green : "transparent", color: active ? "#fff" : "#E7DFCF", fontWeight: active ? 600 : 500 }}
                        >
                          <Icon size={16} /> {it.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <button
              onClick={() => setMode("client")}
              className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: C.gold, color: "#2A1D08" }}
            >
              <Store size={16} /> Aperçu espace client
            </button>
            <button
              onClick={logout}
              className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.1)", color: "#E7DFCF" }}
            >
              <LogOut size={16} /> Se déconnecter
            </button>
          </aside>

          {/* CONTENU GÉRANT */}
          <main className="flex-1 p-6 md:p-8 pt-20 md:pt-8 overflow-y-auto">
            {section === "dashboard" && (
              <div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Tableau de bord</h1>
                <p className="text-sm mb-6" style={{ color: C.inkSoft }}>Vue d'ensemble de l'activité — {fmtDate(todayISO())}</p>

                {/* Centre de notifications */}
                <button onClick={() => setShowNotifs(!showNotifs)}
                  className="w-full mb-4 rounded-2xl p-4 flex items-center justify-between text-left"
                  style={{ background: nbNonLues > 0 ? C.greenSoft : C.card, border: `1px solid ${nbNonLues > 0 ? C.green : C.border}` }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <div className="text-sm font-bold" style={{ color: C.ink }}>
                        Notifications{nbNonLues > 0 ? ` — ${nbNonLues} nouvelle(s)` : ""}
                      </div>
                      <div className="text-xs" style={{ color: C.inkSoft }}>Commandes et paiements signalés par vos clients</div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: C.inkSoft, transform: showNotifs ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                </button>

                {showNotifs && (
                  <div className="rounded-2xl overflow-hidden mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {notifs.length === 0 ? (
                      <div className="p-4 text-sm text-center" style={{ color: C.inkSoft }}>Aucune notification pour l'instant.</div>
                    ) : (
                      <>
                        {notifs.slice(0, 15).map((n) => (
                          <div key={n.id} className="p-3.5 flex items-start gap-2" style={{ borderBottom: `1px solid ${C.border}`, background: n.lu ? "transparent" : C.greenSoft }}>
                            {!n.lu && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: C.green }} />}
                            <div className="min-w-0">
                              <div className="text-sm" style={{ color: C.ink, fontWeight: n.lu ? 400 : 600 }}>{n.message}</div>
                              <div className="text-[11px]" style={{ color: C.inkSoft }}>
                                {new Date(n.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))}
                        {nbNonLues > 0 && (
                          <button onClick={() => updateNotifs(notifs.map((n) => ({ ...n, lu: true })))}
                            className="w-full p-3 text-xs font-semibold" style={{ color: C.greenDeep, background: C.bg }}>
                            Tout marquer comme lu
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {nbSignales > 0 && (
                  <button onClick={() => setSection("commandes")}
                    className="w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left"
                    style={{ background: C.goldSoft, border: `1px solid ${C.gold}` }}>
                    <AlertCircle size={20} style={{ color: "#8A5D14" }} />
                    <div>
                      <div className="text-sm font-bold" style={{ color: "#8A5D14" }}>{nbSignales} paiement(s) signalé(s) par des clients</div>
                      <div className="text-xs" style={{ color: "#8A5D14" }}>Touche ici pour vérifier et confirmer dans Commandes</div>
                    </div>
                  </button>
                )}
                {nbEnRetard > 0 && (
                  <button onClick={() => setSection("commandes")}
                    className="w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left"
                    style={{ background: C.chiliSoft, border: `1px solid ${C.chili}` }}>
                    <Clock size={20} style={{ color: C.chili }} />
                    <div>
                      <div className="text-sm font-bold" style={{ color: C.chili }}>{nbEnRetard} commande(s) en retard de paiement — {fcfa(montantEnRetard)}</div>
                      <div className="text-xs" style={{ color: C.chili }}>L'échéance convenue est dépassée. Touche ici pour voir et relancer.</div>
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <KPI icon={TrendingUp} label="Ventes totales" value={fcfa(ventesTotal)} sub={`${commandes.length} commandes`} tone="green" />
                  <KPI icon={AlertCircle} label="Impayés" value={fcfa(totalDu)} sub={`${nbImpayes} facture(s) impayée(s)`} tone="chili" />
                  <KPI icon={Clock} label="À livrer" value={commandes.filter((c) => !c.livree).length} sub="commandes en préparation" tone="gold" />
                  <KPI icon={Package} label="Ventes du jour" value={fcfa(commandes.filter((c) => c.date === todayISO()).reduce((s, c) => s + montantCommande(c), 0))} sub={`${commandes.filter((c) => c.date === todayISO()).length} commande(s) aujourd'hui`} tone="green" />
                </div>

                {/* Statistiques : meilleurs clients et produits */}
                {commandes.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="font-bold mb-3 text-sm" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>🏆 Meilleurs clients</h3>
                      {clients
                        .map((cl) => ({ cl, ca: commandes.filter((c) => c.clientId === cl.id).reduce((s, c) => s + montantCommande(c), 0) }))
                        .filter((x) => x.ca > 0)
                        .sort((a, b) => b.ca - a.ca)
                        .slice(0, 3)
                        .map((x, i) => (
                          <div key={x.cl.id} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
                            <span style={{ color: C.ink }}>{["🥇", "🥈", "🥉"][i]} {x.cl.nom}</span>
                            <span className="mono font-semibold" style={{ color: C.greenDeep }}>{fcfa(x.ca)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="font-bold mb-3 text-sm" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>⭐ Produits les plus vendus</h3>
                      {(() => {
                        const compte = {};
                        commandes.forEach((c) => c.items.forEach((it) => {
                          compte[it.produitId] = (compte[it.produitId] || 0) + Number(it.qte || 0);
                        }));
                        return Object.entries(compte)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([pid, qte], i) => (
                            <div key={pid} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
                              <span style={{ color: C.ink }}>{["🥇", "🥈", "🥉"][i]} {nomProduit(pid)}</span>
                              <span className="mono font-semibold" style={{ color: C.greenDeep }}>× {qte}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <h3 className="font-bold mb-4" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Dernières commandes</h3>
                  <div className="space-y-3">
                    {commandes.slice().reverse().map((cmd) => (
                      <div key={cmd.id} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: C.ink }}>{nomClient(cmd.clientId)}</div>
                          <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(cmd.date)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="mono text-sm" style={{ color: C.ink }}>{fcfa(montantCommande(cmd))}</span>
                          <Badge statut={cmd.statut} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === "clients" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Clients</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>{clients.length} client(s) enregistré(s)</p>
                  </div>
                  <button onClick={() => setShowClientModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouveau client
                  </button>
                </div>

                <input
                  value={rechercheClients}
                  onChange={(e) => setRechercheClients(e.target.value)}
                  placeholder="Rechercher un client (nom, téléphone, adresse…)"
                  className="w-full px-4 py-2.5 rounded-xl text-sm mb-4" style={inputStyle} />

                <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  {clients
                    .filter((c) => {
                      const q = rechercheClients.trim().toLowerCase();
                      if (!q) return true;
                      return [c.nom, c.tel, c.adresse, c.type].some((v) => (v || "").toLowerCase().includes(q));
                    })
                    .map((c) => {
                    const cmds = commandes.filter((o) => o.clientId === c.id);
                    const du = cmds.reduce((s, o) => s + montantReste(o), 0);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className="flex items-center gap-3">
                          {c.photo ? (
                            <img src={c.photo} alt={c.nom} className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: `2px solid ${C.green}` }} />
                          ) : (
                            <ClaieBadge size={38}><Users size={16} /></ClaieBadge>
                          )}
                          <div>
                            <div className="font-semibold text-sm" style={{ color: C.ink }}>{c.nom}</div>
                            <div className="text-xs" style={{ color: C.inkSoft }}>{c.tel} · {c.adresse} · {c.type}</div>
                            <button onClick={() => setClientEdit(c)}
                              className="mt-1.5 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                              style={{ background: C.greenSoft, color: C.greenDeep }}>
                              <UserCog size={11} /> Modifier
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs" style={{ color: C.inkSoft }}>{cmds.length} commande(s)</div>
                            <div className="mono text-sm font-semibold" style={{ color: du > 0 ? C.chili : C.green }}>
                              {du > 0 ? `Doit ${fcfa(du)}` : "À jour"}
                            </div>
                            {du > 0 && (
                              <button
                                onClick={() => setEncaisserClient({ client: c, du })}
                                className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ml-auto"
                                style={{ background: C.greenSoft, color: C.greenDeep }}>
                                <Wallet size={11} /> Encaisser
                              </button>
                            )}
                            {cmds.length > 0 && (
                              <button
                                onClick={() => setReleveClient(c)}
                                className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ml-auto"
                                style={{ background: C.bgAlt, color: C.ink }}>
                                <FileText size={11} /> Relevé
                              </button>
                            )}
                            {c.motDePasse && (
                              <button
                                onClick={() => setConfirmation({
                                  message: `Réinitialiser le mot de passe de ${c.nom} ? Il se connectera à nouveau avec son numéro de téléphone.`,
                                  action: () => updateClients(clients.map((x) => x.id === c.id ? { ...x, motDePasse: undefined } : x)),
                                })}
                                className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ml-auto"
                                style={{ background: C.chiliSoft, color: C.chili }}>
                                <Lock size={11} /> Réinit. mot de passe
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (cmds.length > 0) {
                                setConfirmation({ message: `Impossible de supprimer ${c.nom} : ce client a ${cmds.length} commande(s) enregistrée(s).` });
                                return;
                              }
                              setConfirmation({
                                message: `Supprimer le client ${c.nom} ?`,
                                action: () => updateClients(clients.filter((x) => x.id !== c.id)),
                              });
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: C.chiliSoft, color: C.chili }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {section === "produits" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Produits</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>Catalogue attiéké</p>
                  </div>
                  <button onClick={() => setShowProduitModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouveau produit
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {produits.map((p) => (
                    <div key={p.id} className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <div className="flex items-start justify-between">
                        <div className="text-3xl mb-3">{p.emoji}</div>
                        <button
                          onClick={() => setConfirmation({
                            message: `Supprimer le produit "${p.nom}" ?`,
                            action: () => updateProduits(produits.filter((x) => x.id !== p.id)),
                          })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: C.chiliSoft, color: C.chili }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="font-semibold text-sm mb-1" style={{ color: C.ink }}>{p.nom}</div>
                      <div className="text-xs mb-3" style={{ color: C.inkSoft }}>{p.unite}</div>
                      <div className="mono font-bold" style={{ color: C.greenDeep }}>{fcfa(p.prix)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === "commandes" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Commandes</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>Suivi des commandes et paiements</p>
                  </div>
                  <button onClick={() => setShowCommandeModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouvelle commande
                  </button>
                </div>
                <input
                  value={rechercheCommandes}
                  onChange={(e) => setRechercheCommandes(e.target.value)}
                  placeholder="Rechercher un client…"
                  className="w-full px-4 py-2.5 rounded-xl text-sm mb-4" style={inputStyle} />

                {clients
                  .filter((cl) => {
                    const q = rechercheCommandes.trim().toLowerCase();
                    if (!q) return true;
                    return (cl.nom || "").toLowerCase().includes(q) || (cl.tel || "").toLowerCase().includes(q);
                  })
                  .map((cl) => ({ cl, cmds: commandes.filter((c) => c.clientId === cl.id) }))
                  .filter((g) => g.cmds.length > 0)
                  .sort((a, b) => {
                    const duA = a.cmds.reduce((s, c) => s + montantReste(c), 0);
                    const duB = b.cmds.reduce((s, c) => s + montantReste(c), 0);
                    return duB - duA; // les clients qui doivent le plus en premier
                  })
                  .map(({ cl, cmds }) => {
                    const du = cmds.reduce((s, c) => s + montantReste(c), 0);
                    return (
                      <div key={cl.id} className="rounded-2xl overflow-hidden mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                        {/* En-tête client */}
                        <div className="p-4 flex items-center justify-between gap-3" style={{ background: C.bgAlt }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <ClaieBadge size={36}><Users size={15} /></ClaieBadge>
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>{cl.nom}</div>
                              <div className="text-xs" style={{ color: C.inkSoft }}>{cmds.length} commande(s)</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="mono text-sm font-bold" style={{ color: du > 0 ? C.chili : C.green }}>
                              {du > 0 ? `Doit ${fcfa(du)}` : "À jour"}
                            </div>
                          </div>
                        </div>

                        {/* Commandes du client */}
                        {cmds.slice().sort((a, b) => b.date.localeCompare(a.date)).map((cmd) => (
                          <div key={cmd.id} className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold" style={{ color: C.ink }}>
                                  {cmd.items.map((it) => `${it.qte}× ${nomProduit(it.produitId)}`).join(", ")}
                                </div>
                                <div className="text-xs mt-1" style={{ color: C.inkSoft }}>
                                  {fmtDate(cmd.date)} · {cmd.moyenPaiement} · échéance {fmtDate(cmd.jourPaiement)}
                                  {montantReste(cmd) > 0 && cmd.jourPaiement < todayISO() && (
                                    <span className="ml-1.5 font-bold px-1.5 py-0.5 rounded" style={{ background: C.chiliSoft, color: C.chili }}>En retard</span>
                                  )}
                                </div>
                                {(cmd.fraisTransport > 0 || cmd.fraisEmballage > 0) && (
                                  <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                                    {cmd.fraisTransport > 0 && <>Transport {cmd.zone ? `(${cmd.zone.split("(")[0].trim()})` : ""} : {fcfa(cmd.fraisTransport)}</>}
                                    {cmd.fraisTransport > 0 && cmd.fraisEmballage > 0 && " · "}
                                    {cmd.fraisEmballage > 0 && <>Emballage : {fcfa(cmd.fraisEmballage)}</>}
                                  </div>
                                )}
                                {cmd.paiementSignale && cmd.statut !== "payé" && (
                                  <div className="text-xs mt-1 font-semibold flex items-center gap-1 flex-wrap" style={{ color: C.gold }}>
                                    <AlertCircle size={12} />
                                    {typeof cmd.paiementSignale === "object"
                                      ? `Le client signale un versement de ${fcfa(cmd.paiementSignale.montant)} par ${cmd.paiementSignale.moyen} — à vérifier`
                                      : "Le client signale avoir payé — à vérifier"}
                                  </div>
                                )}
                              </div>
                              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                <span className="mono text-sm font-semibold" style={{ color: C.ink }}>{fcfa(montantCommande(cmd))}</span>
                                <Badge statut={cmd.statut} />
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: cmd.livree ? C.greenSoft : C.goldSoft, color: cmd.livree ? C.greenDeep : "#8A5D14" }}>
                                  {cmd.livree ? "LIVRÉE" : "À LIVRER"}
                                </span>
                                {cmd.statut === "partiel" && (
                                  <span className="text-[11px] mono" style={{ color: C.gold }}>reste {fcfa(montantReste(cmd))}</span>
                                )}
                              </div>
                            </div>
                            {cmd.paiements && cmd.paiements.length > 0 && (
                              <div className="mt-2 rounded-lg px-3 py-2 text-[11px]" style={{ background: C.bg }}>
                                {cmd.paiements.map((p, i) => (
                                  <div key={i} className="flex justify-between py-0.5">
                                    <span style={{ color: C.inkSoft }}>{fmtDate(p.date)} · {p.moyen}</span>
                                    <span className="mono font-semibold" style={{ color: C.greenDeep }}>+ {fcfa(p.montant)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              {!cmd.livree && (
                                <button
                                  onClick={() => updateCommandes(commandes.map((c) => c.id === cmd.id ? { ...c, livree: true, dateLivraison: todayISO() } : c))}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                  style={{ background: C.gold }}>
                                  🚚 Marquer livrée
                                </button>
                              )}
                              {cmd.statut !== "payé" && (
                                <>
                                  {typeof cmd.paiementSignale === "object" && cmd.paiementSignale?.montant > 0 && (
                                    <button
                                      onClick={() => encaisser(cmd.id, Math.min(cmd.paiementSignale.montant, montantReste(cmd)), cmd.paiementSignale.moyen)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                      style={{ background: C.green }}>
                                      <Check size={12} /> Confirmer {fcfa(Math.min(cmd.paiementSignale.montant, montantReste(cmd)))}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setEncaisserCmd(cmd)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: C.goldSoft, color: "#8A5D14" }}>
                                    <Wallet size={12} /> {typeof cmd.paiementSignale === "object" ? "Montant différent" : "Encaisser un montant"}
                                  </button>
                                  <button
                                    onClick={() => encaisser(cmd.id, montantReste(cmd), cmd.moyenPaiement)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: C.greenSoft, color: C.greenDeep }}>
                                    <Check size={12} /> Solder ({fcfa(montantReste(cmd))})
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setConfirmation({
                                  message: `Supprimer la commande de ${cl.nom} (${fcfa(montantCommande(cmd))}) ? Cette action est définitive.`,
                                  action: () => updateCommandes(commandes.filter((c) => c.id !== cmd.id)),
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: C.chiliSoft, color: C.chili }}>
                                <Trash2 size={12} /> Supprimer
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Pied : encaissement global si plusieurs commandes non soldées */}
                        {du > 0 && cmds.filter((c) => montantReste(c) > 0).length > 1 && (
                          <div className="p-3" style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}>
                            <button
                              onClick={() => setEncaisserClient({ client: cl, du })}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                              style={{ background: C.green }}>
                              <Wallet size={14} /> Encaisser sur le solde total ({fcfa(du)})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {section === "factures" && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Devis & Factures</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>{documents.length} document(s) émis</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowSignatureModal(true)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: signature ? C.greenSoft : C.goldSoft, color: signature ? C.greenDeep : "#8A5D14" }}>
                      ✍️ {signature ? "Ma signature ✓" : "Ma signature"}
                    </button>
                    <button onClick={() => setShowDocModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                      <Plus size={16} /> Nouveau document
                    </button>
                  </div>
                </div>

                {/* Compteurs par type */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {Object.entries(DOC_TYPES).map(([key, t]) => {
                    const n = documents.filter((d) => d.type === key).length;
                    return (
                      <div key={key} className="rounded-2xl p-4 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                        <div className="text-xl font-bold mono" style={{ color: C.ink }}>{n}</div>
                        <div className="text-xs" style={{ color: C.inkSoft }}>{t.label}{n > 1 ? "s" : ""}</div>
                      </div>
                    );
                  })}
                </div>

                {documents.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                    <div className="flex justify-center mb-3"><ClaieBadge size={48}><FileText size={20} /></ClaieBadge></div>
                    <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Aucun document pour l'instant</p>
                    <p className="text-xs" style={{ color: C.inkSoft }}>Crée un devis, une facture ou un reçu à partir d'une commande existante.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {documents.slice().reverse().map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: doc.type === "devis" ? C.goldSoft : C.greenSoft,
                                color: doc.type === "devis" ? "#8A5D14" : C.greenDeep,
                              }}>
                              {DOC_TYPES[doc.type].label}
                            </span>
                            <span className="mono text-xs font-semibold" style={{ color: C.inkSoft }}>{doc.numero}</span>
                          </div>
                          <div className="text-sm font-semibold mt-1 truncate" style={{ color: C.ink }}>{nomClient(doc.clientId)}</div>
                          <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(doc.date)}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="mono text-sm font-semibold hidden sm:block" style={{ color: C.ink }}>{fcfa(doc.total)}</span>
                          <button onClick={() => setDocPreview(doc)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                            style={{ background: C.greenSoft, color: C.greenDeep }}>
                            <Eye size={13} /> Voir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {section === "personnel" && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Personnel</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>
                      {personnel.length} employé(s) · payé : {fcfa(paies.filter((p) => p.statut === "payé").reduce((s, p) => s + p.montant, 0))} · à verser : <span style={{ color: paies.some((p) => p.statut === "non payé") ? C.chili : C.inkSoft }}>{fcfa(paies.filter((p) => p.statut === "non payé").reduce((s, p) => s + p.montant, 0))}</span>
                    </p>
                  </div>
                  <button onClick={() => setShowPersonnelModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouvel employé
                  </button>
                </div>

                {personnel.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                    <div className="flex justify-center mb-3"><ClaieBadge size={48}><UserCog size={20} /></ClaieBadge></div>
                    <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Aucun employé enregistré</p>
                    <p className="text-xs" style={{ color: C.inkSoft }}>Ajoute ton personnel : photo, poste, salaire, contact…</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {personnel.map((p) => (
                      <div key={p.id} className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {p.photo ? (
                              <img src={p.photo} alt={p.nom}
                                className="w-12 h-12 rounded-full object-cover shrink-0"
                                style={{ border: `2px solid ${C.green}` }} />
                            ) : (
                              <ClaieBadge size={48}><UserCog size={18} /></ClaieBadge>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-sm" style={{ color: C.ink }}>{p.nom}</div>
                              <div className="text-xs" style={{ color: C.inkSoft }}>{p.poste}{p.tel ? ` · ${p.tel}` : ""}</div>
                              <div className="text-xs mt-0.5 space-y-0.5" style={{ color: C.inkSoft }}>
                                {p.adresse && <div>Adresse : {p.adresse}</div>}
                                {p.dateNaissance && <div>Né(e) le {fmtDate(p.dateNaissance)}</div>}
                                {p.cni && <div>Pièce d'identité : {p.cni}</div>}
                                {p.contactUrgence && <div>Contact d'urgence : {p.contactUrgence}</div>}
                                {p.dateEmbauche && <div>Embauché(e) le {fmtDate(p.dateEmbauche)}</div>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="mono text-sm font-semibold" style={{ color: C.greenDeep }}>{fcfa(p.salaire)}</div>
                            <div className="text-[11px]" style={{ color: C.inkSoft }}>par {(p.typePaie || "mensuel") === "journalier" ? "jour" : "mois"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button onClick={() => setPersonnelEdit(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: C.greenSoft, color: C.greenDeep }}>
                            <UserCog size={12} /> Modifier
                          </button>
                          <button onClick={() => setFicheEmploi(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: C.bgAlt, color: C.ink }}>
                            <FileText size={12} /> Fiche d'emploi
                          </button>
                          <button onClick={() => setFichePaie(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: C.bgAlt, color: C.ink }}>
                            <Receipt size={12} /> Fiche de paie
                          </button>
                          <button
                            onClick={() => setConfirmation({
                              message: `Supprimer l'employé(e) ${p.nom} ?`,
                              action: () => updatePersonnel(personnel.filter((x) => x.id !== p.id)),
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: C.chiliSoft, color: C.chili }}>
                            <Trash2 size={12} /> Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* JOURNAL DES PAIES */}
                {paies.length > 0 && (
                  <>
                    <h3 className="font-bold mt-6 mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Journal des paies</h3>
                    <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                      Chaque journée (ou mois) écoulée est enregistrée automatiquement comme payée. Touche le statut pour le changer : <span style={{ color: C.greenDeep, fontWeight: 600 }}>Payé</span> → <span style={{ color: C.chili, fontWeight: 600 }}>Non payé</span> → <span style={{ fontWeight: 600 }}>Repos</span> (journée non travaillée, non comptée).
                    </p>
                    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      {paies
                        .slice()
                        .sort((a, b) => b.periode.localeCompare(a.periode))
                        .slice(0, 30)
                        .map((pa) => {
                          const emp = personnel.find((e) => e.id === pa.employeId);
                          const libPeriode = pa.type === "mensuel"
                            ? new Date(pa.periode + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
                            : fmtDate(pa.periode);
                          const statut = pa.statut;
                          const suivant = pa.type === "journalier"
                            ? (statut === "payé" ? "non payé" : statut === "non payé" ? "repos" : "payé")
                            : (statut === "payé" ? "non payé" : "payé");
                          const styles = {
                            "payé": { bg: C.greenSoft, fg: C.greenDeep, label: "Payé ✓" },
                            "non payé": { bg: C.chiliSoft, fg: C.chili, label: "Non payé" },
                            "repos": { bg: C.bgAlt, fg: C.inkSoft, label: "Repos" },
                          };
                          const s = styles[statut] || styles["payé"];
                          return (
                            <div key={pa.id} className="p-3.5 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}`, opacity: statut === "repos" ? 0.65 : 1 }}>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{emp?.nom || "—"}</div>
                                <div className="text-xs capitalize" style={{ color: C.inkSoft }}>
                                  {libPeriode} · {pa.type === "journalier" ? "journée" : "mois"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="mono text-sm font-semibold" style={{ color: statut === "repos" ? C.inkSoft : C.ink, textDecoration: statut === "repos" ? "line-through" : "none" }}>{fcfa(pa.montant)}</span>
                                <button
                                  onClick={() => updatePaies(paies.map((x) => x.id === pa.id ? { ...x, statut: suivant } : x))}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold w-24"
                                  style={{ background: s.bg, color: s.fg }}>
                                  {s.label}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}
            {section === "materiel" && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Matériel</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>{materiel.length} équipement(s) répertorié(s)</p>
                  </div>
                  <button onClick={() => setShowMaterielModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouvel équipement
                  </button>
                </div>

                {materiel.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                    <div className="flex justify-center mb-3"><ClaieBadge size={48}><Wrench size={20} /></ClaieBadge></div>
                    <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Aucun matériel enregistré</p>
                    <p className="text-xs" style={{ color: C.inkSoft }}>Répertorie tes machines : broyeur, presse, cuiseur, bâches, bassines…</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {materiel.map((m) => {
                      const etatCouleurs = {
                        "Bon état": { bg: C.greenSoft, fg: C.greenDeep },
                        "À entretenir": { bg: C.goldSoft, fg: "#8A5D14" },
                        "En panne": { bg: C.chiliSoft, fg: C.chili },
                      };
                      const e = etatCouleurs[m.etat] || etatCouleurs["Bon état"];
                      return (
                        <div key={m.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-sm" style={{ color: C.ink }}>{m.nom}</div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: e.bg, color: e.fg }}>{m.etat}</span>
                          </div>
                          <div className="text-xs space-y-0.5" style={{ color: C.inkSoft }}>
                            <div>Quantité : {m.quantite}</div>
                            {m.valeur > 0 && <div>Valeur : <span className="mono">{fcfa(m.valeur)}</span></div>}
                            {m.dernierEntretien && <div>Dernier entretien : {fmtDate(m.dernierEntretien)}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {section === "achats" && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Achats & Ventes</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>Journal des mouvements</p>
                  </div>
                  <button onClick={() => setShowAchatModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouvel achat
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: C.inkSoft }}>Total ventes</div>
                    <div className="text-lg font-bold mono" style={{ color: C.greenDeep }}>{fcfa(ventesTotal)}</div>
                    <div className="text-xs" style={{ color: C.inkSoft }}>{commandes.length} commande(s)</div>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: C.inkSoft }}>Total achats</div>
                    <div className="text-lg font-bold mono" style={{ color: C.chili }}>{fcfa(achats.reduce((s, a) => s + a.montant, 0))}</div>
                    <div className="text-xs" style={{ color: C.inkSoft }}>{achats.length} achat(s)</div>
                  </div>
                </div>

                <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Journal des achats</h3>
                {achats.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center mb-6" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                    <p className="text-xs" style={{ color: C.inkSoft }}>Aucun achat enregistré. Note ici tes achats de manioc, sacs, gaz, intrants…</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {achats.slice().reverse().map((a) => (
                      <div key={a.id} className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{a.designation}</div>
                          <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(a.date)}{a.fournisseur ? ` · ${a.fournisseur}` : ""}</div>
                        </div>
                        <span className="mono text-sm font-semibold shrink-0" style={{ color: C.chili }}>− {fcfa(a.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Journal des ventes</h3>
                <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  {commandes.slice().reverse().map((cmd) => (
                    <div key={cmd.id} className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{nomClient(cmd.clientId)}</div>
                        <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(cmd.date)} · {cmd.items.map((it) => `${it.qte}× ${nomProduit(it.produitId)}`).join(", ")}</div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="mono text-sm font-semibold" style={{ color: C.greenDeep }}>+ {fcfa(montantCommande(cmd))}</span>
                        <Badge statut={cmd.statut} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {section === "depenses" && (
              <div>
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Dépenses & Entretiens</h1>
                    <p className="text-sm" style={{ color: C.inkSoft }}>Total : {fcfa(depenses.reduce((s, d) => s + d.montant, 0))}</p>
                  </div>
                  <button onClick={() => setShowDepenseModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                    <Plus size={16} /> Nouvelle dépense
                  </button>
                </div>

                {/* Totaux par catégorie */}
                {depenses.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {["Entretien matériel", "Eau / Électricité", "Transport", "Autre"].map((cat) => {
                      const tot = depenses.filter((d) => d.categorie === cat).reduce((s, d) => s + d.montant, 0);
                      return (
                        <div key={cat} className="rounded-2xl p-3 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                          <div className="mono text-sm font-bold" style={{ color: C.ink }}>{fcfa(tot)}</div>
                          <div className="text-[11px]" style={{ color: C.inkSoft }}>{cat}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {depenses.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                    <div className="flex justify-center mb-3"><ClaieBadge size={48}><Receipt size={20} /></ClaieBadge></div>
                    <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>Aucune dépense enregistrée</p>
                    <p className="text-xs" style={{ color: C.inkSoft }}>Note ici les entretiens du matériel, l'eau, l'électricité, le transport et toutes tes autres dépenses.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {depenses.slice().reverse().map((d) => (
                      <div key={d.id} className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: C.ink }}>{d.designation}</div>
                          <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(d.date)} · {d.categorie}</div>
                        </div>
                        <span className="mono text-sm font-semibold shrink-0" style={{ color: C.chili }}>− {fcfa(d.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {section === "compta" && (() => {
              const totalAchats = achats.reduce((s, a) => s + a.montant, 0);
              const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0);
              const salairesPayes = paies.filter((p) => p.statut === "payé").reduce((s, p) => s + p.montant, 0);
              const salairesDus = paies.filter((p) => p.statut === "non payé").reduce((s, p) => s + p.montant, 0);
              const encaisse = commandes.reduce((s, c) => s + montantPaye(c), 0);
              const sorties = totalAchats + totalDepenses + salairesPayes;
              const resultat = encaisse - sorties;

              // Regroupement par mois (encaissements réels et sorties)
              const mois = {};
              commandes.forEach((c) => {
                (c.paiements || []).forEach((p) => {
                  const k = p.date.slice(0, 7);
                  mois[k] = mois[k] || { in: 0, out: 0 };
                  mois[k].in += Number(p.montant || 0);
                });
                if ((!c.paiements || c.paiements.length === 0) && c.statut === "payé") {
                  const k = c.date.slice(0, 7);
                  mois[k] = mois[k] || { in: 0, out: 0 };
                  mois[k].in += montantCommande(c);
                }
              });
              achats.forEach((a) => {
                const k = a.date.slice(0, 7);
                mois[k] = mois[k] || { in: 0, out: 0 };
                mois[k].out += a.montant;
              });
              depenses.forEach((d) => {
                const k = d.date.slice(0, 7);
                mois[k] = mois[k] || { in: 0, out: 0 };
                mois[k].out += d.montant;
              });
              paies.filter((p) => p.statut === "payé").forEach((p) => {
                const k = p.periode.slice(0, 7);
                mois[k] = mois[k] || { in: 0, out: 0 };
                mois[k].out += p.montant;
              });
              const moisTries = Object.keys(mois).sort().reverse();
              const nomMois = (k) => new Date(k + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

              return (
                <div>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
                    <h1 className="text-2xl font-bold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Comptabilité</h1>
                    <button onClick={() => setShowRapport(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                      <Printer size={15} /> Rapport imprimable
                    </button>
                  </div>
                  <p className="text-sm mb-6" style={{ color: C.inkSoft }}>Bilan consolidé de toute l'activité</p>

                  {/* Résultat */}
                  <div className="rounded-2xl p-6 mb-6 text-center"
                    style={{ background: resultat >= 0 ? C.greenSoft : C.chiliSoft, border: `1px solid ${resultat >= 0 ? C.green : C.chili}` }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: resultat >= 0 ? C.greenDeep : C.chili }}>
                      {resultat >= 0 ? "Bénéfice" : "Perte"}
                    </div>
                    <div className="text-3xl font-bold mono" style={{ color: resultat >= 0 ? C.greenDeep : C.chili, fontFamily: "'Fraunces', serif" }}>
                      {fcfa(Math.abs(resultat))}
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.inkSoft }}>Encaissé − (achats + dépenses + salaires)</div>
                  </div>

                  {/* Détail entrées / sorties */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="font-bold mb-3 text-sm" style={{ color: C.greenDeep }}>ENTRÉES</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Ventes encaissées</span><span className="mono font-semibold" style={{ color: C.greenDeep }}>{fcfa(encaisse)}</span></div>
                        <div className="flex justify-between text-xs pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
                          <span style={{ color: C.inkSoft }}>En attente (impayés/partiels)</span>
                          <span className="mono" style={{ color: C.gold }}>{fcfa(totalDu)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="font-bold mb-3 text-sm" style={{ color: C.chili }}>SORTIES</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Achats</span><span className="mono" style={{ color: C.ink }}>{fcfa(totalAchats)}</span></div>
                        <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Dépenses & entretiens</span><span className="mono" style={{ color: C.ink }}>{fcfa(totalDepenses)}</span></div>
                        <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Salaires versés</span><span className="mono" style={{ color: C.ink }}>{fcfa(salairesPayes)}</span></div>
                        {salairesDus > 0 && (
                          <div className="flex justify-between text-xs"><span style={{ color: C.chili }}>Salaires non versés (dus)</span><span className="mono" style={{ color: C.chili }}>{fcfa(salairesDus)}</span></div>
                        )}
                        <div className="flex justify-between pt-2 font-bold" style={{ borderTop: `1px solid ${C.border}` }}>
                          <span style={{ color: C.ink }}>Total sorties</span><span className="mono" style={{ color: C.chili }}>{fcfa(sorties)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Par mois */}
                  {moisTries.length > 0 && (
                    <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="font-bold mb-4" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Détail par mois</h3>
                      <div className="space-y-3">
                        {moisTries.map((k) => {
                          const m = mois[k];
                          const solde = m.in - m.out;
                          return (
                            <div key={k} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                              <div>
                                <div className="text-sm font-semibold capitalize" style={{ color: C.ink }}>{nomMois(k)}</div>
                                <div className="text-xs" style={{ color: C.inkSoft }}>
                                  <span style={{ color: C.greenDeep }}>+ {fcfa(m.in)}</span> · <span style={{ color: C.chili }}>− {fcfa(m.out)}</span>
                                </div>
                              </div>
                              <span className="mono text-sm font-bold" style={{ color: solde >= 0 ? C.greenDeep : C.chili }}>
                                {solde >= 0 ? "+" : "−"} {fcfa(Math.abs(solde))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {section === "parametres" && (
              <ParametresSection
                key={entrepriseV}
                signature={signature}
                onOpenSignature={() => setShowSignatureModal(true)}
                pin={pin}
                onSavePin={updatePin}
                onSaveEntreprise={updateEntreprise}
                recup={recup}
                onSaveRecup={updateRecup}
                onExport={exporterDonnees}
                onImport={importerDonnees}
              />
            )}
          </main>
        </>
      ) : (
        <ClientPortal
          clients={clients} produits={produits} commandes={commandes} documents={documents}
          activeClientId={activeClientId} setActiveClientId={setActiveClientId}
          montantCommande={montantCommande} montantReste={montantReste} nomProduit={nomProduit}
          updateCommandes={updateCommandes} updateClients={updateClients}
          signature={signature}
          ajouterNotif={ajouterNotif}
          isGerant={auth.role === "gerant"}
          onExit={auth.role === "gerant" ? () => setMode("gerant") : logout}
        />
      )}

      {(showClientModal || clientEdit) && (
        <ClientModal
          initial={clientEdit}
          onClose={() => { setShowClientModal(false); setClientEdit(null); }}
          onSave={(c) => {
            if (clientEdit) {
              updateClients(clients.map((x) => x.id === c.id ? c : x));
            } else {
              updateClients([...clients, c]);
            }
            setShowClientModal(false); setClientEdit(null);
          }} />
      )}
      {showProduitModal && (
        <AddProduitModal onClose={() => setShowProduitModal(false)} onSave={(p) => { updateProduits([...produits, p]); setShowProduitModal(false); }} />
      )}
      {showCommandeModal && (
        <AddCommandeModal clients={clients} produits={produits} onClose={() => setShowCommandeModal(false)}
          onSave={(c) => {
              updateCommandes([...commandes, c]);
              setShowCommandeModal(false);
              notifierGerant("Nouvelle commande", `Nouvelle commande de ${nomClient(c.clientId)} : ${fcfa(montantCommande(c))} (${c.statut}).`);
            }} />
      )}
      {showDocModal && (
        <AddDocModal
          clients={clients} produits={produits} commandes={commandes} documents={documents}
          montantCommande={montantCommande} nomClient={nomClient} nomProduit={nomProduit}
          onClose={() => setShowDocModal(false)}
          onSave={(d) => { updateDocuments([...documents, d]); setShowDocModal(false); setDocPreview(d); }}
        />
      )}
      {docPreview && (
        <DocPreviewModal doc={docPreview} client={clients.find((c) => c.id === docPreview.clientId)} signature={signature} onClose={() => setDocPreview(null)} />
      )}
      {showSignatureModal && (
        <SignatureModal
          signature={signature}
          onClose={() => setShowSignatureModal(false)}
          onSave={(s) => { updateSignature(s); setShowSignatureModal(false); }} />
      )}
      {ficheEmploi && (
        <FicheEmploiModal emp={ficheEmploi} signature={signature} onClose={() => setFicheEmploi(null)} />
      )}
      {fichePaie && (
        <FichePaieModal emp={fichePaie} paies={paies.filter((p) => p.employeId === fichePaie.id)} signature={signature} onClose={() => setFichePaie(null)} />
      )}
      {(showPersonnelModal || personnelEdit) && (
        <PersonnelModal
          initial={personnelEdit}
          onClose={() => { setShowPersonnelModal(false); setPersonnelEdit(null); }}
          onSave={(p, modeSalaire) => {
            if (personnelEdit) {
              updatePersonnel(personnel.map((x) => x.id === p.id ? p : x));
              // Répercussion sur les paies de cet employé :
              // - lignes d'un type qui ne correspond plus : supprimées (régénérées au bon format)
              // - correction : tout l'historique recalculé au nouveau montant
              // - augmentation : seules les paies à partir d'aujourd'hui (ou du mois en cours) changent
              const aujourdHui = todayISO();
              const moisCourant = aujourdHui.slice(0, 7);
              const nouvellesPaies = paies
                .filter((pa) => pa.employeId !== p.id || pa.type === (p.typePaie || "mensuel"))
                .map((pa) => {
                  if (pa.employeId !== p.id) return pa;
                  const concerne = modeSalaire === "correction"
                    || (pa.type === "journalier" && pa.periode >= aujourdHui)
                    || (pa.type === "mensuel" && pa.periode >= moisCourant);
                  return concerne ? { ...pa, montant: Number(p.salaire) || 0 } : pa;
                });
              updatePaies(nouvellesPaies);
            } else {
              updatePersonnel([...personnel, p]);
            }
            setShowPersonnelModal(false); setPersonnelEdit(null);
          }} />
      )}
      {showMaterielModal && (
        <AddMaterielModal onClose={() => setShowMaterielModal(false)}
          onSave={(m) => { updateMateriel([...materiel, m]); setShowMaterielModal(false); }} />
      )}
      {showAchatModal && (
        <AddAchatModal onClose={() => setShowAchatModal(false)}
          onSave={(a) => { updateAchats([...achats, a]); setShowAchatModal(false); }} />
      )}
      {showDepenseModal && (
        <AddDepenseModal onClose={() => setShowDepenseModal(false)}
          onSave={(d) => { updateDepenses([...depenses, d]); setShowDepenseModal(false); }} />
      )}
      {showRapport && (
        <RapportModal
          commandes={commandes} achats={achats} depenses={depenses} personnel={personnel} paies={paies}
          clients={clients} montantCommande={montantCommande} nomClient={nomClient}
          montantPaye={montantPaye} montantReste={montantReste}
          onClose={() => setShowRapport(false)} />
      )}
      {encaisserCmd && (
        <EncaisserModal
          cmd={encaisserCmd}
          reste={montantReste(encaisserCmd)}
          clientNom={nomClient(encaisserCmd.clientId)}
          onClose={() => setEncaisserCmd(null)}
          onEncaisser={(montant, moyen) => { encaisser(encaisserCmd.id, montant, moyen); setEncaisserCmd(null); }}
        />
      )}
      {encaisserClient && (
        <EncaisserSoldeModal
          client={encaisserClient.client}
          du={encaisserClient.du}
          commandes={commandes.filter((c) => c.clientId === encaisserClient.client.id && montantReste(c) > 0).sort((a, b) => a.date.localeCompare(b.date))}
          montantReste={montantReste}
          nomProduit={nomProduit}
          onClose={() => setEncaisserClient(null)}
          onEncaisser={(montant, moyen) => { encaisserSurSolde(encaisserClient.client.id, montant, moyen); setEncaisserClient(null); }}
        />
      )}
      {releveClient && (
        <ReleveModal
          client={releveClient}
          commandes={commandes.filter((c) => c.clientId === releveClient.id).sort((a, b) => a.date.localeCompare(b.date))}
          montantCommande={montantCommande} montantPaye={montantPaye} montantReste={montantReste}
          nomProduit={nomProduit}
          onClose={() => setReleveClient(null)} />
      )}
      {confirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(36,26,21,0.5)" }}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: C.card }}>
            <p className="text-sm mb-5 text-center" style={{ color: C.ink }}>{confirmation.message}</p>
            {confirmation.action ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmation(null)}
                  className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.bgAlt, color: C.ink }}>
                  Annuler
                </button>
                <button onClick={() => { confirmation.action(); setConfirmation(null); }}
                  className="py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.chili }}>
                  Confirmer
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmation(null)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
                Compris
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   MODALES GÉRANT
--------------------------------------------------------- */
function ClientModal({ initial, onClose, onSave }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [tel, setTel] = useState(initial?.tel || "");
  const [adresse, setAdresse] = useState(initial?.adresse || "");
  const [type, setType] = useState(initial?.type || "Particulier");
  const [photo, setPhoto] = useState(initial?.photo || "");

  const chargerPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 240;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={initial ? "Modifier le client" : "Nouveau client"} onClose={onClose}>
      {/* Photo */}
      <div className="flex flex-col items-center mb-4">
        {photo ? (
          <img src={photo} alt="Photo" className="w-20 h-20 rounded-full object-cover mb-2" style={{ border: `2px solid ${C.green}` }} />
        ) : (
          <div className="mb-2"><ClaieBadge size={80}><Users size={30} /></ClaieBadge></div>
        )}
        <label className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: C.greenSoft, color: C.greenDeep }}>
          {photo ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" onChange={chargerPhoto} className="hidden" />
        </label>
        {photo && (
          <button onClick={() => setPhoto("")} className="text-[11px] mt-1" style={{ color: C.chili }}>Retirer la photo</button>
        )}
      </div>

      <Field label="Nom"><input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Téléphone (sert de clé de connexion du client)"><input value={tel} onChange={(e) => setTel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Adresse"><input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Particulier</option><option>Revendeur</option>
        </select>
      </Field>
      <button disabled={!nom} onClick={() => onSave({ id: initial?.id || "c" + Date.now(), nom, tel, adresse, type, photo })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        {initial ? "Enregistrer les modifications" : "Enregistrer"}
      </button>
    </Modal>
  );
}

function AddProduitModal({ onClose, onSave }) {
  const [nom, setNom] = useState(""); const [unite, setUnite] = useState("sac 25kg");
  const [prix, setPrix] = useState(""); const [stock, setStock] = useState("");
  return (
    <Modal title="Nouveau produit" onClose={onClose}>
      <Field label="Nom"><input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Unité"><input value={unite} onChange={(e) => setUnite(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Prix (FCFA)"><input type="number" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <button disabled={!nom || !prix} onClick={() => onSave({ id: "p" + Date.now(), nom, unite, prix: Number(prix), stock: 0, emoji: "🌾" })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Enregistrer
      </button>
    </Modal>
  );
}

function AddCommandeModal({ clients, produits, onClose, onSave }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [items, setItems] = useState([{ produitId: produits[0]?.id || "", qte: 1 }]);
  const [statut, setStatut] = useState("impayé");
  const [moyen, setMoyen] = useState("Espèces");
  const [jour, setJour] = useState(todayISO());
  const [zoneId, setZoneId] = useState("bouafle");
  const [emballage, setEmballage] = useState(false);
  const [nbSacsManuel, setNbSacsManuel] = useState(null); // null = automatique
  const [fraisTransportManuel, setFraisTransportManuel] = useState(null); // null = automatique
  const [fraisEmballageManuel, setFraisEmballageManuel] = useState(null); // null = automatique

  const addLigne = () => setItems([...items, { produitId: produits[0]?.id || "", qte: 1 }]);
  const updateLigne = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const removeLigne = (i) => setItems(items.filter((_, idx) => idx !== i));

  const zone = ZONES_LIVRAISON.find((z) => z.id === zoneId);
  const nbSacsAuto = compterSacs(items, produits);
  const nbSacs = nbSacsManuel !== null ? Number(nbSacsManuel) : nbSacsAuto;
  const fraisTransportAuto = zone.tarif * nbSacs;
  const fraisEmballageAuto = emballage ? TARIF_EMBALLAGE * nbSacs : 0;
  const fraisTransport = fraisTransportManuel !== null ? Number(fraisTransportManuel) : fraisTransportAuto;
  const fraisEmballage = fraisEmballageManuel !== null ? Number(fraisEmballageManuel) : fraisEmballageAuto;
  const sousTotal = items.reduce((s, it) => {
    const p = produits.find((x) => x.id === it.produitId);
    return s + (p ? p.prix * Number(it.qte || 0) : 0);
  }, 0);

  return (
    <Modal title="Nouvelle commande" onClose={onClose}>
      <Field label="Client">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Field>

      <div className="mb-3">
        <span className="block text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>Produits</span>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <select value={it.produitId} onChange={(e) => updateLigne(i, "produitId", e.target.value)} className="flex-1 px-2 py-2 rounded-lg text-sm" style={inputStyle}>
              {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <input type="number" min="1" value={it.qte} onChange={(e) => updateLigne(i, "qte", Number(e.target.value))} className="w-16 px-2 py-2 rounded-lg text-sm" style={inputStyle} />
            <button onClick={() => removeLigne(i)} className="w-9 rounded-lg flex items-center justify-center" style={{ background: C.chiliSoft, color: C.chili }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addLigne} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.green }}><Plus size={12} /> Ajouter une ligne</button>
      </div>

      {/* Livraison & emballage */}
      <Field label="Livraison (transport par sac)">
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          {ZONES_LIVRAISON.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={emballage} onChange={(e) => setEmballage(e.target.checked)}
          className="w-4 h-4" style={{ accentColor: C.green }} />
        <span className="text-sm" style={{ color: C.ink }}>Emballage ({fcfa(TARIF_EMBALLAGE)}/sac)</span>
      </label>
      {(zone.tarif > 0 || emballage) && (
        <Field label={`Nombre de sacs (détecté automatiquement : ${nbSacsAuto})`}>
          <input type="number" min="0" value={nbSacs}
            onChange={(e) => setNbSacsManuel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </Field>
      )}
{zone.tarif > 0 && (
        <Field label={`Frais de transport — FCFA (calculé : ${fcfa(fraisTransportAuto)})`}>
          <div className="flex gap-2">
            <input type="number" min="0" value={fraisTransport}
              onChange={(e) => setFraisTransportManuel(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            {fraisTransportManuel !== null && (
              <button onClick={() => setFraisTransportManuel(null)}
                className="px-3 rounded-lg text-xs font-semibold" style={{ background: C.bgAlt, color: C.inkSoft }}>
                Auto
              </button>
            )}
          </div>
        </Field>
      )}
      {emballage && (
        <Field label={`Frais d'emballage — FCFA (calculé : ${fcfa(fraisEmballageAuto)})`}>
          <div className="flex gap-2">
            <input type="number" min="0" value={fraisEmballage}
              onChange={(e) => setFraisEmballageManuel(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            {fraisEmballageManuel !== null && (
              <button onClick={() => setFraisEmballageManuel(null)}
                className="px-3 rounded-lg text-xs font-semibold" style={{ background: C.bgAlt, color: C.inkSoft }}>
                Auto
              </button>
            )}
          </div>
        </Field>
      )}
      {/* Récapitulatif */}
      <div className="rounded-xl p-3 mb-3 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Produits</span><span className="mono" style={{ color: C.ink }}>{fcfa(sousTotal)}</span></div>
        {fraisTransport > 0 && <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Transport ({nbSacs} sac·s)</span><span className="mono" style={{ color: C.ink }}>{fcfa(fraisTransport)}</span></div>}
        {fraisEmballage > 0 && <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Emballage ({nbSacs} sac·s)</span><span className="mono" style={{ color: C.ink }}>{fcfa(fraisEmballage)}</span></div>}
        <div className="flex justify-between pt-2 mt-1 font-bold" style={{ borderTop: `1px solid ${C.border}`, color: C.greenDeep }}>
          <span>Total</span><span className="mono">{fcfa(sousTotal + fraisTransport + fraisEmballage)}</span>
        </div>
      </div>

      <Field label="Statut de paiement">
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="impayé">Impayé</option><option value="partiel">Partiel</option><option value="payé">Payé</option>
        </select>
      </Field>
      <Field label="Moyen de paiement">
        <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Espèces</option><option>Mobile Money</option><option>Virement</option>
        </select>
      </Field>
      <Field label="Jour de paiement prévu"><input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>

      <button
        disabled={!clientId || items.length === 0}
        onClick={() => onSave({
          id: "o" + Date.now(), clientId, date: todayISO(), items, statut,
          moyenPaiement: moyen, jourPaiement: jour,
          zone: zone.tarif > 0 ? zone.label : null,
          nbSacs: (fraisTransport > 0 || fraisEmballage > 0) ? nbSacs : 0,
          fraisTransport, fraisEmballage,
        })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Enregistrer la commande
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------
   MODALES DOCUMENTS (devis / facture / reçu)
--------------------------------------------------------- */
function AddDocModal({ clients, produits, commandes, documents, montantCommande, nomClient, nomProduit, onClose, onSave }) {
  const [type, setType] = useState("facture");
  const [commandeId, setCommandeId] = useState(commandes[0]?.id || "");
  const [montantRecu, setMontantRecu] = useState("");

  const cmd = commandes.find((c) => c.id === commandeId);
  const total = cmd ? montantCommande(cmd) : 0;

  const creer = () => {
    if (!cmd) return;
    const lignes = cmd.items.map((it) => {
      const p = produits.find((x) => x.id === it.produitId);
      return {
        designation: p?.nom || "—",
        unite: p?.unite || "",
        qte: it.qte,
        pu: p?.prix || 0,
        montant: (p?.prix || 0) * it.qte,
      };
    });
    if (cmd.fraisTransport > 0) {
      lignes.push({ designation: `Transport${cmd.zone ? ` — ${cmd.zone.split("(")[0].trim()}` : ""}`, unite: cmd.nbSacs ? `${cmd.nbSacs} sac·s` : "", qte: 1, pu: cmd.fraisTransport, montant: cmd.fraisTransport });
    }
    if (cmd.fraisEmballage > 0) {
      lignes.push({ designation: "Emballage", unite: cmd.nbSacs ? `${cmd.nbSacs} sac·s` : "", qte: 1, pu: cmd.fraisEmballage, montant: cmd.fraisEmballage });
    }
    const doc = {
      id: "d" + Date.now(),
      type,
      numero: prochainNumero(documents, type),
      clientId: cmd.clientId,
      commandeId: cmd.id,
      date: todayISO(),
      lignes,
      total,
      montantRecu: type === "recu" ? Number(montantRecu) || total : null,
      moyenPaiement: cmd.moyenPaiement,
      statut: cmd.statut,
    };
    onSave(doc);
  };

  return (
    <Modal title="Nouveau document" onClose={onClose}>
      <Field label="Type de document">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(DOC_TYPES).map(([key, t]) => (
            <button key={key} onClick={() => setType(key)}
              className="py-2 rounded-lg text-sm font-semibold"
              style={{
                background: type === key ? C.green : C.bgAlt,
                color: type === key ? "#fff" : C.ink,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Commande concernée">
        <select value={commandeId} onChange={(e) => setCommandeId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          {commandes.slice().reverse().map((c) => (
            <option key={c.id} value={c.id}>
              {nomClient(c.clientId)} — {fmtDate(c.date)} — {fcfa(montantCommande(c))}
            </option>
          ))}
        </select>
      </Field>

      {cmd && (
        <div className="rounded-xl p-3 mb-3 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          {cmd.items.map((it, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span style={{ color: C.ink }}>{it.qte}× {nomProduit(it.produitId)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-1 font-bold" style={{ borderTop: `1px solid ${C.border}`, color: C.greenDeep }}>
            <span>Total</span><span className="mono">{fcfa(total)}</span>
          </div>
        </div>
      )}

      {type === "recu" && (
        <Field label={`Montant reçu (laisser vide = totalité : ${fcfa(total)})`}>
          <input type="number" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)}
            placeholder={String(total)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </Field>
      )}

      <button disabled={!cmd} onClick={creer}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Générer le {DOC_TYPES[type].label.toLowerCase()} ({prochainNumero(documents, type)})
      </button>
    </Modal>
  );
}

function DocPreviewModal({ doc, client, signature, onClose }) {
  const t = DOC_TYPES[doc.type];
  const reste = doc.type === "recu"
    ? (doc.resteApres !== undefined ? doc.resteApres : doc.total - doc.montantRecu)
    : null;

  const imprimer = () => {
    try { window.print(); } catch { /* impression non disponible dans cet aperçu */ }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.55)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-3 py-6">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        {/* Barre d'actions */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: C.ink }}>
          <span className="text-sm font-semibold text-white">{t.label} {doc.numero}</span>
          <div className="flex items-center gap-2">
            <button onClick={imprimer} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>
              <Printer size={13} /> Imprimer
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="p-6" style={{ color: C.ink }}>
          {/* En-tête entreprise */}
          <div className="flex items-start justify-between mb-6 pb-4" style={{ borderBottom: `2px solid ${C.green}` }}>
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.greenDeep }}>{ENTREPRISE.nom}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{ENTREPRISE.slogan}</div>
              <div className="text-xs mt-1" style={{ color: C.inkSoft }}>{ENTREPRISE.adresse} · {ENTREPRISE.tel}{ENTREPRISE.email ? " · " + ENTREPRISE.email : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: doc.type === "devis" ? C.gold : C.green }}>{t.label}</div>
              <div className="mono text-sm font-semibold">{doc.numero}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(doc.date)}</div>
            </div>
          </div>

          {/* Client */}
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: C.inkSoft }}>
              {doc.type === "devis" ? "Devis adressé à" : doc.type === "recu" ? "Reçu de" : "Facturé à"}
            </div>
            <div className="text-sm font-semibold">{client?.nom || "—"}</div>
            {client?.adresse && <div className="text-xs" style={{ color: C.inkSoft }}>{client.adresse}</div>}
            {client?.tel && <div className="text-xs" style={{ color: C.inkSoft }}>{client.tel}</div>}
          </div>

          {/* Lignes */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr style={{ background: C.bg }}>
                <th className="text-left px-2 py-2 text-xs font-bold" style={{ color: C.inkSoft }}>Désignation</th>
                <th className="text-center px-2 py-2 text-xs font-bold" style={{ color: C.inkSoft }}>Qté</th>
                <th className="text-right px-2 py-2 text-xs font-bold" style={{ color: C.inkSoft }}>P.U.</th>
                <th className="text-right px-2 py-2 text-xs font-bold" style={{ color: C.inkSoft }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {doc.lignes.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="px-2 py-2">
                    <div className="font-medium">{l.designation}</div>
                    <div className="text-[11px]" style={{ color: C.inkSoft }}>{l.unite}</div>
                  </td>
                  <td className="text-center px-2 py-2 mono">{l.qte}</td>
                  <td className="text-right px-2 py-2 mono text-xs">{Number(l.pu).toLocaleString("fr-FR")}</td>
                  <td className="text-right px-2 py-2 mono font-semibold">{Number(l.montant).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="flex flex-col items-end gap-1 mb-6">
            <div className="flex justify-between w-56 text-sm font-bold py-2 px-3 rounded-lg" style={{ background: C.greenSoft, color: C.greenDeep }}>
              <span>TOTAL</span><span className="mono">{fcfa(doc.total)}</span>
            </div>
            {doc.type === "recu" && (
              <>
                <div className="flex justify-between w-56 text-sm py-1 px-3">
                  <span style={{ color: C.inkSoft }}>Montant reçu</span>
                  <span className="mono font-semibold" style={{ color: C.greenDeep }}>{fcfa(doc.montantRecu)}</span>
                </div>
                {reste > 0 && (
                  <div className="flex justify-between w-56 text-sm py-1 px-3">
                    <span style={{ color: C.inkSoft }}>Reste à payer</span>
                    <span className="mono font-semibold" style={{ color: C.chili }}>{fcfa(reste)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Signature */}
          {signature && (
            <div className="flex flex-col items-end mt-4 mb-2">
              <div className="text-[11px] mb-1" style={{ color: C.inkSoft }}>Pour {ENTREPRISE.nom},</div>
              <img src={signature} alt="Signature" className="max-h-16" />
            </div>
          )}

          {/* Pied */}
          <div className="text-xs pt-3" style={{ borderTop: `1px solid ${C.border}`, color: C.inkSoft }}>
            {doc.type === "devis" && "Ce devis est valable 15 jours à compter de sa date d'émission."}
            {doc.type === "facture" && `Paiement par ${doc.moyenPaiement}. Merci pour votre confiance.`}
            {doc.type === "recu" && `Paiement reçu par ${doc.moyenPaiement}. ${ENTREPRISE.nom} vous remercie.`}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MODALES PERSONNEL & MATÉRIEL
--------------------------------------------------------- */
function PersonnelModal({ initial, onClose, onSave }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [poste, setPoste] = useState(initial?.poste || "");
  const [tel, setTel] = useState(initial?.tel || "");
  const [salaire, setSalaire] = useState(initial?.salaire ?? "");
  const [dateEmbauche, setDateEmbauche] = useState(initial?.dateEmbauche || todayISO());
  const [adresse, setAdresse] = useState(initial?.adresse || "");
  const [dateNaissance, setDateNaissance] = useState(initial?.dateNaissance || "");
  const [cni, setCni] = useState(initial?.cni || "");
  const [contactUrgence, setContactUrgence] = useState(initial?.contactUrgence || "");
  const [photo, setPhoto] = useState(initial?.photo || "");
  const [typePaie, setTypePaie] = useState(initial?.typePaie || "journalier");
  const [modeSalaire, setModeSalaire] = useState("augmentation"); // "augmentation" | "correction"

  // Lecture + redimensionnement de la photo pour un stockage léger
  const chargerPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 240;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={initial ? "Modifier l'employé(e)" : "Nouvel employé"} onClose={onClose}>
      {/* Photo */}
      <div className="flex flex-col items-center mb-4">
        {photo ? (
          <img src={photo} alt="Photo" className="w-20 h-20 rounded-full object-cover mb-2" style={{ border: `2px solid ${C.green}` }} />
        ) : (
          <div className="mb-2"><ClaieBadge size={80}><UserCog size={30} /></ClaieBadge></div>
        )}
        <label className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: C.greenSoft, color: C.greenDeep }}>
          {photo ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" onChange={chargerPhoto} className="hidden" />
        </label>
        {photo && (
          <button onClick={() => setPhoto("")} className="text-[11px] mt-1" style={{ color: C.chili }}>Retirer la photo</button>
        )}
      </div>

      <Field label="Nom complet"><input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Poste (ex : préparatrice, livreur, vendeuse…)"><input value={poste} onChange={(e) => setPoste(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Téléphone"><input value={tel} onChange={(e) => setTel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Type de paie">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTypePaie("journalier")}
            className="py-2 rounded-lg text-sm font-semibold"
            style={{ background: typePaie === "journalier" ? C.green : C.bgAlt, color: typePaie === "journalier" ? "#fff" : C.ink }}>
            Journalier
          </button>
          <button onClick={() => setTypePaie("mensuel")}
            className="py-2 rounded-lg text-sm font-semibold"
            style={{ background: typePaie === "mensuel" ? C.green : C.bgAlt, color: typePaie === "mensuel" ? "#fff" : C.ink }}>
            Mensuel
          </button>
        </div>
      </Field>
      <Field label={typePaie === "journalier" ? "Salaire journalier (FCFA / jour)" : "Salaire mensuel (FCFA / mois)"}>
        <input type="number" value={salaire} onChange={(e) => setSalaire(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
      </Field>
      {initial && Number(salaire) !== Number(initial.salaire) && (
        <div className="rounded-xl p-3 mb-3" style={{ background: C.goldSoft, border: `1px solid ${C.gold}` }}>
          <div className="text-xs font-bold mb-2" style={{ color: "#8A5D14" }}>
            Le salaire passe de {fcfa(initial.salaire)} à {fcfa(Number(salaire) || 0)}. De quoi s'agit-il ?
          </div>
          <button onClick={() => setModeSalaire("augmentation")}
            className="w-full text-left p-2.5 rounded-lg mb-1.5 text-xs"
            style={{ background: modeSalaire === "augmentation" ? C.green : "#fff", color: modeSalaire === "augmentation" ? "#fff" : C.ink }}>
            <span className="font-bold">Augmentation / changement de salaire</span><br />
            <span style={{ opacity: 0.85 }}>Le nouveau montant s'applique à partir d'aujourd'hui. Les paies passées gardent l'ancien montant.</span>
          </button>
          <button onClick={() => setModeSalaire("correction")}
            className="w-full text-left p-2.5 rounded-lg text-xs"
            style={{ background: modeSalaire === "correction" ? C.green : "#fff", color: modeSalaire === "correction" ? "#fff" : C.ink }}>
            <span className="font-bold">Correction d'une erreur de saisie</span><br />
            <span style={{ opacity: 0.85 }}>Tout l'historique des paies est recalculé au bon montant.</span>
          </button>
        </div>
      )}
      <Field label="Adresse"><input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Date de naissance"><input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="N° pièce d'identité (CNI…)"><input value={cni} onChange={(e) => setCni(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Contact d'urgence (nom + téléphone)"><input value={contactUrgence} onChange={(e) => setContactUrgence(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Date d'embauche"><input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>

      <button disabled={!nom || !poste}
        onClick={() => onSave({
          id: initial?.id || "e" + Date.now(),
          nom, poste, tel, salaire: Number(salaire) || 0, dateEmbauche,
          adresse, dateNaissance, cni, contactUrgence, photo, typePaie,
        }, modeSalaire)}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        {initial ? "Enregistrer les modifications" : "Enregistrer"}
      </button>
    </Modal>
  );
}

function AddMaterielModal({ onClose, onSave }) {
  const [nom, setNom] = useState(""); const [quantite, setQuantite] = useState("1");
  const [valeur, setValeur] = useState(""); const [etat, setEtat] = useState("Bon état");
  const [dernierEntretien, setDernierEntretien] = useState("");
  return (
    <Modal title="Nouvel équipement" onClose={onClose}>
      <Field label="Nom (ex : broyeur, presse, cuiseur, bassine…)"><input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Quantité"><input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Valeur d'achat (FCFA, optionnel)"><input type="number" value={valeur} onChange={(e) => setValeur(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="État">
        <select value={etat} onChange={(e) => setEtat(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Bon état</option><option>À entretenir</option><option>En panne</option>
        </select>
      </Field>
      <Field label="Dernier entretien (optionnel)"><input type="date" value={dernierEntretien} onChange={(e) => setDernierEntretien(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <button disabled={!nom} onClick={() => onSave({ id: "m" + Date.now(), nom, quantite: Number(quantite) || 1, valeur: Number(valeur) || 0, etat, dernierEntretien })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Enregistrer
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------
   MODALES ACHATS & DÉPENSES
--------------------------------------------------------- */
function AddAchatModal({ onClose, onSave }) {
  const [designation, setDesignation] = useState(""); const [fournisseur, setFournisseur] = useState("");
  const [montant, setMontant] = useState(""); const [date, setDate] = useState(todayISO());
  return (
    <Modal title="Nouvel achat" onClose={onClose}>
      <Field label="Désignation (ex : manioc 500kg, sacs, gaz…)"><input value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Fournisseur (optionnel)"><input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Montant (FCFA)"><input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <button disabled={!designation || !montant} onClick={() => onSave({ id: "a" + Date.now(), designation, fournisseur, montant: Number(montant), date })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Enregistrer
      </button>
    </Modal>
  );
}

function AddDepenseModal({ onClose, onSave }) {
  const [designation, setDesignation] = useState(""); const [categorie, setCategorie] = useState("Entretien matériel");
  const [montant, setMontant] = useState(""); const [date, setDate] = useState(todayISO());
  return (
    <Modal title="Nouvelle dépense" onClose={onClose}>
      <Field label="Désignation (ex : réparation broyeur, facture CIE…)"><input value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Catégorie">
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Entretien matériel</option><option>Eau / Électricité</option><option>Transport</option><option>Autre</option>
        </select>
      </Field>
      <Field label="Montant (FCFA)"><input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
      <button disabled={!designation || !montant} onClick={() => onSave({ id: "x" + Date.now(), designation, categorie, montant: Number(montant), date })}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
        Enregistrer
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------
   MODALE D'ENCAISSEMENT
--------------------------------------------------------- */
function EncaisserModal({ cmd, reste, clientNom, onClose, onEncaisser }) {
  const signale = typeof cmd.paiementSignale === "object" ? cmd.paiementSignale : null;
  const [montant, setMontant] = useState(signale?.montant ? String(Math.min(signale.montant, reste)) : "");
  const [moyen, setMoyen] = useState(signale?.moyen || cmd.moyenPaiement || "Espèces");
  const m = Number(montant);
  const valide = m > 0 && m <= reste;

  return (
    <Modal title="Encaisser un paiement" onClose={onClose}>
      <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <div className="font-semibold" style={{ color: C.ink }}>{clientNom}</div>
        <div className="flex justify-between mt-1 text-xs">
          <span style={{ color: C.inkSoft }}>Reste à payer</span>
          <span className="mono font-bold" style={{ color: C.chili }}>{fcfa(reste)}</span>
        </div>
        {signale && (
          <div className="flex justify-between mt-1 text-xs">
            <span style={{ color: C.gold }}>Montant signalé par le client</span>
            <span className="mono font-bold" style={{ color: C.gold }}>{fcfa(signale.montant)}</span>
          </div>
        )}
      </div>
      <Field label="Montant reçu (FCFA)">
        <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)}
          placeholder={String(reste)} autoFocus
          className="w-full px-3 py-3 rounded-lg text-lg mono text-center" style={inputStyle} />
      </Field>
      {m > reste && (
        <p className="text-xs mb-2 font-semibold" style={{ color: C.chili }}>
          Le montant dépasse le reste à payer ({fcfa(reste)}).
        </p>
      )}
      <Field label="Moyen de paiement">
        <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Espèces</option><option>Mobile Money</option><option>Virement</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={() => onEncaisser(reste, moyen)}
          className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.greenSoft, color: C.greenDeep }}>
          Tout ({fcfa(reste)})
        </button>
        <button disabled={!valide} onClick={() => onEncaisser(m, moyen)}
          className="py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
          Encaisser
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   MODALE D'ENCAISSEMENT SUR SOLDE CLIENT
   Le montant versé rembourse les commandes de la plus ancienne
   à la plus récente (imputation FIFO).
--------------------------------------------------------- */
function EncaisserSoldeModal({ client, du, commandes, montantReste, nomProduit, onClose, onEncaisser }) {
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState("Espèces");
  const m = Number(montant);
  const valide = m > 0 && m <= du;

  // Aperçu de la répartition
  let restant = valide ? m : 0;
  const repartition = commandes.map((c) => {
    const reste = montantReste(c);
    const verse = Math.min(restant, reste);
    restant -= verse;
    return { c, reste, verse };
  });

  return (
    <Modal title={`Encaisser — ${client.nom}`} onClose={onClose}>
      <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <div className="flex justify-between text-xs">
          <span style={{ color: C.inkSoft }}>Solde total dû</span>
          <span className="mono font-bold" style={{ color: C.chili }}>{fcfa(du)}</span>
        </div>
        <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>
          {commandes.length} commande(s) non soldée(s). Le versement remboursera d'abord la plus ancienne.
        </div>
      </div>

      <Field label="Montant versé (FCFA)">
        <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)}
          placeholder={String(du)} autoFocus
          className="w-full px-3 py-3 rounded-lg text-lg mono text-center" style={inputStyle} />
      </Field>
      {m > du && (
        <p className="text-xs mb-2 font-semibold" style={{ color: C.chili }}>
          Le montant dépasse le solde dû ({fcfa(du)}).
        </p>
      )}
      <Field label="Moyen de paiement">
        <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option>Espèces</option><option>Mobile Money</option><option>Virement</option>
        </select>
      </Field>

      {/* Aperçu de la répartition */}
      {valide && (
        <div className="rounded-xl p-3 mb-3 text-[11px]" style={{ background: C.greenSoft }}>
          <div className="font-bold mb-1.5" style={{ color: C.greenDeep }}>Répartition du versement :</div>
          {repartition.filter((r) => r.verse > 0).map((r, i) => (
            <div key={i} className="flex justify-between py-0.5" style={{ color: C.greenDeep }}>
              <span>{fmtDate(r.c.date)} — {r.c.items.map((it) => `${it.qte}× ${nomProduit(it.produitId)}`).join(", ").slice(0, 30)}…</span>
              <span className="mono font-semibold shrink-0 ml-2">
                {r.verse >= r.reste ? "soldée ✓" : `+ ${fcfa(r.verse)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={() => onEncaisser(du, moyen)}
          className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.greenSoft, color: C.greenDeep }}>
          Tout ({fcfa(du)})
        </button>
        <button disabled={!valide} onClick={() => onEncaisser(m, moyen)}
          className="py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
          Encaisser
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   RAPPORT COMPTABLE IMPRIMABLE
--------------------------------------------------------- */
function RapportModal({ commandes, achats, depenses, personnel, paies = [], clients, montantCommande, nomClient, montantPaye, montantReste, onClose }) {
  const totalAchats = achats.reduce((s, a) => s + a.montant, 0);
  const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0);
  const salairesPayes = paies.filter((p) => p.statut === "payé").reduce((s, p) => s + p.montant, 0);
  const salairesDus = paies.filter((p) => p.statut === "non payé").reduce((s, p) => s + p.montant, 0);
  const encaisse = commandes.reduce((s, c) => s + montantPaye(c), 0);
  const enAttente = commandes.reduce((s, c) => s + montantReste(c), 0);
  const sorties = totalAchats + totalDepenses + salairesPayes;
  const resultat = encaisse - sorties;

  // Impayés par client (restes réels)
  const impayesParClient = clients
    .map((cl) => ({
      nom: cl.nom,
      du: commandes.filter((c) => c.clientId === cl.id).reduce((s, c) => s + montantReste(c), 0),
    }))
    .filter((x) => x.du > 0)
    .sort((a, b) => b.du - a.du);

  const ligne = (label, val, color) => (
    <div className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
      <span style={{ color: C.inkSoft }}>{label}</span>
      <span className="mono font-semibold" style={{ color: color || C.ink }}>{fcfa(val)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.55)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-3 py-6">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: C.ink }}>
          <span className="text-sm font-semibold text-white">Rapport d'activité</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { try { window.print(); } catch {} }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>
              <Printer size={13} /> Imprimer
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-6" style={{ color: C.ink }}>
          {/* En-tête */}
          <div className="mb-6 pb-4 text-center" style={{ borderBottom: `2px solid ${C.green}` }}>
            <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.greenDeep }}>{ENTREPRISE.nom}</div>
            <div className="text-xs" style={{ color: C.inkSoft }}>{ENTREPRISE.adresse} · {ENTREPRISE.tel}{ENTREPRISE.email ? " · " + ENTREPRISE.email : ""}</div>
            <div className="text-sm font-bold mt-3 uppercase tracking-widest" style={{ color: C.ink }}>Rapport d'activité</div>
            <div className="text-xs" style={{ color: C.inkSoft }}>Établi le {fmtDate(todayISO())}</div>
          </div>

          {/* Résultat */}
          <div className="rounded-xl p-4 mb-6 text-center" style={{ background: resultat >= 0 ? C.greenSoft : C.chiliSoft }}>
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: resultat >= 0 ? C.greenDeep : C.chili }}>
              Résultat : {resultat >= 0 ? "Bénéfice" : "Perte"}
            </div>
            <div className="text-2xl font-bold mono" style={{ color: resultat >= 0 ? C.greenDeep : C.chili }}>{fcfa(Math.abs(resultat))}</div>
          </div>

          {/* Entrées */}
          <div className="mb-5">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.greenDeep }}>1. Entrées</h4>
            {ligne("Ventes encaissées", encaisse, C.greenDeep)}
            {ligne("Créances clients (à recevoir)", enAttente, C.gold)}
          </div>

          {/* Sorties */}
          <div className="mb-5">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.chili }}>2. Sorties</h4>
            {ligne(`Achats (${achats.length})`, totalAchats)}
            {ligne(`Dépenses & entretiens (${depenses.length})`, totalDepenses)}
            {ligne(`Salaires versés (${personnel.length} employé·s)`, salairesPayes)}
            {salairesDus > 0 && ligne("Salaires non versés (dus)", salairesDus, C.chili)}
            <div className="flex justify-between py-2 text-sm font-bold">
              <span>Total sorties</span>
              <span className="mono" style={{ color: C.chili }}>{fcfa(sorties)}</span>
            </div>
          </div>

          {/* Impayés par client */}
          <div className="mb-5">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.ink }}>3. Créances par client</h4>
            {impayesParClient.length === 0 ? (
              <p className="text-sm" style={{ color: C.greenDeep }}>Aucune créance — tous les clients sont à jour.</p>
            ) : (
              impayesParClient.map((x, i) => ligne(x.nom, x.du, C.chili))
            )}
          </div>

          {/* Détail des dépenses par catégorie */}
          {depenses.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.ink }}>4. Dépenses par catégorie</h4>
              {["Entretien matériel", "Eau / Électricité", "Transport", "Autre"].map((cat) => {
                const tot = depenses.filter((d) => d.categorie === cat).reduce((s, d) => s + d.montant, 0);
                return tot > 0 ? <div key={cat}>{ligne(cat, tot)}</div> : null;
              })}
            </div>
          )}

          <div className="text-[11px] pt-3 text-center" style={{ borderTop: `1px solid ${C.border}`, color: C.inkSoft }}>
            Document généré automatiquement par la plateforme de gestion {ENTREPRISE.nom}.
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   RELEVÉ DE COMPTE CLIENT IMPRIMABLE
--------------------------------------------------------- */
function ReleveModal({ client, commandes, montantCommande, montantPaye, montantReste, nomProduit, onClose }) {
  const totalCommande = commandes.reduce((s, c) => s + montantCommande(c), 0);
  const totalPaye = commandes.reduce((s, c) => s + montantPaye(c), 0);
  const solde = totalCommande - totalPaye;

  // Historique chronologique des versements
  const versements = commandes
    .flatMap((c) => (c.paiements || []).map((p) => ({ ...p, commandeDate: c.date })))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.55)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-3 py-6">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: C.ink }}>
            <span className="text-sm font-semibold text-white">Relevé de compte</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { try { window.print(); } catch {} }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>
                <Printer size={13} /> Imprimer
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="p-6" style={{ color: C.ink }}>
            {/* En-tête */}
            <div className="mb-5 pb-4" style={{ borderBottom: `2px solid ${C.green}` }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.greenDeep }}>{ENTREPRISE.nom}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{ENTREPRISE.adresse} · {ENTREPRISE.tel}{ENTREPRISE.email ? " · " + ENTREPRISE.email : ""}</div>
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest">Relevé de compte</div>
                  <div className="text-sm font-semibold mt-1">{client.nom}</div>
                  {client.tel && <div className="text-xs" style={{ color: C.inkSoft }}>{client.tel}</div>}
                </div>
                <div className="text-xs text-right" style={{ color: C.inkSoft }}>Établi le {fmtDate(todayISO())}</div>
              </div>
            </div>

            {/* Solde */}
            <div className="rounded-xl p-4 mb-5 text-center" style={{ background: solde > 0 ? C.chiliSoft : C.greenSoft }}>
              <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: solde > 0 ? C.chili : C.greenDeep }}>
                {solde > 0 ? "Solde dû" : "Compte à jour"}
              </div>
              <div className="text-2xl font-bold mono" style={{ color: solde > 0 ? C.chili : C.greenDeep }}>{fcfa(solde)}</div>
            </div>

            {/* Commandes */}
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2">1. Commandes</h4>
            <div className="mb-5">
              {commandes.map((c) => {
                const reste = montantReste(c);
                const enRetard = reste > 0 && c.jourPaiement < todayISO();
                return (
                  <div key={c.id} className="py-2 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
                    <div className="flex justify-between gap-2">
                      <span className="text-xs" style={{ color: C.inkSoft }}>
                        {fmtDate(c.date)} — {c.items.map((it) => `${it.qte}× ${nomProduit(it.produitId)}`).join(", ")}
                      </span>
                      <span className="mono font-semibold shrink-0">{fcfa(montantCommande(c))}</span>
                    </div>
                    <div className="flex justify-between text-[11px] mt-0.5">
                      <span style={{ color: C.inkSoft }}>
                        Échéance {fmtDate(c.jourPaiement)}{enRetard ? " — EN RETARD" : ""}
                      </span>
                      <span className="mono" style={{ color: reste > 0 ? C.chili : C.greenDeep }}>
                        {reste > 0 ? `reste ${fcfa(reste)}` : "soldée ✓"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Versements */}
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2">2. Versements reçus</h4>
            <div className="mb-5">
              {versements.length === 0 ? (
                <p className="text-sm" style={{ color: C.inkSoft }}>Aucun versement enregistré.</p>
              ) : (
                versements.map((v, i) => (
                  <div key={i} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
                    <span className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(v.date)} · {v.moyen} (commande du {fmtDate(v.commandeDate)})</span>
                    <span className="mono font-semibold" style={{ color: C.greenDeep }}>+ {fcfa(v.montant)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Totaux */}
            <div className="rounded-xl p-4 text-sm space-y-1.5" style={{ background: C.bg }}>
              <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Total commandé</span><span className="mono font-semibold">{fcfa(totalCommande)}</span></div>
              <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Total versé</span><span className="mono font-semibold" style={{ color: C.greenDeep }}>{fcfa(totalPaye)}</span></div>
              <div className="flex justify-between pt-2 font-bold" style={{ borderTop: `1px solid ${C.border}` }}>
                <span>Solde dû</span><span className="mono" style={{ color: solde > 0 ? C.chili : C.greenDeep }}>{fcfa(solde)}</span>
              </div>
            </div>

            <div className="text-[11px] pt-4 text-center" style={{ color: C.inkSoft }}>
              Document généré automatiquement par la plateforme de gestion {ENTREPRISE.nom}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SIGNATURE DU GÉRANT
   Dessinée au doigt ou importée en image ; ajoutée
   automatiquement à tous les documents émis.
--------------------------------------------------------- */
function SignatureModal({ signature, onClose, onSave }) {
  const [dessin, setDessin] = useState(signature || "");
  const canvasRef = { current: null };
  let ctx = null;
  let enCours = false;
  let vide = true;

  const initCanvas = (el) => {
    if (!el) return;
    canvasRef.current = el;
    ctx = el.getContext("2d");
    ctx.strokeStyle = "#241A15";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (canvasRef.current.width / r.width), y: (t.clientY - r.top) * (canvasRef.current.height / r.height) };
  };
  const debut = (e) => { e.preventDefault(); enCours = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const trace = (e) => { if (!enCours) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); vide = false; };
  const fin = () => { if (enCours && !vide) setDessin(canvasRef.current.toDataURL("image/png")); enCours = false; };
  const effacer = () => {
    if (canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    vide = true; setDessin("");
  };

  const importer = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setDessin(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Ma signature" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
        Signez au doigt dans le cadre ci-dessous, ou importez une photo de votre signature.
        Elle sera ajoutée automatiquement à tous vos devis, factures, reçus et relevés.
      </p>

      {dessin ? (
        <div className="rounded-xl p-4 mb-3 flex flex-col items-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <img src={dessin} alt="Signature" className="max-h-24 mb-2" />
          <button onClick={effacer} className="text-xs font-semibold" style={{ color: C.chili }}>Recommencer</button>
        </div>
      ) : (
        <canvas
          ref={initCanvas}
          width={600} height={220}
          className="w-full rounded-xl mb-3 touch-none"
          style={{ background: "#fff", border: `2px dashed ${C.border}`, touchAction: "none" }}
          onMouseDown={debut} onMouseMove={trace} onMouseUp={fin} onMouseLeave={fin}
          onTouchStart={debut} onTouchMove={trace} onTouchEnd={fin}
        />
      )}

      <label className="block text-center text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer mb-3" style={{ background: C.bgAlt, color: C.ink }}>
        Importer une photo de signature
        <input type="file" accept="image/*" onChange={importer} className="hidden" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        {signature && (
          <button onClick={() => onSave("")} className="py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.chiliSoft, color: C.chili }}>
            Supprimer
          </button>
        )}
        <button disabled={!dessin} onClick={() => onSave(dessin)}
          className={`py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 ${signature ? "" : "col-span-2"}`}
          style={{ background: C.green }}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------
   FICHE D'EMPLOI IMPRIMABLE
--------------------------------------------------------- */
function FicheEmploiModal({ emp, signature, onClose }) {
  const infoLigne = (label, val) => val ? (
    <div className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}` }}>
      <span style={{ color: C.inkSoft }}>{label}</span>
      <span className="font-semibold text-right">{val}</span>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.55)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-3 py-6">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: C.ink }}>
            <span className="text-sm font-semibold text-white">Fiche d'emploi</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { try { window.print(); } catch {} }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>
                <Printer size={13} /> Imprimer
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="p-6" style={{ color: C.ink }}>
            <div className="mb-5 pb-4 text-center" style={{ borderBottom: `2px solid ${C.green}` }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.greenDeep }}>{ENTREPRISE.nom}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{ENTREPRISE.adresse} · {ENTREPRISE.tel}{ENTREPRISE.email ? " · " + ENTREPRISE.email : ""}</div>
              <div className="text-sm font-bold mt-3 uppercase tracking-widest">Fiche d'emploi</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>Établie le {fmtDate(todayISO())}</div>
            </div>

            <div className="flex items-center gap-4 mb-5">
              {emp.photo ? (
                <img src={emp.photo} alt={emp.nom} className="w-20 h-20 rounded-xl object-cover" style={{ border: `2px solid ${C.green}` }} />
              ) : (
                <ClaieBadge size={80}><UserCog size={30} /></ClaieBadge>
              )}
              <div>
                <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{emp.nom}</div>
                <div className="text-sm" style={{ color: C.inkSoft }}>{emp.poste}</div>
              </div>
            </div>

            {infoLigne("Type de paie", (emp.typePaie || "mensuel") === "journalier" ? "Journalier" : "Mensuel")}
            {infoLigne("Salaire", `${fcfa(emp.salaire)} / ${(emp.typePaie || "mensuel") === "journalier" ? "jour" : "mois"}`)}
            {infoLigne("Date d'embauche", emp.dateEmbauche ? fmtDate(emp.dateEmbauche) : null)}
            {infoLigne("Téléphone", emp.tel)}
            {infoLigne("Adresse", emp.adresse)}
            {infoLigne("Date de naissance", emp.dateNaissance ? fmtDate(emp.dateNaissance) : null)}
            {infoLigne("Pièce d'identité", emp.cni)}
            {infoLigne("Contact d'urgence", emp.contactUrgence)}

            <div className="grid grid-cols-2 gap-6 mt-8 mb-2">
              <div className="flex flex-col justify-end items-center text-center">
                <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>L'employé(e)</div>
                <div className="text-[11px] mb-2" style={{ color: C.inkSoft }}>Lu et approuvé</div>
                <div className="h-16" />
                <div className="w-full" style={{ borderTop: `1px solid ${C.ink}` }} />
                <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{emp.nom}</div>
              </div>
              <div className="flex flex-col justify-end items-center text-center">
                <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>L'employeur</div>
                <div className="text-[11px] mb-2" style={{ color: C.inkSoft }}>Pour {ENTREPRISE.nom}</div>
                {signature ? (
                  <img src={signature} alt="Signature" className="h-16 object-contain" />
                ) : (
                  <div className="h-16" />
                )}
                <div className="w-full" style={{ borderTop: `1px solid ${C.ink}` }} />
                <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>La gérante</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   FICHE DE PAIE MENSUELLE IMPRIMABLE
   Pour les journaliers : détail des journées du mois.
   Pour les mensuels : la ligne du mois.
--------------------------------------------------------- */
function FichePaieModal({ emp, paies, signature, onClose }) {
  // Mois disponibles pour cet employé (les plus récents en premier)
  const moisDispo = [...new Set(paies.map((p) => p.periode.slice(0, 7)))].sort().reverse();
  const [moisChoisi, setMoisChoisi] = useState(moisDispo[0] || todayISO().slice(0, 7));

  const paiesMois = paies
    .filter((p) => p.periode.slice(0, 7) === moisChoisi)
    .sort((a, b) => a.periode.localeCompare(b.periode));
  const totalPaye = paiesMois.filter((p) => p.statut === "payé").reduce((s, p) => s + p.montant, 0);
  const totalDu = paiesMois.filter((p) => p.statut === "non payé").reduce((s, p) => s + p.montant, 0);
  const joursTravailles = paiesMois.filter((p) => p.statut !== "repos").length;
  const joursRepos = paiesMois.filter((p) => p.statut === "repos").length;
  const nomMois = (k) => new Date(k + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const journalier = (emp.typePaie || "mensuel") === "journalier";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(36,26,21,0.55)", WebkitOverflowScrolling: "touch" }}>
      <div className="min-h-full flex items-start justify-center p-3 py-6">
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: C.ink }}>
            <span className="text-sm font-semibold text-white">Fiche de paie</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { try { window.print(); } catch {} }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>
                <Printer size={13} /> Imprimer
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="p-6" style={{ color: C.ink }}>
            {/* Choix du mois */}
            {moisDispo.length > 1 && (
              <select value={moisChoisi} onChange={(e) => setMoisChoisi(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm mb-4 capitalize" style={inputStyle}>
                {moisDispo.map((m) => <option key={m} value={m}>{nomMois(m)}</option>)}
              </select>
            )}

            <div className="mb-5 pb-4 text-center" style={{ borderBottom: `2px solid ${C.green}` }}>
              <div className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: C.greenDeep }}>{ENTREPRISE.nom}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{ENTREPRISE.adresse} · {ENTREPRISE.tel}{ENTREPRISE.email ? " · " + ENTREPRISE.email : ""}</div>
              <div className="text-sm font-bold mt-3 uppercase tracking-widest">Fiche de paie — <span className="capitalize">{nomMois(moisChoisi)}</span></div>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-sm font-bold">{emp.nom}</div>
                <div className="text-xs" style={{ color: C.inkSoft }}>{emp.poste} · Paie {journalier ? "journalière" : "mensuelle"} · {fcfa(emp.salaire)}/{journalier ? "jour" : "mois"}</div>
              </div>
              <div className="text-xs text-right" style={{ color: C.inkSoft }}>Établie le {fmtDate(todayISO())}</div>
            </div>

            {/* Détail */}
            {paiesMois.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: C.inkSoft }}>Aucune paie enregistrée pour ce mois.</p>
            ) : (
              <div className="mb-4">
                {paiesMois.map((p) => (
                  <div key={p.id} className="flex justify-between py-1.5 text-sm" style={{ borderBottom: `1px dashed ${C.border}`, opacity: p.statut === "repos" ? 0.6 : 1 }}>
                    <span className="text-xs capitalize" style={{ color: C.inkSoft }}>
                      {p.type === "mensuel" ? nomMois(p.periode) : fmtDate(p.periode)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="mono font-semibold" style={{ textDecoration: p.statut === "repos" ? "line-through" : "none", color: p.statut === "repos" ? C.inkSoft : C.ink }}>
                        {p.statut === "repos" ? "—" : fcfa(p.montant)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: p.statut === "payé" ? C.greenSoft : p.statut === "repos" ? C.bgAlt : C.chiliSoft,
                          color: p.statut === "payé" ? C.greenDeep : p.statut === "repos" ? C.inkSoft : C.chili,
                        }}>
                        {p.statut === "payé" ? "PAYÉ" : p.statut === "repos" ? "REPOS" : "DÛ"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Totaux */}
            <div className="rounded-xl p-4 text-sm space-y-1.5 mb-6" style={{ background: C.bg }}>
              {journalier && (
                <>
                  <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Journées travaillées</span><span className="mono font-semibold">{joursTravailles}</span></div>
                  {joursRepos > 0 && (
                    <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Jours de repos (non payés)</span><span className="mono font-semibold">{joursRepos}</span></div>
                  )}
                </>
              )}
              <div className="flex justify-between"><span style={{ color: C.inkSoft }}>Total versé</span><span className="mono font-semibold" style={{ color: C.greenDeep }}>{fcfa(totalPaye)}</span></div>
              {totalDu > 0 && (
                <div className="flex justify-between"><span style={{ color: C.chili }}>Reste dû à l'employé(e)</span><span className="mono font-semibold" style={{ color: C.chili }}>{fcfa(totalDu)}</span></div>
              )}
              <div className="flex justify-between pt-2 font-bold" style={{ borderTop: `1px solid ${C.border}` }}>
                <span>Total du mois</span><span className="mono">{fcfa(totalPaye + totalDu)}</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 mt-6 mb-2">
              <div className="flex flex-col justify-end items-center text-center">
                <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>L'employé(e)</div>
                <div className="text-[11px] mb-2" style={{ color: C.inkSoft }}>Reçu pour solde</div>
                <div className="h-16" />
                <div className="w-full" style={{ borderTop: `1px solid ${C.ink}` }} />
                <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{emp.nom}</div>
              </div>
              <div className="flex flex-col justify-end items-center text-center">
                <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>L'employeur</div>
                <div className="text-[11px] mb-2" style={{ color: C.inkSoft }}>Pour {ENTREPRISE.nom}</div>
                {signature ? (
                  <img src={signature} alt="Signature" className="h-16 object-contain" />
                ) : (
                  <div className="h-16" />
                )}
                <div className="w-full" style={{ borderTop: `1px solid ${C.ink}` }} />
                <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>La gérante</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PARAMÈTRES
   Infos entreprise, signature/cachet, code d'accès gérant.
--------------------------------------------------------- */
function ParametresSection({ signature, onOpenSignature, pin, onSavePin, onSaveEntreprise, recup, onSaveRecup, onExport, onImport }) {
  const [nom, setNom] = useState(ENTREPRISE.nom);
  const [slogan, setSlogan] = useState(ENTREPRISE.slogan);
  const [tel, setTel] = useState(ENTREPRISE.tel);
  const [adresse, setAdresse] = useState(ENTREPRISE.adresse);
  const [email, setEmail] = useState(ENTREPRISE.email || "");
  const [infoSauvee, setInfoSauvee] = useState(false);

  const [nouveauPin, setNouveauPin] = useState("");
  const [confirmerPin, setConfirmerPin] = useState("");
  const [msgPin, setMsgPin] = useState(null); // {ok, texte}

  const [question, setQuestion] = useState(recup?.question || "");
  const [reponse, setReponse] = useState("");
  const [recupSauvee, setRecupSauvee] = useState(false);
  const [msgImport, setMsgImport] = useState(null);

  const lireFichierSauvegarde = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setMsgImport(onImport(data));
      } catch {
        setMsgImport({ ok: false, texte: "Impossible de lire ce fichier." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sauverInfos = () => {
    onSaveEntreprise({ nom, slogan, tel, adresse, email });
    setInfoSauvee(true);
    setTimeout(() => setInfoSauvee(false), 2500);
  };

  const sauverRecup = () => {
    if (!question.trim() || !reponse.trim()) return;
    onSaveRecup({ question: question.trim(), reponse: reponse.trim() });
    setReponse("");
    setRecupSauvee(true);
    setTimeout(() => setRecupSauvee(false), 2500);
  };

  const changerPin = () => {
    if (nouveauPin.length < 4) { setMsgPin({ ok: false, texte: "Le code doit contenir au moins 4 chiffres." }); return; }
    if (nouveauPin !== confirmerPin) { setMsgPin({ ok: false, texte: "Les deux codes ne correspondent pas." }); return; }
    onSavePin(nouveauPin);
    setNouveauPin(""); setConfirmerPin("");
    setMsgPin({ ok: true, texte: "Code modifié. Utilisez-le à la prochaine connexion." });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Paramètres</h1>
      <p className="text-sm mb-6" style={{ color: C.inkSoft }}>Informations de l'entreprise, signature et sécurité</p>

      {/* Infos entreprise */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Informations de l'entreprise</h3>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>Ces informations apparaissent sur tous vos documents (factures, reçus, fiches…).</p>
        <Field label="Nom de l'entreprise"><input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
        <Field label="Slogan"><input value={slogan} onChange={(e) => setSlogan(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
        <Field label="Téléphone"><input value={tel} onChange={(e) => setTel(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemple@gmail.com" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
        <Field label="Adresse"><input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} /></Field>
        <button onClick={sauverInfos} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.green }}>
          Enregistrer les informations
        </button>
        {infoSauvee && <p className="text-xs text-center mt-2 font-semibold" style={{ color: C.greenDeep }}>Informations enregistrées ✓</p>}
      </div>

      {/* Signature */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="font-bold mb-2" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Signature & cachet</h3>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
          Ajoutée automatiquement sur les devis, factures, reçus, fiches d'emploi et fiches de paie.
        </p>
        {signature && (
          <div className="rounded-xl p-3 mb-3 flex justify-center" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <img src={signature} alt="Signature actuelle" className="max-h-16" />
          </div>
        )}
        <button onClick={onOpenSignature} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: signature ? C.greenSoft : C.green, color: signature ? C.greenDeep : "#fff" }}>
          ✍️ {signature ? "Modifier ma signature" : "Créer ma signature"}
        </button>
      </div>

      {/* Code d'accès */}
      <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="font-bold mb-2" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Code d'accès gérant</h3>
        {pin === "1234" && (
          <p className="text-xs mb-3 font-semibold" style={{ color: C.chili }}>
            Vous utilisez encore le code par défaut (1234). Changez-le pour protéger votre gestion.
          </p>
        )}
        <Field label="Nouveau code (4 chiffres ou plus)">
          <input type="password" inputMode="numeric" value={nouveauPin} onChange={(e) => { setNouveauPin(e.target.value); setMsgPin(null); }}
            className="w-full px-3 py-2 rounded-lg text-sm text-center tracking-widest" style={inputStyle} />
        </Field>
        <Field label="Confirmer le nouveau code">
          <input type="password" inputMode="numeric" value={confirmerPin} onChange={(e) => { setConfirmerPin(e.target.value); setMsgPin(null); }}
            className="w-full px-3 py-2 rounded-lg text-sm text-center tracking-widest" style={inputStyle} />
        </Field>
        <button onClick={changerPin} disabled={!nouveauPin || !confirmerPin}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
          Changer le code
        </button>
        {msgPin && (
          <p className="text-xs text-center mt-2 font-semibold" style={{ color: msgPin.ok ? C.greenDeep : C.chili }}>{msgPin.texte}</p>
        )}
      </div>

      {/* Récupération du code */}
      <div className="rounded-2xl p-5 mt-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="font-bold mb-2" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Récupération en cas d'oubli</h3>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
          Définissez une question secrète dont vous seule connaissez la réponse. En cas d'oubli du code, elle vous permettra d'en définir un nouveau depuis l'écran de connexion.
        </p>
        {recup?.question && (
          <p className="text-xs mb-3 font-semibold" style={{ color: C.greenDeep }}>Question actuelle : « {recup.question} »</p>
        )}
        <Field label="Question secrète (ex : nom de mon premier village ?)">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </Field>
        <Field label="Réponse secrète">
          <input value={reponse} onChange={(e) => setReponse(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </Field>
        <button onClick={sauverRecup} disabled={!question.trim() || !reponse.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
          Enregistrer la question de récupération
        </button>
        {recupSauvee && <p className="text-xs text-center mt-2 font-semibold" style={{ color: C.greenDeep }}>Question enregistrée ✓</p>}
      </div>

      {/* Sauvegarde & restauration */}
      <div className="rounded-2xl p-5 mt-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <h3 className="font-bold mb-2" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Sauvegarde des données</h3>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
          Toutes vos données (clients, commandes, comptabilité, paies…) sont regroupées dans un seul fichier que vous téléchargez et conservez précieusement (téléphone, clé USB, Google Drive…). En cas de problème, la restauration remet tout en place. <span className="font-semibold" style={{ color: C.ink }}>Conseil : exportez une sauvegarde chaque semaine.</span>
        </p>
        <button onClick={onExport}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mb-2" style={{ background: C.green }}>
          ⬇️ Exporter une sauvegarde
        </button>
        <label className="block text-center text-sm font-semibold px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: C.goldSoft, color: "#8A5D14" }}>
          ⬆️ Restaurer depuis un fichier
          <input type="file" accept=".json,application/json" onChange={lireFichierSauvegarde} className="hidden" />
        </label>
        <p className="text-[11px] mt-2" style={{ color: C.chili }}>
          Attention : la restauration remplace toutes les données actuelles par celles du fichier.
        </p>
        {msgImport && (
          <p className="text-xs text-center mt-2 font-semibold" style={{ color: msgImport.ok ? C.greenDeep : C.chili }}>{msgImport.texte}</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ÉCRAN DE CONNEXION
--------------------------------------------------------- */
const PIN_GERANT = "1234"; // Code par défaut du prototype — à changer avant mise en production

function LoginScreen({ clients, pin: pinAttendu = PIN_GERANT, recup, onResetPin, onLogin }) {
  const [tab, setTab] = useState("gerant"); // "gerant" | "client"
  const [pin, setPin] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [telSaisi, setTelSaisi] = useState("");
  const [erreur, setErreur] = useState("");
  const [modeRecup, setModeRecup] = useState(false);
  const [reponseRecup, setReponseRecup] = useState("");
  const [recupOK, setRecupOK] = useState(false);
  const [nouveauPin, setNouveauPin] = useState("");

  const connecterGerant = () => {
    if (pin === pinAttendu) onLogin({ role: "gerant" });
    else { setErreur("Code incorrect."); setPin(""); }
  };

  const verifierRecup = () => {
    if (recup && reponseRecup.trim().toLowerCase() === (recup.reponse || "").toLowerCase()) {
      setRecupOK(true); setErreur("");
    } else {
      setErreur("Réponse incorrecte.");
    }
  };

  const definirNouveauPin = () => {
    if (nouveauPin.length < 4) { setErreur("Le code doit contenir au moins 4 chiffres."); return; }
    onResetPin(nouveauPin);
    setModeRecup(false); setRecupOK(false); setReponseRecup(""); setNouveauPin(""); setErreur("");
    onLogin({ role: "gerant" });
  };

  const connecterClient = () => {
    const cl = clients.find((c) => c.id === clientId);
    if (!cl) return;
    const normalise = (s) => (s || "").replace(/\D/g, "");
    // Si le client a défini un mot de passe, c'est lui qui compte ; sinon, le numéro de téléphone sert de clé
    const ok = cl.motDePasse
      ? telSaisi === cl.motDePasse
      : normalise(telSaisi) && normalise(telSaisi) === normalise(cl.tel);
    if (ok) onLogin({ role: "client", clientId });
    else setErreur(cl.motDePasse ? "Mot de passe incorrect." : "Le numéro de téléphone ne correspond pas à ce compte.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: C.bg,
      backgroundImage: `radial-gradient(circle, rgba(36,26,21,0.05) 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600;700&display=swap');
        * { font-family: 'Public Sans', sans-serif; }
      `}</style>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <ClaieBadge size={64}><Leaf size={28} /></ClaieBadge>
          <h1 className="text-2xl font-bold mt-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>HÉLÈNE Multiservices</h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>Attiéké · Bouaflé</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          {/* Onglets */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button onClick={() => { setTab("gerant"); setErreur(""); }}
              className="py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: tab === "gerant" ? C.green : C.bgAlt, color: tab === "gerant" ? "#fff" : C.ink }}>
              <Lock size={14} /> Gérant
            </button>
            <button onClick={() => { setTab("client"); setErreur(""); }}
              className="py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: tab === "client" ? C.green : C.bgAlt, color: tab === "client" ? "#fff" : C.ink }}>
              <Users size={14} /> Client
            </button>
          </div>

          {tab === "gerant" ? (
            modeRecup ? (
              <>
                {!recup ? (
                  <p className="text-sm text-center mb-3" style={{ color: C.chili }}>
                    Aucune question de récupération n'a été configurée dans Paramètres. Contactez le support pour réinitialiser le code.
                  </p>
                ) : recupOK ? (
                  <>
                    <p className="text-xs mb-2 font-semibold" style={{ color: C.greenDeep }}>Réponse correcte ! Définissez votre nouveau code :</p>
                    <Field label="Nouveau code d'accès">
                      <input type="password" inputMode="numeric" value={nouveauPin}
                        onChange={(e) => { setNouveauPin(e.target.value); setErreur(""); }}
                        onKeyDown={(e) => e.key === "Enter" && definirNouveauPin()}
                        className="w-full px-3 py-3 rounded-lg text-center text-lg tracking-widest" style={inputStyle} />
                    </Field>
                    <button onClick={definirNouveauPin} disabled={!nouveauPin}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                      Enregistrer et me connecter
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs mb-2 font-semibold" style={{ color: C.ink }}>{recup.question}</p>
                    <Field label="Votre réponse">
                      <input value={reponseRecup}
                        onChange={(e) => { setReponseRecup(e.target.value); setErreur(""); }}
                        onKeyDown={(e) => e.key === "Enter" && verifierRecup()}
                        className="w-full px-3 py-3 rounded-lg text-sm" style={inputStyle} />
                    </Field>
                    <button onClick={verifierRecup} disabled={!reponseRecup}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                      Vérifier
                    </button>
                  </>
                )}
                <button onClick={() => { setModeRecup(false); setRecupOK(false); setErreur(""); }}
                  className="w-full text-center text-xs mt-3" style={{ color: C.inkSoft }}>
                  ← Retour à la connexion
                </button>
              </>
            ) : (
            <>
              <Field label="Code d'accès gérant">
                <input type="password" inputMode="numeric" value={pin}
                  onChange={(e) => { setPin(e.target.value); setErreur(""); }}
                  onKeyDown={(e) => e.key === "Enter" && connecterGerant()}
                  placeholder="••••"
                  className="w-full px-3 py-3 rounded-lg text-center text-lg tracking-widest" style={inputStyle} />
              </Field>
              <button onClick={connecterGerant} disabled={!pin}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                Accéder à la gestion
              </button>
              <button onClick={() => { setModeRecup(true); setErreur(""); }}
                className="w-full text-center text-xs mt-3 font-semibold" style={{ color: C.greenDeep }}>
                Code oublié ?
              </button>
            </>
            )
          ) : (
            <>
              <Field label="Votre compte">
                <select value={clientId} onChange={(e) => { setClientId(e.target.value); setErreur(""); }}
                  className="w-full px-3 py-2.5 rounded-lg text-sm" style={inputStyle}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </Field>
              <Field label={clients.find((c) => c.id === clientId)?.motDePasse ? "Votre mot de passe" : "Votre numéro de téléphone (vérification)"}>
                <input type={clients.find((c) => c.id === clientId)?.motDePasse ? "password" : "tel"} value={telSaisi}
                  onChange={(e) => { setTelSaisi(e.target.value); setErreur(""); }}
                  onKeyDown={(e) => e.key === "Enter" && connecterClient()}
                  placeholder="07 xx xx xx xx"
                  className="w-full px-3 py-3 rounded-lg text-sm" style={inputStyle} />
              </Field>
              <button onClick={connecterClient} disabled={!telSaisi}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                Accéder à mon espace
              </button>
              <p className="text-[11px] text-center mt-3" style={{ color: C.inkSoft }}>
                Saisissez le numéro enregistré sur votre compte.
              </p>
            </>
          )}

          {erreur && (
            <p className="text-xs text-center mt-3 font-semibold" style={{ color: C.chili }}>{erreur}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ESPACE CLIENT (aperçu)
--------------------------------------------------------- */
function ClientPortal({ clients, produits, commandes, documents, activeClientId, setActiveClientId, montantCommande, montantReste, nomProduit, updateCommandes, updateClients, signature, ajouterNotif, isGerant, onExit }) {
  const [cart, setCart] = useState({});
  const [moyen, setMoyen] = useState("Mobile Money");
  const [jour, setJour] = useState(todayISO());
  const [placed, setPlaced] = useState(false);
  const [recuOuvert, setRecuOuvert] = useState(null);
  const [catOuverte, setCatOuverte] = useState(null); // catégorie de produits dépliée
  const [signalerPour, setSignalerPour] = useState(null); // id de la commande en cours de signalement
  const [montantSignale, setMontantSignale] = useState("");
  const [moyenSignale, setMoyenSignale] = useState("Mobile Money");
  const [showMdp, setShowMdp] = useState(false);
  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpConfirme, setMdpConfirme] = useState("");
  const [msgMdp, setMsgMdp] = useState(null);
  const [zoneId, setZoneId] = useState("bouafle");
  const [emballage, setEmballage] = useState(false);

  const mesCommandes = commandes.filter((c) => c.clientId === activeClientId);
  const mesRecus = (documents || []).filter((d) => d.type === "recu" && d.clientId === activeClientId);
  const totalDu = mesCommandes.reduce((s, c) => s + montantReste(c), 0);
  const client = clients.find((c) => c.id === activeClientId);

  const cartTotal = Object.entries(cart).reduce((s, [pid, qte]) => {
    const p = produits.find((x) => x.id === pid);
    return s + (p ? p.prix * qte : 0);
  }, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([produitId, qte]) => ({ produitId, qte }));
  const zone = ZONES_LIVRAISON.find((z) => z.id === zoneId);
  const nbSacs = compterSacs(cartItems, produits);
  const fraisTransport = zone.tarif * nbSacs;
  const fraisEmballage = emballage ? TARIF_EMBALLAGE * nbSacs : 0;
  const totalAvecFrais = cartTotal + fraisTransport + fraisEmballage;

  const passerCommande = () => {
    if (cartItems.length === 0) return;
    const nouvelle = {
      id: "o" + Date.now(), clientId: activeClientId, date: todayISO(), items: cartItems,
      statut: "impayé", moyenPaiement: moyen, jourPaiement: jour,
      zone: zone.tarif > 0 ? zone.label : null,
      nbSacs: (fraisTransport > 0 || fraisEmballage > 0) ? nbSacs : 0,
      fraisTransport, fraisEmballage,
    };
    updateCommandes([...commandes, nouvelle]);
    if (!isGerant && ajouterNotif) {
      const total = cartTotal + fraisTransport + fraisEmballage;
      ajouterNotif(`🛒 Nouvelle commande de ${client?.nom || "un client"} — ${fcfa(total)}`);
    }
    setCart({}); setZoneId("bouafle"); setEmballage(false); setPlaced(true);
    setTimeout(() => setPlaced(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* HEADER CLIENT */}
      <header className="p-5 flex items-center justify-between" style={{ background: C.ink, color: "#F5F1E6" }}>
        <div className="flex items-center gap-3">
          <ClaieBadge size={40}><Store size={18} /></ClaieBadge>
          <div>
            <div className="font-bold" style={{ fontFamily: "'Fraunces', serif" }}>Espace Client — HÉLÈNE Multiservices</div>
            <div className="text-xs opacity-60">{isGerant ? "Aperçu de ce que voit un client connecté" : "Bienvenue dans votre espace"}</div>
          </div>
        </div>
        <button onClick={onExit} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.1)" }}>
          {isGerant ? (<><ArrowLeft size={14} /> Retour gérant</>) : (<><LogOut size={14} /> Déconnexion</>)}
        </button>
      </header>

      <div className="p-5 md:p-8 flex-1 overflow-y-auto">
        {isGerant && (
          <Field label="Connecté en tant que (simulation de connexion)">
            <select value={activeClientId || ""} onChange={(e) => setActiveClientId(e.target.value)} className="px-3 py-2 rounded-lg text-sm max-w-xs" style={inputStyle}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
        )}

        <div className="grid md:grid-cols-3 gap-4 my-6">
          <div className="md:col-span-2 rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="font-bold mb-1" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Bonjour {client?.nom}</h3>
            <p className="text-sm mb-4" style={{ color: C.inkSoft }}>Voici le récapitulatif de vos commandes.</p>
            <div className="flex gap-4">
              <div className="flex-1 rounded-xl p-4" style={{ background: totalDu > 0 ? C.chiliSoft : C.greenSoft }}>
                <div className="text-xs font-semibold" style={{ color: totalDu > 0 ? C.chili : C.greenDeep }}>Solde dû</div>
                <div className="text-xl font-bold mono" style={{ color: totalDu > 0 ? C.chili : C.greenDeep }}>{fcfa(totalDu)}</div>
              </div>
              <div className="flex-1 rounded-xl p-4" style={{ background: C.bgAlt }}>
                <div className="text-xs font-semibold" style={{ color: C.inkSoft }}>Commandes passées</div>
                <div className="text-xl font-bold mono" style={{ color: C.ink }}>{mesCommandes.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-2"><Wallet size={16} style={{ color: C.green }} /><span className="text-xs font-semibold" style={{ color: C.inkSoft }}>Moyens de paiement acceptés</span></div>
            <div className="flex flex-wrap gap-2">
              {[["Mobile Money", Smartphone], ["Espèces", Banknote], ["Virement", CreditCard]].map(([label, Icon]) => (
                <span key={label} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full" style={{ background: C.bgAlt, color: C.ink }}>
                  <Icon size={12} /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RÉCAP COMMANDES */}
        <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Mes commandes</h3>
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          {mesCommandes.length === 0 && <div className="p-5 text-sm" style={{ color: C.inkSoft }}>Aucune commande pour l'instant.</div>}
          {mesCommandes.slice().reverse().map((cmd) => (
            <div key={cmd.id} className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{cmd.items.map((it) => `${it.qte}× ${nomProduit(it.produitId)}`).join(", ")}</div>
                  <div className="text-xs" style={{ color: C.inkSoft }}>{fmtDate(cmd.date)} · {cmd.moyenPaiement} · échéance {fmtDate(cmd.jourPaiement)}</div>
                  {(cmd.fraisTransport > 0 || cmd.fraisEmballage > 0) && (
                    <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                      {cmd.fraisTransport > 0 && <>Transport : {fcfa(cmd.fraisTransport)}</>}
                      {cmd.fraisTransport > 0 && cmd.fraisEmballage > 0 && " · "}
                      {cmd.fraisEmballage > 0 && <>Emballage : {fcfa(cmd.fraisEmballage)}</>}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1 shrink-0">
                  <span className="mono text-sm font-semibold" style={{ color: C.ink }}>{fcfa(montantCommande(cmd))}</span>
                  <Badge statut={cmd.statut} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: cmd.livree ? C.greenSoft : C.goldSoft, color: cmd.livree ? C.greenDeep : "#8A5D14" }}>
                    {cmd.livree ? `LIVRÉE${cmd.dateLivraison ? " le " + fmtDate(cmd.dateLivraison) : ""}` : "EN PRÉPARATION"}
                  </span>
                  {cmd.statut === "partiel" && (
                    <span className="text-[11px] mono" style={{ color: C.gold }}>reste {fcfa(montantReste(cmd))}</span>
                  )}
                </div>
              </div>
              {cmd.statut !== "payé" && (
                cmd.paiementSignale ? (
                  <div className="text-xs mt-2 font-semibold flex items-center gap-1" style={{ color: C.gold }}>
                    <Clock size={12} /> Paiement signalé{typeof cmd.paiementSignale === "object" ? ` (${fcfa(cmd.paiementSignale.montant)} par ${cmd.paiementSignale.moyen})` : ""} — en attente de confirmation par HÉLÈNE Multiservices
                  </div>
                ) : signalerPour === cmd.id ? (
                  <div className="mt-3 rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: C.ink }}>
                      Quel montant avez-vous versé ? (reste dû : {fcfa(montantReste(cmd))})
                    </div>
                    <input type="number" value={montantSignale}
                      onChange={(e) => setMontantSignale(e.target.value)}
                      placeholder={String(montantReste(cmd))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm mono text-center mb-2" style={inputStyle} />
                    <select value={moyenSignale} onChange={(e) => setMoyenSignale(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm mb-2" style={inputStyle}>
                      <option>Mobile Money</option><option>Espèces</option><option>Virement</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setSignalerPour(null); setMontantSignale(""); }}
                        className="py-2 rounded-lg text-xs font-semibold" style={{ background: C.bgAlt, color: C.ink }}>
                        Annuler
                      </button>
                      <button
                        disabled={!(Number(montantSignale) > 0)}
                        onClick={() => {
                          updateCommandes(commandes.map((c) => c.id === cmd.id
                            ? { ...c, paiementSignale: { montant: Number(montantSignale), moyen: moyenSignale, date: todayISO() } }
                            : c));
                          if (!isGerant && ajouterNotif) {
                            ajouterNotif(`💰 ${client?.nom || "Un client"} signale un versement de ${fcfa(Number(montantSignale))} par ${moyenSignale}`);
                          }
                          setSignalerPour(null); setMontantSignale("");
                        }}
                        className="py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                        Envoyer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSignalerPour(cmd.id); setMontantSignale(""); setMoyenSignale(cmd.moyenPaiement || "Mobile Money"); }}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: C.greenSoft, color: C.greenDeep }}>
                    <Check size={12} /> J'ai effectué un paiement
                  </button>
                )
              )}
            </div>
          ))}
        </div>

        {/* MON COMPTE — changement de mot de passe (client réel uniquement) */}
        {!isGerant && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <button onClick={() => setShowMdp(!showMdp)} className="w-full flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: C.ink }}>🔒 Mon mot de passe</span>
              <ChevronRight size={16} style={{ color: C.inkSoft, transform: showMdp ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {showMdp && (
              <div className="mt-3">
                <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                  {client?.motDePasse
                    ? "Modifiez votre mot de passe de connexion."
                    : "Vous vous connectez actuellement avec votre numéro de téléphone. Définissez un mot de passe personnel pour plus de sécurité."}
                </p>
                <Field label={client?.motDePasse ? "Mot de passe actuel" : "Votre numéro de téléphone (vérification)"}>
                  <input type="password" value={mdpActuel} onChange={(e) => { setMdpActuel(e.target.value); setMsgMdp(null); }}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </Field>
                <Field label="Nouveau mot de passe (4 caractères minimum)">
                  <input type="password" value={mdpNouveau} onChange={(e) => { setMdpNouveau(e.target.value); setMsgMdp(null); }}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </Field>
                <Field label="Confirmer le nouveau mot de passe">
                  <input type="password" value={mdpConfirme} onChange={(e) => { setMdpConfirme(e.target.value); setMsgMdp(null); }}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </Field>
                <button
                  disabled={!mdpActuel || !mdpNouveau || !mdpConfirme}
                  onClick={() => {
                    const normalise = (s) => (s || "").replace(/\D/g, "");
                    const actuelOK = client?.motDePasse
                      ? mdpActuel === client.motDePasse
                      : normalise(mdpActuel) === normalise(client?.tel);
                    if (!actuelOK) { setMsgMdp({ ok: false, texte: client?.motDePasse ? "Mot de passe actuel incorrect." : "Numéro de téléphone incorrect." }); return; }
                    if (mdpNouveau.length < 4) { setMsgMdp({ ok: false, texte: "Le mot de passe doit contenir au moins 4 caractères." }); return; }
                    if (mdpNouveau !== mdpConfirme) { setMsgMdp({ ok: false, texte: "Les deux mots de passe ne correspondent pas." }); return; }
                    updateClients(clients.map((c) => c.id === activeClientId ? { ...c, motDePasse: mdpNouveau } : c));
                    setMdpActuel(""); setMdpNouveau(""); setMdpConfirme("");
                    setMsgMdp({ ok: true, texte: "Mot de passe enregistré. Utilisez-le à votre prochaine connexion." });
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ background: C.green }}>
                  Enregistrer le mot de passe
                </button>
                {msgMdp && <p className="text-xs text-center mt-2 font-semibold" style={{ color: msgMdp.ok ? C.greenDeep : C.chili }}>{msgMdp.texte}</p>}
              </div>
            )}
          </div>
        )}

        {/* MES REÇUS */}
        {mesRecus.length > 0 && (
          <>
            <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Mes reçus de paiement</h3>
            <div className="rounded-2xl overflow-hidden mb-8" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {mesRecus.slice().reverse().map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: C.greenSoft, color: C.greenDeep }}>Reçu</span>
                      <span className="mono text-xs font-semibold" style={{ color: C.inkSoft }}>{r.numero}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.inkSoft }}>{fmtDate(r.date)} · {r.moyenPaiement}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="mono text-sm font-semibold" style={{ color: C.greenDeep }}>{fcfa(r.montantRecu)}</span>
                    <button onClick={() => setRecuOuvert(r)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: C.greenSoft, color: C.greenDeep }}>
                      <Eye size={13} /> Voir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* NOUVELLE COMMANDE */}
        <h3 className="font-bold mb-3" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Passer une nouvelle commande</h3>
        <div className="mb-6 space-y-3">
          {(() => {
            // Regroupement des produits par famille
            const categoriser = (p) => {
              const u = (p.unite || "").toLowerCase();
              if (u === "kg" || u.includes("tonne")) return "Grosses commandes (kg · tonne)";
              if (u === "boule") return "Boules";
              if (u.includes("250 boules")) return "Sacs de 250 boules";
              if (u.includes("200 boules")) return "Sacs de 200 boules";
              if (u.includes("bassine")) return "Bassines";
              return "Autres";
            };
            const ORDRE = ["Boules", "Sacs de 250 boules", "Sacs de 200 boules", "Bassines", "Grosses commandes (kg · tonne)", "Autres"];
            const groupes = {};
            produits.forEach((p) => {
              const cat = categoriser(p);
              (groupes[cat] = groupes[cat] || []).push(p);
            });

            return ORDRE.filter((cat) => groupes[cat]?.length).map((cat) => {
              const liste = groupes[cat];
              const ouvert = catOuverte === cat;
              const nbChoisis = liste.reduce((s, p) => s + (cart[p.id] || 0), 0);
              return (
                <div key={cat} className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${ouvert ? C.green : C.border}` }}>
                  {/* En-tête de catégorie */}
                  <button onClick={() => setCatOuverte(ouvert ? null : cat)}
                    className="w-full flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{liste[0].emoji}</span>
                      <div className="text-left">
                        <div className="text-sm font-bold" style={{ color: C.ink }}>{cat}</div>
                        <div className="text-xs" style={{ color: C.inkSoft }}>{liste.length} produit(s)</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {nbChoisis > 0 && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: C.green }}>{nbChoisis}</span>
                      )}
                      <ChevronRight size={18} style={{ color: C.inkSoft, transform: ouvert ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                    </div>
                  </button>

                  {/* Produits de la catégorie */}
                  {ouvert && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      {liste.map((p) => {
                        const u = (p.unite || "").toLowerCase();
                        const estVrac = u === "kg" || u.includes("tonne");
                        const qte = cart[p.id] || 0;
                        return (
                          <div key={p.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold" style={{ color: C.ink }}>{p.nom}</div>
                                <div className="text-xs mono" style={{ color: C.inkSoft }}>{fcfa(p.prix)} / {p.unite}</div>
                              </div>
                              {estVrac ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="number" min="0" value={qte || ""}
                                    onChange={(e) => setCart({ ...cart, [p.id]: Math.max(0, Number(e.target.value) || 0) })}
                                    placeholder="0"
                                    className="w-20 px-2 py-2 rounded-lg text-sm mono text-center" style={inputStyle} />
                                  <span className="text-xs" style={{ color: C.inkSoft }}>{u === "kg" ? "kg" : "t"}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button onClick={() => setCart({ ...cart, [p.id]: Math.max(0, qte - 1) })} className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{ background: C.bgAlt, color: C.ink }}>–</button>
                                  <span className="w-6 text-center text-sm font-semibold" style={{ color: qte > 0 ? C.greenDeep : C.ink }}>{qte}</span>
                                  <button onClick={() => setCart({ ...cart, [p.id]: qte + 1 })} className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ background: C.green }}>+</button>
                                </div>
                              )}
                            </div>
                            {estVrac && qte > 0 && (
                              <div className="flex justify-between mt-2 text-xs rounded-lg px-3 py-1.5" style={{ background: C.greenSoft }}>
                                <span style={{ color: C.greenDeep }}>{qte} {u === "kg" ? "kg" : "tonne(s)"} × {fcfa(p.prix)}</span>
                                <span className="mono font-bold" style={{ color: C.greenDeep }}>{fcfa(qte * p.prix)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {cartCount > 0 && (
          <div className="rounded-2xl p-5 mb-8" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold" style={{ color: C.ink }}>{cartCount} article(s) sélectionné(s)</span>
              <span className="mono font-bold" style={{ color: C.greenDeep }}>{fcfa(totalAvecFrais)}</span>
            </div>

            {/* Livraison & emballage */}
            <Field label="Livraison (transport par sac)">
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                {ZONES_LIVRAISON.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={emballage} onChange={(e) => setEmballage(e.target.checked)}
                className="w-4 h-4" style={{ accentColor: C.green }} />
              <span className="text-sm" style={{ color: C.ink }}>Emballage ({fcfa(TARIF_EMBALLAGE)}/sac)</span>
            </label>

            {(fraisTransport > 0 || fraisEmballage > 0) && (
              <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Produits</span><span className="mono" style={{ color: C.ink }}>{fcfa(cartTotal)}</span></div>
                {fraisTransport > 0 && <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Transport ({nbSacs} sac·s)</span><span className="mono" style={{ color: C.ink }}>{fcfa(fraisTransport)}</span></div>}
                {fraisEmballage > 0 && <div className="flex justify-between py-0.5"><span style={{ color: C.inkSoft }}>Emballage ({nbSacs} sac·s)</span><span className="mono" style={{ color: C.ink }}>{fcfa(fraisEmballage)}</span></div>}
                <div className="flex justify-between pt-2 mt-1 font-bold" style={{ borderTop: `1px solid ${C.border}`, color: C.greenDeep }}>
                  <span>Total</span><span className="mono">{fcfa(totalAvecFrais)}</span>
                </div>
              </div>
            )}
            {zone.tarif > 0 && nbSacs === 0 && (
              <p className="text-xs mb-3" style={{ color: C.gold }}>
                Le transport est facturé par sac de boules. Pour les grosses commandes (kg · tonne), la livraison est organisée directement avec HÉLÈNE Multiservices.
              </p>
            )}
            {zone.tarif > 0 && nbSacs > 0 && cartItems.some((it) => {
              const p = produits.find((x) => x.id === it.produitId);
              const u = (p?.unite || "").toLowerCase();
              return u === "kg" || u.includes("tonne");
            }) && (
              <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                Le transport ci-dessus ne concerne que les sacs. Pour la partie au kg / à la tonne, la livraison sera organisée directement avec HÉLÈNE Multiservices.
              </p>
            )}

            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <Field label="Moyen de paiement choisi">
                <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  <option>Mobile Money</option><option>Espèces</option><option>Virement</option>
                </select>
              </Field>
              <Field label="Jour de paiement souhaité">
                <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </Field>
            </div>
            <button onClick={passerCommande} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.green }}>
              <Check size={16} /> Confirmer la commande
            </button>
            {placed && <p className="text-xs text-center mt-2" style={{ color: C.greenDeep }}>Commande enregistrée — le gérant la voit immédiatement.</p>}
          </div>
        )}
      </div>

      {recuOuvert && (
        <DocPreviewModal doc={recuOuvert} client={clients.find((c) => c.id === recuOuvert.clientId)} signature={signature} onClose={() => setRecuOuvert(null)} />
      )}
    </div>
  );
}
