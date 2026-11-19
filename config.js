// Einstellungen für den Shop Prototyp.
// Supabase: Projekt URL und den "anon public" Schlüssel aus
// Supabase > Project Settings > API hier eintragen. Der anon Schlüssel ist für
// den Browser gedacht und darf öffentlich sein; geschützt wird über die Regeln in supabase.sql.
window.SHOP_CONFIG = {
  marke: "GILT & GRIT",          // Arbeitstitel, später durch den echten Markennamen ersetzen
  untertitel: "Fine Art Prints mit Haltung",
  supabaseUrl: "",                // z.B. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",            // beginnt mit "eyJ..." oder "sb_publishable_..."
  preise: [
    { groesse: "30 × 40 cm", preis: 59 },
    { groesse: "50 × 70 cm", preis: 99 },
    { groesse: "70 × 100 cm", preis: 159 },
  ],
};
